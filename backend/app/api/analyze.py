import asyncio

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, HttpUrl

from app.core import effective_settings
from app.core.filenames import sanitize_filename
from app.core.ratelimit import check_rate_limit
from app.core.ytdlp import AnalyzeError, extract_info

router = APIRouter()


class AnalyzeRequest(BaseModel):
    url: HttpUrl


class VideoFormat(BaseModel):
    format_id: str
    ext: str
    resolution: str | None = None
    fps: float | None = None
    filesize_bytes: int | None = None
    vcodec: str | None = None


class AudioFormat(BaseModel):
    format_id: str
    ext: str
    abr: float | None = None
    filesize_bytes: int | None = None
    acodec: str | None = None


class SubtitleTrack(BaseModel):
    lang: str
    ext: str


class AnalyzeResponse(BaseModel):
    title: str
    duration_seconds: int | None = None
    thumbnail_url: str | None = None
    site: str
    suggested_filename: str
    video_formats: list[VideoFormat]
    audio_formats: list[AudioFormat]
    subtitles: list[SubtitleTrack]


def _build_response(info: dict) -> AnalyzeResponse:
    video_formats: list[VideoFormat] = []
    audio_formats: list[AudioFormat] = []

    for fmt in info.get("formats") or []:
        vcodec = fmt.get("vcodec")
        acodec = fmt.get("acodec")
        has_video = vcodec not in (None, "none")
        has_audio = acodec not in (None, "none")
        filesize = fmt.get("filesize") or fmt.get("filesize_approx")

        if has_video:
            resolution = fmt.get("resolution")
            if not resolution and fmt.get("width") and fmt.get("height"):
                resolution = f"{fmt['width']}x{fmt['height']}"
            video_formats.append(
                VideoFormat(
                    format_id=str(fmt.get("format_id", "")),
                    ext=fmt.get("ext", ""),
                    resolution=resolution,
                    fps=fmt.get("fps"),
                    filesize_bytes=filesize,
                    vcodec=vcodec,
                )
            )
        elif has_audio:
            audio_formats.append(
                AudioFormat(
                    format_id=str(fmt.get("format_id", "")),
                    ext=fmt.get("ext", ""),
                    abr=fmt.get("abr"),
                    filesize_bytes=filesize,
                    acodec=acodec,
                )
            )

    subtitles = [
        SubtitleTrack(lang=lang, ext=tracks[0].get("ext", ""))
        for lang, tracks in (info.get("subtitles") or {}).items()
        if tracks
    ]

    return AnalyzeResponse(
        title=info.get("title") or "Sans titre",
        duration_seconds=info.get("duration"),
        thumbnail_url=info.get("thumbnail"),
        site=info.get("extractor_key") or info.get("extractor") or "inconnu",
        suggested_filename=sanitize_filename(info.get("title") or "video"),
        video_formats=video_formats,
        audio_formats=audio_formats,
        subtitles=subtitles,
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest, request: Request) -> AnalyzeResponse:
    client_ip = request.client.host if request.client else "inconnu"
    if not check_rate_limit(client_ip, effective_settings.analyze_rate_limit_per_minute()):
        raise HTTPException(status_code=429, detail="Trop de requêtes d'analyse. Réessaie dans une minute.")

    try:
        info = await asyncio.to_thread(extract_info, str(payload.url))
    except AnalyzeError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc

    return _build_response(info)
