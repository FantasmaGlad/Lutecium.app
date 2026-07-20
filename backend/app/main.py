from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import analyze, downloads, health
from app.core.db import async_session_maker, init_db
from app.core.queue import reconcile_on_startup


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with async_session_maker() as session:
        await reconcile_on_startup(session)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Lutecium", lifespan=lifespan)
    app.include_router(health.router, prefix="/api")
    app.include_router(analyze.router, prefix="/api")
    app.include_router(downloads.router, prefix="/api")
    return app


app = create_app()
