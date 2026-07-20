from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.db import get_session
from app.core.signing import InvalidFileTokenError, verify_file_token
from app.models.download import Download, DownloadStatus

router = APIRouter()


@router.get("/files/{token}")
async def download_file(token: str, session: AsyncSession = Depends(get_session)) -> FileResponse:
    try:
        job_id = verify_file_token(token)
    except InvalidFileTokenError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc

    download = await session.get(Download, job_id)
    if download is None or download.status != DownloadStatus.DONE or not download.filename:
        raise HTTPException(status_code=404, detail="Ce fichier n'est plus disponible.")

    file_path = Path(settings.downloads_dir) / str(job_id) / download.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Ce fichier n'est plus disponible.")

    return FileResponse(
        path=file_path,
        filename=download.filename,
        media_type="application/octet-stream",
    )
