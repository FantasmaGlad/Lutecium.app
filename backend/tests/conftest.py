import os

# Base en mémoire pour les tests, définie avant tout import de app.* (voir app/core/db.py).
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

# httpx (comme un vrai navigateur) ne renvoie pas les cookies Secure sur http://test.
os.environ.setdefault("SECURE_COOKIES", "false")

import pytest_asyncio  # noqa: E402

from app.core.db import async_session_maker, init_db  # noqa: E402
from app.core.runtime_settings import _cache as _runtime_settings_cache  # noqa: E402
from app.models import Base  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def _fresh_db():
    """Base en mémoire partagée sur toute la session pytest (StaticPool) : on vide TOUTES
    les tables après chaque test, pas seulement celles du fichier courant, pour éviter
    toute fuite entre tests (ex: compteurs invité qui persisteraient d'un fichier à l'autre)."""
    await init_db()
    yield
    async with async_session_maker() as session:
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(table.delete())
        await session.commit()
    _runtime_settings_cache.clear()  # état en mémoire (pas en BDD) du cache d'overrides P2-08
