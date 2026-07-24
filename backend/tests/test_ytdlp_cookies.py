from pathlib import Path

import yt_dlp

from app.config import settings
from app.core import ytdlp as ytdlp_module


class _CapturingYoutubeDL:
    """Double de yt_dlp.YoutubeDL qui capture les options reçues sans rien télécharger."""

    captured_opts: dict = {}

    def __init__(self, opts: dict):
        _CapturingYoutubeDL.captured_opts = opts

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def extract_info(self, url: str, download: bool = False):
        return {"title": "t", "formats": []}


def test_extract_info_omits_cookiefile_when_unset(monkeypatch):
    monkeypatch.setattr(settings, "cookies_file", None)
    monkeypatch.setattr(yt_dlp, "YoutubeDL", _CapturingYoutubeDL)

    ytdlp_module.extract_info("https://example.com/video")

    assert "cookiefile" not in _CapturingYoutubeDL.captured_opts


def test_extract_info_omits_cookiefile_when_file_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "cookies_file", str(tmp_path / "absent-cookies.txt"))
    monkeypatch.setattr(yt_dlp, "YoutubeDL", _CapturingYoutubeDL)

    ytdlp_module.extract_info("https://example.com/video")

    assert "cookiefile" not in _CapturingYoutubeDL.captured_opts


def test_extract_info_sets_cookiefile_when_present(monkeypatch, tmp_path):
    cookies_path = tmp_path / "cookies.txt"
    cookies_path.write_text("# Netscape HTTP Cookie File\n")
    monkeypatch.setattr(settings, "cookies_file", str(cookies_path))
    monkeypatch.setattr(yt_dlp, "YoutubeDL", _CapturingYoutubeDL)

    ytdlp_module.extract_info("https://example.com/video")

    assert _CapturingYoutubeDL.captured_opts["cookiefile"] == str(cookies_path)


def test_base_opts_sets_cookiefile_for_downloads(monkeypatch, tmp_path):
    cookies_path = tmp_path / "cookies.txt"
    cookies_path.write_text("# Netscape HTTP Cookie File\n")
    monkeypatch.setattr(settings, "cookies_file", str(cookies_path))

    opts = ytdlp_module._base_opts({}, Path(tmp_path), lambda e: None, lambda e: None)

    assert opts["cookiefile"] == str(cookies_path)
