from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class GuestDownload(Base):
    """Table `guest_downloads` (§8) — soft limit du mode invité (F-06, F-07), purgée quotidiennement."""

    __tablename__ = "guest_downloads"

    id: Mapped[int] = mapped_column(primary_key=True)
    ip_hash: Mapped[str] = mapped_column(String, index=True, nullable=False)
    guest_cookie: Mapped[str] = mapped_column(String, index=True, nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
