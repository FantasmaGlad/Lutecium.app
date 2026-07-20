import os

# Base en mémoire pour les tests, définie avant tout import de app.* (voir app/core/db.py).
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

# httpx (comme un vrai navigateur) ne renvoie pas les cookies Secure sur http://test.
os.environ.setdefault("SECURE_COOKIES", "false")
