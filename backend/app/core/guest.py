import hashlib
import secrets
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.guest_download import GuestDownload

GUEST_COOKIE_NAME = "lutecium_guest"


def new_guest_cookie() -> str:
    return secrets.token_urlsafe(16)


def _hash_ip(ip: str, salt: str) -> str:
    return hashlib.sha256(f"{ip}{salt}".encode()).hexdigest()


def _daily_salt() -> str:
    return date.today().isoformat()


async def guest_download_count(db: AsyncSession, ip: str, guest_cookie: str) -> int:
    """Compteur combiné cookie + IP (F-07) : soft limit volontairement contournable,
    aucun mécanisme agressif. Réinitialisé chaque jour (sel quotidien sur l'IP)."""
    ip_hash = _hash_ip(ip, _daily_salt())
    result = await db.execute(
        select(GuestDownload).where(
            (GuestDownload.ip_hash == ip_hash) | (GuestDownload.guest_cookie == guest_cookie)
        )
    )
    return sum(record.count for record in result.scalars().all())


async def record_guest_download(db: AsyncSession, ip: str, guest_cookie: str) -> None:
    ip_hash = _hash_ip(ip, _daily_salt())
    record = await db.scalar(
        select(GuestDownload).where(
            GuestDownload.ip_hash == ip_hash, GuestDownload.guest_cookie == guest_cookie
        )
    )
    if record is None:
        record = GuestDownload(ip_hash=ip_hash, guest_cookie=guest_cookie, count=0)
        db.add(record)
    record.count += 1
    await db.commit()
