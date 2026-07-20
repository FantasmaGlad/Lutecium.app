import pytest

from app.core.signing import InvalidFileTokenError, generate_file_token, verify_file_token


def test_round_trip():
    token = generate_file_token(42)
    assert verify_file_token(token) == 42


def test_invalid_token_rejected():
    with pytest.raises(InvalidFileTokenError):
        verify_file_token("ceci-nest-pas-un-token-valide")


def test_tampered_token_rejected():
    token = generate_file_token(1)
    # Modifie un caractère au milieu du token (pas le dernier : dernier octet base64
    # partiellement "don't care", modifier uniquement celui-ci peut ne rien changer).
    mid = len(token) // 2
    flipped = "a" if token[mid] != "a" else "b"
    tampered = token[:mid] + flipped + token[mid + 1 :]
    with pytest.raises(InvalidFileTokenError):
        verify_file_token(tampered)
