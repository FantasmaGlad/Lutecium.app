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


async def _make_admin() -> User:
    async with async_session_maker() as session:
        admin = User(pseudo="admin", password_hash=hash_password("adminpass123"), role=UserRole.ADMIN)
        session.add(admin)
        await session.commit()
        await session.refresh(admin)
        return admin


@pytest.mark.asyncio
async def test_admin_can_reset_password_and_forces_change(client):
    await _make_admin()
    reg = await client.post("/api/auth/register", json={"pseudo": "victim", "password": "ancienmdp123"})
    victim_id = reg.json()["id"]
    await client.post("/api/auth/logout")

    await client.post("/api/auth/login", json={"pseudo": "admin", "password": "adminpass123"})
    reset = await client.post(f"/api/admin/users/{victim_id}/reset-password")
    assert reset.status_code == 200
    temp_password = reset.json()["temporary_password"]
    await client.post("/api/auth/logout")

    login = await client.post("/api/auth/login", json={"pseudo": "victim", "password": temp_password})
    assert login.status_code == 200
    assert login.json()["must_change_password"] is True

    # Le changement forcé ne demande pas l'ancien mot de passe (déjà oublié / temporaire).
    changed = await client.post("/api/auth/change-password", json={"new_password": "nouveaumdp123"})
    assert changed.status_code == 200

    old_login = await client.post("/api/auth/login", json={"pseudo": "victim", "password": temp_password})
    assert old_login.status_code == 401


@pytest.mark.asyncio
async def test_non_admin_cannot_reset_password(client):
    reg = await client.post("/api/auth/register", json={"pseudo": "regular", "password": "motdepasse123"})
    other_id = reg.json()["id"] + 1  # peu importe l'id, l'accès doit être refusé avant

    response = await client.post(f"/api/admin/users/{other_id}/reset-password")
    assert response.status_code == 403
