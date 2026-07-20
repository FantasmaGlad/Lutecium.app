# Cahier des charges — Projet Lutecium
**Version :** 1.0 — 20 juillet 2026
**Auteur :** [Toi]
**Statut :** Référence pour développement
---
## 1. Contexte et objectifs
### 1.1 Présentation
Lutecium est un service web auto-hébergé de téléchargement de vidéos en ligne, s'appuyant sur la bibliothèque **yt-dlp** (support de YouTube, TikTok, Instagram, X/Twitter et plus de 1000 sites). L'utilisateur colle une URL dans une interface web inspirée de Cobalt Tools, choisit ses options (format, qualité, audio seul, sous-titres…), et récupère le fichier dans son navigateur.
### 1.2 Objectifs
- **Fonctionnel** : offrir un téléchargeur multi-sites fiable et **sans friction** : 1 téléchargement possible sans compte, inscription libre et immédiate au-delà. La philosophie est la commodité (esprit Cobalt), pas le mur d'authentification.
- **Pédagogique (home lab)** : maîtriser Docker, le reverse proxying, le durcissement d'un serveur exposé, la gestion d'une base de données, et le provisioning automatisé.
- **Scalabilité** : concevoir dès le départ une installation reproductible (script `.sh` paramétrable) pour pouvoir déployer plusieurs serveurs à l'avenir.
### 1.3 Hors périmètre (v1)
- Monétisation / publicité (reporté, voir §10).
- Interface multilingue (français uniquement).
- Streaming direct vers le navigateur (mode « store and forward » uniquement).
- Envoi d'emails (reset de mot de passe manuel par l'admin).
- Multi-serveurs (préparé par l'architecture, non implémenté).
---
## 2. Environnements
### 2.1 Machine de développement
| Élément | Détail |
|---|---|
| Machine | HP Pavilion 16-ag0xxx — Ryzen 7 8840U, 16 GiB RAM, 512 GB |
| OS | Ubuntu 26.04 LTS (GNOME 50, Wayland) |
| Outils | Docker + Docker Compose, Node.js (build React), Python 3.12+, Git |
### 2.2 Serveur de production
| Élément | Détail |
|---|---|
| Machine | Dell Wyse 5070 (fanless) — 16 GB DDR4, SSD **32 GB** (SSD 512 GB à récupérer ultérieurement) |
| OS | Debian 13 Trixie, 64-bit |
| Réseau | Box Bouygues, port forwarding 80/443 uniquement, DynDNS DuckDNS |
| Domaine | `lutecium.duckdns.org` (nom de domaine payant envisagé plus tard) |
### 2.3 Contraintes matérielles fortes
- **Disque 32 GB** : après OS + Docker + images (~8–10 GB), environ 20 GB utiles. D'où les limites du §6.
- **CPU fanless** : risque de throttling thermique sur les longs encodages ffmpeg. Concurrence limitée à 2 téléchargements simultanés.
- **Upload Bouygues** : le débit montant de la box est le goulot d'étranglement pour servir les fichiers aux utilisateurs.
---
## 3. Architecture technique
### 3.1 Stack retenue
| Couche | Technologie | Justification |
|---|---|---|
| Backend | **Python 3.12 + FastAPI** | Intégration native de yt-dlp (bibliothèque Python), asynchrone, doc API auto-générée |
| Téléchargement | **yt-dlp + ffmpeg** | Support multi-sites, fusion audio/vidéo, extraction audio |
| Frontend | **React** (Vite) | Composants réutilisables, évolutivité, gestion fine des états (file, progression) |
| Temps réel | **SSE (Server-Sent Events)** | Progression des téléchargements et position dans la file, plus simple que WebSocket pour du flux unidirectionnel serveur → client |
| Base de données | **SQLite** via **SQLAlchemy + Alembic** | Zéro maintenance, un seul fichier ; l'ORM garantit une migration future vers PostgreSQL par simple changement de chaîne de connexion |
| Reverse proxy | **Caddy** | HTTPS automatique (Let's Encrypt), config minimale ; migration possible vers Nginx sans impact applicatif |
| Conteneurisation | **Docker + Docker Compose** | Isolation, mises à jour yt-dlp sans risque, rollback facile |
| DynDNS | **DuckDNS** (client en conteneur ou cron) | IP Bouygues dynamique |
| Monitoring | Dashboard admin intégré + **Uptime Kuma** (optionnel) | Voir §8 |
### 3.2 Schéma d'architecture
```
Internet
   │  (ports 80/443 uniquement, forward box Bouygues)
   ▼
┌─────────────────────────── Wyse 5070 / Debian 13 ───────────────────────────┐
│                                                                             │
│  ┌─────────┐    ┌──────────────────────────────┐    ┌────────────────────┐  │
│  │  Caddy  │───▶│  FastAPI (backend Lutecium)  │───▶│  Worker yt-dlp     │  │
│  │  HTTPS  │    │  - API REST + SSE            │    │  + ffmpeg          │  │
│  │  auto   │    │  - Auth / sessions           │    │  (file d'attente)  │  │
│  └─────────┘    │  - Quotas / file d'attente   │    └─────────┬──────────┘  │
│       │         └──────────┬───────────────────┘              │             │
│       │                    │                                  ▼             │
│       ▼                    ▼                        /data/downloads (tmpfs   │
│  Frontend React      SQLite (lutecium.db)          ou volume, TTL 5 min)    │
│  (fichiers statiques │ SQLAlchemy + Alembic                                 │
│   buildés)           └── sauvegarde quotidienne                             │
│                                                                             │
│  Cron : maj yt-dlp nightly · nettoyage fichiers · backup BDD · DuckDNS      │
│  auto-cpufreq (optimisation thermique)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
SSH : réseau local uniquement (port 22 NON forwardé), clés uniquement.
Administration distante future : WireGuard ou Tailscale.
```
### 3.3 Conteneurs Docker Compose
1. `caddy` — reverse proxy, sert le frontend React buildé, termine le TLS.
2. `lutecium-api` — FastAPI + yt-dlp + ffmpeg (image custom, base `python:3.12-slim`).
3. `duckdns` — mise à jour de l'IP (ou simple cron hôte).
4. `uptime-kuma` — (optionnel) supervision.
Volumes : `caddy_data` (certificats), `lutecium_db` (SQLite + backups), `downloads` (fichiers temporaires).
---
## 4. Exigences fonctionnelles — côté utilisateur
### 4.1 Authentification et comptes
| ID | Exigence |
|---|---|
| F-01 | Inscription via un formulaire sur le site (pseudo, mot de passe). |
| F-02 | **Inscription libre : le compte est actif immédiatement**, sans validation par l'admin. L'admin conserve la possibilité de suspendre ou supprimer un compte a posteriori depuis le dashboard (A-10). |
| F-03 | Connexion par pseudo + mot de passe. Mots de passe hachés (**argon2** ou bcrypt), jamais en clair. |
| F-04 | Session persistante **30 jours** (cookie httpOnly, Secure, SameSite). |
| F-05 | Mot de passe oublié : réinitialisation manuelle par l'admin (génération d'un mot de passe temporaire à changer à la première connexion). |
| F-06 | **Mode invité (sans compte)** : un visiteur non connecté peut effectuer **1 téléchargement** (vidéo, audio ou autre fichier). Au-delà, l'interface l'invite à créer un compte. |
| F-07 | Le suivi du mode invité repose sur un mécanisme léger (cookie + IP en mémoire courte durée). **Limite volontairement contournable** : l'objectif est la commodité et l'incitation douce à l'inscription, pas un mur d'authentification. Aucun CAPTCHA ni empreinte agressive. |
| F-08 | Le téléchargement invité est soumis aux mêmes limites techniques que les comptes (taille max par fichier, file d'attente) et compte dans le quota disque global. |
### 4.2 Téléchargement
| ID | Exigence |
|---|---|
| F-10 | Champ URL unique acceptant tout site supporté par yt-dlp (YouTube, TikTok, Instagram, X, etc.). |
| F-11 | Après analyse de l'URL, affichage des options disponibles : formats vidéo (avec résolution **et fps**), pistes audio, sous-titres, miniature, métadonnées. |
| F-12 | Modes : vidéo (meilleure qualité dispo ou choix précis), **audio seul** (mp3/m4a/opus), sous-titres seuls. |
| F-13 | Champ **nom de fichier personnalisé**, pré-rempli avec le titre de la vidéo nettoyé (caractères interdits retirés). |
| F-14 | Fusion audio+vidéo automatique via ffmpeg lorsque les flux sont séparés. |
| F-15 | Playlists : **refusées en v1** (message clair) — une URL = une vidéo. |
| F-16 | Messages d'erreur explicites en français : vidéo privée, géo-bloquée, site nécessitant des cookies, fichier trop volumineux, quota atteint, etc. |
### 4.3 File d'attente et progression
| ID | Exigence |
|---|---|
| F-20 | Maximum **2 téléchargements simultanés** sur le serveur (valeur configurable) ; les demandes suivantes entrent en file d'attente FIFO. |
| F-21 | Affichage en temps réel (SSE) : position dans la file, puis progression du téléchargement (%, vitesse, taille), puis étape de traitement ffmpeg. |
| F-22 | **Temps estimé** affiché, calculé sur la moyenne glissante des téléchargements récents (précision indicative, ±50 %). |
| F-23 | L'utilisateur peut annuler sa demande en file ou en cours. |
| F-24 | À la fin, un lien de téléchargement est présenté ; le fichier est servi via un lien signé propre à l'utilisateur. |
### 4.4 Gestion des fichiers (« store and forward »)
| ID | Exigence |
|---|---|
| F-30 | Le fichier est conservé **5 minutes** après la fin du traitement, permettant de le re-télécharger en cas de changement de page, puis supprimé automatiquement. |
| F-31 | Nettoyage de sécurité : toute trace de fichier de plus de 15 minutes est purgée (filet en cas de crash du processus principal). |
| F-32 | Les fichiers temporaires d'un téléchargement échoué ou annulé sont supprimés immédiatement. |
---
## 5. Exigences fonctionnelles — côté administrateur
### 5.1 Compte admin
| ID | Exigence |
|---|---|
| A-01 | Un compte admin est créé lors de l'installation (script `.sh`, identifiants demandés interactivement, stockés hachés dans SQLite). |
| A-02 | L'admin est **exempté des quotas**. |
### 5.2 Dashboard admin — « salle de contrôle »
| ID | Exigence |
|---|---|
| A-10 | **Gestion utilisateurs** : liste des comptes (avec date d'inscription et activité récente), suspension, suppression, modification du quota individuel, reset de mot de passe. Vue des téléchargements invités (IP anonymisée) pour repérer un éventuel abus. |
| A-11 | **Métriques d'usage** : téléchargements par jour/semaine (graphiques), volume total, top sites sources, taux d'erreur yt-dlp, file d'attente en direct. |
| A-12 | **État système** : CPU (charge + fréquence), RAM, **température** (critique sur fanless), espace disque restant, état des conteneurs. |
| A-13 | **Journal** : historique des téléchargements (utilisateur, URL, taille, durée, statut) et journal des erreurs, avec rotation. |
| A-14 | Actions rapides : purge du dossier téléchargements, vidage de la file, mise à jour manuelle de yt-dlp. |
---
## 6. Quotas et limites
Toutes les valeurs sont des **variables de configuration** (fichier `.env`), définies lors de l'installation par le script et modifiables ensuite.
| Paramètre | Valeur v1 (SSD 32 GB) | Variable |
|---|---|---|
| Quota par utilisateur | **20 GB / jour glissant** | `USER_DAILY_QUOTA_GB=20` |
| Téléchargements en mode invité | **1 par visiteur** (soft limit) | `GUEST_DOWNLOAD_LIMIT=1` |
| Taille max par fichier | **8 GB** | `MAX_FILE_SIZE_GB=8` |
| Quota disque global téléchargements | **15 GB** | `GLOBAL_DOWNLOADS_CAP_GB=15` |
| Téléchargements simultanés | **2** | `MAX_CONCURRENT_DOWNLOADS=2` |
| Taille max de la file d'attente | 20 | `MAX_QUEUE_SIZE=20` |
| Rétention fichier après complétion | 5 min | `FILE_TTL_MINUTES=5` |
| Durée de session | 30 jours | `SESSION_DAYS=30` |
**Remarque importante** : avec le quota global de 15 GB, un utilisateur ne pourra pas réellement consommer 20 GB en simultané ; le quota journalier de 20 GB prend tout son sens après migration sur le SSD 512 GB (il suffira alors d'ajuster `GLOBAL_DOWNLOADS_CAP_GB` et `MAX_FILE_SIZE_GB`).
Comportements associés :
- Si le quota global disque est atteint, les nouvelles demandes sont refusées avec un message clair (pas de suppression de fichiers en cours d'usage).
- Vérification du poids estimé **avant** téléchargement quand yt-dlp le fournit ; sinon interruption en cours si `MAX_FILE_SIZE_GB` est dépassé.
- Rate limiting applicatif : max 10 requêtes d'analyse d'URL / minute / utilisateur.
---
## 7. Exigences non fonctionnelles
### 7.1 Sécurité
| ID | Exigence |
|---|---|
| S-01 | **Seuls les ports 80 et 443 sont forwardés** sur la box. Le port 22 (SSH) n'est jamais exposé à Internet. |
| S-02 | SSH : authentification **par clé uniquement** (`PasswordAuthentication no`), root login désactivé. |
| S-03 | HTTPS obligatoire (redirection 80→443 par Caddy, certificats Let's Encrypt automatiques). |
| S-04 | Mots de passe hachés argon2id ; cookies de session httpOnly + Secure + SameSite=Lax. |
| S-05 | Validation stricte des entrées : l'URL est passée à yt-dlp **en argument via son API Python, jamais via une commande shell** (prévention d'injection). Le nom de fichier personnalisé est assaini (whitelist de caractères). |
| S-06 | Protection brute-force login : verrouillage temporaire après 5 échecs. |
| S-07 | En-têtes de sécurité via Caddy (HSTS, X-Content-Type-Options, CSP adaptée à React). |
| S-08 | `fail2ban` sur l'hôte (journaux Caddy) contre les scans agressifs. |
| S-09 | Conteneurs non-root, volumes en lecture seule quand possible, réseau Docker interne (seul Caddy est exposé). |
| S-10 | Mises à jour de sécurité Debian automatiques (`unattended-upgrades`). |
| S-11 | Administration distante future : via **WireGuard ou Tailscale** exclusivement, jamais par exposition de SSH. |
### 7.2 Performance et fiabilité
| ID | Exigence |
|---|---|
| P-01 | `auto-cpufreq` installé et configuré : fréquence max en charge, économie en idle, mitigation du throttling thermique du fanless. |
| P-02 | L'API reste réactive (<500 ms) pendant les téléchargements : les tâches yt-dlp/ffmpeg tournent dans des workers séparés du serveur web. |
| P-03 | Redémarrage automatique des conteneurs (`restart: unless-stopped`) ; la file d'attente survit à un redémarrage (persistée en BDD). |
| P-04 | Sauvegarde quotidienne de la BDD SQLite (`.backup`), rétention 7 jours, sur le même disque en v1 (copie externe recommandée dès que possible). |
### 7.3 Maintenance et exploitation
| ID | Exigence |
|---|---|
| M-01 | **Mise à jour automatique nightly de yt-dlp** (cron : `pip install -U yt-dlp` dans le conteneur ou rebuild de l'image) — indispensable, les sites cassent l'extracteur en permanence. |
| M-02 | Rotation des logs (taille max, durée max). |
| M-03 | Cron de nettoyage des fichiers orphelins (§F-31). |
| M-04 | Support d'un fichier `cookies.txt` monté dans le conteneur pour les sites l'exigeant (Instagram, certains contenus X/TikTok), documenté dans le README. |
---
## 8. Modèle de données (SQLite / SQLAlchemy)
Tables principales (schéma géré par migrations Alembic) :
- **users** : id, pseudo (unique), hash mot de passe, rôle (user/admin), statut (active/suspended), quota journalier personnalisé (nullable → défaut global), date de création, flag « mot de passe à changer ».
- **guest_downloads** : hash d'IP, cookie invité, compteur, date — table volatile purgée quotidiennement, servant uniquement à la soft limit du mode invité (F-07).
- **sessions** : id (token), user_id, date de création, date d'expiration, user-agent.
- **downloads** : id, user_id, URL source, site détecté, options choisies (JSON), nom de fichier final, taille, durée de traitement, statut (queued / downloading / processing / done / failed / cancelled / expired), message d'erreur, timestamps.
- **daily_usage** : user_id, date, octets consommés (pour le quota 20 GB/jour glissant).
- **settings** : paires clé/valeur modifiables depuis le dashboard admin (permet d'ajuster les limites sans redéploiement).
**Évolution des volumes** : SQLite étant un fichier unique, la migration vers un disque plus grand est une simple copie. Le passage à PostgreSQL (nécessaire uniquement en multi-serveurs) se fera via SQLAlchemy/Alembic en changeant `DATABASE_URL` — aucune réécriture applicative. Variable `DB_TYPE` prévue dans le script d'installation dès la v1.
---
## 9. Livrable « provisioning » : script d'installation
Un livrable à part entière du projet : **`install-lutecium.sh`**, permettant de configurer une machine Debian 13 vierge de zéro, en vue d'un futur scaling multi-serveurs.
Fonctions du script (idempotent, relançable sans casse) :
1. Mise à jour système + paquets de base (git, curl, ufw, fail2ban, unattended-upgrades).
2. **Durcissement SSH** : import de la clé publique, désactivation du mot de passe et du root login.
3. Pare-feu ufw : autoriser 80/443, SSH depuis le LAN uniquement.
4. Installation de Docker + Docker Compose, et d'auto-cpufreq.
5. **Configuration interactive** : questions posées à l'opérateur (quotas, limites disque, concurrence, domaine DuckDNS + token, identifiants admin) → génération du fichier `.env`.
6. Clonage du dépôt Git de Lutecium, build/pull des images, initialisation de la BDD (migrations Alembic), création du compte admin.
7. Installation des crons (yt-dlp update, nettoyage, backup BDD, DuckDNS).
8. **« Beau terminal »** : installation et configuration d'un shell agréable (zsh + starship ou équivalent, alias utiles, motd d'accueil Lutecium avec état du service).
9. Rapport final : URL du service, récap de la configuration, checklist des actions manuelles restantes (port forwarding sur la box).
---
## 10. Évolutions futures (backlog)
Par ordre de probabilité :
1. **Migration SSD 512 GB** : déchiffrer/réinstaller le disque Windows, étendre les quotas (`MAX_FILE_SIZE_GB`, `GLOBAL_DOWNLOADS_CAP_GB`), allonger éventuellement le TTL des fichiers.
2. **Nom de domaine payant** en remplacement de DuckDNS (changement dans le Caddyfile uniquement).
3. **Proxys sortants** (`--proxy` de yt-dlp, proxys résidentiels) si l'IP Bouygues se fait rate-limiter par YouTube — configurable par site source.
4. **Support des playlists** avec limite d'éléments et quota adapté.
5. **Streaming direct** pour les cas simples (audio seul, formats pré-fusionnés).
6. **Migration Nginx** si besoin de fonctionnalités avancées (sans impact applicatif).
7. **Multi-serveurs** : PostgreSQL central, répartition de charge, le script d'installation servant de base de provisioning.
8. **Monétisation** : à réévaluer. ⚠️ Point de vigilance déjà identifié : les régies publicitaires majeures (AdSense…) refusent les sites de téléchargement de contenus de plateformes tierces, et une exploitation commerciale aggrave l'exposition juridique (CGU des plateformes). Alternatives : dons, accès soutenu. À traiter dans un avenant dédié le moment venu.
9. **WireGuard/Tailscale** pour l'administration à distance.
---
## 11. Risques identifiés
| Risque | Impact | Mitigation |
|---|---|---|
| Casse fréquente des extracteurs yt-dlp (YouTube, TikTok, Insta changent leur code) | Service partiellement HS | Mise à jour auto nightly (M-01) + bouton de maj manuelle admin (A-14) |
| Rate-limiting de l'IP résidentielle par YouTube | Téléchargements bloqués, impact sur l'usage perso du foyer | Cercle d'utilisateurs restreint, quotas, proxys en évolution future |
| Saturation du SSD 32 GB | Crash ou refus de service | Quota global 15 GB, TTL 5 min, purge de sécurité, alerte disque sur le dashboard |
| Throttling thermique du Wyse fanless | Lenteur des encodages | auto-cpufreq, concurrence limitée à 2, monitoring température |
| Upload Bouygues limité | Téléchargements lents côté utilisateurs | Peu d'utilisateurs simultanés ; communiquer le débit attendu |
| Sites exigeant une authentification (Instagram…) | Échecs de téléchargement | Support cookies.txt (M-04), messages d'erreur explicites |
| Compromission du serveur exposé | Perte de la machine, rebond sur le LAN | §7.1 complet : surface réduite à 80/443, fail2ban, conteneurs non-root, maj auto |
| Usage du service pour du contenu protégé | Responsabilité de l'hébergeur | Journal des téléchargements, quotas, possibilité de suspension a posteriori, pas d'exploitation commerciale en v1 |
| Inscriptions de bots / abus du mode invité (inscription libre, soft limit contournable — choix assumé) | Consommation de disque, CPU et bande passante | Quotas par compte, quota disque global, rate limiting applicatif, surveillance des inscriptions et des invités depuis le dashboard (A-10), suspension manuelle ; durcissement possible plus tard (invitation, approbation) sans refonte |
---
## 12. Découpage en phases de développement
**Phase 0 — Socle (serveur)** : script d'installation minimal, Debian durci, Docker, Caddy avec page de test en HTTPS via DuckDNS. *Critère : le domaine répond en HTTPS depuis l'extérieur.*
**Phase 1 — Cœur applicatif** : FastAPI + yt-dlp, téléchargement d'une URL sans compte (en local uniquement), fusion ffmpeg, TTL fichiers. *Critère : une vidéo YouTube et un TikTok téléchargés de bout en bout.*
**Phase 2 — Comptes et quotas** : SQLite/SQLAlchemy, inscription libre, sessions 30 j, quotas journaliers, mode invité (1 téléchargement puis invitation à s'inscrire), verrouillage brute-force. *Critère : un invité peut télécharger 1 fichier puis est invité à s'inscrire ; quota appliqué aux comptes.*
**Phase 3 — Frontend React** : interface type Cobalt, analyse d'URL, choix des options, nom de fichier personnalisé, file d'attente et progression SSE. *Critère : parcours complet au clavier/mobile en français.*
**Phase 4 — Salle de contrôle** : dashboard admin complet (utilisateurs, métriques, système, journaux, actions). *Critère : approbation d'un compte et purge disque réalisables en 3 clics.*
**Phase 5 — Industrialisation** : script d'installation complet et idempotent, crons, backups, fail2ban, tests de restauration, documentation README. *Critère : réinstallation complète de zéro sur le Wyse en < 30 min via le script.*
---
*Document évolutif — toute modification des exigences fera l'objet d'une nouvelle version.*
