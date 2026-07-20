import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, HttpUrl
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.auth import get_current_user
from app.config import settings
from app.core import cancellation
from app.core.db import get_session
from app.core.diskspace import current_downloads_usage_bytes
from app.core.events import bus
from app.core.filenames import sanitize_filename
from app.core.guest import GUEST_COOKIE_NAME, guest_download_count, new_guest_cookie, record_guest_download
from app.core.queue import enqueue, queue_position
from app.core.quota import has_quota_remaining
from app.core.signing import generate_file_token
from app.core.throughput import estimate_wait_seconds
from app.core.worker import enqueue_job
from app.models.download import Download, DownloadStatus
from app.models.user import User

router = APIRouter()

_ACTIVE_STATUSES = (DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING)
_TERMINAL_STATUSES = (DownloadStatus.DONE, DownloadStatus.FAILED, DownloadStatus.CANCELLED, DownloadStatus.EXPIRED)


class CreateDownloadRequest(BaseModel):
    url: HttpUrl
    mode: Literal["video", "audio", "subtitles"] = "video"
    format_id: str | None = None
    audio_format: str | None = None
    subtitle_langs: list[str] | None = None
    filename: str | None = None


class DownloadResponse(BaseModel):
    id: int
    status: str
    position: int
    estimated_wait_seconds: int | None = None


@router.post("/downloads", response_model=DownloadResponse)
async def create_download(
    payload: CreateDownloadRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_current_user),
) -> DownloadResponse:
    client_ip = request.client.host if request.client else "inconnu"
    guest_cookie = request.cookies.get(GUEST_COOKIE_NAME)

    if user is None:
        # Mode invité (F-06, F-07) : soft limit, jamais de mur d'authentification.
        if not guest_cookie:
            guest_cookie = new_guest_cookie()
            response.set_cookie(
                key=GUEST_COOKIE_NAME,
                value=guest_cookie,
                max_age=365 * 86400,
                httponly=True,
                secure=settings.secure_cookies,
                samesite="lax",
            )
        if await guest_download_count(session, client_ip, guest_cookie) >= settings.guest_download_limit:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "guest_limit_reached",
                    "message": "Tu as atteint la limite invité. Crée un compte pour continuer à télécharger.",
                },
            )
    elif not await has_quota_remaining(session, user):
        # Quota-cadeau (CDC UI §6.4) : refusé seulement si le quota était déjà atteint
        # AVANT cette demande — la précédente a été offerte même si elle l'a dépassé.
        raise HTTPException(
            status_code=403,
            detail={
                "code": "quota_reached",
                "message": "Quota journalier atteint. Réinitialisation à minuit.",
            },
        )

    active_count = await session.scalar(
        select(func.count()).select_from(Download).where(Download.status.in_(_ACTIVE_STATUSES))
    )
    if active_count >= settings.max_queue_size:
        raise HTTPException(status_code=429, detail="La file d'attente est pleine. Réessaie dans quelques minutes.")

    usage_bytes = current_downloads_usage_bytes()
    if usage_bytes >= settings.global_downloads_cap_gb * 1024**3:
        raise HTTPException(
            status_code=507,
            detail="Le quota disque global du serveur est atteint. Réessaie plus tard.",
        )

    options = payload.model_dump(exclude={"url"}, exclude_none=True)
    if "filename" in options:
        # Nom de fichier personnalisé : jamais passé tel quel à yt-dlp/ffmpeg (S-05, F-13).
        options["filename"] = sanitize_filename(options["filename"])
    options["max_file_size_gb"] = settings.max_file_size_gb

    download = await enqueue(session, url=str(payload.url), options=options, user_id=user.id if user else None)
    if user is None:
        await record_guest_download(session, client_ip, guest_cookie)
    position = await queue_position(session, download)
    await enqueue_job(download.id)
    return DownloadResponse(
        id=download.id,
        status=download.status,
        position=position,
        estimated_wait_seconds=estimate_wait_seconds(position),
    )


@router.post("/downloads/{job_id}/cancel", response_model=DownloadResponse)
async def cancel_download(job_id: int, session: AsyncSession = Depends(get_session)) -> DownloadResponse:
    download = await session.get(Download, job_id)
    if download is None:
        raise HTTPException(status_code=404, detail="Téléchargement introuvable.")

    if download.status == DownloadStatus.QUEUED:
        download.status = DownloadStatus.CANCELLED
        await session.commit()
        bus.publish(job_id, {"event": "cancelled", "data": {}})
    elif download.status in (DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING):
        cancellation.request_cancel(job_id)
    else:
        raise HTTPException(status_code=409, detail="Ce téléchargement est déjà terminé.")

    return DownloadResponse(id=download.id, status=download.status, position=0)


@router.get("/downloads/{job_id}/events")
async def download_events(job_id: int, session: AsyncSession = Depends(get_session)) -> EventSourceResponse:
    download = await session.get(Download, job_id)
    if download is None:
        raise HTTPException(status_code=404, detail="Téléchargement introuvable.")

    async def generator():
        if download.status == DownloadStatus.QUEUED:
            position = await queue_position(session, download)
            yield _sse(
                "queued",
                {"position": position, "estimated_wait_seconds": estimate_wait_seconds(position)},
            )
        elif download.status == DownloadStatus.DONE:
            yield _sse(
                "done",
                {
                    "filename": download.filename,
                    "size_bytes": download.size_bytes,
                    "file_url": f"/api/files/{generate_file_token(download.id)}",
                },
            )
            return
        elif download.status in (DownloadStatus.FAILED,):
            yield _sse("failed", {"message": download.error_message})
            return
        elif download.status in (DownloadStatus.CANCELLED, DownloadStatus.EXPIRED):
            yield _sse(download.status, {})
            return
        else:
            yield _sse(download.status, {})

        queue = bus.subscribe(job_id)
        try:
            while True:
                event = await queue.get()
                yield _sse(event["event"], event["data"])
                if event["event"] in ("done", "failed", "cancelled"):
                    break
        finally:
            bus.unsubscribe(job_id, queue)

    return EventSourceResponse(generator())


def _sse(event: str, data: dict) -> dict:
    return {"event": event, "data": json.dumps(data)}
