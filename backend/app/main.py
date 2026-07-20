import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import analyze, downloads, health
from app.core.db import async_session_maker, init_db
from app.core.events import bus
from app.core.queue import reconcile_on_startup
from app.core.worker import requeue_pending_jobs, start_workers


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    bus.bind_loop(asyncio.get_running_loop())
    async with async_session_maker() as session:
        await reconcile_on_startup(session)
    await requeue_pending_jobs()
    workers = start_workers()
    yield
    for task in workers:
        task.cancel()


def create_app() -> FastAPI:
    app = FastAPI(title="Lutecium", lifespan=lifespan)
    app.include_router(health.router, prefix="/api")
    app.include_router(analyze.router, prefix="/api")
    app.include_router(downloads.router, prefix="/api")
    return app


app = create_app()
