from app.core.filenames import sanitize_filename


def test_removes_disallowed_characters():
    assert sanitize_filename("Ma Vidéo : Test / Démo") == "Ma Vidéo Test Démo"


def test_falls_back_when_empty_after_cleaning():
    assert sanitize_filename("#чита#кирилл") == "video"


def test_truncates_long_names():
    assert len(sanitize_filename("a" * 300)) == 150


def test_strips_leading_trailing_dots_and_dashes():
    assert sanitize_filename("...evil-name--") == "evil-name"
