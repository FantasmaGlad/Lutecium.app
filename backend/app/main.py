import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import admin, analyze, auth, downloads, files, health
from app.core.bootstrap_admin import bootstrap_admin
from app.core.cleanup import cleanup_loop
from app.core.db import async_session_maker
from app.core.events import bus
from app.core.logging_config import configure_logging
from app.core.migrations import run_migrations
from app.core.queue import reconcile_on_startup
from app.core.runtime_settings import refresh_cache
from app.core.worker import requeue_pending_jobs, start_workers


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Le schéma est géré par Alembic (migration = source de vérité, P2-01) ; `init_db`/create_all
    # reste utilisé par les tests (base en mémoire, pas d'historique de migration nécessaire).
    await asyncio.to_thread(run_migrations)
    await bootstrap_admin()  # A-01 : compte admin si ADMIN_PSEUDO/ADMIN_PASSWORD renseignés
    await refresh_cache()  # overrides admin (table settings, P2-08)
    bus.bind_loop(asyncio.get_running_loop())
    async with async_session_maker() as session:
        await reconcile_on_startup(session)
    await requeue_pending_jobs()
    workers = start_workers()
    cleanup_task = asyncio.create_task(cleanup_loop())
    yield
    cleanup_task.cancel()
    for task in workers:
        task.cancel()


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title="Lutecium", lifespan=lifespan)
    app.include_router(health.router, prefix="/api")
    app.include_router(analyze.router, prefix="/api")
    app.include_router(downloads.router, prefix="/api")
    app.include_router(files.router, prefix="/api")
    app.include_router(auth.router, prefix="/api")
    app.include_router(admin.router, prefix="/api")
    return app


app = create_app()
