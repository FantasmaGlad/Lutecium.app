import re

_DISALLOWED_CHARS = re.compile(r"[^A-Za-z0-9À-ÿ ._-]")
_MAX_LENGTH = 150


def sanitize_filename(name: str) -> str:
    """Nettoie un nom de fichier selon la whitelist S-05 (jamais passé à un shell)."""
    cleaned = _DISALLOWED_CHARS.sub("", name)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ._-")
    if not cleaned:
        cleaned = "video"
    return cleaned[:_MAX_LENGTH]
