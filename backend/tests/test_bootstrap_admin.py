import pytest
from sqlalchemy import select

from app.config import settings
from app.core.bootstrap_admin import bootstrap_admin
from app.core.db import async_session_maker
from app.models.user import User, UserRole


@pytest.fixture(autouse=True)
def _reset_settings():
    original = (settings.admin_pseudo, settings.admin_password)
    yield
    settings.admin_pseudo, settings.admin_password = original


@pytest.mark.asyncio
async def test_no_admin_env_vars_creates_nothing(_fresh_db):
    settings.admin_pseudo, settings.admin_password = None, None
    await bootstrap_admin()

    async with async_session_maker() as session:
        admin = await session.scalar(select(User).where(User.role == UserRole.ADMIN))
    assert admin is None


@pytest.mark.asyncio
async def test_creates_admin_when_env_vars_set(_fresh_db):
    settings.admin_pseudo, settings.admin_password = "root", "motdepasseadmin123"
    await bootstrap_admin()

    async with async_session_maker() as session:
        admin = await session.scalar(select(User).where(User.pseudo == "root"))
    assert admin is not None
    assert admin.role == UserRole.ADMIN


@pytest.mark.asyncio
async def test_idempotent_when_admin_already_exists(_fresh_db):
    settings.admin_pseudo, settings.admin_password = "root", "motdepasseadmin123"
    await bootstrap_admin()
    await bootstrap_admin()  # 2e démarrage : ne doit pas dupliquer/planter

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.role == UserRole.ADMIN))
        admins = result.scalars().all()
    assert len(admins) == 1
