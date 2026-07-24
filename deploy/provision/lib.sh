#!/usr/bin/env bash
# Bibliothèque d'affichage partagée par les scripts de provisioning (install-lutecium.sh,
# diagnose.sh, phase0.sh, configure.sh, terminal.sh) : couleurs, étapes numérotées,
# horodatage, journal complet pour le diagnostic, résumé final en tableau.
# `source` ce fichier, jamais exécuté seul.

# --- Couleurs (désactivées si la sortie n'est pas un terminal, ou si NO_COLOR est posé) ---
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  UI_BOLD=$'\033[1m';    UI_DIM=$'\033[2m';     UI_RESET=$'\033[0m'
  UI_RED=$'\033[31m';    UI_GREEN=$'\033[32m';  UI_YELLOW=$'\033[33m'
  UI_BLUE=$'\033[34m';   UI_CYAN=$'\033[36m';   UI_WHITE=$'\033[97m'
else
  UI_BOLD=""; UI_DIM=""; UI_RESET=""
  UI_RED=""; UI_GREEN=""; UI_YELLOW=""; UI_BLUE=""; UI_CYAN=""; UI_WHITE=""
fi

# --- Journal complet (diagnostic a posteriori) : chaque script source-ant lib.sh doit
# poser UI_LOG_FILE avant le premier appel, sinon un chemin par défaut est utilisé. ---
: "${UI_LOG_FILE:=/tmp/lutecium-$(date +%Y%m%d-%H%M%S).log}"
mkdir -p "$(dirname "$UI_LOG_FILE")" 2>/dev/null || true
: > "$UI_LOG_FILE" 2>/dev/null || UI_LOG_FILE=/dev/null

ui_log_raw() { echo "$*" >> "$UI_LOG_FILE" 2>/dev/null || true; }

ui_banner() {
  # Wordmark ASCII repris du motd (P5-06) — cohérence visuelle avec le terminal serveur.
  printf '%s\n' "${UI_CYAN}${UI_BOLD}"
  cat <<'EOF'
  888             888                   d8b
  888             888                   Y8P
  888             888
  888      888  888888 .d88b.  .d8888b  888 888  888 88888b.d88b.
  888      888  888   d8P  Y8b 88K      888 888  888 888 "888 "88b
  888      888  888   88888888 "Y8888b. 888 888  888 888  888  888
  888      Y88b 888   Y8b.          X88 888 Y88b 888 888  888  888
  88888888  "Y88888    "Y8888   88888P' 888  "Y88888 888  888  888
EOF
  printf '%s\n' "${UI_RESET}${UI_DIM}  service de téléchargement auto-hébergé — provisioning${UI_RESET}"
  echo
}

UI_STEP_N=0
UI_STEP_TOTAL="${UI_STEP_TOTAL:-1}"
UI_STEP_START=0

ui_step() {
  # ui_step "Titre de l'étape"
  UI_STEP_N=$((UI_STEP_N + 1))
  UI_STEP_START=$(date +%s)
  local label="[${UI_STEP_N}/${UI_STEP_TOTAL}]"
  echo
  printf '%s\n' "${UI_BLUE}${UI_BOLD}${label} $*${UI_RESET}"
  ui_log_raw ""
  ui_log_raw "=== ${label} $* ($(date -Is)) ==="
}

ui_step_elapsed() {
  local now; now=$(date +%s)
  echo "$((now - UI_STEP_START))s"
}

ui_ok()   { printf '  %s✓%s %s\n' "$UI_GREEN" "$UI_RESET" "$*"; ui_log_raw "OK: $*"; }
ui_warn() { printf '  %s⚠%s %s\n' "$UI_YELLOW" "$UI_RESET" "$*"; ui_log_raw "WARN: $*"; }
ui_err()  { printf '  %s✗%s %s\n' "$UI_RED" "$UI_RESET" "$*" >&2; ui_log_raw "ERR: $*"; }
ui_info() { printf '  %s·%s %s\n' "$UI_DIM" "$UI_RESET" "$*"; ui_log_raw "INFO: $*"; }

# ui_run "description affichée" -- commande...
# Exécute la commande (sortie redirigée dans UI_LOG_FILE), affiche ✓/durée ou ✗ + un
# extrait de la sortie pour diagnostiquer sans avoir à rouvrir le log manuellement.
ui_run() {
  local desc="$1"; shift
  [ "$1" = "--" ] && shift
  local start; start=$(date +%s)
  ui_log_raw "--- \$ $* ---"
  if "$@" >>"$UI_LOG_FILE" 2>&1; then
    local dur=$(( $(date +%s) - start ))
    printf '  %s✓%s %s %s(%ss)%s\n' "$UI_GREEN" "$UI_RESET" "$desc" "$UI_DIM" "$dur" "$UI_RESET"
    return 0
  else
    local code=$?
    printf '  %s✗%s %s %s(échec, code %s)%s\n' "$UI_RED" "$UI_RESET" "$desc" "$UI_DIM" "$code" "$UI_RESET"
    printf '    %sdernières lignes du journal :%s\n' "$UI_DIM" "$UI_RESET"
    tail -n 8 "$UI_LOG_FILE" 2>/dev/null | sed 's/^/    | /'
    return "$code"
  fi
}

# --- Résumé final en tableau (statut par ligne) ---
UI_SUMMARY_ROWS=()
ui_summary_add() {
  # ui_summary_add "ok|warn|err" "libellé" "détail"
  UI_SUMMARY_ROWS+=("$1|$2|$3")
}
ui_summary_print() {
  echo
  printf '%s\n' "${UI_BOLD}Résumé${UI_RESET}"
  local row status label detail icon color
  for row in "${UI_SUMMARY_ROWS[@]}"; do
    IFS='|' read -r status label detail <<<"$row"
    case "$status" in
      ok)   icon="✓"; color="$UI_GREEN" ;;
      warn) icon="⚠"; color="$UI_YELLOW" ;;
      *)    icon="✗"; color="$UI_RED" ;;
    esac
    printf '  %s%s%s  %-46s %s%s%s\n' "$color" "$icon" "$UI_RESET" "$label" "$UI_DIM" "$detail" "$UI_RESET"
  done
  echo
}

ui_die() {
  ui_err "$*"
  echo
  printf '%s%s a échoué à l'"'"'étape %s/%s.%s\n' "$UI_RED$UI_BOLD" "Installation" "$UI_STEP_N" "$UI_STEP_TOTAL" "$UI_RESET"
  printf '%sJournal complet : %s%s\n' "$UI_DIM" "$UI_LOG_FILE" "$UI_RESET"
  [ "${#UI_SUMMARY_ROWS[@]}" -gt 0 ] && ui_summary_print
  exit 1
}
