import time

_MAX_ATTEMPTS = 5
_LOCKOUT_SECONDS = 15 * 60
_failures: dict[str, list[float]] = {}


def _key(pseudo: str, ip: str) -> str:
    return f"{pseudo}:{ip}"


def is_locked(pseudo: str, ip: str) -> bool:
    """Verrouillage temporaire après 5 échecs (S-06), compteur par pseudo + IP."""
    key = _key(pseudo, ip)
    now = time.time()
    recent = [t for t in _failures.get(key, []) if now - t < _LOCKOUT_SECONDS]
    _failures[key] = recent
    return len(recent) >= _MAX_ATTEMPTS


def record_failure(pseudo: str, ip: str) -> None:
    _failures.setdefault(_key(pseudo, ip), []).append(time.time())


def reset(pseudo: str, ip: str) -> None:
    _failures.pop(_key(pseudo, ip), None)
