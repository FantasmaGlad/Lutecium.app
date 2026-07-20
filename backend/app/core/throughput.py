import math
from collections import deque

from app.config import settings

_SAMPLE_WINDOW = 10
_durations_seconds: deque[float] = deque(maxlen=_SAMPLE_WINDOW)


def record_job_duration(seconds: float) -> None:
    if seconds > 0:
        _durations_seconds.append(seconds)


def estimate_wait_seconds(position: int) -> int | None:
    """Estimation grossière du temps d'attente pour une position en file (F-22, ±50% assumé).

    Retourne None tant qu'aucun téléchargement n'a encore abouti (pas assez de données).
    """
    if not _durations_seconds or position <= 0:
        return None
    average = sum(_durations_seconds) / len(_durations_seconds)
    slots = max(settings.max_concurrent_downloads, 1)
    return math.ceil((position / slots) * average)
