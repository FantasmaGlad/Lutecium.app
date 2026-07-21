"""A-14 : mise à jour manuelle de yt-dlp depuis le dashboard admin (cf. M-01 pour la version nightly).

Important : `pip install --upgrade` seul ne suffit pas. yt-dlp est importé comme
bibliothèque Python (S-05) et ses dizaines de sous-modules (extracteurs) sont déjà
chargés en mémoire — un `importlib.reload` ne les rafraîchit pas de façon fiable.
La seule façon sûre de « recharger les workers proprement » (PLAN §4) est de
redémarrer le processus : `restart: unless-stopped` (docker-compose.yml) le relance
aussitôt avec le paquet à jour réellement importé depuis zéro.
"""

import asyncio
import logging
import os
import signal

from sqlalchemy import func, select

from app.core.db import async_session_maker
from app.models.download import Download, DownloadStatus

log = logging.getLogger(__name__)

_ACTIVE_STATUSES = (DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING)
_RESTART_DELAY_SECONDS = 2  # laisse le temps à la réponse HTTP de partir avant l'arrêt


class UpdateInProgressError(Exception):
    pass


async def update_yt_dlp() -> str:
    async with async_session_maker() as session:
        active = await session.scalar(
            select(func.count()).select_from(Download).where(Download.status.in_(_ACTIVE_STATUSES))
        )
    if active:
        raise UpdateInProgressError("Des téléchargements sont en cours ; réessaie une fois la file vide.")

    process = await asyncio.create_subprocess_exec(
        "pip",
        "install",
        "--upgrade",
        "yt-dlp",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    output = await process.communicate()
    if process.returncode != 0:
        raise RuntimeError("La mise à jour de yt-dlp a échoué : " + output[0].decode(errors="replace")[-500:])

    version = await asyncio.to_thread(_installed_version)
    asyncio.get_running_loop().call_later(_RESTART_DELAY_SECONDS, _restart_process)
    return version


def _installed_version() -> str:
    """Lit la version installée depuis un sous-processus frais plutôt que le module déjà
    importé dans ce process (voir docstring du module : reload non fiable)."""
    import subprocess

    result = subprocess.run(
        ["python", "-c", "import yt_dlp; print(yt_dlp.version.__version__)"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def _restart_process() -> None:
    log.info("Redémarrage du service après mise à jour de yt-dlp (redémarrage automatique par Docker).")
    os.kill(os.getpid(), signal.SIGTERM)
