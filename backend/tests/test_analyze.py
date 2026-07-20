from httpx import ASGITransport, AsyncClient
import pytest

from app.api import analyze as analyze_module
from app.core.ytdlp import PlaylistNotSupportedError
from app.main import create_app

FAKE_VIDEO_INFO = {
    "title": "Ma Vidéo : Test / Démo",
    "duration": 125,
    "thumbnail": "https://example.com/thumb.jpg",
    "extractor_key": "Youtube",
    "formats": [
        {
            "format_id": "137",
            "ext": "mp4",
            "vcodec": "avc1",
            "acodec": "none",
            "width": 1920,
            "height": 1080,
            "fps": 30,
            "filesize": 12_000_000,
        },
        {
            "format_id": "140",
            "ext": "m4a",
            "vcodec": "none",
            "acodec": "mp4a.40.2",
            "abr": 128,
            "filesize": 2_000_000,
        },
    ],
    "subtitles": {
        "fr": [{"ext": "vtt"}],
        "en": [{"ext": "vtt"}],
    },
}


@pytest.mark.asyncio
async def test_analyze_success(monkeypatch):
    monkeypatch.setattr(analyze_module, "extract_info", lambda url: FAKE_VIDEO_INFO)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/analyze", json={"url": "https://example.com/video"})

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Ma Vidéo : Test / Démo"
    assert body["suggested_filename"] == "Ma Vidéo Test Démo"
    assert body["site"] == "Youtube"
    assert len(body["video_formats"]) == 1
    assert body["video_formats"][0]["resolution"] == "1920x1080"
    assert len(body["audio_formats"]) == 1
    assert {s["lang"] for s in body["subtitles"]} == {"fr", "en"}


@pytest.mark.asyncio
async def test_analyze_rejects_playlist(monkeypatch):
    def raise_playlist(url):
        raise PlaylistNotSupportedError("Les playlists ne sont pas prises en charge.")

    monkeypatch.setattr(analyze_module, "extract_info", raise_playlist)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/analyze", json={"url": "https://example.com/playlist"})

    assert response.status_code == 422
    assert "playlist" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_analyze_invalid_url():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/analyze", json={"url": "pas-une-url"})

    assert response.status_code == 422
