from datetime import datetime

from sqlalchemy import DateTime, Float
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class SystemMetric(Base):
    """Table `system_metrics` : échantillons périodiques (core/metrics_history.py) pour les
    graphiques d'évolution du dashboard admin (A-12, UI §7.3). Purgée au-delà de 7 jours."""

    __tablename__ = "system_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    cpu_percent: Mapped[float] = mapped_column(Float)
    ram_percent: Mapped[float] = mapped_column(Float)
    disk_percent: Mapped[float] = mapped_column(Float)
    temperature_celsius: Mapped[float | None] = mapped_column(Float, nullable=True)
    power_watts: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_rx_bytes_per_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_tx_bytes_per_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
