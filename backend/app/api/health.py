from fastapi import APIRouter
from importlib.metadata import version, PackageNotFoundError

router = APIRouter()


def _package_version(name: str) -> str | None:
    try:
        return version(name)
    except PackageNotFoundError:
        return None


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "app_version": _package_version("lutecium"),
        "yt_dlp_version": _package_version("yt-dlp"),
    }
