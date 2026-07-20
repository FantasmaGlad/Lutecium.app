# Plan d'implémentation — Lutecium

**Version :** 1.0 — 20 juillet 2026
**Référence :** [cahier des charges v1.0](cahier-des-charges.md) (source de vérité des exigences)
**Suivi d'avancement :** [TRACKING.md](../TRACKING.md) (état des tâches, à jour en temps réel)
**Protocole multi-agents :** [CLAUDE.md](../CLAUDE.md)

---

## 1. Analyse du cahier des charges

### 1.1 Points forts
- Périmètre v1 bien borné (pas de playlists, pas d'emails, pas de streaming direct) et phases avec critères de sortie mesurables (§12).
- Contraintes matérielles intégrées dès la conception : quotas configurables, concurrence limitée à 2, TTL courts.
- Chemins d'évolution propres : SQLite→PostgreSQL via SQLAlchemy/Alembic, Caddy→Nginx, DuckDNS→domaine payant.
- Posture sécurité cohérente : surface réduite à 80/443, SSH par clé sur LAN uniquement, conteneurs non-root, yt-dlp via API Python (S-05).

### 1.2 Points d'attention et arbitrages

| # | Point | Analyse | Décision proposée |
|---|---|---|---|
| 1 | tmpfs pour `/data/downloads` (§3.2 « tmpfs ou volume ») | Cap global de 15 GB vs 16 GiB de RAM : intenable en tmpfs. | **Volume disque** avec cap logiciel 15 GB. Le TTL de 5 min limite l'usure du SSD. |
| 2 | Quota « 20 GB / jour **glissant** » (§6) vs table `daily_usage` par date (§8) | Une fenêtre glissante de 24 h ne se calcule pas avec des compteurs journaliers. | Le quota se calcule sur la table `downloads` (somme des tailles des téléchargements terminés < 24 h + en cours). `daily_usage` est conservée comme agrégat pour les stats admin (A-11). |
| 3 | « Worker yt-dlp » séparé sur le schéma (§3.2) | Un conteneur worker + broker est surdimensionné pour 2 téléchargements simultanés. | **Workers asyncio dans le conteneur API** : yt-dlp exécuté dans des threads (`asyncio.to_thread`), ffmpeg en sous-processus (piloté par yt-dlp). La file est persistée en BDD (P-03 respecté). Extraction en conteneur séparé possible plus tard sans changer le modèle de données. |
| 4 | Température CPU depuis un conteneur (A-12) | `/sys` n'est pas visible par défaut dans le conteneur. | Monter `/sys/class/thermal` et `/sys/class/hwmon` en lecture seule dans `lutecium-api` ; lecture via psutil. |
| 5 | « État des conteneurs » sur le dashboard (A-12) | Nécessite l'accès au socket Docker = surface d'attaque. | v1 : heartbeat applicatif + métriques hôte. Si le besoin se confirme : `docker-socket-proxy` en lecture seule (jamais le socket brut). |
| 6 | SQLite en écriture concurrente | FastAPI async + workers écrivent en parallèle. | Mode **WAL** + `busy_timeout`. Quelques écritures/seconde au pire : largement suffisant. |
| 7 | Phase 0 depuis la machine de dev | Le socle serveur exige le Wyse sous Debian 13. | Commencer par la Phase 1 en local ; Phase 0 dès que le serveur est accessible. |
| 8 | Interruption à `MAX_FILE_SIZE_GB` (§6) | yt-dlp ne fournit pas toujours la taille à l'analyse (`filesize` souvent absent, `filesize_approx` estimé). | Pré-check quand la taille est connue ; sinon option `max_filesize` de yt-dlp + garde-fou dans le progress hook (abandon si octets écrits > limite). |

### 1.3 Décisions techniques structurantes

| Sujet | Décision | Justification / exigence |
|---|---|---|
| Layout | Monorepo : `backend/`, `frontend/`, `deploy/`, `docs/` | Le script d'install (§9) clone un seul dépôt. |
| Config | `pydantic-settings` lisant `.env` (défauts du §6 codés en dur) + overrides runtime via table `settings` | §6, A-14, §8 |
| Auth | Sessions côté serveur (table `sessions`), token aléatoire 256 bits dans un cookie httpOnly/Secure/SameSite=Lax, hachage `argon2-cffi` (argon2id) | F-03, F-04, S-04 |
| Liens signés | Token signé HMAC (`itsdangerous`) portant job_id, expiration alignée sur `FILE_TTL_MINUTES` | F-24, F-30 |
| SSE | `sse-starlette` ; bus d'événements en mémoire par job ; événements typés : `queued(position)`, `progress(pct, speed, size, eta)`, `processing(step)`, `done(file_url)`, `failed(message)`, `cancelled` | F-21, F-22 |
| Rate limiting | Compteur en mémoire (fenêtre glissante) par utilisateur/IP : 10 analyses/min | §6 |
| Invités | Cookie signé + `SHA-256(IP + sel quotidien)` stocké dans `guest_downloads`, purge quotidienne | F-06, F-07, A-10 (« IP anonymisée ») |
| Playlists | `noplaylist=True` systématique ; si `extract_info` retourne `_type == "playlist"` → 422 avec message F-15. URL mixte vidéo+liste → on prend la vidéo. | F-15 |
| BDD Phase 1 | SQLAlchemy + `create_all` sur la seule table `downloads` ; Alembic introduit en Phase 2 avec une migration initiale = schéma complet §8 | Éviter la cérémonie Alembic tant que le schéma bouge |
| Tests | pytest + httpx (`ASGITransport`) ; tests dépendant du réseau marqués `@pytest.mark.network` (exclus par défaut en CI/machine sans réseau) | P1-16 |
| Frontend | Vite + React, CSS léger (modules), thème sombre type Cobalt, français uniquement | §1.3, Phase 3 |

---

## 2. Structure du dépôt

```
Lutecium/
├── CLAUDE.md                  # protocole multi-agents (lu automatiquement par Claude Code)
├── TRACKING.md                # état des tâches — LE fichier de pilotage
├── README.md
├── .env.example               # toutes les variables du §6 + secrets
├── docs/
│   ├── cahier-des-charges.md  # spec v1.0 verbatim
│   └── PLAN.md                # ce document
├── backend/
│   ├── app/
│   │   ├── main.py            # app factory FastAPI
│   │   ├── config.py          # pydantic-settings
│   │   ├── api/               # routes : analyze, downloads, files, auth, admin, health
│   │   ├── core/              # queue, worker yt-dlp, sse, sécurité, erreurs FR
│   │   ├── models/            # SQLAlchemy (schéma §8)
│   │   └── services/          # quotas, nettoyage/TTL, métriques
│   ├── alembic/               # migrations (à partir de la Phase 2)
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/                  # Vite + React (Phase 3)
└── deploy/
    ├── docker-compose.yml     # prod : caddy, lutecium-api, duckdns
    ├── docker-compose.dev.yml # dev local
    ├── caddy/Caddyfile
    ├── cron/                  # maj yt-dlp, nettoyage, backup BDD, duckdns
    └── install-lutecium.sh    # provisioning §9
```

---

## 3. Contrats API (v1)

Figés pour permettre le travail backend/frontend en parallèle. **Toute évolution passe par une mise à jour de cette section** (et une note dans TRACKING.md § Décisions).

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/api/health` | public | vivacité + versions (app, yt-dlp) |
| POST | `/api/analyze` | invité/user, rate-limité 10/min | `{url}` → métadonnées : titre, durée, miniature, site, formats vidéo (résolution, fps, taille estimée), formats audio, sous-titres, nom de fichier proposé (nettoyé) |
| POST | `/api/downloads` | invité (1 max) / user | `{url, mode: video\|audio\|subtitles, format_id?, audio_format?, subtitle_langs?, filename?}` → `{id, status, position}` ; erreurs : file pleine, quota, taille, invité épuisé |
| GET | `/api/downloads/{id}/events` | propriétaire | flux SSE (événements §1.3) |
| POST | `/api/downloads/{id}/cancel` | propriétaire | annulation en file ou en cours (F-23) |
| GET | `/api/files/{token}` | lien signé | téléchargement du fichier final (F-24) |
| POST | `/api/auth/register` / `login` / `logout` | public | comptes (F-01..F-04) |
| GET | `/api/auth/me` | user | session courante + flag « mdp à changer » |
| POST | `/api/auth/change-password` | user | changement de mot de passe (F-05) |
| GET/PATCH/DELETE | `/api/admin/users`, `/api/admin/users/{id}` | admin | A-10 (suspension, quota individuel, reset mdp, suppression) |
| GET | `/api/admin/guests` | admin | téléchargements invités, IP anonymisée (A-10) |
| GET | `/api/admin/metrics` | admin | A-11 (par jour/semaine, volume, top sites, taux d'erreur, file en direct) |
| GET | `/api/admin/system` | admin | A-12 (CPU, fréquence, RAM, température, disque, heartbeats) |
| GET | `/api/admin/journal` | admin | A-13 (historique + erreurs, paginé) |
| POST | `/api/admin/actions/{action}` | admin | A-14 : `purge-downloads`, `clear-queue`, `update-ytdlp` |
| GET/PATCH | `/api/admin/settings` | admin | overrides des limites (§8 settings) |

---

## 4. Plan détaillé par phases

Les identifiants de tâches (T-xx, P1-xx…) sont ceux de [TRACKING.md](../TRACKING.md). Notes techniques ci-dessous uniquement quand elles apportent quelque chose.

### Phase T — Setup transversal
Structure du dépôt, git, `.gitignore` (venv, node_modules, `.env`, `*.db`, `data/downloads/`), README squelette.

### Phase 1 — Cœur applicatif (backend, dev local)
**Critère de sortie :** une vidéo YouTube et un TikTok téléchargés de bout en bout (analyse → file → téléchargement → fusion → lien signé → TTL).

- **P1-01** : app factory, `config.py` avec toutes les variables du §6, `/api/health`.
- **P1-02** : Dockerfile `python:3.12-slim` + ffmpeg (apt), utilisateur non-root dès maintenant (S-09), compose dev avec volume `./data/downloads`.
- **P1-03** : `extract_info(download=False)` dans un thread ; refus playlists ; réponse au format du contrat §3.
- **P1-04** : file FIFO persistée dans `downloads` (statuts §8) ; au démarrage, les jobs `queued` sont re-mis en file et les `downloading`/`processing` orphelins passés `failed` (fichiers nettoyés) — P-03.
- **P1-05** : worker : sémaphore `MAX_CONCURRENT_DOWNLOADS`, yt-dlp avec `format` choisi, `outtmpl` vers un répertoire par job, `progress_hooks`/`postprocessor_hooks` → bus SSE, fusion FFmpegMerger automatique (F-14).
- **P1-06** : audio seul via `FFmpegExtractAudio` (mp3/m4a/opus) ; sous-titres seuls (`writesubtitles`, `skip_download`).
- **P1-07** : assainissement du nom de fichier : whitelist `[A-Za-z0-9À-ÿ ._-]`, longueur max, extension imposée par le serveur (S-05).
- **P1-08** : SSE par job (contrat §3) ; un client qui se reconnecte reçoit d'abord l'état courant.
- **P1-09** : temps estimé = taille estimée ÷ moyenne glissante du débit de bout en bout des N derniers téléchargements réussis (F-22, ±50 % assumé).
- **P1-10** : annulation coopérative : flag consulté dans le progress hook (lève une exception yt-dlp), suppression immédiate des fichiers (F-32).
- **P1-11** : lien signé `itsdangerous`, expiration = TTL ; `FileResponse` avec `Content-Disposition` du nom personnalisé.
- **P1-12** : tâche périodique asyncio : suppression 5 min après `done` (statut → `expired`), balayage filet de tout fichier > 15 min (F-30, F-31).
- **P1-13** : application des limites §6 : pré-check taille, `max_filesize`, cap disque global (mesure du dossier + tailles estimées des jobs en cours), `MAX_QUEUE_SIZE`.
- **P1-14** : module central d'erreurs : mapping des exceptions yt-dlp → messages français (privée, géo-bloquée, cookies requis, introuvable, trop volumineuse, quota…) (F-16).
- **P1-15** : rate limiting analyse 10/min.
- **P1-16** : validation du critère de phase (tests manuels YouTube + TikTok, tests pytest de la file/TTL/assainissement).

### Phase 2 — Comptes et quotas
**Critère de sortie :** un invité télécharge 1 fichier puis est invité à s'inscrire ; quota appliqué aux comptes.

- **P2-01** : Alembic initialisé, migration = schéma complet §8 ; WAL activé.
- **P2-02** : inscription libre (F-01, F-02), argon2id.
- **P2-03** : login/logout, sessions 30 j (cookie httpOnly, Secure — désactivable en dev http —, SameSite=Lax).
- **P2-04** : verrouillage temporaire après 5 échecs de connexion (S-06), compteur par pseudo + IP.
- **P2-05** : mode invité (F-06..F-08) : cookie signé + hash IP salé, 1 téléchargement, puis 401 avec code dédié que l'UI traduira en invitation à s'inscrire.
- **P2-06** : quota 20 GB/24 h glissantes (calcul sur `downloads`, cf. §1.2-2), quota individuel nullable, admin exempté (A-02).
- **P2-07** : reset admin → mot de passe temporaire + flag « à changer » forçant le passage par `change-password` (F-05).
- **P2-08** : table `settings` + service de config runtime (les valeurs BDD priment sur `.env`).
- **P2-09** : validation du critère de phase.

### Phase 3 — Frontend React
**Critère de sortie :** parcours complet au clavier et sur mobile, en français.

- **P3-01** : squelette Vite + React, thème sombre type Cobalt, proxy dev vers l'API.
- **P3-02** : écran principal : champ URL unique + bouton (F-10).
- **P3-03** : panneau d'options post-analyse : formats (résolution + fps), audio, sous-titres, nom de fichier pré-rempli (F-11..F-13).
- **P3-04** : file + progression : `EventSource` natif, reconnexion, position en file, %, vitesse, ETA, étape ffmpeg, bouton annuler, lien final (F-21..F-24).
- **P3-05** : écrans auth : inscription, connexion, changement de mot de passe forcé.
- **P3-06** : parcours invité : après le 1er téléchargement, bandeau d'invitation à s'inscrire (F-06).
- **P3-07** : erreurs françaises partout, navigation clavier, responsive mobile (critère de phase).
- **P3-08** : build de production servi par Caddy (`/api/*` → lutecium-api, le reste → statique).

### Phase 4 — Salle de contrôle (admin)
**Critère de sortie :** suspension d'un compte et purge disque réalisables en ≤ 3 clics.

- **P4-01** : API gestion utilisateurs (A-10).
- **P4-02** : API métriques (A-11) — agrégations SQL sur `downloads`/`daily_usage`.
- **P4-03** : API système (A-12) — psutil + `/sys/class/thermal` monté ro ; alerte disque (risque §11).
- **P4-04** : journal (A-13) + rotation des logs (M-02).
- **P4-05** : actions rapides (A-14) — la maj yt-dlp fait `pip install -U yt-dlp` dans le conteneur puis recharge les workers proprement (pas pendant un téléchargement en cours).
- **P4-06** : UI dashboard (vues : utilisateurs, invités, métriques, système, journal, réglages, actions).
- **P4-07** : validation du critère de phase.

### Phase 0 — Socle serveur (nécessite le Wyse)
**Critère de sortie :** `https://lutecium.duckdns.org` répond depuis l'extérieur.

- **P0-01** : script minimal (fonctions réutilisables par P5-01) : durcissement SSH (S-02), ufw 80/443 + SSH LAN (S-01), fail2ban, unattended-upgrades (S-10).
- **P0-02** : Docker + Compose + auto-cpufreq (P-01).
- **P0-03** : Caddy + page de test statique + conteneur DuckDNS + HTTPS Let's Encrypt (S-03).
- **P0-04** : validation depuis l'extérieur (4G/5G).

### Phase 5 — Industrialisation
**Critère de sortie :** réinstallation complète de zéro sur le Wyse en < 30 min via le script.

- **P5-01** : `install-lutecium.sh` complet et idempotent (§9, étapes 1–7) — chaque étape vérifie l'état avant d'agir.
- **P5-02** : configuration interactive → `.env` + création du compte admin (A-01).
- **P5-03** : crons : maj yt-dlp nightly (M-01), nettoyage orphelins (M-03), backup BDD `.backup` rétention 7 j (P-04), DuckDNS.
- **P5-04** : Caddyfile final : HSTS, X-Content-Type-Options, CSP adaptée à React (S-07).
- **P5-05** : durcissement conteneurs : non-root, réseau Docker interne (seul Caddy exposé), volumes ro quand possible (S-09).
- **P5-06** : « beau terminal » : zsh + starship, alias, motd Lutecium avec état du service (§9.8).
- **P5-07** : README complet + doc `cookies.txt` (M-04).
- **P5-08** : test chronométré de réinstallation (< 30 min).

---

## 5. Ordre recommandé et parallélisation multi-agents

**Ordre nominal :** T → P1 → P2 → P3 → P4 → P5. **P0 est indépendante** : à lancer dès que le Wyse est accessible, en parallèle de n'importe quelle phase.

Parallélisation possible entre sessions/agents :
- **Piste A (backend)** : P1 puis P2 — séquentiel, c'est la colonne vertébrale.
- **Piste B (frontend)** : P3 peut démarrer dès la fin de P1 (les contrats §3 sont figés ; l'auth P3-05/P3-06 attend P2).
- **Piste C (ops)** : P0 dès que le matériel est prêt ; P5-01/P5-06 (script, terminal) peuvent s'écrire à tout moment, leur test attend le Wyse.

Règles de coordination : voir [CLAUDE.md](../CLAUDE.md). En résumé : une tâche = un seul agent ; TRACKING.md mis à jour avant/après chaque tâche ; toute déviation du plan documentée dans TRACKING.md § Décisions.
