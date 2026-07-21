"""Métriques d'usage (A-11) : agrégations SQL sur `downloads`/`daily_usage`."""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.download import Download, DownloadStatus

_ACTIVE_STATUSES = (DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING)


async def downloads_per_day(db: AsyncSession, days: int = 7) -> list[dict]:
    since = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(func.date(Download.created_at), func.count())
        .where(func.date(Download.created_at) >= since.isoformat())
        .group_by(func.date(Download.created_at))
        .order_by(func.date(Download.created_at))
    )
    counts = {day: count for day, count in result.all()}
    return [
        {"date": (since + timedelta(days=i)).isoformat(), "count": counts.get((since + timedelta(days=i)).isoformat(), 0)}
        for i in range(days)
    ]


async def top_sites(db: AsyncSession, limit: int = 5) -> list[dict]:
    result = await db.execute(
        select(Download.site, func.count())
        .where(Download.site.is_not(None))
        .group_by(Download.site)
        .order_by(func.count().desc())
        .limit(limit)
    )
    return [{"site": site, "count": count} for site, count in result.all()]


async def error_rate(db: AsyncSession) -> float:
    total = await db.scalar(
        select(func.count()).select_from(Download).where(Download.status.in_((DownloadStatus.DONE, DownloadStatus.FAILED)))
    )
    if not total:
        return 0.0
    failed = await db.scalar(select(func.count()).select_from(Download).where(Download.status == DownloadStatus.FAILED))
    return round((failed or 0) / total, 4)


async def total_volume_bytes(db: AsyncSession) -> int:
    return await db.scalar(select(func.coalesce(func.sum(Download.size_bytes), 0))) or 0


async def queue_snapshot(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Download.id, Download.site, Download.status).where(Download.status.in_(_ACTIVE_STATUSES)).order_by(Download.id)
    )
    return [{"id": row.id, "site": row.site, "status": row.status} for row in result.all()]
