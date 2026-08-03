# Consignes pour l'agent IA — Lutecium

## 1. Architecture (vue d'ensemble)

Lutecium est une application web auto-hébergée de téléchargement de vidéos (style Cobalt Tools) structurée en monorepo :
- **`backend/`** : API REST & SSE FastAPI, workers asyncio yt-dlp + ffmpeg, base SQLite en mode WAL.
- **`frontend/`** : Interface SPA React 19 + Vite + TypeScript, thèmes clair/sombre, PWA et streaming d'événements SSE.
- **`deploy/`** : Infrastructure Docker Compose derrière reverse proxy Caddy (HTTPS automatique) sur serveur Debian 13 (Dell Wyse 5070).
- **`docs/`** : Exigences fonctionnelles et de sécurité (cahier des charges F/S/A/M/P) et contrats API v1 (`docs/PLAN.md`).

Documentation détaillée : [README.md](README.md). Cartographie fichier par fichier : [structure.md](structure.md).

---

## 2. RÈGLE D'OR : utiliser le serveur MCP avant d'explorer à l'aveugle

> **Avant un `grep` large ou une exploration au hasard pour trouver la logique métier d'un composant, utilise le serveur MCP local `lutecium-project-map` :**
> - `find_file(query)` — recherche par mots-clés libres
> - `list_topics()` — liste des catégories thématiques (`auth`, `downloads`, `admin`, `deploy`, `database`, `security`)
> - `get_topic_files(topic)` — fichiers d'un sujet donné
> - `list_workspaces()` — liste des paquets et dépendances
> - `get_full_map()` — cartographie complète JSON

---

## 3. Maintenance de la cartographie

Toute modification de structure (ajout, déplacement ou suppression d'un fichier significatif) impose une mise à jour **DANS LE MÊME COMMIT** de :
1. `structure.md` (version human-readable)
2. `.claude/project-structure.json` (version machine-readable du serveur MCP)

---

## 4. Principes de développement propres au projet

1. **API Python yt-dlp obligatoire (S-05)** : Tout appel à yt-dlp doit passer exclusivement par son API Python (`yt_dlp.YoutubeDL`). Il est **strictement interdit** de passer des URL ou arguments à un shell pour éviter les vulnérabilités d'injection.
2. **Gestion de file & TTL (P-01/S-07)** : Concurrence max 2 téléchargements simultanés (`MAX_CONCURRENT_DOWNLOADS`). Les fichiers servis via liens signés temporaires sont supprimés au bout de 5 minutes (`FILE_TTL_MINUTES`).
3. **Anonymat des invités (S-09)** : Les téléchargements anonymes sont suivis par hash d'IP salé quotidiennement, remis à zéro à minuit. Aucune IP brute n'est persistée.
4. **Authentification & Cookies** : Sessions adossées à des tokens 256 bits (`sessions`), transportées par cookies HTTP-only / SameSite=Lax / Secure. Fichier `deploy/cookies/cookies.txt` (Netscape) pour les sites nécessitant une authentification (Instagram, X).
5. **Base de données SQLite** : Moteur SQLAlchemy 2.x et Alembic configurés pour SQLite avec mode WAL.
6. **Tests et vérification** : Exécuter `pytest` dans `backend/` et `npm run lint && npx tsc -b` dans `frontend/` avant tout commit.
7. **Runbook de déploiement** : Disponible dans `.claude/project-structure.json` section `_deployment` pour les interventions sur `debian-malefique` (`192.168.1.186`).
