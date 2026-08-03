---
name: lutecium-navigation
description: Navigation et exploration du dépôt Lutecium via le serveur MCP local et la cartographie versionnée.
---

# Skill — Navigation et Exploration dans Lutecium

Ce skill opérationnalise la règle d'or d'exploration du dépôt Lutecium.

## Instructions pour l'Agent

1. **Interroger le serveur MCP local `lutecium-project-map` en premier :**
   - Utiliser `find_file(query)` pour chercher des fichiers par mots-clés métiers (ex: `auth`, `worker`, `sse`, `caddy`, `quota`).
   - Utiliser `list_topics()` et `get_topic_files(topic)` pour obtenir la liste des fichiers pré-indexés d'un domaine métier.
   - Utiliser `list_workspaces()` pour comprendre la structure et les dépendances du monorepo.
   - Utiliser `get_full_map()` uniquement si une vue globale JSON brute est nécessaire.

2. **Référer aux cartographies humaines et à l'architecture :**
   - Consulter [structure.md](file:///home/fanta/Developpement/web/Lutecium/structure.md) pour la vue arborescente commentée.
   - Consulter [README.md](file:///home/fanta/Developpement/web/Lutecium/README.md) pour les choix d'architecture et les pièges (hot spots).

3. **Maintenance obligatoire de la cartographie :**
   - Si tu ajoutes, déplaces ou supprimes un fichier significatif, tu **DOIS** mettre à jour dans le **MÊME COMMIT** :
     - `structure.md`
     - `.claude/project-structure.json`
