FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 lutecium
WORKDIR /app

COPY pyproject.toml alembic.ini ./
COPY app ./app
COPY alembic ./alembic

# CACHEBUST invalide volontairement le cache Docker de cette étape à chaque build
# (passer --build-arg CACHEBUST=$(date +%s)) : pyproject.toml ne fixe qu'un plancher
# de version pour yt-dlp (>=), sans cache-busting un rebuild pourrait réutiliser une
# couche mise en cache au lieu de résoudre à nouveau la dernière version sur PyPI (M-01).
ARG CACHEBUST=1
RUN pip install --no-cache-dir .

RUN mkdir -p /app/data/downloads && chown -R lutecium:lutecium /app
USER lutecium

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
