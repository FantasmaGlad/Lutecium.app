from httpx import ASGITransport, AsyncClient
import pytest
import pytest_asyncio

from app.core.db import async_session_maker, init_db
from app.core.queue import enqueue, queue_position, reconcile_on_startup
from app.main import create_app
from app.models.download import Download, DownloadStatus


@pytest_asyncio.fixture(autouse=True)
async def _fresh_db():
    await init_db()
    yield
    async with async_session_maker() as session:
        await session.execute(Download.__table__.delete())
        await session.commit()


@pytest.mark.asyncio
async def test_create_download_via_api_returns_position_one():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/downloads", json={"url": "https://example.com/video"})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "queued"
    assert body["position"] == 1


@pytest.mark.asyncio
async def test_second_download_has_position_two(_fresh_db):
    async with async_session_maker() as session:
        first = await enqueue(session, url="https://example.com/a", options={})
        second = await enqueue(session, url="https://example.com/b", options={})

        assert await queue_position(session, first) == 1
        assert await queue_position(session, second) == 2


@pytest.mark.asyncio
async def test_reconcile_marks_orphans_failed_and_leaves_queued_alone(_fresh_db):
    async with async_session_maker() as session:
        queued = await enqueue(session, url="https://example.com/queued", options={})
        orphan = await enqueue(session, url="https://example.com/orphan", options={})
        orphan.status = DownloadStatus.DOWNLOADING
        await session.commit()

        marked = await reconcile_on_startup(session)
        assert marked == 1

        await session.refresh(queued)
        await session.refresh(orphan)
        assert queued.status == DownloadStatus.QUEUED
        assert orphan.status == DownloadStatus.FAILED
        assert orphan.error_message
