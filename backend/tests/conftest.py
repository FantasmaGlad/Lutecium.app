import os

# Base en mémoire pour les tests, définie avant tout import de app.* (voir app/core/db.py).
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
