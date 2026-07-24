# Lutecium

Service web auto-hébergé de téléchargement de vidéos (YouTube, TikTok, Instagram, X/Twitter et plus de 1000 sites via [yt-dlp](https://github.com/yt-dlp/yt-dlp)). Interface en français, esprit [Cobalt Tools](https://cobalt.tools/) : coller une URL, choisir le format, récupérer le fichier — 1 téléchargement possible sans compte, inscription libre et immédiate au-delà.

Projet home lab déployé sur un Dell Wyse 5070 (Debian 13) derrière Caddy, en Docker Compose.

## Documents de référence

- [docs/cahier-des-charges.md](docs/cahier-des-charges.md) — exigences (IDs F-xx, A-xx, S-xx, P-xx, M-xx), source de vérité fonctionnelle.
- [docs/ui-ux-cahier-des-charges.md](docs/ui-ux-cahier-des-charges.md) — design, états A→F de l'interface, ton, animations.
- [docs/PLAN.md](docs/PLAN.md) — plan d'implémentation, décisions techniques, contrats API.
- [TRACKING.md](TRACKING.md) — état des tâches et journal des sessions.
- [CLAUDE.md](CLAUDE.md) — protocole de développement multi-sessions.

## Stack

| Couche | Technologie |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x + Alembic, SSE |
| Téléchargement | yt-dlp (API Python uniquement, jamais de shell) + ffmpeg |
| Frontend | React + Vite + TypeScript, PWA |
| Base de données | SQLite (WAL) |
| Reverse proxy | Caddy (HTTPS automatique via Let's Encrypt) |
| Conteneurisation | Docker Compose |

## Développement local

### Backend

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e .
cp ../.env.example ../.env   # adapter si besoin
alembic upgrade head
uvicorn app.main:app --reload
```

Tests : `pytest` (les tests réseau réels sont marqués `@pytest.mark.network`, non lancés par défaut).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Avec Docker (dev)

```bash
cd deploy
docker compose -f docker-compose.dev.yml up --build
```

## Déploiement en production

Voir [docs/PLAN.md](docs/PLAN.md) et [deploy/](deploy/) :

- `deploy/provision/phase0.sh` — durcissement initial d'un Debian 13 vierge (SSH par clé, ufw, fail2ban, unattended-upgrades, Docker, auto-cpufreq).
- `deploy/install-lutecium.sh` — installation complète et idempotente (réutilise `phase0.sh`, configuration interactive, déploiement des conteneurs, crons). Affichage en couleur, étape par étape, avec journal détaillé (`deploy/logs/`) et résumé final :
  ```
  cd deploy && ./install-lutecium.sh
  ```
- `deploy/install-lutecium.sh --diagnose` — état de santé complet d'une installation existante, en lecture seule (Docker, conteneurs, certificat TLS, veille/session graphique, crons, backups…), utilisable seul ou lancé souvent en cas de souci. Peut aussi s'appeler directement : `bash deploy/provision/diagnose.sh`.
- `deploy/docker-compose.yml` — Caddy + backend + DuckDNS en production.
- `deploy/cron/` — mise à jour yt-dlp, backup base de données.

Le fichier `deploy/.env` (jamais commité, voir `deploy/.env.example`) contient tous les secrets et réglages de production.

## Fichier `cookies.txt` (sites nécessitant une connexion)

Certains sites (Instagram, certains contenus X/Twitter ou TikTok) refusent l'accès anonyme et nécessitent des cookies de session pour que yt-dlp fonctionne (M-04). Le service peut monter un fichier `cookies.txt` au format Netscape :

1. Exporter les cookies d'un compte dédié (jamais un compte personnel) depuis un navigateur, par exemple avec l'extension [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc).
2. Déposer le fichier en tant que `deploy/cookies/cookies.txt` sur le serveur (répertoire déjà monté en lecture seule dans le conteneur `lutecium-api`, jamais commis dans git).
3. Dans `deploy/.env`, décommenter et régler `COOKIES_FILE=/app/cookies/cookies.txt`, puis redémarrer le conteneur `lutecium-api`.

Si la variable n'est pas définie ou si le fichier est absent, yt-dlp fonctionne normalement sans cookies (comportement par défaut) — les sites qui les exigent renverront le message d'erreur français habituel (« Ce site nécessite une connexion... »).

**Précautions** :
- N'utiliser qu'un compte jetable/dédié : le fichier donne un accès complet à la session de ce compte.
- Les cookies expirent : à renouveler périodiquement s'ils cessent de fonctionner.
- Ne jamais commiter `cookies.txt` (déjà exclu par `.gitignore`).

## Sécurité

Voir §7 du [cahier des charges](docs/cahier-des-charges.md) pour la liste complète (S-01 à S-11) : SSH par clé uniquement, surface réseau réduite à 80/443, conteneurs non-root, argon2id, sessions httpOnly/Secure/SameSite, yt-dlp appelé uniquement via son API Python (jamais de shell).
