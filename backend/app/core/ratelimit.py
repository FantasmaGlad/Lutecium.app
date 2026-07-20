import time
from collections import defaultdict

_WINDOW_SECONDS = 60
_hits: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str, max_per_window: int) -> bool:
    """Fenêtre glissante en mémoire. Retourne False si la limite est dépassée (§6)."""
    now = time.time()
    hits = _hits[key]
    cutoff = now - _WINDOW_SECONDS
    while hits and hits[0] < cutoff:
        hits.pop(0)
    if len(hits) >= max_per_window:
        return False
    hits.append(now)
    return True
