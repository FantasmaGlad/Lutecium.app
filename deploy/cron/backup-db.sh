#!/usr/bin/env bash
# P-04/§3.2 : sauvegarde quotidienne de la base SQLite (lutecium.db), rotation 7 jours.
#
# La base tourne en WAL (P2-01) : une simple copie du fichier .db peut manquer des
# écritures encore dans le fichier -wal, donc ne pas utiliser cp/rsync directement.
# Utilise l'API de backup à chaud de sqlite3 (module standard Python, déjà présent
# dans l'image python:3.12-slim), exécutée dans le conteneur via `docker compose exec`
# — cohérente même avec le service en cours d'utilisation, aucun arrêt nécessaire.
#
# Installation (crontab de l'utilisateur `fanta` sur le Wyse) — quotidien à 3h, décalé
# par rapport au cron yt-dlp (toutes les 6h, cf. update-ytdlp.sh) :
#   0 3 * * * /home/fanta/lutecium/deploy/cron/backup-db.sh >> /home/fanta/lutecium/deploy/cron/backup-db.log 2>&1

set -uo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="$(pwd)/backups"
RETENTION_DAYS=7
SERVICE="lutecium-api"
CONTAINER_DB="/app/data/lutecium.db"
CONTAINER_TMP="/app/data/.backup_tmp.db"

log() { echo "[$(date -Is)] $*"; }

mkdir -p "$BACKUP_DIR"

if ! docker compose exec -T "$SERVICE" test -f "$CONTAINER_DB"; then
  log "ERREUR : ${CONTAINER_DB} introuvable dans le conteneur ${SERVICE}, abandon."
  exit 1
fi

# Backup à chaud cohérent (gère le WAL correctement, contrairement à une copie de fichier).
if ! docker compose exec -T "$SERVICE" python3 -c "
import sqlite3
src = sqlite3.connect('file:${CONTAINER_DB}?mode=ro', uri=True)
dst = sqlite3.connect('${CONTAINER_TMP}')
with dst:
    src.backup(dst)
dst.close()
src.close()
"; then
  log "ERREUR : échec du backup à chaud (sqlite3 .backup) dans le conteneur."
  docker compose exec -T "$SERVICE" rm -f "$CONTAINER_TMP" 2>/dev/null || true
  exit 1
fi

dest="${BACKUP_DIR}/lutecium-$(date +%Y%m%d-%H%M%S).db"

if ! docker compose cp "${SERVICE}:${CONTAINER_TMP}" "$dest"; then
  log "ERREUR : échec de la copie du backup hors du conteneur."
  docker compose exec -T "$SERVICE" rm -f "$CONTAINER_TMP" 2>/dev/null || true
  exit 1
fi

docker compose exec -T "$SERVICE" rm -f "$CONTAINER_TMP" 2>/dev/null || true

gzip -f "$dest"
log "OK : backup créé (${dest}.gz, $(du -h "${dest}.gz" | cut -f1))."

# Rotation : ne garder que les RETENTION_DAYS derniers jours (disque de 32 GB, §2.3).
find "$BACKUP_DIR" -name 'lutecium-*.db.gz' -mtime "+${RETENTION_DAYS}" -print -delete | while read -r removed; do
  log "Rotation : suppression de ${removed} (> ${RETENTION_DAYS} j)."
done

exit 0
