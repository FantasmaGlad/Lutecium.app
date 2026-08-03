# Lutecium

Service web auto-hébergé de téléchargement de vidéos et d'extraction audio (yt-dlp + FastAPI + React). Serveur backend autoritaire Python/FastAPI, workers asyncio avec intégration native de l'API Python yt-dlp, client SPA React 19 + Vite, distribution HTTPS via Caddy 2.

Ce document décrit l'architecture réellement en place, la gestion du cycle de vie des fichiers, le fonctionnement de la file d'attente autoritaire et les contrats de l'API REST v1.
Pour une cartographie fichier-par-fichier du dépôt, voir [structure.md](.claude/structure.md).

---

## Sommaire

1. [Stack et démarrage](#1-stack-et-démarrage)
2. [Architecture générale](#2-architecture-générale)
3. [Moteur backend autoritaire (`backend/app/`)](#3-moteur-backend-autoritaire-backendapp)
4. [Gestion des téléchargements et cycle de vie des fichiers](#4-gestion-des-téléchargements-et-cycle-de-vie-des-fichiers)
5. [Référence complète des configurations](#5-référence-complète-des-configurations)
6. [File d'attente, concurrence et quotas](#6-file-dattente-concurrence-et-quotas)
7. [Reverse proxy Caddy et durcissement sécurité](#7-reverse-proxy-caddy-et-durcissement-sécurité)
8. [Client React 19 et communication temps réel (SSE)](#8-client-react-19-et-communication-temps-réel-sse)
9. [Tests et vérification](#9-tests-et-vérification)
10. [Outillage IA et cartographie](#10-outillage-ia-et-cartographie)
11. [Déploiement et exploitation](#11-déploiement-et-exploitation)
12. [Licence](#12-licence)

---

## 1. Stack et démarrage

- **Backend** : Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, SQLite (mode WAL), `sse-starlette`, pytest.
- **Moteur d'extraction** : yt-dlp (exclusivement via son API Python native `yt_dlp.YoutubeDL`), ffmpeg.
- **Frontend** : React 19, Vite, TypeScript, Framer Motion, oxlint, PWA.
- **Reverse Proxy & Prod** : Caddy 2 (HTTPS automatique Let's Encrypt), Docker Compose.

### Exécution en développement local (sans Docker)

```bash
# Terminal 1 — Backend FastAPI
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env.example ../.env
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend React
cd frontend
npm install
npm run dev
```

L'API écoute sur `http://localhost:8000` (documentation OpenAPI disponible sur `http://localhost:8000/docs`).
Le serveur de développement frontend écoute sur `http://localhost:5173`.

### Exécution locale avec Docker Compose

```bash
cd deploy
docker compose -f docker-compose.dev.yml up --build
```

---

## 2. Architecture générale

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Client Web (React 19 / Vite SPA)                                                │
│  - Formulaire d'analyse & sélection de format (MainFlow.tsx)                     │
│  - Écoute SSE /api/downloads/{id}/events (downloadEvents.ts)                     │
└────────────────────────┬────────────────────────────────────────────────────────┘
                         │ HTTPS / SSE via Caddy 2 (Reverse Proxy)
                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Serveur Backend FastAPI (lutecium-api)                                          │
│  ┌───────────────────────────┐    ┌──────────────────────────────────────────┐  │
│  │  Routes API REST & SSE    │    │  File d'attente & Workers asyncio        │  │
│  │  (analyze, downloads,     │───►│  yt-dlp (API Python) + ffmpeg            │  │
│  │   auth, admin, files)     │    │  (Concurrence max: 2 jobs)               │  │
│  └─────────────┬─────────────┘    └────────────────────┬─────────────────────┘  │
│                │                                       │                        │
│                ▼                                       ▼                        │
│    SQLite WAL (lutecium.db)                    /app/data/downloads/             │
│    (users, downloads, sessions)                (Stockage éphémère, TTL 5 min)   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Trois couches principales isolées :

1. **API REST & Auth (`app/api/`, `app/core/sessions.py`)** — Traite l'authentification (sessions HTTP-only), l'analyse d'URL, la mise en file et les fonctions d'administration.
2. **Gestionnaire de file & Workers (`app/core/queue.py`, `app/core/worker.py`)** — Moteur autoritaire gérant l'exécution des tâches d'extraction et de conversion sans bloquer la boucle d'événements principale.
3. **Distribution sécurisée (`app/api/files.py`)** — Livraisons de fichiers par liens signés éphémères à usage unique avec auto-destruction.

---

## 3. Moteur backend autoritaire (`backend/app/`)

### Règle d'or d'exécution de yt-dlp (Exigence S-05)

Tout appel à yt-dlp s'effectue **strictement via l'API Python** (`yt_dlp.YoutubeDL`).
Il est formellement interdit de construire ou de passer des commandes shell avec des arguments d'URL pour empêcher toute injection d'arguments ou de commandes système.

```python
# Exemple de configuration autoritaire yt-dlp (core/worker.py)
ydl_opts = {
    'format': format_spec,
    'outtmpl': str(output_path),
    'noplaylist': True,
    'quiet': True,
    'no_warnings': True,
    'cookiefile': cookies_path if cookies_path and os.path.exists(cookies_path) else None,
}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download([url])
```

### Abstractions clés du backend

- **`app/main.py`** : Point d'entrée principal, enregistrement des handlers d'exception `LuteciumError`, middleware CORS et gestion du cycle de vie (`lifespan`) initialisant les tâches de fond.
- **`app/core/queue.py`** : File d'attente d'exécution avec persistance SQLite. Garantit que pas plus de `MAX_CONCURRENT_DOWNLOADS` (défaut : 2) ne tournent simultanément.
- **`app/core/worker.py`** : Tâche de fond exécutant l'extraction yt-dlp, la post-transformation ffmpeg (extraction audio MP3/M4A/Opus ou réencodage vidéo) et la remontée d'avancement.
- **`app/core/sse.py`** : Diffuseur d'événements `sse-starlette` transmettant la position en file, le pourcentage de progression, la vitesse d'extraction et l'ETA en temps réel.
- **`app/core/filenames.py`** : Assainissement strict du nom de fichier final via une liste blanche de caractères alphanumériques et de séparateurs sûrs (`[a-zA-Z0-9_-.]`).

---

## 4. Gestion des téléchargements et cycle de vie des fichiers

### Flux d'exécution nominal

1. **Analyse (`POST /api/analyze`)** : L'utilisateur soumet une URL. Le serveur interroge yt-dlp en mode extraction de métadonnées uniquement (`extract_info(download=False)`). Les playlists sont explicitement rejetées (Exigence S-06).
2. **Mise en file (`POST /api/downloads`)** : L'utilisateur sélectionne un format (vidéo, audio seul, sous-titres). Le serveur vérifie le quota journalier et la limite de taille, puis insère le job en base avec l'état `queued`.
3. **Suivi temps réel (`GET /api/downloads/{id}/events`)** : Le client ouvre une connexion EventSource SSE. Le backend émet les transitions d'état (`queued` → `downloading` → `processing` → `ready` ou `error`).
4. **Récupération (`GET /api/files/{token}`)** : À la fin du traitement, le backend génère un token signé HMAC-SHA256 (valide 5 minutes). Le client télécharge le fichier via ce token.
5. **Purge automatique (`FILE_TTL_MINUTES`)** : Un worker de nettoyage exécuté toutes les minutes supprime définitivement le fichier physique du disque et invalide le token 5 minutes après sa création.

---

## 5. Référence complète des configurations

La configuration combine les variables d'environnement (`.env`) et la table SQLite `settings`. Les valeurs modifiées en base par l'administrateur via `/api/admin/settings` priment dynamiquement à chaud sans nécessiter de redémarrage.

| Variable d'environnement | Type | Défaut | Effet & Description |
|---|---|---|---|
| `SECRET_KEY` | `str` | `change-me-in-production` | Clé secrète utilisée pour signer les cookies de session et les tokens de téléchargement HMAC. |
| `DATABASE_URL` | `str` | `sqlite:////app/data/lutecium.db` | URI de la base de données SQLite (mode WAL actif). |
| `DOWNLOADS_DIR` | `str` | `/app/data/downloads` | Répertoire temporaire de stockage des fichiers téléchargés. |
| `MAX_CONCURRENT_DOWNLOADS` | `int` | `2` | Nombre maximal de téléchargements yt-dlp/ffmpeg simultanés. |
| `MAX_QUEUE_SIZE` | `int` | `20` | Nombre maximal de demandes en attente dans la file avant rejet (`429 Too Many Requests`). |
| `USER_DAILY_QUOTA_GB` | `float` | `20.0` | Quota de téléchargement journalier alloué à chaque utilisateur inscrit (remise à zéro à 00:00 UTC). |
| `GUEST_DOWNLOAD_LIMIT` | `int` | `1` | Nombre maximal de téléchargements autorisés par 24h pour un invité sans compte. |
| `MAX_FILE_SIZE_GB` | `float` | `8.0` | Limite de taille individuelle autorisée pour une seule vidéo/audio. |
| `GLOBAL_DOWNLOADS_CAP_GB` | `float` | `15.0` | Plafond d'occupation disque global du dossier temporaire avant blocage préventif des nouveaux jobs. |
| `FILE_TTL_MINUTES` | `int` | `5` | Durée de vie maximale d'un fichier sur le disque après sa préparation. |
| `SESSION_DAYS` | `int` | `30` | Durée de validité des sessions utilisateurs. |
| `ANALYZE_RATE_LIMIT_PER_MINUTE` | `int` | `10` | Rate limiting de l'endpoint `/api/analyze` par IP/session. |
| `COOKIES_FILE` | `str` | `None` | Chemin vers un fichier `cookies.txt` (format Netscape) pour les sites nécessitant une session (Instagram, X). |

---

## 6. File d'attente, concurrence et quotas

### Gestion de la concurrence et tolérance aux pannes

La file d'attente autoritaire (`app/core/queue.py`) maintient l'état des jobs en mémoire et en SQLite (`downloads.status`).
En cas de crash ou de redémarrage du serveur, les jobs qui étaient à l'état `downloading` ou `processing` sont automatiquement basculés à l'état `error` au démarrage, et la file reprend l'exécution des jobs `queued`.

### Anonymisation et quota des invités (Exigence S-09)

Les requêtes d'utilisateurs non authentifiés sont suivies dans la table `guest_downloads` via le hash HMAC d'IP avec un sel tournant quotidiennement (`hash(IP + daily_salt)`).
Aucune adresse IP brute n'est conservée en base de données. La table est entièrement purgée chaque jour à minuit.

---

## 7. Reverse proxy Caddy et durcissement sécurité

### Configuration Caddy v2 (`deploy/Caddyfile`)

Caddy gère la terminaison TLS (certificats Let's Encrypt / ZeroSSL automatiques) et applique les en-têtes de sécurité recommandés par l'exigence S-08 :

```caddy
example.com {
    encode gzip zstd

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "no-referrer-when-downgrade"
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss:;"
    }

    handle /api/* {
        reverse_proxy lutecium-api:8000
    }

    handle {
        root * /srv
        file_server
        try_files {path} /index.html
    }
}
```

### Isolement des conteneurs Docker

- Système de fichiers hôte monté en `read_only` sur les conteneurs (à l'exception de `/app/data` et `/tmp` montés en `tmpfs`).
- Attribut `no-new-privileges:true` actif sur tous les services.
- Exécution sous utilisateur non-root (`nobody:nogroup` ou utilisateur applicatif dédié `1000:1000`).

---

## 8. Client React 19 et communication temps réel (SSE)

Le client frontend est une Single Page Application React 19 compilée avec Vite.

- **`src/components/flow/MainFlow.tsx`** : Composant d'interface 1-clic pilotant la machine à états de téléchargement :
  - State `IDLE` : Champ de saisie d'URL avec détection automatique.
  - State `ANALYZING` : Spinner d'extraction des métadonnées.
  - State `PREVIEW` : Carte d'affichage des formats vidéo/audio disponibles.
  - State `PROGRESS` : Barre d'avancement alimentée en temps réel par le flux SSE.
  - State `DONE` : Bouton de téléchargement direct du fichier via lien signé.
  - State `ERROR` : Diagnostic de l'erreur avec option de réessai.
- **`src/lib/downloadEvents.ts`** : Abstraction de l'EventSource SSE gérant le décalage réseau, la reconnexion automatique et le traitement des messages JSON d'avancement.

---

## 9. Tests et vérification

### Backend Python (`pytest`)

```bash
cd backend
pytest                              # Exécute tous les tests unitaires et d'intégration isolés
pytest -m network                   # Exécute les tests nécessitant un accès réseau réel à yt-dlp
```

### Frontend TypeScript (`oxlint` & `tsc`)

```bash
cd frontend
npm run lint                        # Analyse statique Oxlint
npx tsc -b                          # Validation stricte des types TypeScript
npm run build                       # Compilation du bundle de production
```

---

## 10. Outillage de cartographie et navigation

Le dépôt intègre une cartographie structurée pour la navigation et l'indexation du projet :

- **`.claude/project-structure.json`** : Source de vérité JSON décrivant les paquets, fichiers et thématiques du projet.
- **`.claude/structure.md`** : Arborescence commentée au format Markdown.
- **`.claude/mcp/server.mjs`** : Service local d'exploration exposant les fonctions `find_file`, `list_topics`, `get_topic_files`, `list_workspaces`, `get_full_map`.

---

## 11. Déploiement et exploitation

### Production sur serveur Debian 13 (Dell Wyse 5070)

Le script `deploy/install-lutecium.sh` assure l'installation et le durcissement du serveur en une seule commande :

```bash
ssh fanta@192.168.1.186
cd ~/lutecium/deploy
./install-lutecium.sh
```

### Procédure de mise à jour manuelle en production

```bash
ssh fanta@192.168.1.186
cd ~/lutecium
git pull origin main
cd deploy
docker compose up --build -d
docker compose ps
curl -s https://192.168.1.186/api/health | jq .
```

---

## 12. Licence

Distribué sous licence **GNU Affero General Public License v3.0 (AGPLv3)**. Voir le fichier [LICENSE](LICENSE) pour les termes complets.
Toute réutilisation ou modification de ce code déployée en tant que service réseau impose la mise à disposition publique des sources du service modifié.
