# CLAUDE.md — Lutecium

Service web auto-hébergé de téléchargement de vidéos (yt-dlp + FastAPI + React), déployé en Docker derrière Caddy sur un Dell Wyse 5070 (Debian 13). Interface en français, esprit Cobalt Tools.

## Documents de référence — à lire en début de session

1. **[AGENTS.md](AGENTS.md)** — consignes d'onboarding agent, RÈGLE D'OR MCP et règles d'architecture.
2. **[structure.md](structure.md)** — cartographie human-readable du dépôt (arborescence commentée).
3. **[docs/PLAN.md](docs/PLAN.md)** — plan d'implémentation, décisions techniques, contrats API.
4. **[docs/cahier-des-charges.md](docs/cahier-des-charges.md)** — source de vérité des exigences (IDs F-xx, A-xx, S-xx, P-xx, M-xx).
5. **[docs/ui-ux-cahier-des-charges.md](docs/ui-ux-cahier-des-charges.md)** — source de vérité UI/UX : design, états A→F de l'interface, animations, ton (tutoiement), quota-cadeau.

> **RÈGLE D'OR MCP :** Avant toute exploration à l'aveugle, utiliser le serveur MCP local `lutecium-project-map` (`find_file`, `list_topics`, `get_topic_files`, `list_workspaces`, `get_full_map`).
> **MAINTENANCE :** Mettre à jour `structure.md` ET `.claude/project-structure.json` dans le MÊME commit pour tout changement de structure.

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
- **Frontend** : React + Vite + TypeScript, français uniquement (tutoiement), design selon le CDC UI/UX (monochrome deux thèmes, mobile-first, monospace + sans-serif, animations expressives mais informatives).
- **Config** : `.env` (jamais commité, `.env.example` à jour) ; défauts du §6 codés en dur ; overrides runtime via la table `settings`.
- **Sécurité** : les exigences S-01 à S-11 du cahier des charges priment sur toute commodité de dev.
- **Fichiers temporaires** : tout passe par `data/downloads/` (ignoré par git), un sous-répertoire par job.
