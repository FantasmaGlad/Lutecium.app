from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import pytest_asyncio

from app.config import settings
from app.core.cleanup import _expire_done_downloads, _purge_orphan_directories
from app.core.db import async_session_maker, init_db
from app.models.download import Download, DownloadStatus


@pytest_asyncio.fixture(autouse=True)
async def _fresh_db():
    await init_db()
    yield
    async with async_session_maker() as session:
        await session.execute(Download.__table__.delete())
        await session.commit()


@pytest.mark.asyncio
async def test_expire_done_downloads_removes_old_files(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "downloads_dir", str(tmp_path))
    job_dir = tmp_path / "1"
    job_dir.mkdir()
    (job_dir / "video.mp4").write_bytes(b"contenu")

    old_time = datetime.now(timezone.utc) - timedelta(minutes=settings.file_ttl_minutes + 1)
    async with async_session_maker() as session:
        download = Download(id=1, url="https://example.com/x", status=DownloadStatus.DONE, filename="video.mp4")
        session.add(download)
        await session.commit()
        # updated_at est auto-généré : on le force manuellement pour simuler l'ancienneté.
        await session.execute(
            Download.__table__.update().where(Download.id == 1).values(updated_at=old_time)
        )
        await session.commit()

    await _expire_done_downloads()

    assert not job_dir.exists()
    async with async_session_maker() as session:
        refreshed = await session.get(Download, 1)
        assert refreshed.status == DownloadStatus.EXPIRED


@pytest.mark.asyncio
async def test_expire_done_downloads_keeps_recent_files(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "downloads_dir", str(tmp_path))
    job_dir = tmp_path / "2"
    job_dir.mkdir()
    (job_dir / "video.mp4").write_bytes(b"contenu")

    async with async_session_maker() as session:
        download = Download(id=2, url="https://example.com/y", status=DownloadStatus.DONE, filename="video.mp4")
        session.add(download)
        await session.commit()

    await _expire_done_downloads()

    assert job_dir.exists()


def test_purge_orphan_directories_removes_stale(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "downloads_dir", str(tmp_path))
    stale_dir = tmp_path / "99"
    stale_dir.mkdir()
    old_mtime = (datetime.now(timezone.utc) - timedelta(minutes=60)).timestamp()
    Path(stale_dir).touch()
    import os

    os.utime(stale_dir, (old_mtime, old_mtime))

    import asyncio

    asyncio.run(_purge_orphan_directories())

    assert not stale_dir.exists()
