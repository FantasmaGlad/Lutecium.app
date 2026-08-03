# Cartographie du dépôt — Lutecium

> **Règle de maintenance impérative :**
> Cartographie human-readable du dépôt, en miroir de `.claude/project-structure.json` (lisible par machine et serveur MCP local) et `README.md` (architecture en détail).
> Mets à jour **CE fichier ET `.claude/project-structure.json` dans le MÊME commit** si tu ajoutes, déplaces ou supprimes un fichier important — sinon les deux deviennent trompeurs.

---

## Vue d'ensemble des Workspaces

- **`backend/`** : API REST & SSE FastAPI, workers asyncio yt-dlp + ffmpeg, persistance SQLite WAL.
- **`frontend/`** : Interface SPA React 19 + Vite + TS (esprit Cobalt), SSE progression, PWA, thèmes et i18n.
- **`deploy/`** : Déploiement Docker Compose, Caddy (HTTPS auto), scripts de provisioning et crons.
- **`docs/`** : Cahier des charges (exigences F/S/A/M/P), plan d'implémentation, design system, UI/UX.

---

## Arborescence commentée des fichiers significatifs

```
Lutecium/
├── backend/                                # API FastAPI & Workers Python 3.12
│   ├── app/
│   │   ├── main.py                         Point d'entrée FastAPI, cycle de vie, routage /api/*, gestion LuteciumError
│   │   ├── config.py                       Configuration Pydantic BaseSettings (.env), surchargée par effective_settings.py
│   │   ├── api/
│   │   │   ├── analyze.py                  POST /api/analyze — métadonnées yt-dlp, refus des playlists (S-06), rate limiting
│   │   │   ├── downloads.py                POST/GET /api/downloads — file d'attente, flux SSE et annulation
│   │   │   ├── files.py                    GET /api/files/{token} — distribution par lien signé temporaire (TTL 5 min)
│   │   │   └── admin.py                    API Admin — métriques CPU/RAM/disque, gestion des comptes et actions système
│   │   ├── core/
│   │   │   ├── worker.py                   Worker asyncio yt-dlp via API Python (S-05, pas de shell) + fusion ffmpeg
│   │   │   ├── queue.py                    File d'attente en mémoire avec persistance SQLite (max 2 simultanés)
│   │   │   ├── sse.py                      Diffusion Server-Sent Events (étape, %, vitesse, ETA) vers le frontend
│   │   │   ├── guest.py                    Gestion des invités via hash d'IP salé quotidiennement (S-09)
│   │   │   ├── quota.py                    Contrôle des quotas journaliers utilisateurs (USER_DAILY_QUOTA_GB = 20 Go)
│   │   │   ├── sessions.py                 Cookies HTTP-only / SameSite=Lax / Secure adossés aux tokens de session
│   │   │   ├── filenames.py                Assainissement strict des noms de fichiers téléchargés par liste blanche
│   │   │   └── effective_settings.py       Combinaison dynamique des configurations .env et des valeurs admin en base
│   │   └── models/
│   │       ├── user.py                     Modèle SQLAlchemy User (argon2id, rôles, quotas)
│   │       ├── download.py                 Modèle SQLAlchemy Download (statuts, métadonnées, horodatages)
│   │       └── session.py                  Modèle SQLAlchemy Session (tokens 256 bits, expiration)
│   └── alembic/
│       └── env.py                          Migrations de schéma SQLite en mode WAL
├── frontend/                               # Single Page Application React 19 + Vite + TypeScript
│   ├── src/
│   │   ├── App.tsx                         Composant racine, routage, modales et contexte global
│   │   ├── components/
│   │   │   └── flow/
│   │   │       └── MainFlow.tsx            Interface Cobalt-like 1-clic (détection URL, preview, progression SSE, téléchargement)
│   │   └── lib/
│   │       ├── downloadEvents.ts           Client EventSource gérant la reconnexion au flux SSE /api/downloads/{id}/events
│   │       └── AuthContext.tsx             Provider React maintenant l'état de session utilisateur (/api/auth/me)
│   └── package.json                        Scripts npm (dev, build, lint oxlint, check tsc)
├── deploy/                                 # Scripts et conteneurs de déploiement
│   ├── docker-compose.yml                  Stack de prod (lutecium-caddy + lutecium-api + duckdns)
│   ├── Caddyfile                           Reverse proxy Caddy v2, HTTPS automatique, en-têtes de sécurité (HSTS, CSP)
│   ├── install-lutecium.sh                 Script bash idempotent d'installation et durcissement système pour Debian 13
│   └── cron/
│       └── update-ytdlp.sh                 Cron de mise à jour automatique nightly de yt-dlp dans le conteneur API
├── docs/                                   # Documentation et spécifications d'origine
│   ├── PLAN.md                             Plan d'implémentation et contrats d'API REST v1
│   ├── cahier-des-charges.md               Exigences fonctionnelles et non fonctionnelles (F-xx, S-xx, A-xx, M-xx, P-xx)
│   ├── ui-ux-cahier-des-charges.md         Spécifications UI/UX, thèmes, animations et états de l'interface
│   └── design-system.md                    Tokens de design CSS, typographie et composants
├── .claude/
│   └── project-structure.json              Source de vérité JSON machine-readable pour le serveur MCP
├── .gemini/
│   └── project-structure.json              Lien symbolique vers .claude/project-structure.json
├── AGENTS.md                               Consignes d'onboarding agent, règle d'or MCP et maintenance
└── README.md                               Documentation technique globale, installation et architecture
```

---

## Thématiques transversales (Topics)

- **`auth`** : `backend/app/core/sessions.py`, `backend/app/models/session.py`, `backend/app/models/user.py`, `frontend/src/lib/AuthContext.tsx`
- **`downloads`** : `backend/app/core/worker.py`, `backend/app/core/queue.py`, `backend/app/api/downloads.py`, `frontend/src/components/flow/MainFlow.tsx`, `frontend/src/lib/downloadEvents.ts`
- **`admin`** : `backend/app/api/admin.py`, `backend/app/services/metrics.py`, `frontend/src/pages/admin/AdminOverviewPage.tsx`
- **`deploy`** : `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/install-lutecium.sh`, `deploy/cron/update-ytdlp.sh`
- **`database`** : `backend/app/core/db.py`, `backend/app/models/base.py`, `backend/alembic/env.py`
- **`security`** : `backend/app/core/filenames.py`, `backend/app/core/bruteforce.py`, `backend/app/core/sessions.py`, `deploy/Caddyfile`
