from datetime import datetime, timezone

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_aware_utc(dt: datetime) -> datetime:
    """SQLite renvoie des datetimes naïfs même pour une colonne `timezone=True` :
    à utiliser avant toute comparaison Python (pas SQL) avec `utcnow()`."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
