# TRACKING — Lutecium

> **Fichier de pilotage multi-sessions.** À lire en **début de session**, à mettre à jour **en temps réel** (au moment de prendre/finir une tâche, pas en fin de session).
> Protocole : [CLAUDE.md](CLAUDE.md) · Plan technique : [docs/PLAN.md](docs/PLAN.md) · Exigences : [docs/cahier-des-charges.md](docs/cahier-des-charges.md)

**Légende :** ⬜ à faire · 🔄 en cours (session + date en colonne Session) · ✅ fait · 🧪 fait, à vérifier · ⛔ bloqué (raison en Notes)

## Vue d'ensemble

| Phase | Intitulé | Avancement | Critère de sortie (CDC §12) |
|---|---|---|---|
| T | Setup transversal | 1/3 | — |
| 1 | Cœur applicatif (backend) | 0/16 | YouTube + TikTok téléchargés de bout en bout |
| 2 | Comptes et quotas | 0/9 | Invité : 1 téléchargement puis invitation ; quotas appliqués |
| 3 | Frontend React | 0/8 | Parcours complet clavier/mobile en français |
| 4 | Salle de contrôle (admin) | 0/7 | Suspension + purge disque en ≤ 3 clics |
| 0 | Socle serveur (Wyse) | 0/4 | HTTPS répond depuis l'extérieur |
| 5 | Industrialisation | 0/8 | Réinstallation de zéro < 30 min |

## Phase T — Setup transversal

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| T-01 | Structure du dépôt (backend/, frontend/, deploy/, docs/) + git init + .gitignore + .env.example | §9 | 🔄 | S1 (2026-07-20) | git init + .gitignore + 1er commit faits ; arborescence + .env.example après validation du plan |
| T-02 | Docs de pilotage : cahier des charges, PLAN.md, TRACKING.md, CLAUDE.md | — | ✅ | S1 (2026-07-20) | |
| T-03 | README squelette | — | ⬜ | | |

## Phase 1 — Cœur applicatif (backend)

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| P1-01 | Squelette FastAPI : app factory, config.py (variables §6), /api/health | P-02 | ⬜ | | |
| P1-02 | Dockerfile API (python:3.12-slim + ffmpeg, non-root) + compose dev | S-09 | ⬜ | | |
| P1-03 | POST /api/analyze : extract_info, refus playlists, formats+fps, nom proposé | F-10, F-11, F-15 | ⬜ | | |
| P1-04 | File FIFO persistée en BDD (table downloads), reprise au redémarrage | F-20, P-03 | ⬜ | | |
| P1-05 | Worker téléchargement vidéo + fusion ffmpeg + hooks de progression | F-12, F-14 | ⬜ | | |
| P1-06 | Modes audio seul (mp3/m4a/opus) et sous-titres seuls | F-12 | ⬜ | | |
| P1-07 | Nom de fichier personnalisé assaini (whitelist) | F-13, S-05 | ⬜ | | |
| P1-08 | SSE /api/downloads/{id}/events (position, %, vitesse, étape ffmpeg) | F-21 | ⬜ | | |
| P1-09 | Temps estimé (moyenne glissante des débits récents) | F-22 | ⬜ | | |
| P1-10 | Annulation (en file et en cours) + nettoyage immédiat | F-23, F-32 | ⬜ | | |
| P1-11 | Lien signé + GET /api/files/{token} | F-24 | ⬜ | | |
| P1-12 | TTL 5 min après complétion + purge filet 15 min | F-30, F-31 | ⬜ | | |
| P1-13 | Limites : MAX_FILE_SIZE_GB (pré-check + interruption), cap disque global, MAX_QUEUE_SIZE | §6 | ⬜ | | |
| P1-14 | Messages d'erreur français (mapping exceptions yt-dlp) | F-16 | ⬜ | | |
| P1-15 | Rate limiting analyse : 10/min/utilisateur | §6 | ⬜ | | |
| P1-16 | Critère de phase : YouTube + TikTok de bout en bout + tests pytest | §12 | ⬜ | | |

## Phase 2 — Comptes et quotas

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| P2-01 | Alembic init + migration schéma complet §8, SQLite WAL | §8 | ⬜ | | |
| P2-02 | Inscription libre + hachage argon2id | F-01..03, S-04 | ⬜ | | |
| P2-03 | Login/logout, sessions 30 j, cookies httpOnly/Secure/SameSite | F-04, S-04 | ⬜ | | |
| P2-04 | Verrouillage brute-force (5 échecs) | S-06 | ⬜ | | |
| P2-05 | Mode invité : cookie signé + hash IP, 1 téléchargement, purge quotidienne | F-06..08 | ⬜ | | |
| P2-06 | Quota 20 GB/24 h glissantes + quota individuel + admin exempté | §6, A-02 | ⬜ | | |
| P2-07 | Reset mdp par l'admin → mdp temporaire + changement forcé | F-05 | ⬜ | | |
| P2-08 | Table settings + config runtime (BDD prime sur .env) | §8, A-14 | ⬜ | | |
| P2-09 | Critère de phase : parcours invité + quotas vérifiés | §12 | ⬜ | | |

## Phase 3 — Frontend React

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| P3-01 | Squelette Vite + React + TypeScript, thème type Cobalt, proxy dev API | §3.1 | ⬜ | | TypeScript validé (cadrage 2026-07-20) |
| P3-02 | Écran principal : champ URL + analyse | F-10 | ⬜ | | |
| P3-03 | Options : formats (résolution+fps), audio, sous-titres, nom de fichier | F-11..13 | ⬜ | | |
| P3-04 | File + progression SSE + annulation + lien final | F-21..24 | ⬜ | | |
| P3-05 | Écrans auth (inscription, connexion, changement mdp forcé) | F-01..05 | ⬜ | | Dépend de P2 |
| P3-06 | Parcours invité + invitation à s'inscrire | F-06 | ⬜ | | Dépend de P2-05 |
| P3-07 | Erreurs FR partout, navigation clavier, responsive mobile | F-16, §12 | ⬜ | | |
| P3-08 | Build production servi par Caddy | §3.3 | ⬜ | | |

## Phase 4 — Salle de contrôle (admin)

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| P4-01 | API gestion utilisateurs (liste, suspension, suppression, quota, reset mdp) + vue invités | A-10 | ⬜ | | |
| P4-02 | API métriques d'usage (jour/semaine, volume, top sites, taux d'erreur, file) | A-11 | ⬜ | | |
| P4-03 | API état système (CPU, fréquence, RAM, température, disque) + alerte disque | A-12 | ⬜ | | Monter /sys ro dans le conteneur |
| P4-04 | Journal téléchargements + erreurs, rotation | A-13, M-02 | ⬜ | | |
| P4-05 | Actions rapides : purge downloads, vidage file, maj yt-dlp | A-14 | ⬜ | | |
| P4-06 | UI dashboard complète | A-10..14 | ⬜ | | |
| P4-07 | Critère de phase : suspension + purge en ≤ 3 clics | §12 | ⬜ | | |

## Phase 0 — Socle serveur (Wyse accessible en SSH par clé ✅)

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| P0-01 | Script minimal : durcissement SSH, ufw, fail2ban, unattended-upgrades | S-01, S-02, S-08, S-10 | ⛔ | S1 (2026-07-20) | sudo exige un mot de passe sur le Wyse → en attente du choix utilisateur (cf. § Décisions) |
| P0-02 | Docker + Compose + auto-cpufreq sur Debian 13 | P-01 | ⬜ | | |
| P0-03 | Caddy + page de test + DuckDNS + HTTPS Let's Encrypt | S-03 | ⬜ | | |
| P0-04 | Critère de phase : HTTPS répond depuis l'extérieur | §12 | ⬜ | | |

## Phase 5 — Industrialisation

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| P5-01 | install-lutecium.sh complet et idempotent (§9.1–9.7) | §9 | ⬜ | | Réutilise les fonctions de P0-01/02 |
| P5-02 | Configuration interactive → .env + création compte admin | §9.5, A-01 | ⬜ | | |
| P5-03 | Crons : yt-dlp nightly, nettoyage, backup BDD 7 j, DuckDNS | M-01, M-03, P-04 | ⬜ | | |
| P5-04 | Caddyfile final : HSTS, X-Content-Type-Options, CSP | S-07 | ⬜ | | |
| P5-05 | Durcissement conteneurs : non-root, réseau interne, volumes ro | S-09 | ⬜ | | |
| P5-06 | Beau terminal : zsh + starship, alias, motd Lutecium | §9.8 | ⬜ | | |
| P5-07 | README complet + doc cookies.txt | M-04 | ⬜ | | |
| P5-08 | Critère de phase : réinstallation chronométrée < 30 min | §12 | ⬜ | | |

## Décisions

| Date | Sujet | Décision | Origine |
|---|---|---|---|
| 2026-07-20 | Stockage downloads | Volume disque, pas tmpfs (15 GB vs 16 GiB RAM) | PLAN §1.2-1 |
| 2026-07-20 | Quota glissant | Calculé sur `downloads` (24 h glissantes) ; `daily_usage` = stats | PLAN §1.2-2 |
| 2026-07-20 | Architecture worker | Workers asyncio in-process, file persistée en BDD | PLAN §1.2-3 |
| 2026-07-20 | Alembic | Introduit en Phase 2 (P1 = create_all sur `downloads`) | PLAN §1.3 |
| 2026-07-20 | Git | Dépôt local, un commit par tâche terminée ; remote GitHub plus tard | Cadrage utilisateur |
| 2026-07-20 | Frontend | TypeScript | Cadrage utilisateur |
| 2026-07-20 | Démarrage | Le plan doit être **validé par l'utilisateur** avant de coder les phases 1–4 ; la préparation du serveur (Phase 0) démarre tout de suite | Cadrage utilisateur |
| 2026-07-20 | Accès Wyse | SSH par clé uniquement (`fanta@192.168.1.186`, hostname `debian-malefique`) ; **aucun mot de passe utilisé ni stocké** | S-02 |

**En attente :** validation du plan par l'utilisateur (débloque les phases 1–4) · méthode d'accès root sur le Wyse (question posée le 2026-07-20, débloque P0-01/P0-02).

## Journal des sessions

| Date | Session | Travail effectué |
|---|---|---|
| 2026-07-20 | S1 | Analyse du cahier des charges, création de docs/PLAN.md, TRACKING.md, CLAUDE.md, docs/cahier-des-charges.md. Cadrage reçu : plan à valider, git local, TypeScript, Wyse prêt. git init + .gitignore + 1er commit. Connexion SSH au Wyse vérifiée par clé (Debian 13, 21 Go libres, Docker absent) ; installation bloquée par sudo-avec-mot-de-passe → question posée. |
