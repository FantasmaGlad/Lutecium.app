"""A-01 : compte admin créé à l'installation. En attendant le script interactif (P5-02),
le compte est créé au démarrage si ADMIN_PSEUDO/ADMIN_PASSWORD sont renseignés et
qu'aucun admin n'existe encore — idempotent, jamais d'identifiants par défaut."""

import logging

from sqlalchemy import select

from app.config import settings
from app.core.auth import hash_password
from app.core.db import async_session_maker
from app.models.user import User, UserRole

log = logging.getLogger(__name__)


async def bootstrap_admin() -> None:
    if not settings.admin_pseudo or not settings.admin_password:
        return

    async with async_session_maker() as session:
        existing_admin = await session.scalar(select(User).where(User.role == UserRole.ADMIN))
        if existing_admin is not None:
            return

        existing_pseudo = await session.scalar(select(User).where(User.pseudo == settings.admin_pseudo))
        if existing_pseudo is not None:
            log.warning(
                "ADMIN_PSEUDO=%s correspond déjà à un compte non-admin ; aucun compte admin créé automatiquement.",
                settings.admin_pseudo,
            )
            return

        admin = User(
            pseudo=settings.admin_pseudo,
            password_hash=hash_password(settings.admin_password),
            role=UserRole.ADMIN,
        )
        session.add(admin)
        await session.commit()
        log.info("Compte admin '%s' créé au démarrage.", settings.admin_pseudo)
