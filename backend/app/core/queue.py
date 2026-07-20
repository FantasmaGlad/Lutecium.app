from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.download import Download, DownloadStatus


async def enqueue(session: AsyncSession, *, url: str, options: dict) -> Download:
    download = Download(url=url, options=options, status=DownloadStatus.QUEUED)
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
