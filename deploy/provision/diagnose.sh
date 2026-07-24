#!/usr/bin/env bash
# Diagnostic complet et en LECTURE SEULE d'une installation Lutecium : ne modifie rien,
# safe à lancer à tout moment (y compris en prod, y compris souvent). Utilisable seul
# (bash provision/diagnose.sh) ou via install-lutecium.sh --diagnose.
set -uo pipefail
cd "$(dirname "$0")/.."   # -> deploy/

UI_LOG_FILE="/tmp/lutecium-diagnose-$(date +%Y%m%d-%H%M%S).log"
UI_STEP_TOTAL=7
# shellcheck source=lib.sh
source provision/lib.sh

ui_banner
printf '%sDiagnostic — %s%s\n' "$UI_BOLD" "$(date -Is)" "$UI_RESET"

PROBLEMS=0
note_ok()   { ui_ok "$1";   ui_summary_add ok   "$2" "$3"; }
note_warn() { ui_warn "$1"; ui_summary_add warn "$2" "$3"; PROBLEMS=$((PROBLEMS+1)); }
note_err()  { ui_err "$1";  ui_summary_add err  "$2" "$3"; PROBLEMS=$((PROBLEMS+1)); }

# --- 1. Système ---
ui_step "Système"
disk_line="$(df -h / | awk 'NR==2 {print $3"/"$2" ("$5")"; }')"
disk_pct="$(df / | awk 'NR==2 {gsub("%","",$5); print $5}')"
mem_line="$(free -h | awk '/^Mem:/ {print $3"/"$2}')"
if [ "${disk_pct:-0}" -ge 90 ]; then
  note_err "Disque : ${disk_line} — critique (≥90%)" "Disque" "${disk_line}"
elif [ "${disk_pct:-0}" -ge 75 ]; then
  note_warn "Disque : ${disk_line} — à surveiller" "Disque" "${disk_line}"
else
  note_ok "Disque : ${disk_line}" "Disque" "${disk_line}"
fi
note_ok "RAM : ${mem_line}" "RAM" "${mem_line}"
note_ok "Uptime : $(uptime -p 2>/dev/null || uptime)" "Uptime" "$(uptime -p 2>/dev/null || echo '?')"

# --- 2. Veille / session graphique (leçon du 2026-07-24 : cause des coupures réseau) ---
ui_step "Veille et session graphique"
masked_count=0
for t in sleep.target suspend.target hibernate.target hybrid-sleep.target; do
  # `systemctl is-enabled` sort en code non-zéro pour "masked" (pas seulement "enabled") ;
  # capturer la sortie avant de la tester évite le piège classique de pipefail (un pipe
  # direct vers grep échouerait à cause du code de sortie de systemctl, pas de grep).
  state="$(systemctl is-enabled "$t" 2>/dev/null || true)"
  [ "$state" = "masked" ] && masked_count=$((masked_count+1))
done
if [ "$masked_count" -eq 4 ]; then
  note_ok "Cibles de veille masquées (4/4)" "Veille système" "masquée"
else
  note_err "Cibles de veille masquées : ${masked_count}/4 seulement — la machine peut se mettre en veille" \
    "Veille système" "${masked_count}/4 masquées — voir README"
fi
default_target="$(systemctl get-default 2>/dev/null || echo '?')"
if [ "$default_target" = "multi-user.target" ]; then
  note_ok "Cible par défaut : ${default_target} (headless)" "Cible par défaut" "${default_target}"
else
  note_warn "Cible par défaut : ${default_target} (pas headless)" "Cible par défaut" "${default_target}"
fi
if systemctl is-active --quiet gdm.service 2>/dev/null || systemctl is-active --quiet lightdm.service 2>/dev/null; then
  note_warn "Un display manager (GDM/LightDM) est actif" "Session graphique" "active"
else
  note_ok "Aucun display manager actif" "Session graphique" "inactive"
fi

# --- 3. Docker ---
ui_step "Docker"
if command -v docker >/dev/null 2>&1; then
  docker_version="$(docker --version 2>/dev/null | sed 's/,.*//')"
  if docker info >/dev/null 2>&1; then
    note_ok "Docker actif (${docker_version})" "Docker" "actif"
  else
    note_err "Docker installé mais démon inactif" "Docker" "démon inactif"
  fi
else
  note_err "Docker non installé" "Docker" "absent"
fi

# --- 4. Conteneurs Lutecium ---
ui_step "Conteneurs"
if [ -f docker-compose.yml ] && command -v docker >/dev/null 2>&1; then
  for svc in caddy lutecium-api duckdns; do
    status="$(docker compose ps --format '{{.Service}} {{.Status}}' 2>/dev/null | awk -v s="$svc" '$1==s {$1=""; print}')"
    if [ -z "$status" ]; then
      note_err "${svc} : absent" "Conteneur ${svc}" "absent"
    elif echo "$status" | grep -qi '^\s*up'; then
      note_ok "${svc} :${status}" "Conteneur ${svc}" "$(echo "$status" | xargs)"
    else
      note_err "${svc} :${status}" "Conteneur ${svc}" "$(echo "$status" | xargs)"
    fi
  done
else
  note_warn "docker-compose.yml introuvable dans $(pwd) — sauté" "Conteneurs" "non vérifiable"
fi

# --- 5. Application ---
ui_step "Application"
if command -v docker >/dev/null 2>&1 && docker compose ps lutecium-api >/dev/null 2>&1; then
  if docker compose exec -T lutecium-api python3 -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)" \
    >/dev/null 2>&1; then
    note_ok "/api/health (interne, dans le conteneur) : OK" "Backend (interne)" "OK"
  else
    note_err "/api/health (interne) : injoignable" "Backend (interne)" "injoignable"
  fi
fi
domain="$(grep -m1 '^LUTECIUM_DOMAIN=' .env 2>/dev/null | cut -d= -f2- | cut -d, -f1 | xargs)"
if [ -n "$domain" ]; then
  if code="$(curl -sS -o /dev/null -w '%{http_code}' -m 8 "https://${domain}/api/health" 2>/dev/null)" && [ "$code" = "200" ]; then
    note_ok "https://${domain}/api/health (public) : 200" "Backend (public)" "200 OK"
  else
    note_err "https://${domain}/api/health (public) : ${code:-injoignable}" "Backend (public)" "${code:-injoignable}"
  fi
  # Capturé sans dépendre du code de sortie du pipe (openssl s_client peut sortir en
  # code non-zéro même en cas de succès selon les versions — même piège que systemctl
  # is-enabled plus haut) : on vérifie le contenu récupéré, pas le code de sortie.
  expiry="$(echo | openssl s_client -servername "$domain" -connect "${domain}:443" 2>/dev/null \
      | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  if [ -n "$expiry" ]; then
    note_ok "Certificat TLS valide jusqu'au ${expiry}" "Certificat TLS" "${expiry}"
  else
    note_warn "Certificat TLS : impossible à vérifier" "Certificat TLS" "non vérifiable"
  fi
else
  note_warn "LUTECIUM_DOMAIN absent de .env — vérifications publiques sautées" "Domaine" "non configuré"
fi

# --- 6. Configuration ---
ui_step "Configuration (.env)"
if [ -f .env ]; then
  note_ok ".env présent" "Fichier .env" "présent"
  if grep -q '^SECRET_KEY=change-me-in-production' .env 2>/dev/null; then
    note_err "SECRET_KEY encore à la valeur par défaut !" "SECRET_KEY" "valeur par défaut (à changer)"
  else
    note_ok "SECRET_KEY personnalisée" "SECRET_KEY" "personnalisée"
  fi
  if grep -q '^ADMIN_PSEUDO=' .env 2>/dev/null; then
    note_ok "Bootstrap admin configuré" "Compte admin" "configuré"
  else
    note_warn "Aucun ADMIN_PSEUDO dans .env" "Compte admin" "non configuré"
  fi
else
  note_err ".env absent — lancer configure.sh" "Fichier .env" "absent"
fi

# --- 7. Crons ---
ui_step "Crons"
crontab_content="$(crontab -l 2>/dev/null || true)"
if echo "$crontab_content" | grep -q 'update-ytdlp.sh'; then
  note_ok "Cron maj yt-dlp installé" "Cron yt-dlp" "installé"
else
  note_warn "Cron maj yt-dlp absent" "Cron yt-dlp" "absent"
fi
if echo "$crontab_content" | grep -q 'backup-db.sh'; then
  note_ok "Cron backup BDD installé" "Cron backup" "installé"
else
  note_warn "Cron backup BDD absent" "Cron backup" "absent"
fi
if [ -d backups ]; then
  last_backup="$(find backups -name '*.db.gz' -printf '%T@ %f\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
  if [ -n "$last_backup" ]; then
    note_ok "Dernier backup : ${last_backup}" "Dernier backup BDD" "${last_backup}"
  else
    note_warn "Aucun backup trouvé dans deploy/backups/" "Dernier backup BDD" "aucun"
  fi
fi

# --- Résumé ---
ui_summary_print
if [ "$PROBLEMS" -eq 0 ]; then
  printf '%s%s Tout est vert — aucun problème détecté.%s\n' "$UI_GREEN" "$UI_BOLD" "$UI_RESET"
else
  printf '%s%s %d point(s) à regarder ci-dessus.%s\n' "$UI_YELLOW" "$UI_BOLD" "$PROBLEMS" "$UI_RESET"
fi
printf '%sJournal : %s%s\n' "$UI_DIM" "$UI_LOG_FILE" "$UI_RESET"
exit 0
