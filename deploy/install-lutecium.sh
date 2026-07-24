#!/usr/bin/env bash
# P5-01 — Installation complète et idempotente de Lutecium sur un Debian 13 vierge (§9).
# Orchestre les scripts déjà écrits et testés séparément plutôt que de dupliquer leur
# logique : provision/phase0.sh (étapes §9.1-4,7), provision/configure.sh (§9.5),
# provision/terminal.sh (§9.8). Relançable sans casse : chaque sous-script vérifie
# déjà l'état avant d'agir.
#
# Usage : depuis une machine Debian 13 vierge, en tant qu'utilisateur non-root avec
# sudo NOPASSWD (ou lance directement en root) :
#   git clone <url-du-dépôt> ~/lutecium && cd ~/lutecium/deploy && ./install-lutecium.sh
# Si le dépôt n'a pas encore de remote Git accessible depuis le serveur, copier le
# répertoire lutecium/ par un autre moyen (rsync/scp) avant de lancer ce script.
set -uo pipefail
cd "$(dirname "$0")"   # -> deploy/
DEPLOY_DIR="$(pwd)"

log() { echo -e "\n=== $* ==="; }
die() { echo "ERREUR : $*" >&2; exit 1; }

command -v sudo >/dev/null && SUDO="sudo" || SUDO=""

log "1/6 Durcissement système + Docker + auto-cpufreq (S-01/02/08/10, P-01)"
$SUDO bash provision/phase0.sh || die "phase0.sh a échoué, voir ci-dessus."

log "2/6 Configuration interactive (.env)"
bash provision/configure.sh || die "configure.sh a échoué ou a été interrompu."

log "3/6 Conteneurs (build + démarrage)"
docker compose up -d --build || die "docker compose up a échoué."

log "4/6 Attente du service applicatif"
ready=""
for _ in $(seq 1 30); do
  if docker compose exec -T lutecium-api python3 -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)" \
    >/dev/null 2>&1; then
    ready="1"
    break
  fi
  sleep 2
done
if [ -z "$ready" ]; then
  echo "AVERTISSEMENT : /api/health ne répond toujours pas après 60s — vérifie 'docker compose logs lutecium-api'."
else
  echo "Backend prêt (migrations Alembic + éventuel compte admin appliqués au démarrage)."
fi

log "5/6 Crons (yt-dlp nightly, backup BDD quotidien)"
CRON_MARKER="# Lutecium (posé par install-lutecium.sh)"
existing_crontab="$($SUDO -u "${SUDO_USER:-$USER}" crontab -l 2>/dev/null || true)"
if echo "$existing_crontab" | grep -qF "$CRON_MARKER"; then
  echo "Crons déjà installés, inchangés."
else
  new_crontab="$(cat <<EOF
${existing_crontab}
${CRON_MARKER}
0 */6 * * * ${DEPLOY_DIR}/cron/update-ytdlp.sh >> ${DEPLOY_DIR}/cron/update-ytdlp.log 2>&1
0 3 * * * ${DEPLOY_DIR}/cron/backup-db.sh >> ${DEPLOY_DIR}/cron/backup-db.log 2>&1
EOF
)"
  echo "$new_crontab" | $SUDO -u "${SUDO_USER:-$USER}" crontab -
  echo "Crons installés (maj yt-dlp toutes les 6h, backup BDD quotidien à 3h)."
fi

log "6/6 Beau terminal (optionnel)"
read -r -p "Configurer zsh + starship + alias (§9.8) ? [O/n] : " want_terminal
if [ "${want_terminal,,}" != "n" ]; then
  $SUDO bash provision/terminal.sh || echo "AVERTISSEMENT : terminal.sh a échoué (non bloquant)."
else
  echo "Ignoré."
fi

domain="$(grep -m1 '^LUTECIUM_DOMAIN=' .env 2>/dev/null | cut -d= -f2- | cut -d, -f1 | xargs)"
cat <<EOF

=====================================================================
 Installation terminée.

 URL du service   : https://${domain:-<voir LUTECIUM_DOMAIN dans .env>}
 Config générée   : ${DEPLOY_DIR}/.env (chmod 600, jamais commitée)
 État des services : docker compose ps   (depuis ${DEPLOY_DIR})
 Logs backend      : docker compose logs -f lutecium-api

 Reste à faire manuellement si pas déjà en place :
   - Port forwarding 80/443 vers cette machine sur la box internet.
   - Si des sites nécessitent des cookies (M-04) : voir README.md
     (déposer deploy/cookies/cookies.txt, décommenter COOKIES_FILE).
   - Vérifier depuis l'extérieur (4G/5G) que https://${domain:-...} répond.
=====================================================================
EOF
