import asyncio
import logging
from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.core.db import async_session_maker
from app.core.events import bus
from app.core.ytdlp import DownloadFailedError, run_download
from app.models.download import Download, DownloadStatus

log = logging.getLogger(__name__)

work_queue: asyncio.Queue[int] = asyncio.Queue()


async def enqueue_job(job_id: int) -> None:
    await work_queue.put(job_id)


async def requeue_pending_jobs() -> None:
    """P-03 : au démarrage, les jobs déjà `queued` reprennent leur place dans la file."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Download.id).where(Download.status == DownloadStatus.QUEUED).order_by(Download.id)
        )
        for (job_id,) in result.all():
            await work_queue.put(job_id)


def start_workers() -> list[asyncio.Task]:
    return [asyncio.create_task(_worker_loop()) for _ in range(settings.max_concurrent_downloads)]


async def _worker_loop() -> None:
    while True:
        job_id = await work_queue.get()
        try:
            await _process_job(job_id)
        except Exception:  # noqa: BLE001 — le worker ne doit jamais s'arrêter sur une erreur d'un job
            log.exception("Erreur inattendue en traitant le job %s", job_id)
        finally:
            work_queue.task_done()


async def _process_job(job_id: int) -> None:
    async with async_session_maker() as session:
        download = await session.get(Download, job_id)
        if download is None or download.status != DownloadStatus.QUEUED:
            return
        download.status = DownloadStatus.DOWNLOADING
        url, options = download.url, download.options or {}
        await session.commit()

    bus.publish(job_id, {"event": "downloading", "data": {}})

    def on_progress(d: dict) -> None:
        if d.get("status") == "downloading":
            bus.publish(
                job_id,
                {
                    "event": "progress",
                    "data": {
                        "downloaded_bytes": d.get("downloaded_bytes"),
                        "total_bytes": d.get("total_bytes") or d.get("total_bytes_estimate"),
                        "speed": d.get("speed"),
                        "eta": d.get("eta"),
                    },
                },
            )
        elif d.get("status") == "finished":
            bus.publish(job_id, {"event": "processing", "data": {"step": "assemblage audio + vidéo…"}})

    def on_postprocessor(d: dict) -> None:
        if d.get("status") == "finished":
            bus.publish(job_id, {"event": "processing", "data": {"step": d.get("postprocessor", "")}})

    job_dir = Path(settings.downloads_dir) / str(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        final_path, size_bytes = await asyncio.to_thread(
            run_download, url, options, job_dir, on_progress, on_postprocessor
        )
    except DownloadFailedError as exc:
        await _mark_failed(job_id, str(exc))
        return
    except Exception as exc:  # noqa: BLE001 — capturé pour toujours notifier le client (F-16)
        await _mark_failed(job_id, "Une erreur inattendue est survenue pendant le téléchargement.")
        log.exception("Échec inattendu du job %s: %s", job_id, exc)
        return

    async with async_session_maker() as session:
        download = await session.get(Download, job_id)
        download.status = DownloadStatus.DONE
        download.filename = final_path.name
        download.size_bytes = size_bytes
        await session.commit()

    bus.publish(job_id, {"event": "done", "data": {"filename": final_path.name, "size_bytes": size_bytes}})


async def _mark_failed(job_id: int, message: str) -> None:
    async with async_session_maker() as session:
        download = await session.get(Download, job_id)
        if download is not None:
            download.status = DownloadStatus.FAILED
            download.error_message = message
            await session.commit()
    bus.publish(job_id, {"event": "failed", "data": {"message": message}})
