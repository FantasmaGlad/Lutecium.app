import secrets
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.base import as_aware_utc, utcnow
from app.models.session import Session as SessionModel

COOKIE_NAME = "lutecium_session"


async def create_session(db: AsyncSession, user_id: int, user_agent: str | None) -> SessionModel:
    session = SessionModel(
        token=secrets.token_urlsafe(32),  # 256 bits (PLAN §1.3)
        user_id=user_id,
        expires_at=utcnow() + timedelta(days=settings.session_days),
        user_agent=user_agent,
    )
    db.add(session)
    await db.commit()
    return session


async def get_session_by_token(db: AsyncSession, token: str) -> SessionModel | None:
    session = await db.get(SessionModel, token)
    if session is None or as_aware_utc(session.expires_at) < utcnow():
        return None
    return session


async def delete_session(db: AsyncSession, token: str) -> None:
    session = await db.get(SessionModel, token)
    if session is not None:
        await db.delete(session)
        await db.commit()
