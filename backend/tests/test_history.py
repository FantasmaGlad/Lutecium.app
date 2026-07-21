from httpx import ASGITransport, AsyncClient
import pytest
import pytest_asyncio

from app.main import create_app


@pytest_asyncio.fixture
async def client():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_history_requires_auth(client):
    response = await client.get("/api/me/downloads")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_history_lists_own_downloads_newest_first(client):
    await client.post("/api/auth/register", json={"pseudo": "hist_user", "password": "motdepasse123"})

    await client.post("/api/downloads", json={"url": "https://www.youtube.com/watch?v=a"})
    await client.post("/api/downloads", json={"url": "https://tiktok.com/@x/video/b"})

    response = await client.get("/api/me/downloads")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert [item["site"] for item in body["items"]] == ["tiktok.com", "youtube.com"]
    assert body["items"][0]["options"] == {"mode": "video", "max_file_size_gb": 8.0}


@pytest.mark.asyncio
async def test_history_does_not_leak_other_users_downloads(client):
    await client.post("/api/auth/register", json={"pseudo": "hist_a", "password": "motdepasse123"})
    await client.post("/api/downloads", json={"url": "https://example.com/mine"})
    await client.post("/api/auth/logout")

    await client.post("/api/auth/register", json={"pseudo": "hist_b", "password": "motdepasse123"})
    response = await client.get("/api/me/downloads")
    assert response.json()["total"] == 0
