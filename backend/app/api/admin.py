import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_user
from app.core.auth import hash_password
from app.core.db import get_session
from app.models.user import User, UserRole

router = APIRouter()


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
