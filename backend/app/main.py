from fastapi import FastAPI

from app.api import analyze, health


def create_app() -> FastAPI:
    app = FastAPI(title="Lutecium")
    app.include_router(health.router, prefix="/api")
    app.include_router(analyze.router, prefix="/api")
    return app


app = create_app()
