# CLAUDE.md — Lutecium

Service web auto-hébergé de téléchargement de vidéos (yt-dlp + FastAPI + React), déployé en Docker derrière Caddy sur un Dell Wyse 5070 (Debian 13). Interface en français, esprit Cobalt Tools.

## Documents de référence — à lire en début de session

1. **[TRACKING.md](TRACKING.md)** — état des tâches et journal des sessions. **Toujours le lire en premier.**
2. **[docs/PLAN.md](docs/PLAN.md)** — plan d'implémentation, décisions techniques, contrats API.
3. **[docs/cahier-des-charges.md](docs/cahier-des-charges.md)** — source de vérité des exigences (IDs F-xx, A-xx, S-xx, P-xx, M-xx).

## Protocole multi-sessions (obligatoire)

1. **Début de session** : lire TRACKING.md, identifier les tâches ⬜ non bloquées de la phase en cours.
2. **Avant de coder** : passer la tâche choisie à 🔄 avec l'identifiant de session et la date (colonne Session). Une tâche = un seul agent.
3. **Ne jamais reprendre** une tâche 🔄 d'une autre session sans demande explicite de l'utilisateur.
4. **Fin de tâche** : passer à ✅ (ou 🧪 si non vérifiée), noter les écarts en colonne Notes, mettre à jour la ligne « Avancement » de la vue d'ensemble, ajouter/compléter la ligne du Journal des sessions.
5. **Décisions** : toute décision structurante hors PLAN.md s'ajoute à TRACKING.md § Décisions. Si un arbitrage utilisateur est nécessaire, **poser la question** (l'utilisateur veut être consulté point par point) plutôt que trancher seul.
6. **Contrats API** : figés dans PLAN.md §3 ; toute évolution = mise à jour de PLAN.md §3 + note dans TRACKING.md § Décisions.
7. **Git** (si le dépôt est initialisé) : un commit par tâche terminée, message préfixé par l'ID (`P1-03: analyse d'URL, refus des playlists`).

## Serveur de production

- Wyse 5070 : `ssh fanta@192.168.1.186` (hostname `debian-malefique`), Debian 13, SSD 32 GB (~21 GB libres). Authentification **par clé SSH uniquement** — ne jamais utiliser ni stocker de mot de passe (S-02).

## Conventions

- **Langue** : UI, messages d'erreur et docs en **français** ; code, identifiants et noms de commits techniques en anglais (message de commit en français accepté).
- **Backend** : Python 3.12, FastAPI, SQLAlchemy 2.x (+ Alembic à partir de la Phase 2), pytest. Tests réseau marqués `@pytest.mark.network`.
- **yt-dlp** : uniquement via son API Python — jamais d'URL passée à un shell (S-05, non négociable).
- **Frontend** : React + Vite, français uniquement, thème sombre type Cobalt.
- **Config** : `.env` (jamais commité, `.env.example` à jour) ; défauts du §6 codés en dur ; overrides runtime via la table `settings`.
- **Sécurité** : les exigences S-01 à S-11 du cahier des charges priment sur toute commodité de dev.
- **Fichiers temporaires** : tout passe par `data/downloads/` (ignoré par git), un sous-répertoire par job.
