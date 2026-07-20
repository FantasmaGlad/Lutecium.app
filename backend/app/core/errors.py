import re

# Mapping best-effort des messages d'erreur yt-dlp vers un message français actionnable (F-16).
# yt-dlp n'expose pas toujours des sous-classes d'exception dédiées par cause : on reconnaît
# les cas les plus fréquents par motif dans le message, avec un message générique en repli.
_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"private video", re.I), "Cette vidéo est privée."),
    (re.compile(r"video (is )?unavailable|has been removed", re.I), "Cette vidéo n'est plus disponible."),
    (re.compile(r"not available in your country|not available on this app|geo.?restrict", re.I),
     "Ce contenu est géo-bloqué et n'est pas disponible depuis ce serveur."),
    (re.compile(r"sign in to confirm|login required|cookies", re.I),
     "Ce site nécessite une connexion (cookies) qui n'est pas configurée sur ce serveur."),
    (re.compile(r"unsupported url|no extractor", re.I), "Ce site n'est pas pris en charge."),
    (re.compile(r"http error 404|not found", re.I), "Ce contenu est introuvable."),
    (re.compile(r"max.?filesize|file is larger than max-filesize", re.I),
     "Le fichier dépasse la taille maximale autorisée."),
    (re.compile(r"unable to download webpage|network|timed? ?out|connection", re.I),
     "Le site source est injoignable pour le moment. Réessaie plus tard."),
]

_DEFAULT_ANALYZE_MESSAGE = "Impossible d'analyser ce lien. Vérifie qu'il est valide et que le site est pris en charge."
_DEFAULT_DOWNLOAD_MESSAGE = "Le téléchargement a échoué. Vérifie que le lien est toujours valide."


def _translate(message: str, default: str) -> str:
    for pattern, french in _PATTERNS:
        if pattern.search(message):
            return french
    return default


def translate_analyze_error(exc: Exception) -> str:
    return _translate(str(exc), _DEFAULT_ANALYZE_MESSAGE)


def translate_download_error(exc: Exception) -> str:
    return _translate(str(exc), _DEFAULT_DOWNLOAD_MESSAGE)
