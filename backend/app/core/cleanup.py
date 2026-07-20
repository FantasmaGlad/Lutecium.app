import asyncio
import logging
import shutil
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.core.db import async_session_maker
from app.models.download import Download, DownloadStatus

log = logging.getLogger(__name__)

_CHECK_INTERVAL_SECONDS = 30
_ORPHAN_SAFETY_MULTIPLIER = 3  # filet de sécurité §F-31 : par défaut 3 × 5 min = 15 min


async def cleanup_loop() -> None:
    while True:
        try:
            await _expire_done_downloads()
            await _purge_orphan_directories()
        except Exception:  # noqa: BLE001 — le nettoyage ne doit jamais interrompre le service
            log.exception("Erreur pendant le nettoyage périodique")
        await asyncio.sleep(_CHECK_INTERVAL_SECONDS)


async def _expire_done_downloads() -> None:
    """F-30 : les fichiers `done` expirent après FILE_TTL_MINUTES."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.file_ttl_minutes)
    async with async_session_maker() as session:
        result = await session.execute(
            select(Download).where(Download.status == DownloadStatus.DONE, Download.updated_at < cutoff)
        )
        for download in result.scalars().all():
            job_dir = Path(settings.downloads_dir) / str(download.id)
            shutil.rmtree(job_dir, ignore_errors=True)
            download.status = DownloadStatus.EXPIRED
        await session.commit()


async def _purge_orphan_directories() -> None:
    """F-31 : filet de sécurité, purge tout répertoire de job trop ancien quel que soit son statut."""
    root = Path(settings.downloads_dir)
    if not root.exists():
        return
    max_age_seconds = settings.file_ttl_minutes * 60 * _ORPHAN_SAFETY_MULTIPLIER
    now = time.time()
    for job_dir in root.iterdir():
        if job_dir.is_dir() and (now - job_dir.stat().st_mtime) > max_age_seconds:
            shutil.rmtree(job_dir, ignore_errors=True)
