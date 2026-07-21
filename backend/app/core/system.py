"""État système (A-12). Pas d'accès au socket Docker (surface d'attaque, cf. PLAN §1.2-5) :
v1 = heartbeat applicatif + métriques hôte via psutil. `/sys/class/thermal` et
`/sys/class/hwmon` montés en lecture seule dans le conteneur pour la température (PLAN §1.2-4)."""

import time
from pathlib import Path

import psutil

from app.config import settings

_START_TIME = time.monotonic()

_THERMAL_PATHS = [
    Path("/sys/class/thermal/thermal_zone0/temp"),
    Path("/sys/class/hwmon/hwmon0/temp1_input"),
]


def _cpu_temperature_celsius() -> float | None:
    for path in _THERMAL_PATHS:
        try:
            millidegrees = int(path.read_text().strip())
            return millidegrees / 1000
        except (FileNotFoundError, ValueError, PermissionError):
            continue
    return None


def _cpu_frequency_mhz() -> float | None:
    try:
        freq = psutil.cpu_freq()
        return freq.current if freq else None
    except NotImplementedError:
        return None


def system_snapshot() -> dict:
    disk = psutil.disk_usage(str(Path(settings.downloads_dir).resolve().anchor or "/"))
    mem = psutil.virtual_memory()
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "cpu_frequency_mhz": _cpu_frequency_mhz(),
        "cpu_temperature_celsius": _cpu_temperature_celsius(),
        "ram_used_bytes": mem.used,
        "ram_total_bytes": mem.total,
        "disk_used_bytes": disk.used,
        "disk_total_bytes": disk.total,
        "uptime_seconds": time.monotonic() - _START_TIME,
        "yt_dlp_version": _yt_dlp_version(),
    }


def _yt_dlp_version() -> str:
    import yt_dlp

    return yt_dlp.version.__version__
