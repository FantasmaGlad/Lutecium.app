from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session_maker
from app.models.setting import Setting

_cache: dict[str, str] = {}


async def refresh_cache() -> None:
    async with async_session_maker() as session:
        result = await session.execute(select(Setting))
        _cache.clear()
        for row in result.scalars().all():
            _cache[row.key] = row.value


def get_override(key: str) -> str | None:
    return _cache.get(key)


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    """Les valeurs en BDD priment sur `.env` (P2-08) ; utilisé par le dashboard admin (A-14)."""
    setting = await db.get(Setting, key)
    if setting is None:
        setting = Setting(key=key, value=value)
        db.add(setting)
    else:
        setting.value = value
    await db.commit()
    _cache[key] = value


async def get_all_settings(db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(Setting))
    return {row.key: row.value for row in result.scalars().all()}
