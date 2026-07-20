from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.models import Base  # noqa: F401 — importe tous les modèles pour create_all/Alembic

_engine_kwargs = {}
_is_memory = ":memory:" in settings.database_url
if _is_memory:
    # Sqlite en mémoire (tests) : une seule connexion partagée, sinon chaque
    # connexion voit une base vide.
    _engine_kwargs["poolclass"] = StaticPool
elif settings.database_url.startswith("sqlite"):
    # Sqlite fichier : le répertoire parent doit exister avant la première connexion.
    db_path = Path(settings.database_url.split("///", 1)[1])
    db_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(settings.database_url, **_engine_kwargs)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

if settings.database_url.startswith("sqlite") and not _is_memory:
    # WAL : meilleure concurrence lecture/écriture entre l'API et les workers (P2-01).

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_wal(dbapi_connection, connection_record) -> None:  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
