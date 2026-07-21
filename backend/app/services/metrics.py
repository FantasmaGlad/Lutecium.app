"""Métriques d'usage (A-11) : agrégations SQL sur `downloads`/`daily_usage`."""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.download import Download, DownloadStatus

_ACTIVE_STATUSES = (DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING)


def _local_date(created_at: datetime) -> date:
    """`created_at` est stocké en UTC (naïf sous SQLite, cf. models/base.py) ; le jour civil
    du service est celui du serveur (Europe/Paris, décision 2026-07-20), pas le jour UTC —
    un `func.date()` SQL sur la colonne UTC décalerait les téléchargements de fin/début de
    journée sur le mauvais jour pendant la fenêtre du décalage horaire."""
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return created_at.astimezone().date()


async def downloads_per_day(db: AsyncSession, days: int = 7) -> list[dict]:
    since = date.today() - timedelta(days=days - 1)
    # Large de 2 jours en UTC de part et d'autre pour ne jamais couper un jour local en
    # cours de route ; le comptage précis se fait ensuite en Python (voir _local_date).
    since_utc = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc) - timedelta(days=1)
    result = await db.execute(select(Download.created_at).where(Download.created_at >= since_utc))

    counts: dict[str, int] = {}
    for (created_at,) in result.all():
        day = _local_date(created_at).isoformat()
        counts[day] = counts.get(day, 0) + 1

    return [
        {"date": (since + timedelta(days=i)).isoformat(), "count": counts.get((since + timedelta(days=i)).isoformat(), 0)}
        for i in range(days)
    ]


async def active_users_today(db: AsyncSession) -> int:
    since_utc = datetime.combine(date.today(), datetime.min.time(), tzinfo=timezone.utc) - timedelta(days=1)
    result = await db.execute(
        select(Download.user_id, Download.created_at).where(
            Download.created_at >= since_utc, Download.user_id.is_not(None)
        )
    )
    today = date.today()
    return len({user_id for user_id, created_at in result.all() if _local_date(created_at) == today})


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
