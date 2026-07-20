from collections.abc import Callable
from pathlib import Path
from typing import Any

import yt_dlp


class AnalyzeError(Exception):
    """Erreur d'analyse avec message déjà en français, prêt à afficher (F-16)."""


class PlaylistNotSupportedError(AnalyzeError):
    pass


class DownloadFailedError(Exception):
    """Erreur de téléchargement avec message déjà en français, prêt à afficher (F-16)."""


def extract_info(url: str) -> dict:
    """Analyse une URL via l'API Python de yt-dlp — jamais de commande shell (S-05)."""
    ydl_opts = {
        "noplaylist": True,
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        # Détection rapide des playlists : n'en résout pas chaque entrée (F-15).
        "extract_flat": "in_playlist",
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        raise AnalyzeError(
            "Impossible d'analyser ce lien. Vérifie qu'il est valide et que le site est pris en charge."
        ) from exc

    if info is None:
        raise AnalyzeError("Impossible d'analyser ce lien.")

    if info.get("_type") == "playlist" or (info.get("entries") is not None and "formats" not in info):
        raise PlaylistNotSupportedError(
            "Les playlists ne sont pas prises en charge : colle le lien d'une seule vidéo."
        )

    return info


def run_download(
    url: str,
    options: dict,
    job_dir: Path,
    on_progress: Callable[[dict[str, Any]], None],
    on_postprocessor: Callable[[dict[str, Any]], None],
) -> tuple[Path, int]:
    """Télécharge une vidéo (mode `video`, F-12) avec fusion audio+vidéo automatique (F-14).

    yt-dlp fusionne automatiquement via ffmpeg quand les flux vidéo/audio sont séparés
    (aucune commande shell : tout passe par l'API Python, S-05).
    """
    format_id = options.get("format_id")
    format_selector = f"{format_id}+bestaudio/best" if format_id else "bestvideo+bestaudio/best"

    ydl_opts = {
        "outtmpl": str(job_dir / "%(title).200B.%(ext)s"),
        "format": format_selector,
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [on_progress],
        "postprocessor_hooks": [on_postprocessor],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as exc:
        raise DownloadFailedError(
            "Le téléchargement a échoué. Vérifie que le lien est toujours valide."
        ) from exc

    final_path = _resolve_final_path(info, job_dir)
    return final_path, final_path.stat().st_size


def _resolve_final_path(info: dict, job_dir: Path) -> Path:
    filepath = info.get("filepath") or info.get("_filename")
    if filepath and Path(filepath).exists():
        return Path(filepath)

    requested = info.get("requested_downloads") or []
    for entry in requested:
        candidate = entry.get("filepath")
        if candidate and Path(candidate).exists():
            return Path(candidate)

    candidates = sorted(job_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise DownloadFailedError("Le fichier téléchargé est introuvable.")
    return candidates[0]
