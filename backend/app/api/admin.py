import asyncio
import secrets
import string
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.db import async_session_maker

from app.api.auth import require_user
from app.core.auth import hash_password
from app.core.db import get_session
from app.core.diskspace import current_downloads_usage_bytes
from app.core.quota import get_today_usage_bytes, quota_bytes_for
from app.core.runtime_settings import get_all_settings, set_setting
from app.core.system import system_snapshot
from app.models.daily_usage import DailyUsage
from app.models.download import Download
from app.models.guest_download import GuestDownload
from app.models.session import Session as SessionModel
from app.models.user import User, UserRole, UserStatus
from app.services import metrics

router = APIRouter()

_ALLOWED_SETTING_KEYS = {
    "max_file_size_gb",
    "global_downloads_cap_gb",
    "max_queue_size",
    "user_daily_quota_gb",
    "guest_download_limit",
    "analyze_rate_limit_per_minute",
    "file_ttl_minutes",
}


async def require_admin(user: User = Depends(require_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs.")
    return user


class ResetPasswordResponse(BaseModel):
    temporary_password: str


def _generate_temp_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/admin/users/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> ResetPasswordResponse:
    """F-05 : réinitialisation manuelle par l'admin — mot de passe temporaire à changer
    à la première connexion (must_change_password, cf. /api/auth/change-password)."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    temp_password = _generate_temp_password()
    user.password_hash = hash_password(temp_password)
    user.must_change_password = True
    await db.commit()
    return ResetPasswordResponse(temporary_password=temp_password)


class SettingsResponse(BaseModel):
    settings: dict[str, str]


class UpdateSettingsRequest(BaseModel):
    settings: dict[str, str]


@router.get("/admin/settings", response_model=SettingsResponse)
async def read_settings(
    admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session)
) -> SettingsResponse:
    return SettingsResponse(settings=await get_all_settings(db))


@router.patch("/admin/settings", response_model=SettingsResponse)
async def update_settings(
    payload: UpdateSettingsRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> SettingsResponse:
    """Les overrides prennent effet immédiatement pour cette requête admin, et sous
    30s pour le reste du service (rafraîchissement périodique, cf. core/cleanup.py)."""
    unknown = set(payload.settings) - _ALLOWED_SETTING_KEYS
    if unknown:
        raise HTTPException(status_code=422, detail=f"Réglage(s) inconnu(s) : {', '.join(sorted(unknown))}")
    for key, value in payload.settings.items():
        await set_setting(db, key, value)
    return SettingsResponse(settings=await get_all_settings(db))


# --- A-10 : gestion utilisateurs ---


class UserSummary(BaseModel):
    id: int
    pseudo: str
    role: str
    status: str
    created_at: datetime
    last_seen_at: datetime | None
    daily_quota_gb: float | None
    effective_daily_quota_bytes: float
    usage_today_bytes: int
    total_downloads: int


class UpdateUserRequest(BaseModel):
    status: str | None = None
    daily_quota_gb: float | None = Field(default=None, gt=0)


@router.get("/admin/users", response_model=list[UserSummary])
async def list_users(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session)) -> list[UserSummary]:
    users = (await db.execute(select(User).order_by(User.created_at.desc()))).scalars().all()

    # Requêtes groupées plutôt qu'une boucle par utilisateur (N+1) — négligeable au volume
    # d'un service auto-hébergé, mais autant l'éviter tant que c'est simple à faire.
    last_seen_rows = await db.execute(
        select(SessionModel.user_id, func.max(SessionModel.created_at)).group_by(SessionModel.user_id)
    )
    last_seen_by_user = dict(last_seen_rows.all())

    totals_rows = await db.execute(
        select(Download.user_id, func.count()).where(Download.user_id.is_not(None)).group_by(Download.user_id)
    )
    totals_by_user = dict(totals_rows.all())

    usage_rows = await db.execute(select(DailyUsage.user_id, DailyUsage.bytes_used).where(DailyUsage.usage_date == date.today()))
    usage_by_user = dict(usage_rows.all())

    return [
        UserSummary(
            id=u.id,
            pseudo=u.pseudo,
            role=u.role,
            status=u.status,
            created_at=u.created_at,
            last_seen_at=last_seen_by_user.get(u.id),
            daily_quota_gb=u.daily_quota_gb,
            effective_daily_quota_bytes=quota_bytes_for(u),
            usage_today_bytes=usage_by_user.get(u.id, 0),
            total_downloads=totals_by_user.get(u.id, 0),
        )
        for u in users
    ]


@router.patch("/admin/users/{user_id}", response_model=UserSummary)
async def update_user(
    user_id: int,
    payload: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> UserSummary:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    if payload.status is not None:
        if payload.status not in (UserStatus.ACTIVE, UserStatus.SUSPENDED):
            raise HTTPException(status_code=422, detail="Statut invalide.")
        user.status = payload.status
    if "daily_quota_gb" in payload.model_fields_set:
        user.daily_quota_gb = payload.daily_quota_gb
    await db.commit()

    last_seen = await db.scalar(select(func.max(SessionModel.created_at)).where(SessionModel.user_id == user.id))
    total = await db.scalar(select(func.count()).select_from(Download).where(Download.user_id == user.id))
    return UserSummary(
        id=user.id,
        pseudo=user.pseudo,
        role=user.role,
        status=user.status,
        created_at=user.created_at,
        last_seen_at=last_seen,
        daily_quota_gb=user.daily_quota_gb,
        effective_daily_quota_bytes=quota_bytes_for(user),
        usage_today_bytes=await get_today_usage_bytes(db, user.id),
        total_downloads=total or 0,
    )


@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session)
) -> dict:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    await db.execute(delete(SessionModel).where(SessionModel.user_id == user_id))
    # Historique de téléchargements détaché plutôt que supprimé (métriques globales, A-11).
    await db.execute(update(Download).where(Download.user_id == user_id).values(user_id=None))
    await db.delete(user)
    await db.commit()
    return {"ok": True}


class GuestSummary(BaseModel):
    ip_hash: str
    guest_cookie: str
    count: int
    created_at: datetime


@router.get("/admin/guests", response_model=list[GuestSummary])
async def list_guests(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session)) -> list[GuestSummary]:
    result = await db.execute(select(GuestDownload).order_by(GuestDownload.created_at.desc()).limit(200))
    return [
        GuestSummary(ip_hash=g.ip_hash, guest_cookie=g.guest_cookie, count=g.count, created_at=g.created_at)
        for g in result.scalars().all()
    ]


# --- A-11 : métriques d'usage ---


class MetricsResponse(BaseModel):
    downloads_per_day: list[dict]
    top_sites: list[dict]
    error_rate: float
    total_volume_bytes: int
    queue: list[dict]
    downloads_today: int
    active_users_today: int


async def _collect_metrics(db: AsyncSession) -> MetricsResponse:
    per_day = await metrics.downloads_per_day(db)
    downloads_today = per_day[-1]["count"] if per_day else 0
    return MetricsResponse(
        downloads_per_day=per_day,
        top_sites=await metrics.top_sites(db),
        error_rate=await metrics.error_rate(db),
        total_volume_bytes=await metrics.total_volume_bytes(db),
        queue=await metrics.queue_snapshot(db),
        downloads_today=downloads_today,
        active_users_today=await metrics.active_users_today(db),
    )


@router.get("/admin/metrics", response_model=MetricsResponse)
async def admin_metrics(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session)) -> MetricsResponse:
    return await _collect_metrics(db)


@router.get("/admin/metrics/stream")
async def admin_metrics_stream(admin: User = Depends(require_admin)) -> EventSourceResponse:
    """A-11, UI §7.3 : rafraîchissement temps réel de la vue d'ensemble."""

    async def generator():
        while True:
            async with async_session_maker() as db:
                payload = await _collect_metrics(db)
            yield {"event": "metrics", "data": payload.model_dump_json()}
            await asyncio.sleep(5)

    return EventSourceResponse(generator())


# --- A-12 : état système ---


class SystemResponse(BaseModel):
    cpu_percent: float
    cpu_frequency_mhz: float | None
    cpu_temperature_celsius: float | None
    ram_used_bytes: int
    ram_total_bytes: int
    disk_used_bytes: int
    disk_total_bytes: int
    downloads_dir_usage_bytes: int
    uptime_seconds: float
    yt_dlp_version: str


async def _collect_system() -> SystemResponse:
    # psutil.cpu_percent(interval=...) bloque le thread appelant (§1.3 : yt-dlp/ffmpeg
    # suivent déjà ce principe via asyncio.to_thread pour ne jamais geler la boucle asyncio).
    snapshot = await asyncio.to_thread(system_snapshot)
    return SystemResponse(**snapshot, downloads_dir_usage_bytes=current_downloads_usage_bytes())


@router.get("/admin/system", response_model=SystemResponse)
async def admin_system(admin: User = Depends(require_admin)) -> SystemResponse:
    return await _collect_system()


@router.get("/admin/system/stream")
async def admin_system_stream(admin: User = Depends(require_admin)) -> EventSourceResponse:
    """A-12, UI §7.3 : rafraîchissement temps réel de l'état système."""

    async def generator():
        while True:
            payload = await _collect_system()
            yield {"event": "system", "data": payload.model_dump_json()}
            await asyncio.sleep(3)

    return EventSourceResponse(generator())


# --- A-13 : journal ---


class JournalEntry(BaseModel):
    id: int
    user_id: int | None
    site: str | None
    url: str
    size_bytes: int | None
    status: str
    error_message: str | None
    created_at: datetime


@router.get("/admin/journal", response_model=list[JournalEntry])
async def admin_journal(
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> list[JournalEntry]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    query = select(Download).order_by(Download.id.desc())
    if status is not None:
        query = query.where(Download.status == status)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [
        JournalEntry(
            id=d.id,
            user_id=d.user_id,
            site=d.site,
            url=d.url,
            size_bytes=d.size_bytes,
            status=d.status,
            error_message=d.error_message,
            created_at=d.created_at,
        )
        for d in result.scalars().all()
    ]


# --- A-14 : actions rapides ---


class ActionResponse(BaseModel):
    ok: bool
    message: str


@router.post("/admin/actions/{action}", response_model=ActionResponse)
async def run_action(
    action: str, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session)
) -> ActionResponse:
    if action == "purge-downloads":
        from app.core.cleanup import purge_all_download_files

        removed = await purge_all_download_files(db)
        return ActionResponse(ok=True, message=f"{removed} fichier(s) purgé(s).")

    if action == "clear-queue":
        from app.core.queue import clear_queue

        count = await clear_queue(db)
        return ActionResponse(ok=True, message=f"{count} tâche(s) en file annulée(s).")

    if action == "update-ytdlp":
        from app.core.ytdlp_update import UpdateInProgressError, update_yt_dlp

        try:
            version = await update_yt_dlp()
        except UpdateInProgressError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return ActionResponse(
            ok=True, message=f"yt-dlp mis à jour ({version}). Redémarrage du service dans quelques secondes."
        )

    raise HTTPException(status_code=404, detail="Action inconnue.")
