from datetime import datetime, timedelta, timezone

from httpx import ASGITransport, AsyncClient
import pytest
import pytest_asyncio

from app.api import downloads as downloads_module
from app.core.cleanup import _purge_old_guest_downloads
from app.core.db import async_session_maker
from app.main import create_app
from app.models.guest_download import GuestDownload

FAKE_ANALYZE_INFO_URL = "https://example.com/video"


@pytest_asyncio.fixture
async def client(monkeypatch):
    monkeypatch.setattr(downloads_module, "enqueue_job", _noop_enqueue_job)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _noop_enqueue_job(job_id: int) -> None:
    # Évite de vraiment lancer un téléchargement réseau dans ces tests.
    return None


@pytest.mark.asyncio
async def test_guest_can_download_once(client):
    response = await client.post("/api/downloads", json={"url": FAKE_ANALYZE_INFO_URL})
    assert response.status_code == 200
    assert "lutecium_guest" in response.cookies


@pytest.mark.asyncio
async def test_guest_blocked_on_second_download(client):
    await client.post("/api/downloads", json={"url": FAKE_ANALYZE_INFO_URL})
    response = await client.post("/api/downloads", json={"url": FAKE_ANALYZE_INFO_URL})
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "guest_limit_reached"


@pytest.mark.asyncio
async def test_authenticated_user_not_subject_to_guest_limit(client):
    await client.post("/api/auth/register", json={"pseudo": "regular", "password": "motdepasse123"})
    first = await client.post("/api/downloads", json={"url": FAKE_ANALYZE_INFO_URL})
    second = await client.post("/api/downloads", json={"url": FAKE_ANALYZE_INFO_URL})
    assert first.status_code == 200
    assert second.status_code == 200


@pytest.mark.asyncio
async def test_purge_removes_yesterdays_guest_records():
    async with async_session_maker() as session:
        old = GuestDownload(ip_hash="a", guest_cookie="b", count=1)
        session.add(old)
        await session.commit()
        await session.refresh(old)
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        await session.execute(
            GuestDownload.__table__.update().where(GuestDownload.id == old.id).values(created_at=yesterday)
        )
        await session.commit()

    await _purge_old_guest_downloads()

    async with async_session_maker() as session:
        remaining = await session.get(GuestDownload, old.id)
        assert remaining is None
