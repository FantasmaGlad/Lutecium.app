from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import settings

_serializer = URLSafeTimedSerializer(settings.secret_key, salt="lutecium-file-link")


class InvalidFileTokenError(Exception):
    """Lien invalide ou expiré (F-24, F-30)."""


def generate_file_token(job_id: int) -> str:
    return _serializer.dumps({"job_id": job_id})


def verify_file_token(token: str) -> int:
    try:
        data = _serializer.loads(token, max_age=settings.file_ttl_minutes * 60)
    except (BadSignature, SignatureExpired) as exc:
        raise InvalidFileTokenError("Ce lien de téléchargement n'est plus valide.") from exc
    return data["job_id"]
