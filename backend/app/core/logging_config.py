"""M-02 : rotation des logs applicatifs (taille max, durée max)."""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.config import settings

_MAX_BYTES = 5 * 1024 * 1024  # 5 Mo par fichier
_BACKUP_COUNT = 5  # ~25 Mo d'historique max


_configured = False


def configure_logging() -> None:
    global _configured
    if _configured:
        return
    _configured = True

    log_dir = Path(settings.downloads_dir).parent / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    handler = RotatingFileHandler(log_dir / "app.log", maxBytes=_MAX_BYTES, backupCount=_BACKUP_COUNT)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))

    root = logging.getLogger()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
