# Lutecium

Service web auto-hébergé de téléchargement de vidéos, construit autour de [yt-dlp](https://github.com/yt-dlp/yt-dlp) (YouTube, TikTok, Instagram, X/Twitter et plus de 1000 sites supportés). L'utilisateur colle une URL, choisit un format, récupère le fichier dans son navigateur. Aucune conservation longue durée des fichiers : chaque téléchargement est servi puis effacé.

Projet personnel (home lab), déployé en production sur un mini-PC Dell Wyse 5070 sous Debian 13, derrière Caddy, en Docker Compose.

---

## Partie 1 — Présentation

### Le projet

Lutecium répond à un besoin précis : disposer d'un point d'entrée unique, sans publicité, sans redirecteur et sans mur de paiement, pour récupérer une vidéo ou un audio depuis un site tiers. L'interface s'inspire de [Cobalt Tools](https://cobalt.tools/) : un champ, une URL, un résultat.

Le projet a aussi une visée pédagogique : il sert de terrain d'exercice pour l'exploitation d'un serveur exposé sur Internet (durcissement système, reverse proxy, conteneurisation, sauvegardes, supervision), avec la contrainte volontaire d'un matériel limité (16 Go de RAM, 32 Go de disque, sans ventilateur).

Hors périmètre assumé : pas de support des playlists, pas d'envoi d'e-mails (réinitialisation de mot de passe gérée manuellement par un administrateur), pas de streaming direct dans le navigateur, interface disponible en français et en anglais uniquement.

### Fonctionnalités

**Téléchargement**
- Analyse d'une URL : titre, miniature, durée, site détecté, formats vidéo (résolution, fps, poids estimé), pistes audio, sous-titres disponibles.
- Trois modes : vidéo (avec fusion audio/vidéo automatique via ffmpeg si nécessaire), audio seul (mp3/m4a/opus), sous-titres seuls.
- Nom de fichier personnalisable, assaini côté serveur.
- File d'attente visible en temps réel (position, pourcentage, vitesse, temps estimé), annulation possible à tout moment.
- Fichier livré via un lien signé à usage personnel, supprimé automatiquement 5 minutes après la fin du traitement.

**Comptes et quotas**
- Un téléchargement possible sans compte ; au-delà, invitation à s'inscrire (inscription libre, immédiate, sans validation).
- Quota journalier par utilisateur (remise à zéro à minuit), avec un mécanisme dédié pour la demande qui franchit la limite.
- Historique personnel des téléchargements, avec re-téléchargement en un clic.

**Interface**
- Progressive Web App installable, avec partage direct depuis Android (« share target »).
- Deux thèmes (clair/sombre), français et anglais, accessible au clavier (contrastes AA, `aria-live`, respect de `prefers-reduced-motion`).

**Administration**
- Tableau de bord dédié : gestion des comptes (suspension, quota individuel, réinitialisation de mot de passe, suppression), métriques d'usage, état matériel du serveur en temps réel (CPU, RAM, température, disque, historique en graphiques), journal des téléchargements et des erreurs, actions rapides (purge disque, vidage de file, mise à jour de yt-dlp).

### Prérequis

**Développement local**
- Python 3.12 ou supérieur
- Node.js 20 ou supérieur
- ffmpeg installé sur la machine
- Docker et Docker Compose (optionnel, pour reproduire l'environnement de production)

**Déploiement en production**
- Un serveur Linux (le projet cible Debian 13, `x86_64`) avec Docker et Docker Compose
- Un nom de domaine (ou un sous-domaine [DuckDNS](https://www.duckdns.org/) gratuit)
- Les ports 80 et 443 accessibles depuis Internet (redirigés vers le serveur si celui-ci est derrière une box/un routeur)
- Un accès SSH par clé à la machine cible

### Installation

**En local, sans Docker**

```bash
# Backend
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env.example ../.env
alembic upgrade head
uvicorn app.main:app --reload

# Frontend (autre terminal)
cd frontend
npm install
npm run dev
```

Le backend écoute sur `http://localhost:8000`, le frontend sur `http://localhost:5173`.

**En local, avec Docker**

```bash
cd deploy
docker compose -f docker-compose.dev.yml up --build
```

**En production**

Le dépôt fournit un script d'installation idempotent, à exécuter sur une machine Debian 13 vierge (utilisateur non-root avec sudo, ou root) :

```bash
git clone <url-du-dépôt> ~/lutecium
cd ~/lutecium/deploy
./install-lutecium.sh
```

Le script durcit le système (SSH par clé uniquement, pare-feu, fail2ban, mises à jour automatiques), installe Docker, demande la configuration en interactif (domaine, quotas, identifiants administrateur) puis déploie les conteneurs. Il journalise chaque étape et affiche un récapitulatif final. Un mode diagnostic, sans effet de bord, est disponible séparément :

```bash
./install-lutecium.sh --diagnose
```

### Licence

Distribué sous licence **GNU AGPLv3** (voir [LICENSE](LICENSE)). Toute personne exploitant une version modifiée de ce service — y compris en tant que service web accessible à des tiers — a l'obligation d'en publier le code source.

---

## Partie 2 — Documentation technique

### Architecture

```
Internet
   │  (ports 80/443 uniquement)
   ▼
┌──────────────────────────── Serveur (Debian 13, Docker Compose) ────────────────────────────┐
│                                                                                              │
│  ┌─────────┐    ┌──────────────────────────────┐    ┌────────────────────┐                  │
│  │  Caddy  │───▶│  FastAPI (lutecium-api)      │───▶│  Workers asyncio    │                  │
│  │  HTTPS  │    │  API REST + SSE               │    │  yt-dlp + ffmpeg    │                  │
│  │  auto   │    │  Auth / sessions / quotas     │    │  (file d'attente)   │                  │
│  └─────────┘    └──────────┬───────────────────┘    └─────────┬──────────┘                  │
│       │                    │                                  │                              │
│       ▼                    ▼                                  ▼                              │
│  Frontend React      SQLite (WAL) via                /app/data/downloads                     │
│  (statique, buildé)   SQLAlchemy + Alembic            (fichiers temporaires, TTL 5 min)        │
│                                                                                                │
│  Conteneur DuckDNS (mise à jour de l'IP dynamique) · crons hôte (mise à jour yt-dlp,           │
│  nettoyage, sauvegarde base de données)                                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Les téléchargements yt-dlp/ffmpeg tournent dans des workers `asyncio` à l'intérieur du même conteneur que l'API (pas de conteneur worker séparé pour une concurrence limitée à 2 téléchargements simultanés). La file d'attente est persistée en base et reprise au redémarrage.

### Stack technique

| Couche | Technologie |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x + Alembic, Server-Sent Events (`sse-starlette`) |
| Téléchargement | yt-dlp (exclusivement via son API Python, jamais via un shell) + ffmpeg |
| Authentification | Sessions serveur (cookies httpOnly/Secure/SameSite=Lax), mots de passe hachés argon2id |
| Frontend | React 19, Vite, TypeScript, Framer Motion, React Three Fiber (décor 3D), PWA |
| Base de données | SQLite (mode WAL) |
| Reverse proxy | Caddy 2 (HTTPS automatique via Let's Encrypt) |
| Conteneurisation | Docker Compose |
| DynDNS | DuckDNS |

### Structure du dépôt

Pour une navigation rapide fichier par fichier :
- **Visualisation humaine** : [structure.md](structure.md) (arborescence commentée)
- **Visualisation machine / Agent IA** : [.claude/project-structure.json](.claude/project-structure.json) (source de vérité du serveur MCP local)

```
Lutecium/
├── backend/            # API FastAPI & Workers asyncio Python 3.12
│   ├── app/
│   │   ├── api/        # routes : analyze, downloads, files, auth, admin, health
│   │   ├── core/       # file d'attente, worker yt-dlp, SSE, sécurité, erreurs
│   │   ├── models/      # modèles SQLAlchemy
│   │   └── services/    # quotas, nettoyage/TTL, métriques
│   ├── alembic/         # migrations de schéma SQLite WAL
│   └── tests/           # pytest
├── frontend/            # React 19 + Vite + TypeScript (SPA Cobalt-like)
├── deploy/              # docker-compose, Caddyfile, scripts de provisioning, crons
├── docs/                # cahier des charges, plan d'implémentation, UI/UX
├── .claude/             # cartographie JSON (.claude/project-structure.json) et serveur MCP
├── .gemini/             # symlink vers .claude/project-structure.json pour agents Gemini
└── AGENTS.md            # consignes d'onboarding agent IA et règle d'or MCP
```

### Points chauds et pièges connus (Hot Spots)

1. **Sécurité yt-dlp (S-05)** : Tout appel à yt-dlp doit passer exclusivement par son API Python native (`yt_dlp.YoutubeDL`). Aucun argument passé à un shell pour prévenir les injections d'URL.
2. **File d'attente & Concurrence (P-01/P-02)** : Concurrence limitée à 2 téléchargements simultanés (`MAX_CONCURRENT_DOWNLOADS`). La file d'attente est conservée en mémoire et synchronisée en SQLite pour reprise au redémarrage.
3. **Rétention des fichiers éphémères (S-07)** : Les fichiers finaux sont servis via des liens signés temporaires et supprimés du disque 5 minutes (`FILE_TTL_MINUTES`) après leur création.
4. **Anonymat des invités (S-09)** : Les IP des utilisateurs non connectés sont hachées avec un sel quotidien et purgées chaque minuit. Aucune IP en clair n'est stockée.
5. **Session & Cookies** : L'authentification utilise des cookies de session HTTP-only / SameSite=Lax. Certains sites (Instagram, X) requièrent un fichier `cookies.txt` (format Netscape) déposé dans `deploy/cookies/cookies.txt`.
6. **Maintenance de la cartographie** : Toute modification de structure (ajout/déplacement/suppression de fichier significatif) exige la mise à jour dans le **même commit** de `structure.md` ET `.claude/project-structure.json`.

### API (contrats v1)

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/api/health` | public | vivacité, versions de l'application et de yt-dlp |
| POST | `/api/analyze` | public, limité à 10 req/min | analyse d'une URL → métadonnées, formats disponibles |
| POST | `/api/downloads` | invité (1 max) / utilisateur | mise en file d'un téléchargement |
| GET | `/api/downloads/{id}/events` | propriétaire | flux SSE (position, progression, étape, fin, erreur) |
| POST | `/api/downloads/{id}/cancel` | propriétaire | annulation en file ou en cours |
| GET | `/api/files/{token}` | lien signé | récupération du fichier final |
| POST | `/api/auth/register`, `/login`, `/logout` | public | gestion de compte |
| GET | `/api/auth/me` | utilisateur | session courante, quota du jour |
| POST | `/api/auth/change-password` | utilisateur | changement de mot de passe |
| GET | `/api/me/downloads` | utilisateur | historique paginé |
| GET/PATCH/DELETE | `/api/admin/users[/{id}]` | admin | gestion des comptes |
| GET | `/api/admin/guests` | admin | téléchargements invités (IP anonymisée) |
| GET | `/api/admin/metrics`, `/api/admin/system[/history]`, `/api/admin/journal` | admin | métriques, état système, journal |
| POST | `/api/admin/actions/{action}` | admin | `purge-downloads`, `clear-queue`, `update-ytdlp` |
| GET/PATCH | `/api/admin/settings` | admin | ajustement des limites à chaud |

Documentation interactive générée par FastAPI disponible sur `/docs` en développement.

### Modèle de données

Schéma géré par migrations Alembic (SQLite, mode WAL) :

- `users` — pseudo, hash de mot de passe (argon2id), rôle, statut, quota individuel optionnel.
- `sessions` — token de session (256 bits), expiration, user-agent.
- `guest_downloads` — hash d'IP salé quotidiennement, compteur ; table volatile, purgée chaque jour.
- `downloads` — URL, options choisies, statut, taille, horodatages.
- `daily_usage` — consommation journalière par utilisateur (calcul du quota).
- `settings` — paires clé/valeur modifiables depuis le tableau de bord, prioritaires sur les variables d'environnement.
- `system_metrics` — historique échantillonné (CPU, RAM, disque, température, réseau) pour les graphiques d'administration, rétention 7 jours.

### Configuration

Toutes les limites sont pilotées par variables d'environnement (`.env`, jamais commité — voir `.env.example` et `deploy/.env.example`), avec surcharge possible à chaud via la table `settings` :

| Variable | Rôle | Défaut |
|---|---|---|
| `SECRET_KEY` | signature des sessions et des liens de téléchargement | à régénérer en production |
| `USER_DAILY_QUOTA_GB` | quota journalier par utilisateur | 20 |
| `GUEST_DOWNLOAD_LIMIT` | téléchargements autorisés sans compte | 1 |
| `MAX_FILE_SIZE_GB` | taille maximale par fichier | 8 |
| `GLOBAL_DOWNLOADS_CAP_GB` | plafond disque global pour les téléchargements en cours | 15 |
| `MAX_CONCURRENT_DOWNLOADS` | téléchargements simultanés | 2 |
| `MAX_QUEUE_SIZE` | taille maximale de la file d'attente | 20 |
| `FILE_TTL_MINUTES` | rétention d'un fichier après la fin du traitement | 5 |
| `SESSION_DAYS` | durée de validité d'une session | 30 |
| `ANALYZE_RATE_LIMIT_PER_MINUTE` | limite d'appels à `/api/analyze` | 10 |
| `COOKIES_FILE` | fichier `cookies.txt` (format Netscape) pour les sites nécessitant une session (Instagram, certains contenus X/TikTok) | non défini |

### Sécurité

- Surface réseau réduite aux ports 80/443 ; SSH accessible uniquement depuis le réseau local, authentification par clé exclusivement.
- URL et options utilisateur transmises à yt-dlp exclusivement via son API Python — jamais construites en commande shell.
- Nom de fichier personnalisé assaini par liste blanche de caractères.
- Mots de passe hachés en argon2id ; cookies de session `httpOnly`, `Secure`, `SameSite=Lax`.
- Verrouillage temporaire après 5 échecs de connexion consécutifs.
- En-têtes de sécurité posés par Caddy (HSTS, `X-Content-Type-Options`, CSP restrictive sans `unsafe-inline`).
- Conteneurs non-root, système de fichiers en lecture seule là où c'est possible (`read_only` + `tmpfs` pour les répertoires nécessitant une écriture éphémère), `no-new-privileges`, réseau Docker interne (seul Caddy est exposé).
- Mises à jour de sécurité automatiques du système (`unattended-upgrades`), `fail2ban` sur les journaux du reverse proxy.
- Aucune administration à distance par exposition directe de SSH — prévu exclusivement via VPN (WireGuard/Tailscale) si nécessaire à l'avenir.

### Fichier `cookies.txt`

Certains sites (Instagram, certains contenus X/Twitter ou TikTok) exigent une session authentifiée pour être accessibles par yt-dlp :

1. Exporter les cookies d'un compte dédié (jamais un compte personnel) au format Netscape, par exemple avec l'extension [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc).
2. Déposer le fichier en tant que `deploy/cookies/cookies.txt` sur le serveur (répertoire monté en lecture seule dans le conteneur, jamais commis dans git).
3. Définir `COOKIES_FILE=/app/cookies/cookies.txt` dans `deploy/.env`, puis redémarrer le conteneur `lutecium-api`.

En l'absence de fichier, yt-dlp fonctionne normalement sans ces sites, qui renvoient un message d'erreur explicite. Le compte utilisé doit être jetable : le fichier donne un accès complet à sa session.

### Développement et tests

```bash
# Backend
cd backend && pytest                 # tests réseau réels marqués @pytest.mark.network, exclus par défaut

# Frontend
cd frontend
npm run lint                         # oxlint
npx tsc -b                           # vérification des types
npm run build
```

### Documents de référence

- [structure.md](structure.md) — cartographie human-readable du dépôt (arborescence commentée).
- [.claude/project-structure.json](.claude/project-structure.json) — cartographie machine-readable du dépôt (serveur MCP).
- [AGENTS.md](AGENTS.md) — consignes d'onboarding agent IA et règle d'or MCP.
- [docs/cahier-des-charges.md](docs/cahier-des-charges.md) — exigences fonctionnelles et non fonctionnelles (source de vérité).
- [docs/ui-ux-cahier-des-charges.md](docs/ui-ux-cahier-des-charges.md) — spécification d'interface (design, états, animations, ton).
- [docs/PLAN.md](docs/PLAN.md) — décisions d'implémentation et contrats d'API.
- [docs/design-system.md](docs/design-system.md) — système de design (tokens, typographie, composants).

### État du projet

Projet en développement actif, sans garantie de stabilité de l'API entre deux versions.

