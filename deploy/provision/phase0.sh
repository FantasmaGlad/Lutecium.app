#!/usr/bin/env bash
# Phase 0 — Socle serveur Lutecium (tâches P0-01 et P0-02)
# Cible : Debian 13 Trixie vierge. Idempotent : relançable sans casse.
# Usage : scp phase0.sh fanta@SERVEUR:/tmp/ && ssh fanta@SERVEUR 'sudo bash /tmp/phase0.sh'
# Les fonctions de ce script ont vocation à être reprises par install-lutecium.sh (P5-01).
set -euo pipefail

LAN_CIDR="${LAN_CIDR:-192.168.1.0/24}"
export DEBIAN_FRONTEND=noninteractive

log() { echo -e "\n=== $* ==="; }

log "1/7 Mise à jour du système"
apt-get update -qq
apt-get upgrade -y -qq

log "2/7 Paquets de base"
apt-get install -y -qq git curl ca-certificates gnupg ufw fail2ban \
  unattended-upgrades python3-systemd

log "3/7 Durcissement SSH : clé uniquement, root interdit (S-02)"
install -m 644 /dev/stdin /etc/ssh/sshd_config.d/50-lutecium.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sshd -t
systemctl reload ssh

log "4/7 Pare-feu ufw : 80/443 publics, SSH depuis le LAN uniquement (S-01)"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow from "$LAN_CIDR" to any port 22 proto tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable
ufw status verbose

log "5/7 fail2ban (jail sshd, backend systemd) (S-08)"
install -m 644 /dev/stdin /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
backend = systemd

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

log "6/7 unattended-upgrades (S-10)"
install -m 644 /dev/stdin /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades >/dev/null

log "7/7 Docker (dépôt officiel) + auto-cpufreq (P-01)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker fanta
systemctl enable --now docker >/dev/null
docker --version
docker compose version

if ! command -v auto-cpufreq >/dev/null; then
  rm -rf /opt/auto-cpufreq-src
  git clone --quiet --depth 1 https://github.com/AdnanHodzic/auto-cpufreq.git /opt/auto-cpufreq-src
  (cd /opt/auto-cpufreq-src && printf 'I\n' | timeout 300 ./auto-cpufreq-installer) \
    || echo "AVERTISSEMENT : installation auto-cpufreq échouée (non bloquant, à reprendre)"
fi
if command -v auto-cpufreq >/dev/null && ! systemctl is-active --quiet auto-cpufreq; then
  auto-cpufreq --install || echo "AVERTISSEMENT : daemon auto-cpufreq non installé"
fi
systemctl is-active auto-cpufreq && echo "auto-cpufreq : actif" || true

log "Phase 0 base+docker terminée. Reste : Caddy + DuckDNS (P0-03, token requis)."
