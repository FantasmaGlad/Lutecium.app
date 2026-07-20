import asyncio
import logging
import shutil
import time
from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.core import cancellation
from app.core.db import async_session_maker
from app.core.events import bus
from app.core.quota import record_usage
from app.core.signing import generate_file_token
from app.core.throughput import record_job_duration
from app.core.ytdlp import DownloadCancelledError, DownloadFailedError, run_download
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
            cancellation.clear(job_id)
            work_queue.task_done()


async def _process_job(job_id: int) -> None:
    async with async_session_maker() as session:
        download = await session.get(Download, job_id)
        if download is None or download.status != DownloadStatus.QUEUED:
            return
        download.status = DownloadStatus.DOWNLOADING
        url, options, user_id = download.url, download.options or {}, download.user_id
        await session.commit()

    bus.publish(job_id, {"event": "downloading", "data": {}})

    def on_progress(d: dict) -> None:
        if cancellation.is_cancelled(job_id):
            raise DownloadCancelledError()
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

    started_at = time.monotonic()
    try:
        final_path, size_bytes = await asyncio.to_thread(
            run_download, url, options, job_dir, on_progress, on_postprocessor
        )
    except DownloadCancelledError:
        await _mark_cancelled(job_id, job_dir)
        return
    except DownloadFailedError as exc:
        await _mark_failed(job_id, exc.message, job_dir)
        return
    except Exception as exc:  # noqa: BLE001 — capturé pour toujours notifier le client (F-16)
        await _mark_failed(job_id, "Une erreur inattendue est survenue pendant le téléchargement.", job_dir)
        log.exception("Échec inattendu du job %s: %s", job_id, exc)
        return

    record_job_duration(time.monotonic() - started_at)

    async with async_session_maker() as session:
        download = await session.get(Download, job_id)
        download.status = DownloadStatus.DONE
        download.filename = final_path.name
        download.size_bytes = size_bytes
        await session.commit()
        if user_id is not None:
            await record_usage(session, user_id, size_bytes)  # §6, quota journalier

    file_url = f"/api/files/{generate_file_token(job_id)}"
    bus.publish(
        job_id,
        {"event": "done", "data": {"filename": final_path.name, "size_bytes": size_bytes, "file_url": file_url}},
    )


async def _mark_failed(job_id: int, message: str, job_dir: Path) -> None:
    _cleanup_dir(job_dir)  # F-32 : téléchargement échoué → suppression immédiate
    async with async_session_maker() as session:
        download = await session.get(Download, job_id)
        if download is not None:
            download.status = DownloadStatus.FAILED
            download.error_message = message
            await session.commit()
    bus.publish(job_id, {"event": "failed", "data": {"message": message}})


async def _mark_cancelled(job_id: int, job_dir: Path) -> None:
    _cleanup_dir(job_dir)  # F-32 : téléchargement annulé → suppression immédiate
    async with async_session_maker() as session:
        download = await session.get(Download, job_id)
        if download is not None:
            download.status = DownloadStatus.CANCELLED
            await session.commit()
    bus.publish(job_id, {"event": "cancelled", "data": {}})


def _cleanup_dir(job_dir: Path) -> None:
    shutil.rmtree(job_dir, ignore_errors=True)
