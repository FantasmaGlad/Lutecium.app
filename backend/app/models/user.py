from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class UserRole:
    USER = "user"
    ADMIN = "admin"


class UserStatus:
    ACTIVE = "active"
    SUSPENDED = "suspended"


class User(Base):
    """Table `users` (§8)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    pseudo: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default=UserRole.USER)
    status: Mapped[str] = mapped_column(String, default=UserStatus.ACTIVE)
    daily_quota_gb: Mapped[float | None] = mapped_column(Float, nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
