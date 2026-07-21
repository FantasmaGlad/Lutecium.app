import asyncio
import logging
import shutil
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.db import async_session_maker
from app.core.runtime_settings import refresh_cache
from app.core import effective_settings
from app.models.download import Download, DownloadStatus
from app.models.guest_download import GuestDownload

log = logging.getLogger(__name__)

_CHECK_INTERVAL_SECONDS = 30
_ORPHAN_SAFETY_MULTIPLIER = 3  # filet de sécurité §F-31 : par défaut 3 × 5 min = 15 min


async def cleanup_loop() -> None:
    while True:
        try:
            await refresh_cache()  # overrides admin (table settings, P2-08)
            await _expire_done_downloads()
            await _purge_orphan_directories()
            await _purge_old_guest_downloads()
        except Exception:  # noqa: BLE001 — le nettoyage ne doit jamais interrompre le service
            log.exception("Erreur pendant le nettoyage périodique")
        await asyncio.sleep(_CHECK_INTERVAL_SECONDS)


async def _purge_old_guest_downloads() -> None:
    """§8 : `guest_downloads` est purgée quotidiennement (le sel de l'IP change chaque jour)."""
    today = date.today()
    async with async_session_maker() as session:
        result = await session.execute(select(GuestDownload))
        for record in result.scalars().all():
            if record.created_at.date() != today:
                await session.delete(record)
        await session.commit()


async def _expire_done_downloads() -> None:
    """F-30 : les fichiers `done` expirent après FILE_TTL_MINUTES."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=effective_settings.file_ttl_minutes())
    async with async_session_maker() as session:
        result = await session.execute(
            select(Download).where(Download.status == DownloadStatus.DONE, Download.updated_at < cutoff)
        )
        for download in result.scalars().all():
            job_dir = Path(settings.downloads_dir) / str(download.id)
            shutil.rmtree(job_dir, ignore_errors=True)
            download.status = DownloadStatus.EXPIRED
        await session.commit()


_ACTIVE_STATUSES = (DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING)


async def purge_all_download_files(db: AsyncSession) -> int:
    """A-14 : action rapide « Purger les fichiers ». Ne touche jamais aux jobs actifs
    (téléchargement/traitement en cours) — seulement les fichiers déjà `done`/orphelins."""
    active_ids = set(
        (await db.execute(select(Download.id).where(Download.status.in_(_ACTIVE_STATUSES)))).scalars().all()
    )
    root = Path(settings.downloads_dir)
    removed = 0
    if root.exists():
        for job_dir in root.iterdir():
            if not job_dir.is_dir():
                continue
            if job_dir.name.isdigit() and int(job_dir.name) in active_ids:
                continue
            shutil.rmtree(job_dir, ignore_errors=True)
            removed += 1

    result = await db.execute(select(Download).where(Download.status == DownloadStatus.DONE))
    for download in result.scalars().all():
        download.status = DownloadStatus.EXPIRED
    await db.commit()
    return removed


async def _purge_orphan_directories() -> None:
    """F-31 : filet de sécurité, purge tout répertoire de job trop ancien quel que soit son statut."""
    root = Path(settings.downloads_dir)
    if not root.exists():
        return
    max_age_seconds = effective_settings.file_ttl_minutes() * 60 * _ORPHAN_SAFETY_MULTIPLIER
    now = time.time()
    for job_dir in root.iterdir():
        if job_dir.is_dir() and (now - job_dir.stat().st_mtime) > max_age_seconds:
            shutil.rmtree(job_dir, ignore_errors=True)
