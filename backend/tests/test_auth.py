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
async def test_register_then_me(client):
    response = await client.post("/api/auth/register", json={"pseudo": "alice", "password": "motdepasse123"})
    assert response.status_code == 200
    assert response.json()["pseudo"] == "alice"

    me = await client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["pseudo"] == "alice"


@pytest.mark.asyncio
async def test_register_duplicate_pseudo_rejected(client):
    await client.post("/api/auth/register", json={"pseudo": "bob", "password": "motdepasse123"})
    response = await client.post("/api/auth/register", json={"pseudo": "bob", "password": "autremdp123"})
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_login_wrong_password_rejected(client):
    await client.post("/api/auth/register", json={"pseudo": "carol", "password": "motdepasse123"})
    await client.post("/api/auth/logout")
    response = await client.post("/api/auth/login", json={"pseudo": "carol", "password": "mauvais-mdp"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_locks_after_five_failures(client):
    await client.post("/api/auth/register", json={"pseudo": "dave", "password": "motdepasse123"})
    await client.post("/api/auth/logout")
    for _ in range(5):
        await client.post("/api/auth/login", json={"pseudo": "dave", "password": "mauvais"})
    response = await client.post("/api/auth/login", json={"pseudo": "dave", "password": "motdepasse123"})
    assert response.status_code == 429


@pytest.mark.asyncio
async def test_me_without_session_is_401(client):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_change_password_requires_current(client):
    await client.post("/api/auth/register", json={"pseudo": "erin", "password": "ancienmdp123"})
    bad = await client.post(
        "/api/auth/change-password", json={"current_password": "faux", "new_password": "nouveaumdp123"}
    )
    assert bad.status_code == 401

    ok = await client.post(
        "/api/auth/change-password", json={"current_password": "ancienmdp123", "new_password": "nouveaumdp123"}
    )
    assert ok.status_code == 200
