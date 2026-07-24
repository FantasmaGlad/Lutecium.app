#!/usr/bin/env bash
# P5-06 — « Beau terminal » (§9.8) : zsh + starship, alias utiles, motd Lutecium.
# Idempotent : relançable sans casse (chaque étape vérifie l'état avant d'agir).
# Usage : sudo bash terminal.sh   (configure le zsh de l'utilisateur invoquant sudo,
# ex. fanta ; nécessite root pour chsh/apt/écrire /etc/motd).
set -uo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERREUR : ce script nécessite root (lance-le avec sudo)." >&2
  exit 1
fi

TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
ZSHRC="${TARGET_HOME}/.zshrc"
MARKER="# --- Lutecium (P5-06, généré par deploy/provision/terminal.sh) ---"

log() { echo -e "\n=== $* ==="; }

log "1/4 zsh"
if ! command -v zsh >/dev/null; then
  apt-get update -qq && apt-get install -y -qq zsh
fi
current_shell="$(getent passwd "$TARGET_USER" | cut -d: -f7)"
if [ "$current_shell" != "$(command -v zsh)" ]; then
  chsh -s "$(command -v zsh)" "$TARGET_USER"
fi

log "2/4 starship"
if ! command -v starship >/dev/null; then
  curl -fsSL https://starship.rs/install.sh | sh -s -- --yes
fi

log "3/4 Alias et prompt dans ${ZSHRC}"
touch "$ZSHRC"
if ! grep -qF "$MARKER" "$ZSHRC" 2>/dev/null; then
  cat >> "$ZSHRC" <<EOF

${MARKER}
eval "\$(starship init zsh)"

alias dc="docker compose"
alias dcl="docker compose logs -f --tail=100"
alias dcp="docker compose ps"
alias lutecium-cd="cd ~/lutecium/deploy"
alias lutecium-status="cd ~/lutecium/deploy && docker compose ps"
alias lutecium-logs="cd ~/lutecium/deploy && docker compose logs -f --tail=200 lutecium-api"

lutecium-motd() {
  echo "── Lutecium ──────────────────────────────────────"
  if command -v docker >/dev/null && [ -d ~/lutecium/deploy ]; then
    (cd ~/lutecium/deploy && docker compose ps --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null) \\
      || echo "  (docker compose indisponible ou service non démarré)"
  fi
  df -h / 2>/dev/null | awk 'NR==2 {print "  Disque / : " \$3 " utilisés / " \$2 " (" \$5 ")"}'
  echo "─────────────────────────────────────────────────"
}
lutecium-motd
# --- fin section Lutecium ---
EOF
  chown "$TARGET_USER:$TARGET_USER" "$ZSHRC"
fi

log "4/4 /etc/motd statique (bannière de connexion, avant l'état dynamique zsh)"
cat > /etc/motd <<'EOF'

  888             888                   d8b
  888             888                   Y8P
  888             888
  888      888  888888 .d88b.  .d8888b  888 888  888 88888b.d88b.
  888      888  888   d8P  Y8b 88K      888 888  888 888 "888 "88b
  888      888  888   88888888 "Y8888b. 888 888  888 888  888  888
  888      Y88b 888   Y8b.          X88 888 Y88b 888 888  888  888
  88888888  "Y88888    "Y8888   88888P' 888  "Y88888 888  888  888

  Service de téléchargement auto-hébergé. Voir ~/lutecium/deploy (docker compose).
EOF

echo
echo "Terminal configuré pour ${TARGET_USER}. Se reconnecter (ou 'exec zsh') pour l'appliquer."
