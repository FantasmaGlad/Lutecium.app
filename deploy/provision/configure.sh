#!/usr/bin/env bash
# P5-02 — Configuration interactive : génère/actualise deploy/.env (§9 étape 5).
# Idempotent et relançable : relit deploy/.env existant pour proposer les valeurs
# actuelles comme défauts (touche Entrée = garder), ne régénère jamais une
# SECRET_KEY existante (invaliderait toutes les sessions et liens signés en cours,
# S-04/F-24) et ne force pas un nouveau mot de passe admin si un admin existe déjà
# (le bootstrap applicatif est lui-même idempotent, cf. backend/app/core/bootstrap_admin.py).
#
# Usage : ./configure.sh   (depuis deploy/provision/, ou via install-lutecium.sh)
set -uo pipefail
cd "$(dirname "$0")/.."   # -> deploy/

ENV_FILE=".env"

load_env() {
  # Lecture manuelle en KEY=VALUE brut (pas de `source` : des valeurs comme
  # « lutecium.app, lutecium.duckdns.org » contiennent une virgule/espace et
  # cassent l'interprétation shell d'un fichier sourcé).
  [ -f "$ENV_FILE" ] || return 0
  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    case "$key" in
      [A-Za-z_]*[A-Za-z0-9_]) printf -v "$key" '%s' "$value" ;;
    esac
  done < "$ENV_FILE"
}
load_env

echo "=== Configuration Lutecium (deploy/.env) ==="
echo "Entrée seule = garder la valeur entre crochets."
echo

prompt_default() {
  # prompt_default VAR "Question" "défaut si VAR jamais posé"
  local var="$1" question="$2" fallback="$3" current answer
  current="${!var:-$fallback}"
  read -r -p "${question} [${current}] : " answer
  printf -v "$var" '%s' "${answer:-$current}"
}

prompt_secret() {
  # prompt_secret VAR "Question" — n'affiche jamais la valeur actuelle ni la saisie.
  local var="$1" question="$2" answer
  read -r -s -p "${question} (Entrée = garder la valeur actuelle) : " answer
  echo
  if [ -n "$answer" ]; then
    printf -v "$var" '%s' "$answer"
  fi
}

prompt_default LUTECIUM_DOMAIN "Domaine(s) Caddy (séparés par ', ')" "lutecium.app, lutecium.duckdns.org"
prompt_default DUCKDNS_SUBDOMAIN "Sous-domaine DuckDNS (sans .duckdns.org)" "lutecium"
prompt_secret DUCKDNS_TOKEN "Token DuckDNS (https://www.duckdns.org)"
prompt_default CADDY_ACME_EMAIL "Email pour Let's Encrypt" "admin@example.com"
prompt_default PUID "UID système exécutant les conteneurs" "$(id -u)"
prompt_default PGID "GID système exécutant les conteneurs" "$(id -g)"

if [ -z "${SECRET_KEY:-}" ] || [ "${SECRET_KEY}" = "change-me-in-production" ]; then
  SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
  echo "SECRET_KEY générée automatiquement (S-04/F-24)."
fi

echo
echo "--- Quotas et limites (§6) — Entrée pour garder le défaut recommandé ---"
prompt_default USER_DAILY_QUOTA_GB "Quota journalier par compte (Go)" "${USER_DAILY_QUOTA_GB:-20}"
prompt_default GUEST_DOWNLOAD_LIMIT "Téléchargements autorisés en invité" "${GUEST_DOWNLOAD_LIMIT:-1}"
prompt_default MAX_FILE_SIZE_GB "Taille de fichier maximale (Go)" "${MAX_FILE_SIZE_GB:-8}"
prompt_default GLOBAL_DOWNLOADS_CAP_GB "Cap disque global pour les téléchargements (Go)" "${GLOBAL_DOWNLOADS_CAP_GB:-15}"
prompt_default MAX_CONCURRENT_DOWNLOADS "Téléchargements simultanés max" "${MAX_CONCURRENT_DOWNLOADS:-2}"
prompt_default MAX_QUEUE_SIZE "Taille max de la file d'attente" "${MAX_QUEUE_SIZE:-20}"
prompt_default FILE_TTL_MINUTES "TTL des fichiers prêts (minutes)" "${FILE_TTL_MINUTES:-5}"
prompt_default SESSION_DAYS "Durée des sessions (jours)" "${SESSION_DAYS:-30}"
prompt_default ANALYZE_RATE_LIMIT_PER_MINUTE "Limite d'analyses par minute/IP" "${ANALYZE_RATE_LIMIT_PER_MINUTE:-10}"

echo
if [ -n "${ADMIN_PSEUDO:-}" ]; then
  echo "--- Compte admin (A-01) : ${ADMIN_PSEUDO} déjà configuré ---"
  read -r -p "Changer les identifiants admin ? [o/N] : " change_admin
else
  echo "--- Compte admin (A-01) : aucun configuré ---"
  change_admin="o"
fi

if [ "${change_admin,,}" = "o" ]; then
  prompt_default ADMIN_PSEUDO "Pseudo (ou email) admin" "${ADMIN_PSEUDO:-}"
  attempts=0
  while [ "$attempts" -lt 5 ]; do
    read -r -s -p "Mot de passe admin : " admin_password_1 || { echo; echo "ERREUR : entrée interrompue, abandon."; exit 1; }
    echo
    read -r -s -p "Confirmer le mot de passe : " admin_password_2 || { echo; echo "ERREUR : entrée interrompue, abandon."; exit 1; }
    echo
    if [ "$admin_password_1" = "$admin_password_2" ] && [ -n "$admin_password_1" ]; then
      ADMIN_PASSWORD="$admin_password_1"
      break
    fi
    attempts=$((attempts + 1))
    echo "Les deux saisies ne correspondent pas (ou sont vides), réessaie."
  done
  if [ "$attempts" -ge 5 ]; then
    echo "ERREUR : trop d'essais infructueux, abandon."
    exit 1
  fi
fi

echo
echo "--- cookies.txt (M-04, optionnel) ---"
echo "Si des sites l'exigent (Instagram...), voir README.md : déposer le fichier dans"
echo "deploy/cookies/cookies.txt puis décommenter COOKIES_FILE dans deploy/.env."

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
fi

cat > "$ENV_FILE" <<EOF
# Généré par deploy/provision/configure.sh le $(date -Is) — ne pas commiter.
LUTECIUM_DOMAIN=${LUTECIUM_DOMAIN}
DUCKDNS_SUBDOMAIN=${DUCKDNS_SUBDOMAIN}
DUCKDNS_TOKEN=${DUCKDNS_TOKEN}
CADDY_ACME_EMAIL=${CADDY_ACME_EMAIL}
PUID=${PUID}
PGID=${PGID}
SECRET_KEY=${SECRET_KEY}
USER_DAILY_QUOTA_GB=${USER_DAILY_QUOTA_GB}
GUEST_DOWNLOAD_LIMIT=${GUEST_DOWNLOAD_LIMIT}
MAX_FILE_SIZE_GB=${MAX_FILE_SIZE_GB}
GLOBAL_DOWNLOADS_CAP_GB=${GLOBAL_DOWNLOADS_CAP_GB}
MAX_CONCURRENT_DOWNLOADS=${MAX_CONCURRENT_DOWNLOADS}
MAX_QUEUE_SIZE=${MAX_QUEUE_SIZE}
FILE_TTL_MINUTES=${FILE_TTL_MINUTES}
SESSION_DAYS=${SESSION_DAYS}
ANALYZE_RATE_LIMIT_PER_MINUTE=${ANALYZE_RATE_LIMIT_PER_MINUTE}
ADMIN_PSEUDO=${ADMIN_PSEUDO:-}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
# COOKIES_FILE=/app/cookies/cookies.txt
EOF
chmod 600 "$ENV_FILE"

echo
echo "deploy/.env écrit (permissions 600)."
