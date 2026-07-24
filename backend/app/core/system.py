"""État système (A-12). Pas d'accès au socket Docker (surface d'attaque, cf. PLAN §1.2-5) :
v1 = heartbeat applicatif + métriques hôte via psutil. `/sys/class/thermal` et
`/sys/class/hwmon` montés en lecture seule dans le conteneur pour la température (PLAN §1.2-4)."""

import time
from pathlib import Path

import psutil

from app.config import settings
from app.core.runtime_settings import get_override

_START_TIME = time.monotonic()

_THERMAL_PATHS = [
    Path("/sys/class/thermal/thermal_zone0/temp"),
    Path("/sys/class/hwmon/hwmon0/temp1_input"),
]

# RAPL (Intel/AMD) : consommation du package CPU en Watts. `energy_uj` est en lecture
# root-only sur les noyaux récents (restriction liée à une classe de failles side-channel),
# donc souvent indisponible depuis un conteneur non-root (S-09) — None dans ce cas, jamais
# de valeur inventée (cf. _cpu_temperature_celsius, même philosophie de dégradation propre).
_RAPL_ENERGY_PATH = Path("/sys/class/powercap/intel-rapl:0/energy_uj")
_RAPL_MAX_RANGE_PATH = Path("/sys/class/powercap/intel-rapl:0/max_energy_range_uj")
_RAPL_SAMPLE_SECONDS = 0.2

# Débit réseau : pas de mesure instantanée possible (compteurs cumulatifs depuis le boot),
# donc delta entre deux appels successifs à system_snapshot() — None au tout premier appel.
_last_net_sample: tuple[float, int, int] | None = None


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


def _power_watts() -> float | None:
    try:
        max_range = int(_RAPL_MAX_RANGE_PATH.read_text().strip())
        before_uj = int(_RAPL_ENERGY_PATH.read_text().strip())
        before_t = time.monotonic()
        time.sleep(_RAPL_SAMPLE_SECONDS)
        after_uj = int(_RAPL_ENERGY_PATH.read_text().strip())
        after_t = time.monotonic()
    except (FileNotFoundError, ValueError, PermissionError, OSError):
        return None
    delta_uj = after_uj - before_uj
    if delta_uj < 0:  # le compteur a rebouclé pendant l'échantillon
        delta_uj += max_range
    delta_t = after_t - before_t
    if delta_t <= 0:
        return None
    return (delta_uj / 1_000_000) / delta_t


def _network_rates_bytes_per_sec() -> tuple[float | None, float | None]:
    global _last_net_sample
    counters = psutil.net_io_counters()
    now = time.monotonic()
    previous = _last_net_sample
    _last_net_sample = (now, counters.bytes_recv, counters.bytes_sent)
    if previous is None:
        return None, None
    prev_t, prev_rx, prev_tx = previous
    delta_t = now - prev_t
    if delta_t <= 0:
        return None, None
    rx_rate = max(0.0, (counters.bytes_recv - prev_rx) / delta_t)
    tx_rate = max(0.0, (counters.bytes_sent - prev_tx) / delta_t)
    return rx_rate, tx_rate


def _existing_ancestor(path: Path) -> Path:
    for candidate in (path, *path.parents):
        if candidate.exists():
            return candidate
    return Path("/")


def system_snapshot() -> dict:
    # psutil.disk_usage accepte n'importe quel chemin du point de montage visé : passer
    # `.anchor` (toujours `/` sous Linux, cf. Path.anchor) mesurerait systématiquement le
    # disque racine au lieu du volume réel des téléchargements s'il était monté à part.
    # `downloads_dir` peut ne pas encore exister (créé au 1er job, cf. core/worker.py).
    disk = psutil.disk_usage(str(_existing_ancestor(Path(settings.downloads_dir).resolve())))
    mem = psutil.virtual_memory()
    net_rx, net_tx = _network_rates_bytes_per_sec()
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "cpu_frequency_mhz": _cpu_frequency_mhz(),
        "cpu_temperature_celsius": _cpu_temperature_celsius(),
        "power_watts": _power_watts(),
        "net_rx_bytes_per_sec": net_rx,
        "net_tx_bytes_per_sec": net_tx,
        "ram_used_bytes": mem.used,
        "ram_total_bytes": mem.total,
        "disk_used_bytes": disk.used,
        "disk_total_bytes": disk.total,
        "uptime_seconds": time.monotonic() - _START_TIME,
        "yt_dlp_version": _yt_dlp_version(),
        "yt_dlp_last_update_at": get_override("yt_dlp_last_update_at"),
    }


def _yt_dlp_version() -> str:
    import yt_dlp

    return yt_dlp.version.__version__
