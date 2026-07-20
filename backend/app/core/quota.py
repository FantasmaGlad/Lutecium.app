from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.daily_usage import DailyUsage
from app.models.user import User, UserRole


def quota_bytes_for(user: User) -> float:
    gb = user.daily_quota_gb if user.daily_quota_gb is not None else settings.user_daily_quota_gb
    return gb * 1024**3


async def get_today_usage_bytes(db: AsyncSession, user_id: int) -> int:
    record = await db.scalar(
        select(DailyUsage).where(DailyUsage.user_id == user_id, DailyUsage.usage_date == date.today())
    )
    return record.bytes_used if record else 0


async def has_quota_remaining(db: AsyncSession, user: User) -> bool:
    """Quota-cadeau (CDC UI §6.4) : tant que l'usage du jour n'a pas encore atteint le quota,
    la demande est acceptée même si elle va le dépasser — c'est la dernière offerte.
    Admin exempté (A-02). Jour civil, remise à zéro à minuit."""
    if user.role == UserRole.ADMIN:
        return True
    usage = await get_today_usage_bytes(db, user.id)
    return usage < quota_bytes_for(user)


async def record_usage(db: AsyncSession, user_id: int, size_bytes: int) -> None:
    today = date.today()
    record = await db.scalar(
        select(DailyUsage).where(DailyUsage.user_id == user_id, DailyUsage.usage_date == today)
    )
    if record is None:
        record = DailyUsage(user_id=user_id, usage_date=today, bytes_used=0)
        db.add(record)
    record.bytes_used += size_bytes
    await db.commit()
