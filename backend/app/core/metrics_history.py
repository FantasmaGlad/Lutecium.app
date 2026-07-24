"""Échantillonnage périodique de l'état système pour les graphiques d'évolution du
dashboard admin (A-12, UI §7.3). Même philosophie que core/cleanup.py : boucle infinie,
ne doit jamais interrompre le service."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.core.db import async_session_maker
from app.core.system import system_snapshot
from app.models.system_metric import SystemMetric

log = logging.getLogger(__name__)

_SAMPLE_INTERVAL_SECONDS = 300  # 5 min : ~288 points/jour, 2016/semaine — table légère
_RETENTION_DAYS = 7  # cohérent avec la rétention des backups BDD (P-04)


async def metrics_history_loop() -> None:
    while True:
        try:
            snapshot = await asyncio.to_thread(system_snapshot)
            async with async_session_maker() as session:
                session.add(
                    SystemMetric(
                        cpu_percent=snapshot["cpu_percent"],
                        ram_percent=100 * snapshot["ram_used_bytes"] / snapshot["ram_total_bytes"],
                        disk_percent=100 * snapshot["disk_used_bytes"] / snapshot["disk_total_bytes"],
                        temperature_celsius=snapshot["cpu_temperature_celsius"],
                        power_watts=snapshot["power_watts"],
                        net_rx_bytes_per_sec=snapshot["net_rx_bytes_per_sec"],
                        net_tx_bytes_per_sec=snapshot["net_tx_bytes_per_sec"],
                    )
                )
                cutoff = datetime.now(timezone.utc) - timedelta(days=_RETENTION_DAYS)
                await session.execute(delete(SystemMetric).where(SystemMetric.recorded_at < cutoff))
                await session.commit()
        except Exception:  # noqa: BLE001 — l'échantillonnage ne doit jamais interrompre le service
            log.exception("Erreur pendant l'échantillonnage des métriques système")
        await asyncio.sleep(_SAMPLE_INTERVAL_SECONDS)
