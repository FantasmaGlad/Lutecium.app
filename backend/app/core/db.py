from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.models.base import Base

_engine_kwargs = {}
if ":memory:" in settings.database_url:
    # Sqlite en mémoire (tests) : une seule connexion partagée, sinon chaque
    # connexion voit une base vide.
    _engine_kwargs["poolclass"] = StaticPool
elif settings.database_url.startswith("sqlite"):
    # Sqlite fichier : le répertoire parent doit exister avant la première connexion.
    db_path = Path(settings.database_url.split("///", 1)[1])
    db_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(settings.database_url, **_engine_kwargs)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
