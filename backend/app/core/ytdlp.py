from collections.abc import Callable
from pathlib import Path
from typing import Any

import yt_dlp

from app.config import settings
from app.core.errors import translate_analyze_error, translate_download_error


class AnalyzeError(Exception):
    """Erreur d'analyse avec message déjà en français, prêt à afficher (F-16)."""

    def __init__(self, message: str, raw: str | None = None):
        super().__init__(message)
        self.message = message
        self.raw = raw or message


class PlaylistNotSupportedError(AnalyzeError):
    pass


class DownloadCancelledError(Exception):
    """Levée depuis le hook de progression pour interrompre yt-dlp (annulation coopérative, F-23)."""


class DownloadFailedError(Exception):
    """Erreur de téléchargement avec message déjà en français, prêt à afficher (F-16)."""

    def __init__(self, message: str, raw: str | None = None):
        super().__init__(message)
        self.message = message
        self.raw = raw or message


def _cookies_opts() -> dict:
    """Option `cookiefile` (M-04) : fichier Netscape monté dans le conteneur pour les sites
    qui exigent une connexion (Instagram, certains contenus X/TikTok). Silencieusement
    ignoré si non configuré ou si le fichier n'est pas présent, plutôt que de faire échouer
    tous les téléchargements en son absence."""
    if settings.cookies_file and Path(settings.cookies_file).is_file():
        return {"cookiefile": settings.cookies_file}
    return {}


def extract_info(url: str) -> dict:
    """Analyse une URL via l'API Python de yt-dlp — jamais de commande shell (S-05)."""
    ydl_opts = {
        "noplaylist": True,
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        # Détection rapide des playlists : n'en résout pas chaque entrée (F-15).
        "extract_flat": "in_playlist",
        **_cookies_opts(),
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        raise AnalyzeError(translate_analyze_error(exc), raw=str(exc)) from exc

    if info is None:
        raise AnalyzeError("Impossible d'analyser ce lien.")

    if info.get("_type") == "playlist" or (info.get("entries") is not None and "formats" not in info):
        raise PlaylistNotSupportedError(
            "Les playlists ne sont pas prises en charge : colle le lien d'une seule vidéo."
        )

    return info


def _base_opts(
    options: dict,
    job_dir: Path,
    on_progress: Callable[[dict[str, Any]], None],
    on_postprocessor: Callable[[dict[str, Any]], None],
) -> dict:
    # Nom de fichier personnalisé déjà assaini côté API (F-13, S-05) ; sinon titre nettoyé par yt-dlp.
    custom_filename = options.get("filename")
    name_template = f"{custom_filename}.%(ext)s" if custom_filename else "%(title).200B.%(ext)s"
    opts: dict[str, Any] = {
        "outtmpl": str(job_dir / name_template),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [on_progress],
        "postprocessor_hooks": [on_postprocessor],
        **_cookies_opts(),
    }
    max_file_size_gb = options.get("max_file_size_gb")
    if max_file_size_gb:
        # Pré-check quand la taille est connue, interruption en cours sinon (§6, F-16).
        opts["max_filesize"] = max_file_size_gb * 1024**3
    return opts


def _video_opts(options: dict, base: dict) -> dict:
    """Mode `video` (F-12) : fusion audio+vidéo automatique (F-14) via yt-dlp/ffmpeg."""
    format_id = options.get("format_id")
    format_selector = f"{format_id}+bestaudio/best" if format_id else "bestvideo+bestaudio/best"
    return {
        **base,
        "format": format_selector,
        "merge_output_format": "mp4",
    }


def _audio_opts(options: dict, base: dict) -> dict:
    """Mode `audio` (F-12) : extraction via le postprocesseur FFmpegExtractAudio."""
    audio_format = options.get("audio_format") or "mp3"
    return {
        **base,
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": audio_format,
                "preferredquality": "0",
            }
        ],
    }


def _subtitles_opts(options: dict, base: dict) -> dict:
    """Mode `subtitles` (F-12) : sous-titres seuls, aucun média téléchargé."""
    langs = options.get("subtitle_langs") or ["en"]
    return {
        **base,
        "skip_download": True,
        "writesubtitles": True,
        "subtitleslangs": langs,
    }


_MODE_BUILDERS = {
    "video": _video_opts,
    "audio": _audio_opts,
    "subtitles": _subtitles_opts,
}


def run_download(
    url: str,
    options: dict,
    job_dir: Path,
    on_progress: Callable[[dict[str, Any]], None],
    on_postprocessor: Callable[[dict[str, Any]], None],
) -> tuple[Path, int]:
    """Télécharge selon le mode choisi (video/audio/subtitles, F-12) via l'API Python de
    yt-dlp — jamais de commande shell (S-05)."""
    mode = options.get("mode", "video")
    build_opts = _MODE_BUILDERS.get(mode, _video_opts)
    base = _base_opts(options, job_dir, on_progress, on_postprocessor)
    ydl_opts = build_opts(options, base)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except DownloadCancelledError:
        raise
    except yt_dlp.utils.DownloadError as exc:
        raise DownloadFailedError(translate_download_error(exc), raw=str(exc)) from exc

    final_path = _resolve_final_path(info, job_dir, max_filesize_set="max_filesize" in ydl_opts)
    return final_path, final_path.stat().st_size


def _resolve_final_path(info: dict, job_dir: Path, max_filesize_set: bool = False) -> Path:
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
        if max_filesize_set:
            # yt-dlp écarte silencieusement les formats trop lourds sans lever d'exception (§6).
            raise DownloadFailedError("Le fichier dépasse la taille maximale autorisée sur ce serveur.")
        raise DownloadFailedError("Le fichier téléchargé est introuvable.")
    return candidates[0]
