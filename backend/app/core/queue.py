from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cancellation
from app.core.events import bus
from app.models.download import Download, DownloadStatus


async def enqueue(
    session: AsyncSession, *, url: str, options: dict, user_id: int | None = None, site: str | None = None
) -> Download:
    download = Download(url=url, options=options, status=DownloadStatus.QUEUED, user_id=user_id, site=site)
    session.add(download)
    await session.commit()
    await session.refresh(download)
    return download


async def queue_position(session: AsyncSession, download: Download) -> int:
    """Position 1-based dans la file (0 si le job n'est plus en attente)."""
    if download.status != DownloadStatus.QUEUED:
        return 0
    result = await session.execute(
        select(func.count())
        .select_from(Download)
        .where(Download.status == DownloadStatus.QUEUED, Download.id <= download.id)
    )
    return result.scalar_one()


async def clear_queue(session: AsyncSession) -> int:
    """A-14 : action rapide « Vider la file » — annule les tâches en attente et en cours."""
    result = await session.execute(
        select(Download).where(
            Download.status.in_([DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING])
        )
    )
    jobs = result.scalars().all()
    for job in jobs:
        if job.status == DownloadStatus.QUEUED:
            job.status = DownloadStatus.CANCELLED
            bus.publish(job.id, {"event": "cancelled", "data": {}})
        else:
            cancellation.request_cancel(job.id)
    await session.commit()
    return len(jobs)


async def reconcile_on_startup(session: AsyncSession) -> int:
    """P-03 : au redémarrage, les jobs orphelins (en cours au moment du crash) passent en échec.

    Les jobs `queued` n'ont rien à faire : ils sont déjà prêts à être repris par la file.
    """
    result = await session.execute(
        select(Download).where(Download.status.in_([DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING]))
    )
    orphans = result.scalars().all()
    for job in orphans:
        job.status = DownloadStatus.FAILED
        job.error_message = "Interrompu par un redémarrage du serveur."
    await session.commit()
    return len(orphans)
