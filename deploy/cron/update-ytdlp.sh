#!/usr/bin/env bash
# M-01 : mise à jour périodique de yt-dlp (les extracteurs cassent en permanence,
# c'est le point de fragilité n°1 du service — cf. cahier des charges §11).
#
# Appelle l'action admin déjà testée (POST /api/admin/actions/update-ytdlp) plutôt
# que de dupliquer sa logique en bash : une seule implémentation du garde-fou
# « pas de redémarrage pendant un téléchargement actif » et de l'auto-redémarrage
# propre (cf. backend/app/core/ytdlp_update.py). Robustesse :
#   - jamais tributaire du réseau externe : --resolve force une boucle locale
#     (127.0.0.1) tout en gardant le bon SNI/Host pour que Caddy route correctement
#     et présente le vrai certificat (pas de -k/insecure nécessaire) ;
#   - retries avec backoff sur la connexion/authentification (résilience aux
#     accrocs réseau transitoires déjà observés sur ce serveur) ;
#   - ne force jamais un redémarrage pendant un téléchargement actif (409 → on
#     laisse la main au prochain passage, pas d'échec bruyant) ;
#   - vérifie après coup que le service est bien revenu (sinon alerte explicite
#     dans le log — health check qui échoue après une maj = signal fort à ne pas
#     laisser filer silencieusement) ;
#   - jamais d'identifiants en clair dans les logs ; cookie de session éphémère.
#
# Installation (crontab de l'utilisateur `fanta` sur le Wyse) — toutes les 6h
# plutôt qu'une seule fois par nuit : réduit la fenêtre de « yt-dlp périmé » à
# 6h max au lieu de 24h, sans risque supplémentaire grâce au garde-fou 409 :
#   0 */6 * * * /home/fanta/lutecium/deploy/cron/update-ytdlp.sh >> /home/fanta/lutecium/deploy/cron/update-ytdlp.log 2>&1
#
# Nécessite ADMIN_PSEUDO/ADMIN_PASSWORD dans deploy/.env (mêmes identifiants que
# le bootstrap du compte admin, cf. backend/app/core/bootstrap_admin.py).
#
# Rappel : la mise à jour "à chaud" ne survit pas à une *recréation* du conteneur
# (docker compose down/up, rebuild) — seulement à un restart. Le Dockerfile
# invalide son cache de build à chaque reconstruction (cf. ARG CACHEBUST) pour
# que ce cas-là reparte aussi de la dernière version disponible.

set -uo pipefail
cd "$(dirname "$0")/.."

DOMAIN="${LUTECIUM_UPDATE_DOMAIN:-lutecium.app}"
MAX_ATTEMPTS=3
RETRY_DELAY_SECONDS=15
HEALTH_CHECK_ATTEMPTS=10
HEALTH_CHECK_DELAY_SECONDS=3

# shellcheck disable=SC1091
[ -f .env ] && . ./.env

if [ -z "${ADMIN_PSEUDO:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "[$(date -Is)] ERREUR : ADMIN_PSEUDO/ADMIN_PASSWORD absents de deploy/.env, abandon."
  exit 1
fi

COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

curl_local() {
  # Boucle locale forcée : indépendant du DNS/routeur/WAN, cf. en-tête du fichier.
  curl -sS --resolve "${DOMAIN}:443:127.0.0.1" "$@"
}

log() { echo "[$(date -Is)] $*"; }

attempt=1
login_status=""
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  login_status="$(curl_local -c "$COOKIE_JAR" -o /dev/null -w '%{http_code}' \
    -X POST "https://${DOMAIN}/api/auth/login" \
    -H 'Content-Type: application/json' \
    --data-binary "{\"pseudo\":\"${ADMIN_PSEUDO}\",\"password\":\"${ADMIN_PASSWORD}\"}")"
  [ "$login_status" = "200" ] && break
  log "Connexion admin échouée (HTTP ${login_status}, tentative ${attempt}/${MAX_ATTEMPTS})."
  attempt=$((attempt + 1))
  [ "$attempt" -le "$MAX_ATTEMPTS" ] && sleep "$RETRY_DELAY_SECONDS"
done

if [ "$login_status" != "200" ]; then
  log "ERREUR : impossible de s'authentifier après ${MAX_ATTEMPTS} tentatives, abandon."
  exit 1
fi

attempt=1
action_status=""
action_body=""
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  response_file="$(mktemp)"
  action_status="$(curl_local -b "$COOKIE_JAR" -o "$response_file" -w '%{http_code}' \
    -X POST "https://${DOMAIN}/api/admin/actions/update-ytdlp")"
  action_body="$(cat "$response_file")"
  rm -f "$response_file"

  case "$action_status" in
    200)
      log "OK : ${action_body}"
      break
      ;;
    409)
      log "Téléchargements en cours, mise à jour reportée au prochain passage : ${action_body}"
      exit 0
      ;;
    *)
      log "Échec de l'action update-ytdlp (HTTP ${action_status}, tentative ${attempt}/${MAX_ATTEMPTS}) : ${action_body}"
      attempt=$((attempt + 1))
      [ "$attempt" -le "$MAX_ATTEMPTS" ] && sleep "$RETRY_DELAY_SECONDS"
      ;;
  esac
done

if [ "$action_status" != "200" ]; then
  log "ERREUR : mise à jour de yt-dlp échouée après ${MAX_ATTEMPTS} tentatives."
  exit 1
fi

# Le service redémarre lui-même quelques secondes après la réponse (cf. ytdlp_update.py).
sleep 5
attempt=1
while [ "$attempt" -le "$HEALTH_CHECK_ATTEMPTS" ]; do
  health_status="$(curl_local -o /dev/null -w '%{http_code}' "https://${DOMAIN}/api/health")"
  if [ "$health_status" = "200" ]; then
    log "Service de retour après redémarrage (tentative ${attempt}/${HEALTH_CHECK_ATTEMPTS})."
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep "$HEALTH_CHECK_DELAY_SECONDS"
done

log "ALERTE : le service ne répond plus ${HEALTH_CHECK_ATTEMPTS} tentatives après le redémarrage — à vérifier manuellement."
exit 1
