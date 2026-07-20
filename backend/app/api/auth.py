from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.auth import hash_password, verify_password
from app.core.bruteforce import is_locked, record_failure
from app.core.bruteforce import reset as reset_bruteforce
from app.core.db import get_session
from app.core.quota import get_today_usage_bytes, quota_bytes_for
from app.core.sessions import COOKIE_NAME, create_session, delete_session, get_session_by_token
from app.models.user import User, UserStatus

router = APIRouter()


class RegisterRequest(BaseModel):
    pseudo: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    pseudo: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str | None = None
    new_password: str = Field(min_length=8)


class UserResponse(BaseModel):
    id: int
    pseudo: str
    role: str
    must_change_password: bool
    usage_today_bytes: int
    daily_quota_bytes: float


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
    )


async def _to_response(db: AsyncSession, user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        pseudo=user.pseudo,
        role=user.role,
        must_change_password=user.must_change_password,
        usage_today_bytes=await get_today_usage_bytes(db, user.id),
        daily_quota_bytes=quota_bytes_for(user),
    )


async def get_current_user(request: Request, db: AsyncSession = Depends(get_session)) -> User | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    session = await get_session_by_token(db, token)
    if session is None:
        return None
    return await db.get(User, session.user_id)


async def require_user(user: User | None = Depends(get_current_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Connexion requise.")
    return user


@router.post("/auth/register", response_model=UserResponse)
async def register(
    payload: RegisterRequest, response: Response, db: AsyncSession = Depends(get_session)
) -> UserResponse:
    existing = await db.scalar(select(User).where(User.pseudo == payload.pseudo))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Ce pseudo est déjà utilisé.")

    user = User(pseudo=payload.pseudo, password_hash=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    session = await create_session(db, user.id, None)
    _set_session_cookie(response, session.token)
    return await _to_response(db, user)


@router.post("/auth/login", response_model=UserResponse)
async def login(
    payload: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_session)
) -> UserResponse:
    client_ip = request.client.host if request.client else "inconnu"
    if is_locked(payload.pseudo, client_ip):
        raise HTTPException(status_code=429, detail="Trop de tentatives. Réessaie dans quelques minutes.")

    user = await db.scalar(select(User).where(User.pseudo == payload.pseudo))
    if user is None or not verify_password(payload.password, user.password_hash):
        record_failure(payload.pseudo, client_ip)
        raise HTTPException(status_code=401, detail="Pseudo ou mot de passe incorrect.")

    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="Ce compte est suspendu.")

    reset_bruteforce(payload.pseudo, client_ip)
    session = await create_session(db, user.id, request.headers.get("user-agent"))
    _set_session_cookie(response, session.token)
    return await _to_response(db, user)


@router.post("/auth/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_session)) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await delete_session(db, token)
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@router.get("/auth/me", response_model=UserResponse)
async def me(user: User = Depends(require_user), db: AsyncSession = Depends(get_session)) -> UserResponse:
    return await _to_response(db, user)


@router.post("/auth/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    if not user.must_change_password:
        if payload.current_password is None or not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect.")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    await db.commit()
    return {"ok": True}
