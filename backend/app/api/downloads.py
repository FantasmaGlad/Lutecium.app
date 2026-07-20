from fastapi import APIRouter, Depends
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.queue import enqueue, queue_position
from app.core.worker import enqueue_job

router = APIRouter()


class CreateDownloadRequest(BaseModel):
    url: HttpUrl
    mode: str = "video"
    format_id: str | None = None
    audio_format: str | None = None
    subtitle_langs: list[str] | None = None
    filename: str | None = None


class DownloadResponse(BaseModel):
    id: int
    status: str
    position: int


@router.post("/downloads", response_model=DownloadResponse)
async def create_download(
    payload: CreateDownloadRequest,
    session: AsyncSession = Depends(get_session),
) -> DownloadResponse:
    options = payload.model_dump(exclude={"url"}, exclude_none=True)
    download = await enqueue(session, url=str(payload.url), options=options)
    position = await queue_position(session, download)
    await enqueue_job(download.id)
    return DownloadResponse(id=download.id, status=download.status, position=position)
