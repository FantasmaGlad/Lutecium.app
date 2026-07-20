from httpx import ASGITransport, AsyncClient
import pytest
import pytest_asyncio

from app.core import effective_settings
from app.core.auth import hash_password
from app.core.db import async_session_maker
from app.core.runtime_settings import refresh_cache
from app.main import create_app
from app.models.user import User, UserRole


@pytest_asyncio.fixture
async def admin_client():
    async with async_session_maker() as session:
        admin = User(pseudo="admin", password_hash=hash_password("adminpass123"), role=UserRole.ADMIN)
        session.add(admin)
        await session.commit()

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/auth/login", json={"pseudo": "admin", "password": "adminpass123"})
        yield client


@pytest.mark.asyncio
async def test_default_before_override():
    effective_settings.get_override("max_file_size_gb")  # ne doit pas planter sans cache chargé
    from app.config import settings

    assert effective_settings.max_file_size_gb() == settings.max_file_size_gb


@pytest.mark.asyncio
async def test_admin_can_override_setting_and_it_takes_effect(admin_client):
    response = await admin_client.patch("/api/admin/settings", json={"settings": {"max_file_size_gb": "1"}})
    assert response.status_code == 200
    assert response.json()["settings"]["max_file_size_gb"] == "1"
    assert effective_settings.max_file_size_gb() == 1.0

    # Persisté en base : un rafraîchissement du cache (redémarrage/tick périodique) le retrouve.
    from app.core.runtime_settings import _cache

    _cache.clear()
    await refresh_cache()
    assert effective_settings.max_file_size_gb() == 1.0


@pytest.mark.asyncio
async def test_unknown_setting_key_rejected(admin_client):
    response = await admin_client.patch("/api/admin/settings", json={"settings": {"secret_key": "hack"}})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_non_admin_cannot_read_settings():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/auth/register", json={"pseudo": "regular", "password": "motdepasse123"})
        response = await client.get("/api/admin/settings")
        assert response.status_code == 403
