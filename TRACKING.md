# TRACKING — Lutecium

> **Fichier de pilotage multi-sessions.** À lire en **début de session**, à mettre à jour **en temps réel** (au moment de prendre/finir une tâche, pas en fin de session).
> Protocole : [CLAUDE.md](CLAUDE.md) · Plan technique : [docs/PLAN.md](docs/PLAN.md) · Exigences : [docs/cahier-des-charges.md](docs/cahier-des-charges.md)

**Légende :** ⬜ à faire · 🔄 en cours (session + date en colonne Session) · ✅ fait · 🧪 fait, à vérifier · ⛔ bloqué (raison en Notes)

## Vue d'ensemble

| Phase | Intitulé | Avancement | Critère de sortie (CDC §12) |
|---|---|---|---|
| T | Setup transversal | 2/3 | — |
| 1 | Cœur applicatif (backend) | 2/16 | YouTube + TikTok téléchargés de bout en bout |
| 2 | Comptes et quotas | 0/9 | Invité : 1 téléchargement puis invitation ; quotas appliqués |
| D | Design (Claude Design) | 0/5 | Livrables CDC UI §12 validés |
| 3 | Frontend React | 2/14 (amorcées, non finalisées) | Parcours complet clavier/mobile en français |
| 4 | Salle de contrôle (admin) | 0/7 | Suspension + purge disque en ≤ 3 clics |
| 0 | Socle serveur (Wyse) | 4/4 ✅ | HTTPS répond depuis l'extérieur |
| 5 | Industrialisation | 0/8 | Réinstallation de zéro < 30 min |

## Phase T — Setup transversal

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| T-01 | Structure du dépôt (backend/, frontend/, deploy/, docs/) + git init + .gitignore + .env.example | §9 | ✅ | S1 (2026-07-20) | backend/ scaffoldé (app/api,core,models,services + tests), .env.example racine créé (variables §6). frontend/ reste à créer en Phase 3 |
| T-02 | Docs de pilotage : cahier des charges, PLAN.md, TRACKING.md, CLAUDE.md | — | ✅ | S1 (2026-07-20) | |
| T-03 | README squelette | — | ⬜ | | |

## Phase 1 — Cœur applicatif (backend)

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| P1-01 | Squelette FastAPI : app factory, config.py (variables §6), /api/health | P-02 | ✅ | S1 (2026-07-20) | pyproject.toml, app/main.py, app/config.py (pydantic-settings), /api/health testé (pytest + requête manuelle : `{"status":"ok","app_version":"0.1.0","yt_dlp_version":"2026.7.4"}`). Dev local sur Python 3.14 (3.12 non dispo sur la machine de dev) ; le Dockerfile (P1-02) restera la cible officielle python:3.12-slim |
| P1-02 | Dockerfile API (python:3.12-slim + ffmpeg, non-root) + compose dev | S-09 | ✅ | S1 (2026-07-20) | backend/Dockerfile + .dockerignore, deploy/docker-compose.dev.yml (hot-reload). Buildé et testé sur le Wyse (pas de Docker en local) : /api/health OK, utilisateur non-root confirmé (uid=1000 lutecium), ffmpeg 7.1.5 présent. Image de test supprimée après validation, rien laissé sur le serveur |
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
| P2-06 | Quota journalier + quota individuel + admin exempté + quota-cadeau (la demande qui franchit la limite est acceptée, les suivantes refusées) | §6, A-02, UI §6.4 | ⬜ | | Tranché : jour civil, reset à minuit (2026-07-20) |
| P2-07 | Reset mdp par l'admin → mdp temporaire + changement forcé | F-05 | ⬜ | | |
| P2-08 | Table settings + config runtime (BDD prime sur .env) | §8, A-14 | ⬜ | | |
| P2-09 | Critère de phase : parcours invité + quotas vérifiés | §12 | ⬜ | | |

## Phase D — Design (Claude Design)

Livrables du CDC UI §12, à réaliser avec Claude Design avant/pendant la Phase 3.

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| D-01 | Design system léger : tokens (2 thèmes, typo, espacements, rayons) + composants de base | UI §2, §12.1 | ⬜ | | Monospace exacte tranchée ici |
| D-02 | Wordmark : 3 pistes explorées, 1 retenue, déclinaisons (header, favicon, icône PWA) | UI §2.1, §12.2 | ⬜ | | |
| D-03 | Maquettes HD mobile+desktop, 2 thèmes : états A→F, gestionnaire, auth, historique/compte, invité, admin | UI §12.3 | ⬜ | | |
| D-04 | Prototype des animations du moment signature (B→E + quota-cadeau) | UI §9, §12.4 | ⬜ | | |
| D-05 | Vérification contrastes WCAG AA sur maquettes finales | UI §11, §12.5 | ⬜ | | |

## Phase 3 — Frontend React

Spécification : [CDC UI/UX](docs/ui-ux-cahier-des-charges.md). Mobile-first, deux thèmes monochromes, TypeScript.

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| P3-01 | Squelette Vite + React + TS, tokens design system, thèmes sombre/clair + toggle + prefers-color-scheme | UI §2 | 🧪 | S1 (2026-07-20) | Détour demandé par l'utilisateur avant la suite du backend (voir § Décisions). `frontend/` scaffoldé, `src/styles/tokens.css` (palette 2 thèmes CDC §2.2, typo §2.3), toggle thème fonctionnel (testé clair/sombre), tab title `lutecium▌` + favicon `lu>`. Wordmark et couleurs choisis directement (option 1 du CDC §2.1) sans passer par une session Claude Design formelle → à revalider/raffiner en Phase D. Pas de Framer Motion ni composants avancés à ce stade |
| P3-02 | Layout global : header (burger, wordmark, toggle, compte) + drawer navigation | UI §3.1 | 🧪 | S1 (2026-07-20) | Header fait (burger inerte, wordmark, toggle thème, bouton compte statique). Drawer de navigation pas encore câblé |
| P3-03 | États A/B : champ URL, bouton coller, analyse auto dès URL valide, erreurs inline | F-10, UI §4 | 🧪 | S1 (2026-07-20) | État A (repos) fait : champ URL, bouton coller-presse-papier fonctionnel, ligne sites supportés. Pas encore relié à /api/analyze (dépend de P1-03) ; état B (analyse) et erreurs inline pas encore faits |
| P3-04 | État C : aperçu, Télécharger / Audio seul, options avancées, nom de fichier, poids estimé | F-11..13, UI §4 | ⬜ | | |
| P3-05 | États D/E/F : progression SSE, annulation, célébration, compte à rebours TTL, erreurs actionnables | F-21..24, UI §4 | ⬜ | | |
| P3-06 | Gestionnaire de téléchargements (barre repliée, badge, liste temps réel, actions par ligne) | UI §5.2 | ⬜ | | |
| P3-07 | Toasts + notifications navigateur (permission au 1er téléchargement en file) | UI §5.1 | ⬜ | | |
| P3-08 | Pages auth : login/register, changement mdp forcé, reprise de l'URL en attente | F-01..05, UI §6.2 | ⬜ | | Dépend de P2 |
| P3-09 | Parcours invité : carte d'invitation post-téléchargement, blocage doux | F-06, UI §6.1 | ⬜ | | Dépend de P2-05 |
| P3-10 | /historique (avec retélécharger) + /compte (jauge quota, état dépassé) | UI §6.3 | ⬜ | | Utilise GET /api/me/downloads |
| P3-11 | Quota-cadeau : jauge qui dépasse + animation + messages dédiés | UI §6.4 | ⬜ | | Dépend de P2-06 |
| P3-12 | PWA : manifest, icône, share target Android (URL pré-collée + analyse lancée) | UI §8 | ⬜ | | Faisabilité à valider, pas de mode hors-ligne |
| P3-13 | Accessibilité : AA, clavier complet, aria-live, prefers-reduced-motion | UI §11 | ⬜ | | |
| P3-14 | Build production servi par Caddy | §3.3 | 🧪 | S1 (2026-07-20) | Déploiement manuel fait : `frontend/dist` copié sur le Wyse (`~/lutecium/deploy/site`), Caddyfile mis à jour (`/srv/site`), vérifié en ligne sur `https://lutecium.app`. Process manuel (scp), pas encore automatisé (Phase 5) ; `/api/*` → lutecium-api pas encore configuré (backend pas déployé) |

## Phase 4 — Salle de contrôle (admin)

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| P4-01 | API gestion utilisateurs (liste, suspension, suppression, quota, reset mdp) + vue invités | A-10 | ⬜ | | |
| P4-02 | API métriques d'usage (jour/semaine, volume, top sites, taux d'erreur, file) | A-11 | ⬜ | | |
| P4-03 | API état système (CPU, fréquence, RAM, température, disque) + alerte disque | A-12 | ⬜ | | Monter /sys ro dans le conteneur |
| P4-04 | Journal téléchargements + erreurs, rotation | A-13, M-02 | ⬜ | | |
| P4-05 | Actions rapides : purge downloads, vidage file, maj yt-dlp | A-14 | ⬜ | | |
| P4-06 | UI dashboard : 4 sections (Vue, Users, Sys, Logs), style mission control monochrome, SSE temps réel | A-10..14, UI §7 | ⬜ | | |
| P4-07 | Critère de phase : suspension + purge en ≤ 3 clics | §12 | ⬜ | | |

## Phase 0 — Socle serveur (Wyse accessible en SSH par clé ✅)

| ID | Tâche | Exigences | Statut | Session | Notes |
|---|---|---|---|---|---|
| P0-01 | Script minimal : durcissement SSH, ufw, fail2ban, unattended-upgrades | S-01, S-02, S-08, S-10 | ✅ | S1 (2026-07-20) | deploy/provision/phase0.sh — vérifié : password auth off, root off, ufw (22=LAN, 80/443 publics), fail2ban + unattended actifs |
| P0-02 | Docker + Compose + auto-cpufreq sur Debian 13 | P-01 | ✅ | S1 (2026-07-20) | Docker 29.6.2 + Compose v5.3.1 (dépôt officiel), fanta dans le groupe docker, auto-cpufreq actif |
| P0-03 | Caddy + page de test + DuckDNS + HTTPS Let's Encrypt | S-03 | ✅ | S1 (2026-07-20) | Port forwarding 80/443 confirmé par l'utilisateur sur la Bbox → redémarrage de Caddy → certificat Let's Encrypt obtenu (`certificate obtained successfully`, CN=lutecium.duckdns.org, issuer Let's Encrypt) |
| P0-04 | Critère de phase : HTTPS répond depuis l'extérieur | §12 | ✅ | S1 (2026-07-20) | `https://lutecium.duckdns.org` → 200, certificat valide. Preuve d'accès externe la plus forte : le challenge ACME tls-alpn-01 a été validé par les serveurs Let's Encrypt eux-mêmes (IPs externes visibles dans les logs Caddy) via Internet, pas le LAN. Confirmation complémentaire recommandée : test depuis un téléphone en 4G/5G |

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
| 2026-07-20 | Quota glissant | ~~Calculé sur `downloads` (24 h glissantes)~~ **Superseded**, voir ligne « Quota journalier » ci-dessous | PLAN §1.2-2 |
| 2026-07-20 | Architecture worker | Workers asyncio in-process, file persistée en BDD | PLAN §1.2-3 |
| 2026-07-20 | Alembic | Introduit en Phase 2 (P1 = create_all sur `downloads`) | PLAN §1.3 |
| 2026-07-20 | Git | Dépôt local, un commit par tâche terminée ; remote GitHub plus tard | Cadrage utilisateur |
| 2026-07-20 | Frontend | TypeScript | Cadrage utilisateur |
| 2026-07-20 | Démarrage | Le plan doit être **validé par l'utilisateur** avant de coder les phases 1–4 ; la préparation du serveur (Phase 0) démarre tout de suite | Cadrage utilisateur |
| 2026-07-20 | Accès Wyse | SSH par clé uniquement (`fanta@192.168.1.186`, hostname `debian-malefique`) ; **aucun mot de passe utilisé ni stocké** ; sudo NOPASSWD activé par l'utilisateur | S-02 |
| 2026-07-20 | CDC UI/UX | v1.0 ajouté (docs/ui-ux-cahier-des-charges.md) : Phase D (design) créée, Phase 3 restructurée en 14 tâches, quota-cadeau intégré à P2-06, `GET /api/me/downloads` ajouté aux contrats | Utilisateur |

| 2026-07-20 | Quota journalier | **Jour civil, remise à zéro à minuit** (et non 24 h glissantes) ; calcul via `daily_usage` | Cadrage utilisateur |
| 2026-07-20 | Domaine | Nom de domaine payant `lutecium.app` acheté sur Vercel, en remplacement de `lutecium.duckdns.org` comme domaine principal (backlog CDC §10.2, réalisé plus tôt que prévu). DNS géré par Vercel (nameservers `ns1/ns2.vercel-dns.com`), enregistrement `ALIAS` à l'apex (`@`) → `lutecium.duckdns.org` : Vercel gère la résolution DNS pure (pas de proxy HTTP), DuckDNS continue de suivre l'IP dynamique. Caddy sert désormais les deux domaines (`lutecium.app` en principal, `lutecium.duckdns.org` conservé en secours) | Utilisateur + doc Vercel |

| 2026-07-20 | Détour UI/UX | Interruption volontaire de l'ordre des phases (Phase 1 backend en cours) pour amorcer la Phase 3/D à la demande de l'utilisateur (« voir le site prendre forme »). Choix de wordmark et palette faits directement dans le code (option 1 du CDC UI §2.1, palette §2.2 telle quelle) plutôt que via une session Claude Design formelle — statut 🧪 (à revalider en Phase D). Reprise du backend (P1-02) ensuite | Demande utilisateur |

**En attente :** rien de bloquant actuellement. Plan validé implicitement par l'utilisateur le 2026-07-20 (« ça marche ! On continue. ») ; Phase 1 démarrée, détour Phase 3/D terminé (squelette déployé), reprise du backend.

## Journal des sessions

| Date | Session | Travail effectué |
|---|---|---|
| 2026-07-20 | S1 | Analyse du cahier des charges, création de docs/PLAN.md, TRACKING.md, CLAUDE.md, docs/cahier-des-charges.md. Cadrage reçu : plan à valider, git local, TypeScript, Wyse prêt. git init + .gitignore + 1er commit. Connexion SSH au Wyse vérifiée par clé (Debian 13, 21 Go libres, Docker absent) ; installation bloquée par sudo-avec-mot-de-passe → question posée. |
| 2026-07-20 | S1 (suite) | NOPASSWD sudo activé par l'utilisateur → Phase 0 exécutée via deploy/provision/phase0.sh : durcissement SSH, ufw, fail2ban, unattended-upgrades, Docker 29.6.2 + Compose v5.3.1, auto-cpufreq — tout vérifié actif (P0-01 ✅, P0-02 ✅). CDC UI/UX v1.0 archivé ; PLAN et TRACKING restructurés (Phase D, Phase 3 en 14 tâches, quota-cadeau, GET /api/me/downloads). |
| 2026-07-20 | S1 (suite 2) | Correction de cohérence PLAN.md §1.2 (arbitrage quota aligné sur la décision « minuit »). Préparation P0-03 : deploy/docker-compose.yml (caddy + duckdns), Caddyfile, page de test, .env.example créés et commités ; copiés sur le Wyse (~/lutecium/deploy), `deploy/.env` créé côté serveur (non commité, email ACME rempli, token DuckDNS vide). `docker compose config` validé. En attente du token DuckDNS de l'utilisateur pour lancer les conteneurs. |
| 2026-07-20 | S1 (suite 3) | Token DuckDNS reçu de l'utilisateur, écrit dans `deploy/.env` sur le serveur (jamais dans git/chat en clair après saisie). `docker compose up -d` : caddy + duckdns démarrés et stables. DuckDNS confirmé fonctionnel (`lutecium.duckdns.org` → `176.150.50.31`, IP publique réelle). Let's Encrypt bloqué par timeout sur le challenge HTTP-01 → port forwarding 80/443 manquant sur la box Bouygues, seule action restante côté utilisateur pour P0-03/P0-04. |
| 2026-07-20 | S1 (suite 4) | Utilisateur confirme le port forwarding 80/443 → 192.168.1.186 sur la Bbox. Redémarrage de Caddy : certificat Let's Encrypt obtenu avec succès (challenge tls-alpn-01 validé par les serveurs Let's Encrypt externes). `https://lutecium.duckdns.org` répond 200 avec certificat valide. **Phase 0 terminée (4/4, P0-01 à P0-04 ✅).** |
| 2026-07-20 | S1 (suite 5) | Utilisateur achète `lutecium.app` sur Vercel. Config DNS : enregistrement `ALIAS` à l'apex → `lutecium.duckdns.org` (après un tour d'essais : CNAME sous-domaine refusé car mauvais Name, puis CNAME à l'apex refusé par Vercel qui impose ALIAS pour ce cas). `LUTECIUM_DOMAIN` mis à jour sur le Wyse (`lutecium.app, lutecium.duckdns.org`), Caddy recréé : certificat Let's Encrypt obtenu pour `lutecium.app`. Les deux domaines répondent 200 en HTTPS. |
| 2026-07-20 | S1 (suite 6) | Démarrage Phase 1 (validation implicite du plan par l'utilisateur, « on continue »). T-01 complété : arborescence backend/ (app/api,core,models,services + tests), .env.example racine. P1-01 fait : squelette FastAPI (app factory, config.py pydantic-settings avec les variables §6), route /api/health, testé par pytest et requête manuelle. venv local avec Python 3.14 (3.12 indisponible sur la machine de dev ; Docker python:3.12-slim reste la cible officielle, P1-02 à venir). |
| 2026-07-20 | S1 (suite 7) | Détour demandé par l'utilisateur : amorce Phase 3/D. `frontend/` scaffoldé (Vite + React + TS), tokens de design (2 thèmes, CDC UI §2.2/§2.3), Header (burger, wordmark animé, toggle thème, bouton compte), État A (champ URL + coller presse-papier + sites supportés). Tab title `lutecium▌`, favicon `lu>`. Vérifié dans le navigateur (thème clair/sombre, mobile 375px) et par `tsc --noEmit` + `npm run build` (OK). P3-01/02/03 marquées 🧪 (amorcées, non finalisées — à raffiner en Phase D). |
| 2026-07-20 | S1 (suite 8) | Déploiement manuel du frontend sur le Wyse à la demande de l'utilisateur : Caddyfile + docker-compose.yml modifiés (`/srv/site` remplace `/srv/test`), `frontend/dist` copié via scp dans `~/lutecium/deploy/site`, ancienne page de test supprimée (repo + serveur), Caddy recréé. Vérifié : `https://lutecium.app` sert le vrai squelette (confirmé par navigateur). Incident réseau transitoire vers le Wyse pendant l'opération (2e occurrence de la session), résolu tout seul en ~15s. Reprise du backend : passage à P1-02. |
| 2026-07-20 | S1 (suite 9) | P1-02 fait : backend/Dockerfile (python:3.12-slim + ffmpeg, user non-root) + .dockerignore + deploy/docker-compose.dev.yml. Pas de Docker sur la machine de dev → build et tests faits directement sur le Wyse (répertoire temporaire, image supprimée après coup, rien laissé en place) : /api/health OK, uid=1000 non-root confirmé, ffmpeg 7.1.5 OK. Passage à P1-03 (POST /api/analyze). |
