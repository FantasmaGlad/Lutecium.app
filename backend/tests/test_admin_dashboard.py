from httpx import ASGITransport, AsyncClient
import pytest
import pytest_asyncio

from app.core.auth import hash_password
from app.core.db import async_session_maker
from app.main import create_app
from app.models.user import User, UserRole


@pytest_asyncio.fixture
async def client():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _make_admin(pseudo: str = "admin") -> User:
    async with async_session_maker() as session:
        admin = User(pseudo=pseudo, password_hash=hash_password("adminpass123"), role=UserRole.ADMIN)
        session.add(admin)
        await session.commit()
        await session.refresh(admin)
        return admin


@pytest_asyncio.fixture
async def admin_client(client):
    await _make_admin()
    await client.post("/api/auth/login", json={"pseudo": "admin", "password": "adminpass123"})
    return client


@pytest.mark.asyncio
async def test_list_users_requires_admin(client):
    await client.post("/api/auth/register", json={"pseudo": "regular", "password": "motdepasse123"})
    response = await client.get("/api/admin/users")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_users_includes_registered_accounts(admin_client):
    await admin_client.post("/api/auth/logout")
    await admin_client.post("/api/auth/register", json={"pseudo": "alice", "password": "motdepasse123"})
    await admin_client.post("/api/auth/logout")
    await admin_client.post("/api/auth/login", json={"pseudo": "admin", "password": "adminpass123"})

    response = await admin_client.get("/api/admin/users")
    assert response.status_code == 200
    pseudos = [u["pseudo"] for u in response.json()]
    assert "alice" in pseudos
    assert "admin" in pseudos


@pytest.mark.asyncio
async def test_admin_can_suspend_and_quota_override(admin_client):
    await admin_client.post("/api/auth/logout")
    reg = await admin_client.post("/api/auth/register", json={"pseudo": "bob", "password": "motdepasse123"})
    bob_id = reg.json()["id"]
    await admin_client.post("/api/auth/logout")
    await admin_client.post("/api/auth/login", json={"pseudo": "admin", "password": "adminpass123"})

    patch = await admin_client.patch(f"/api/admin/users/{bob_id}", json={"status": "suspended", "daily_quota_gb": 1})
    assert patch.status_code == 200
    assert patch.json()["status"] == "suspended"
    assert patch.json()["daily_quota_gb"] == 1

    await admin_client.post("/api/auth/logout")
    login = await admin_client.post("/api/auth/login", json={"pseudo": "bob", "password": "motdepasse123"})
    assert login.status_code == 403


@pytest.mark.asyncio
async def test_admin_quota_override_rejects_non_positive_values(admin_client):
    await admin_client.post("/api/auth/logout")
    reg = await admin_client.post("/api/auth/register", json={"pseudo": "dave", "password": "motdepasse123"})
    dave_id = reg.json()["id"]
    await admin_client.post("/api/auth/logout")
    await admin_client.post("/api/auth/login", json={"pseudo": "admin", "password": "adminpass123"})

    for bad_value in (0, -5):
        response = await admin_client.patch(f"/api/admin/users/{dave_id}", json={"daily_quota_gb": bad_value})
        assert response.status_code == 422

    # None reste un moyen valide de revenir au défaut du service.
    response = await admin_client.patch(f"/api/admin/users/{dave_id}", json={"daily_quota_gb": None})
    assert response.status_code == 200
    assert response.json()["daily_quota_gb"] is None


@pytest.mark.asyncio
async def test_admin_can_delete_user(admin_client):
    await admin_client.post("/api/auth/logout")
    reg = await admin_client.post("/api/auth/register", json={"pseudo": "carol", "password": "motdepasse123"})
    carol_id = reg.json()["id"]
    await admin_client.post("/api/auth/logout")
    await admin_client.post("/api/auth/login", json={"pseudo": "admin", "password": "adminpass123"})

    delete = await admin_client.delete(f"/api/admin/users/{carol_id}")
    assert delete.status_code == 200

    users = await admin_client.get("/api/admin/users")
    assert carol_id not in [u["id"] for u in users.json()]


@pytest.mark.asyncio
async def test_admin_metrics_and_system_and_journal(admin_client):
    await admin_client.post("/api/downloads", json={"url": "https://example.com/video"})

    metrics = await admin_client.get("/api/admin/metrics")
    assert metrics.status_code == 200
    assert metrics.json()["downloads_today"] >= 1

    system = await admin_client.get("/api/admin/system")
    assert system.status_code == 200
    assert system.json()["ram_total_bytes"] > 0

    journal = await admin_client.get("/api/admin/journal")
    assert journal.status_code == 200
    assert len(journal.json()) >= 1


@pytest.mark.asyncio
async def test_admin_actions_purge_and_clear_queue(admin_client):
    await admin_client.post("/api/downloads", json={"url": "https://example.com/video"})

    clear = await admin_client.post("/api/admin/actions/clear-queue")
    assert clear.status_code == 200
    assert "1" in clear.json()["message"]

    purge = await admin_client.post("/api/admin/actions/purge-downloads")
    assert purge.status_code == 200

    unknown = await admin_client.post("/api/admin/actions/does-not-exist")
    assert unknown.status_code == 404
