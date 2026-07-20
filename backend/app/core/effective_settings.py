"""Valeurs effectives des limites configurables (§6) : override BDD (table `settings`,
géré depuis le dashboard admin, A-14) sinon défaut `.env`/codé en dur (P2-08)."""

from app.config import settings
from app.core.runtime_settings import get_override


def _float(key: str, default: float) -> float:
    override = get_override(key)
    return float(override) if override is not None else default


def _int(key: str, default: int) -> int:
    override = get_override(key)
    return int(override) if override is not None else default


def max_file_size_gb() -> float:
    return _float("max_file_size_gb", settings.max_file_size_gb)


def global_downloads_cap_gb() -> float:
    return _float("global_downloads_cap_gb", settings.global_downloads_cap_gb)


def max_queue_size() -> int:
    return _int("max_queue_size", settings.max_queue_size)


def user_daily_quota_gb() -> float:
    return _float("user_daily_quota_gb", settings.user_daily_quota_gb)


def guest_download_limit() -> int:
    return _int("guest_download_limit", settings.guest_download_limit)


def analyze_rate_limit_per_minute() -> int:
    return _int("analyze_rate_limit_per_minute", settings.analyze_rate_limit_per_minute)


def file_ttl_minutes() -> int:
    return _int("file_ttl_minutes", settings.file_ttl_minutes)
