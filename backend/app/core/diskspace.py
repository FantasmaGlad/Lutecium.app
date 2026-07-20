from pathlib import Path

from app.config import settings


def current_downloads_usage_bytes() -> int:
    root = Path(settings.downloads_dir)
    if not root.exists():
        return 0
    return sum(f.stat().st_size for f in root.rglob("*") if f.is_file())
