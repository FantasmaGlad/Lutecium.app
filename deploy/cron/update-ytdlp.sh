#!/usr/bin/env bash
# M-01 : mise à jour nightly de yt-dlp (les extracteurs cassent en permanence).
#
# Met à jour le paquet dans le conteneur en cours d'exécution puis redémarre le
# service pour que le nouveau code soit réellement chargé (un `pip install` seul
# ne suffit pas : yt-dlp est importé comme bibliothèque Python et ses extracteurs
# restent en mémoire tant que le processus ne redémarre pas).
#
# Installation sur le Wyse (crontab de l'utilisateur `fanta`, à 4h du matin,
# heure creuse — un job en cours au moment du redémarrage échoue proprement et
# peut être relancé, cf. P-03 reconciliation au démarrage) :
#   0 4 * * * /home/fanta/lutecium/deploy/cron/update-ytdlp.sh >> /home/fanta/lutecium/deploy/cron/update-ytdlp.log 2>&1
#
# Rappel : ceci ne survit pas à une recréation du conteneur (docker compose down/up,
# rebuild) — seulement à un restart. Pour que l'image elle-même reste à jour lors
# d'un déploiement, le Dockerfile invalide le cache de l'étape `pip install` à
# chaque build (cf. ARG CACHEBUST).

set -euo pipefail
cd "$(dirname "$0")/.."

echo "[$(date -Is)] Mise à jour de yt-dlp…"
docker compose exec -T lutecium-api pip install --upgrade --no-cache-dir yt-dlp
echo "[$(date -Is)] Redémarrage de lutecium-api…"
docker compose restart lutecium-api
echo "[$(date -Is)] Terminé."
