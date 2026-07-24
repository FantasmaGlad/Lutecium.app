#!/usr/bin/env bash
# P5-01 — Installation complète et idempotente de Lutecium sur un Debian 13 vierge (§9).
# Orchestre les scripts déjà écrits et testés séparément : provision/phase0.sh (§9.1-4,7),
# provision/configure.sh (§9.5), provision/terminal.sh (§9.8). Relançable sans casse :
# chaque sous-script vérifie déjà l'état avant d'agir.
#
# Usage :
#   ./install-lutecium.sh              installation/mise à jour complète
#   ./install-lutecium.sh --diagnose   état de santé d'une installation existante (lecture seule)
#   ./install-lutecium.sh --help       cette aide
#
# Depuis une machine Debian 13 vierge, en tant qu'utilisateur non-root avec sudo NOPASSWD
# (ou directement en root) :
#   git clone <url-du-dépôt> ~/lutecium && cd ~/lutecium/deploy && ./install-lutecium.sh
# Si le dépôt n'a pas de remote Git accessible depuis le serveur, copier le répertoire
# lutecium/ par un autre moyen (rsync/scp) avant de lancer ce script.
set -uo pipefail
cd "$(dirname "$0")"   # -> deploy/
DEPLOY_DIR="$(pwd)"

case "${1:-}" in
  -h|--help)
    sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  --diagnose)
    exec bash provision/diagnose.sh
    ;;
esac

mkdir -p logs
UI_LOG_FILE="${DEPLOY_DIR}/logs/install-$(date +%Y%m%d-%H%M%S).log"
UI_STEP_TOTAL=6
# shellcheck source=provision/lib.sh
source provision/lib.sh

trap 'ui_die "Interruption inattendue (voir le journal pour le détail)."' ERR

ui_banner
ui_info "Journal détaillé : ${UI_LOG_FILE}"

command -v sudo >/dev/null && SUDO="sudo" || SUDO=""

ui_step "Durcissement système + Docker + auto-cpufreq (S-01/02/08/10, P-01)"
if $SUDO bash provision/phase0.sh >>"$UI_LOG_FILE" 2>&1; then
  ui_ok "Système durci, Docker et auto-cpufreq prêts"
  ui_summary_add ok "Socle système (SSH/ufw/fail2ban/Docker)" "OK"
else
  ui_summary_add err "Socle système (SSH/ufw/fail2ban/Docker)" "échec — voir journal"
  ui_die "phase0.sh a échoué. Dernières lignes : voir ci-dessous, journal complet dans ${UI_LOG_FILE}."
fi

ui_step "Configuration interactive (.env)"
if bash provision/configure.sh; then
  ui_ok "deploy/.env généré"
  ui_summary_add ok "Configuration (.env)" "OK"
else
  ui_summary_add err "Configuration (.env)" "échec ou interrompue"
  ui_die "configure.sh a échoué ou a été interrompu."
fi

ui_step "Conteneurs (build + démarrage)"
if ui_run "docker compose up -d --build" -- docker compose up -d --build; then
  ui_summary_add ok "Conteneurs Docker" "démarrés"
else
  ui_summary_add err "Conteneurs Docker" "échec — voir journal"
  ui_die "docker compose up a échoué."
fi

ui_step "Attente du service applicatif"
ready=""
printf '  %s·%s en attente de /api/health' "$UI_DIM" "$UI_RESET"
for _ in $(seq 1 30); do
  if docker compose exec -T lutecium-api python3 -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)" \
    >>"$UI_LOG_FILE" 2>&1; then
    ready="1"
    break
  fi
  printf '.'
  sleep 2
done
echo
if [ -z "$ready" ]; then
  ui_warn "/api/health ne répond toujours pas après 60s"
  ui_info "Diagnostic : docker compose logs lutecium-api   (ou : $0 --diagnose)"
  ui_summary_add warn "Backend applicatif" "ne répond pas encore après 60s"
else
  ui_ok "Backend prêt (migrations + éventuel compte admin appliqués)"
  ui_summary_add ok "Backend applicatif" "/api/health OK"
fi

ui_step "Crons (yt-dlp nightly, backup BDD quotidien)"
chmod +x cron/*.sh 2>/dev/null || true
CRON_MARKER="# Lutecium (posé par install-lutecium.sh)"
existing_crontab="$($SUDO -u "${SUDO_USER:-$USER}" crontab -l 2>/dev/null || true)"
if echo "$existing_crontab" | grep -qF "$CRON_MARKER"; then
  ui_ok "Crons déjà installés, inchangés"
  ui_summary_add ok "Crontab (yt-dlp + backup)" "déjà en place"
else
  new_crontab="$(cat <<EOF
${existing_crontab}
${CRON_MARKER}
0 */6 * * * ${DEPLOY_DIR}/cron/update-ytdlp.sh >> ${DEPLOY_DIR}/cron/update-ytdlp.log 2>&1
0 3 * * * ${DEPLOY_DIR}/cron/backup-db.sh >> ${DEPLOY_DIR}/cron/backup-db.log 2>&1
EOF
)"
  if echo "$new_crontab" | $SUDO -u "${SUDO_USER:-$USER}" crontab - >>"$UI_LOG_FILE" 2>&1; then
    ui_ok "Crons installés (maj yt-dlp/6h, backup BDD/jour à 3h)"
    ui_summary_add ok "Crontab (yt-dlp + backup)" "installée"
  else
    ui_warn "Échec de la pose de la crontab (non bloquant)"
    ui_summary_add warn "Crontab (yt-dlp + backup)" "échec — à poser manuellement"
  fi
fi

ui_step "Beau terminal (optionnel)"
read -r -p "  Configurer zsh + starship + alias (§9.8) ? [O/n] : " want_terminal
if [ "${want_terminal,,}" != "n" ]; then
  if $SUDO bash provision/terminal.sh >>"$UI_LOG_FILE" 2>&1; then
    ui_ok "Terminal configuré (reconnecte-toi, ou 'exec zsh')"
    ui_summary_add ok "Beau terminal (zsh/starship)" "configuré"
  else
    ui_warn "terminal.sh a échoué (non bloquant)"
    ui_summary_add warn "Beau terminal (zsh/starship)" "échec — non bloquant"
  fi
else
  ui_info "Ignoré"
  ui_summary_add warn "Beau terminal (zsh/starship)" "ignoré"
fi

trap - ERR
domain="$(grep -m1 '^LUTECIUM_DOMAIN=' .env 2>/dev/null | cut -d= -f2- | cut -d, -f1 | xargs)"

ui_summary_print
printf '%s%s Installation terminée.%s\n\n' "$UI_GREEN" "$UI_BOLD" "$UI_RESET"
cat <<EOF
  URL du service    : ${UI_CYAN}https://${domain:-<voir LUTECIUM_DOMAIN dans .env>}${UI_RESET}
  Config générée    : ${DEPLOY_DIR}/.env (chmod 600, jamais commitée)
  Journal d'install : ${UI_LOG_FILE}
  État des services : docker compose ps        (depuis ${DEPLOY_DIR})
  Diagnostic complet: $0 --diagnose

  Reste à faire manuellement si pas déjà en place :
    - Port forwarding 80/443 vers cette machine sur la box internet.
    - Si des sites nécessitent des cookies (M-04) : voir README.md
      (déposer deploy/cookies/cookies.txt, décommenter COOKIES_FILE).
    - Vérifier depuis l'extérieur (4G/5G) que https://${domain:-...} répond.
EOF
