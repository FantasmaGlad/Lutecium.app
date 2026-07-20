import pytest

from app.core.db import async_session_maker
from app.core.quota import has_quota_remaining, quota_bytes_for, record_usage
from app.models.user import User, UserRole


async def _make_user(role: str = UserRole.USER, daily_quota_gb: float | None = None) -> User:
    async with async_session_maker() as session:
        user = User(pseudo="quotauser", password_hash="x", role=role, daily_quota_gb=daily_quota_gb)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest.mark.asyncio
async def test_quota_remaining_when_no_usage():
    user = await _make_user()
    async with async_session_maker() as session:
        assert await has_quota_remaining(session, user) is True


@pytest.mark.asyncio
async def test_gift_download_allowed_then_blocked():
    user = await _make_user(daily_quota_gb=0.001)  # ~1 MB, facile à dépasser
    async with async_session_maker() as session:
        assert await has_quota_remaining(session, user) is True
        # "Cadeau" : ce téléchargement dépasse largement le quota mais était sous la limite avant.
        await record_usage(session, user.id, size_bytes=50_000_000)
        # La demande suivante doit être refusée : le quota était déjà dépassé avant elle.
        assert await has_quota_remaining(session, user) is False


@pytest.mark.asyncio
async def test_admin_always_has_quota_remaining():
    admin = await _make_user(role=UserRole.ADMIN, daily_quota_gb=0.001)
    async with async_session_maker() as session:
        await record_usage(session, admin.id, size_bytes=50_000_000)
        assert await has_quota_remaining(session, admin) is True


@pytest.mark.asyncio
async def test_individual_quota_overrides_default():
    user = await _make_user(daily_quota_gb=100)
    assert quota_bytes_for(user) == 100 * 1024**3
