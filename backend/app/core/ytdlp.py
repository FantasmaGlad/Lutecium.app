import yt_dlp


class AnalyzeError(Exception):
    """Erreur d'analyse avec message déjà en français, prêt à afficher (F-16)."""


class PlaylistNotSupportedError(AnalyzeError):
    pass


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
