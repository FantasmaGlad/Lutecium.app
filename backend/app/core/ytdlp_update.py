"""A-14 : mise à jour manuelle de yt-dlp depuis le dashboard admin (cf. M-01 pour la version nightly)."""

import asyncio
import importlib

from app.core.db import async_session_maker
from app.models.download import Download, DownloadStatus
from sqlalchemy import func, select

_ACTIVE_STATUSES = (DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING)


class UpdateInProgressError(Exception):
    pass


async def update_yt_dlp() -> str:
    async with async_session_maker() as session:
        active = await session.scalar(
            select(func.count()).select_from(Download).where(Download.status.in_(_ACTIVE_STATUSES))
        )
    if active:
        raise UpdateInProgressError("Des téléchargements sont en cours ; réessaie une fois la file vide.")

    process = await asyncio.create_subprocess_exec(
        "pip",
        "install",
        "--upgrade",
        "yt-dlp",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    await process.communicate()
    if process.returncode != 0:
        raise RuntimeError("La mise à jour de yt-dlp a échoué.")

    import yt_dlp

    importlib.reload(yt_dlp.version)
    return yt_dlp.version.__version__
