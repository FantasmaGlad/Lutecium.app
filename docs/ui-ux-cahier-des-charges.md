# Cahier des charges UI/UX — Lutecium
**Version :** 1.0 — 20 juillet 2026
**Complément du cahier des charges technique v1.1**
**Usage :** brief de référence pour la conception avec Claude Design
---
## 1. Positionnement et principes directeurs
Lutecium est un téléchargeur de vidéos multi-sites (yt-dlp), auto-hébergé, au parcours **zéro friction** : coller une URL, choisir (ou pas), télécharger. La référence assumée est **Cobalt Tools** (cobalt.tools) : interface minimale, esthétique technique, aucune étape inutile.
**Les cinq principes, par ordre de priorité :**
1. **Zéro friction** — l'action principale (URL → fichier) ne doit jamais demander plus de 2 interactions. Tout le reste est optionnel.
2. **Esthétique technique / terminal** — sobriété monochrome, précision typographique, esprit outil plutôt qu'esprit produit marketing.
3. **Mobile-first** — le cas d'usage dominant est le partage d'une URL TikTok/Insta/YouTube depuis un téléphone. Le desktop doit être beau et réactif, mais le design part du mobile.
4. **Expressivité maîtrisée** — animations soignées et modernes (le stack React le permet), mais au service du retour d'information : la progression d'un téléchargement est LE moment à célébrer.
5. **Générosité** — le service est un cadeau, pas un péage. Les limites existent mais ne s'expriment jamais comme des murs (cf. quota-cadeau §6.4 et mode invité §6.1).
---
## 2. Identité visuelle
### 2.1 Nom et logo
« Lutecium » est utilisé comme simple nom, sans exploitation de l'univers chimique. Le logo définitif viendra plus tard ; en attendant, un **wordmark typographique** fait office de logo. Trois propositions à explorer dans Claude Design, toutes en monospace pour coller à l'esprit terminal :
1. **`lutecium▌`** — tout en minuscules, suivi d'un curseur bloc qui clignote lentement (comme un prompt de terminal en attente). Le curseur devient l'élément de marque : il apparaît aussi dans le champ URL vide. *Proposition recommandée : simple, vivante, et elle raconte exactement ce qu'est le produit — un outil qui attend ta commande.*
2. **`[lutecium]`** — encadré de crochets fixes, référence aux logs et aux TUI. Statique, très sobre.
3. **`lu>`** en favicon/version compacte + `lutecium` en version longue — le `lu>` évoquant un prompt shell, utilisable seul sur mobile et comme icône PWA.
Le wordmark s'utilise en Noir/Blanc selon le thème, jamais en couleur.
### 2.2 Palette
Palette monochrome « charbon » fournie, à utiliser strictement :
**Thème sombre (défaut)**
| Rôle | Couleur | Hex |
|---|---|---|
| Fond principal | Noir charbon | `#1A1A1A` |
| Surfaces (cartes, champs, panneaux) | Gris foncé | `#4A4A4A` (et déclinaisons plus sombres dérivées, ex. `#2A2A2A` pour les surfaces de premier niveau) |
| Texte secondaire, bordures, icônes inactives | Gris clair | `#A1A1A1` |
| Texte principal | Gris très clair | `#F2F2F2` |
| Accents forts (texte sur bouton primaire, états actifs) | Blanc | `#FFFFFF` |
**Thème clair**
| Rôle | Couleur | Hex |
|---|---|---|
| Fond principal | Blanc | `#FFFFFF` |
| Texte principal | Noir doux | `#2B2B2B` |
| Texte secondaire, icônes | Gris foncé | `#B3B3B3` |
| Surfaces, bordures, champs | Gris clair | `#D4D4D4` (et dérivés plus clairs, ex. `#EDEDED`) |
**Pas de couleur d'accent chromatique pour l'instant** (champ laissé libre pour plus tard). Le contraste, la typographie et le mouvement portent la hiérarchie. Deux exceptions fonctionnelles autorisées, désaturées et discrètes : un vert sobre pour les états de succès et un rouge sobre pour les erreurs, à doser au minimum (une icône, un liseré — jamais des aplats).
**Toggle de thème** : accessible en permanence dans le header (icône), sombre par défaut, préférence mémorisée, respect de `prefers-color-scheme` à la première visite.
### 2.3 Typographie
- **Monospace en rôle principal** — c'est elle qui porte l'identité terminal : wordmark, champ URL, données techniques (tailles, vitesses, %, fps, codecs, quotas, logs admin). Proposer une monospace moderne et lisible (ex. JetBrains Mono, IBM Plex Mono, Commit Mono — Claude Design tranchera).
- **Sans-serif sobre en rôle de confort** pour les textes courants, labels et paragraphes (ex. Inter, ou la police système) — une interface 100 % monospace fatigue à la lecture.
- Échelle typographique nette, graisses limitées (regular / medium / bold), chiffres tabulaires obligatoires partout où des valeurs changent en direct (progression, vitesses, quotas) pour éviter le tremblement.
### 2.4 Style graphique
- Coins très légèrement arrondis (2–4 px) ou droits — pas de gros arrondis « friendly ».
- Bordures fines 1 px plutôt qu'ombres portées ; les ombres, si utilisées, restent subtiles.
- Iconographie filaire, monochrome, cohérente (une seule bibliothèque, ex. Lucide).
- Densité aérée sur le site public, dense sur le dashboard admin (§7).
---
## 3. Architecture de l'interface
### 3.1 Structure globale (site public)
```
┌──────────────────────────────────────────────┐
│ HEADER  [☰]  lutecium▌         [◐] [compte] │  ← fixe, discret
├──────────────────────────────────────────────┤
│                                              │
│                 ZONE PRINCIPALE              │
│        (champ URL / aperçu / progression)    │
│                                              │
├──────────────────────────────────────────────┤
│ [Gestionnaire de téléchargements — drawer]   │  ← replié par défaut
└──────────────────────────────────────────────┘
```
- **Header** : burger (ouvre le bandeau latéral), wordmark centré ou à gauche, toggle thème, avatar/entrée compte.
- **Bandeau latéral déroulant** (drawer gauche) : navigation secondaire — Accueil, Mon historique, Mon compte, (Admin si rôle admin), À propos. Sur desktop, il glisse par-dessus le contenu ; il ne vole jamais d'espace à la zone principale.
- **Zone principale** : un seul bloc central, qui change d'état (§4). C'est ici que tout se passe.
- **Gestionnaire de téléchargements** : barre repliée en bas d'écran (mobile) ou en bas à droite (desktop), badge du nombre de tâches actives, se déploie en liste (§5.2).
### 3.2 Pages
| Page | Contenu |
|---|---|
| `/` | Page principale (états §4) |
| `/login`, `/register` | Pages dédiées, même sobriété : wordmark, formulaire court, rien d'autre |
| `/historique` | Historique des téléchargements de l'utilisateur connecté |
| `/compte` | Pseudo, quota du jour, changement de mot de passe, déconnexion |
| `/admin/…` | Dashboard admin (§7), accessible aux seuls admins |
---
## 4. Page principale — les états du bloc central
Le cœur de l'UX : un bloc unique qui traverse des états successifs, avec des transitions animées soignées entre chacun. Jamais de rechargement de page.
### État A — Repos
- Grand champ URL centré verticalement, placeholder type `colle un lien ici…` avec le curseur bloc clignotant du wordmark.
- Bouton coller depuis le presse-papier (icône) accolé au champ — crucial sur mobile.
- En dessous, une ligne discrète : sites supportés (petites mentions texte : YouTube, TikTok, Instagram, X, +1000 autres).
- C'est tout. Aucun autre élément ne concurrence le champ.
### État B — Analyse (automatique, zéro friction)
- Déclenchée **dès qu'une URL valide est détectée** (collage ou saisie) — pas de bouton « Analyser ».
- Le champ passe en mode chargement : animation type curseur/scan dans l'esprit terminal (ex. points de suspension animés, balayage subtil). Durée typique 1–3 s.
- Si l'URL est invalide ou le site non supporté : message inline sous le champ, factuel (`Ce lien n'est pas reconnu.` / `Ce site n'est pas pris en charge.`), le champ reste éditable.
### État C — Aperçu et options
Le bloc s'étend (transition fluide) et affiche :
- **Carte aperçu** : miniature, titre, chaîne/auteur, durée, site source (petite étiquette monospace).
- **Actions principales** (gros boutons, 2 max côte à côte) :
  - `Télécharger` — lance en meilleure qualité auto (vidéo+audio fusionnés). Le choix par défaut intelligent, pour 90 % des usages.
  - `Audio seul` — raccourci direct mp3/m4a, tant l'usage est fréquent.
- **`Options avancées`** — lien/accordéon replié par défaut, qui déploie :
  - qualité vidéo précise (liste des formats réels détectés : résolution + **fps** + codec + poids estimé),
  - format audio (mp3 / m4a / opus),
  - sous-titres (langues détectées), miniature, métadonnées,
  - **nom de fichier** : champ pré-rempli avec le titre nettoyé, éditable.
- Le poids estimé du choix courant est toujours visible avant de lancer.
### État D — File d'attente et progression (dans la page principale)
Le bloc se transforme en carte de progression :
1. **En file** : `position n°X dans la file` + temps estimé (affiché comme approximatif : `~2 min`), animation d'attente sobre.
2. **Téléchargement** : barre de progression + `%`, vitesse, taille téléchargée/totale en chiffres tabulaires monospace. C'est ici que l'expressivité s'exprime : progression fluide, micro-animations de flux.
3. **Traitement** : étape ffmpeg signalée (`assemblage audio + vidéo…`).
4. Bouton `Annuler` discret mais toujours présent.
5. L'utilisateur peut coller une nouvelle URL pendant ce temps : la tâche en cours glisse dans le **gestionnaire de téléchargements** (§5.2) et le bloc central revient à l'état A. Transition animée qui montre où la tâche est partie.
### État E — Terminé
- Moment de célébration expressif mais élégant (pas de confettis criards : plutôt une animation d'apparition satisfaisante du bouton, un check animé, une pulsation).
- Gros bouton `Enregistrer le fichier` + nom du fichier + poids.
- Compte à rebours visible de la disponibilité : `disponible encore 4:32` (TTL 5 min), en monospace.
- Lien `télécharger autre chose` qui ramène à l'état A.
### État F — Erreur
- Message inline factuel et actionnable, dans la carte : cause claire (`Vidéo privée.` / `Contenu géo-bloqué.` / `Ce site demande une connexion.`) + action possible (`réessayer`, `changer d'URL`).
- Jamais de jargon technique brut en premier niveau ; un lien `détails` peut révéler l'erreur yt-dlp complète pour les curieux.
---
## 5. Notifications et gestionnaire de téléchargements
### 5.1 Notifications
- **Toasts** in-app (coin bas-droite desktop, haut mobile) : téléchargement prêt, erreur, quota. Sobres, monochromes, auto-dismiss, empilables.
- **Notifications navigateur** (avec permission demandée au bon moment : au premier téléchargement mis en file, pas à l'arrivée sur le site) : « Ton fichier est prêt » quand l'utilisateur est sur un autre onglet. Clic = retour sur Lutecium, état E.
### 5.2 Gestionnaire de téléchargements
- Accessible en permanence via la barre repliée (badge de compteur).
- Déployé : liste des tâches de la session — en file (avec position), en cours (mini barre de progression), prêtes (bouton d'enregistrement + compte à rebours TTL), échouées (raison courte).
- Actions par ligne : enregistrer / annuler / réessayer / retirer.
- Mise à jour en temps réel (SSE), animations d'entrée/sortie des lignes.
---
## 6. Comptes, invités et quotas
### 6.1 Mode invité
- Un visiteur télécharge son premier fichier **sans aucune inscription ni interruption**.
- Après ce premier téléchargement réussi (état E), une carte d'invitation apparaît sous le bouton d'enregistrement — **pas une modale bloquante** :
> **Inscris-toi pour continuer à télécharger gratuitement tes vidéos ! :)**
> [Créer un compte] · [Se connecter]
- S'il tente un second téléchargement, le bloc central affiche la même invitation à la place de l'analyse. Ton chaleureux, jamais culpabilisant. Pas de compte à rebours, pas de dark pattern.
### 6.2 Inscription / connexion (pages dédiées)
- Formulaires minimaux : pseudo + mot de passe (+ confirmation à l'inscription). Aucune autre donnée demandée.
- Inscription = connexion immédiate, retour automatique vers la page principale (et reprise de l'URL en attente si le visiteur venait d'en coller une — zéro friction jusqu'au bout).
- Erreurs inline sous les champs, factuelles.
### 6.3 Utilisateur connecté
- Header : pseudo (ou initiale) → menu : Mon historique, Mon compte, Déconnexion.
- **Jauge de quota du jour** visible dans le menu et sur `/compte` : barre + `7,3 / 20 GB` en monospace. Discrète tant qu'on est loin de la limite, plus présente en approche.
- `/historique` : liste des téléchargements passés (titre, site, taille, date, statut) — sans lien de fichier (les fichiers expirent en 5 min), avec bouton `retélécharger` qui relance la tâche.
### 6.4 Le quota-cadeau (comportement signature)
Quand un utilisateur approche de sa limite et que la vidéo demandée ferait **dépasser** les 20 GB :
- Le téléchargement est **accepté quand même** — c'est le dernier de la journée, offert.
- L'interface le présente comme un cadeau, pas comme une tolérance : la jauge se remplit puis **dépasse élégamment le maximum** (`22,4 / 20 GB`), avec une petite animation dédiée et un message du type : `Celle-ci est pour nous. Quota dépassé — à demain !`
- Toute demande suivante le même jour affiche factuellement : `Quota journalier atteint. Réinitialisation à minuit.` avec l'heure de reset.
- C'est **le** détail d'interface qui incarne le principe de générosité (§1.5) : à soigner particulièrement dans Claude Design.
---
## 7. Dashboard admin — « salle de contrôle »
### 7.1 Direction
Ambiance **Grafana / mission control** : dense, monospace assumée, graphes et widgets partout, même palette monochrome (les graphes peuvent user de déclinaisons de gris + les vert/rouge fonctionnels). **Desktop-first** : optimisé pour le laptop de l'admin ; sur mobile il reste consultable (colonnes empilées) sans être la priorité.
### 7.2 Navigation
Sidebar fixe à gauche, 4 sections :
```
┌────────┬─────────────────────────────────────┐
│ ▣ Vue  │                                     │
│ ▢ Users│         CONTENU DE SECTION          │
│ ▢ Sys  │                                     │
│ ▢ Logs │                                     │
└────────┴─────────────────────────────────────┘
```
### 7.3 Sections
**Vue d'ensemble** — le mix demandé : gros chiffres-widgets (téléchargements aujourd'hui, volume servi, utilisateurs actifs, tâches en file), graphique temporel des téléchargements (jour/semaine), top sites sources, taux d'erreur yt-dlp, et la **file d'attente en direct** (liste temps réel des tâches en cours avec progression).
**Utilisateurs** — table dense : pseudo, date d'inscription, dernier accès, conso du jour/quota, nb total de téléchargements, statut. Actions par ligne : ajuster le quota, reset mot de passe, suspendre, supprimer (avec confirmation). Vue secondaire des téléchargements invités (IP anonymisée, compteur) pour repérer un abus.
**Système** — jauges circulaires CPU / RAM / disque, courbe de **température** (widget critique sur fanless : seuil d'alerte visuel), fréquence CPU en direct (effet auto-cpufreq visible), état des conteneurs Docker (up/down + uptime), version de yt-dlp + bouton `Mettre à jour maintenant`, boutons `Purger les fichiers` et `Vider la file`.
**Journaux** — flux des téléchargements (utilisateur, URL, taille, durée, statut) et journal d'erreurs, filtrables, présentés en style log terminal (monospace, lignes denses), avec recherche.
Rafraîchissement temps réel (SSE) sur la vue d'ensemble et le système ; les widgets s'animent à la mise à jour (transitions de valeurs, jamais de clignotement).
---
## 8. Responsive, PWA et plateformes
- **Mobile-first** : tous les écrans publics conçus d'abord pour ~390 px de large ; zones tactiles ≥ 44 px ; le bouton coller-depuis-le-presse-papier est un élément de premier plan sur mobile.
- **Desktop** : la même interface respire — le bloc central reste centré et contenu (max ~640 px), pas d'étalement ; les drawers deviennent des panneaux latéraux élégants.
- **PWA recommandée** : installable sur l'écran d'accueil (icône `lu>`), et surtout **cible de partage Android** (share target) : partager une URL depuis TikTok/YouTube ouvre directement Lutecium avec l'URL pré-collée et l'analyse lancée — l'incarnation ultime du zéro friction. À valider techniquement (manifest + service worker minimal, sans mode hors-ligne).
---
## 9. Animations et micro-interactions
Direction **expressive**, en profitant du stack React moderne (Framer Motion ou équivalent), mais orchestrée :
- **Le moment signature** : la séquence analyse → aperçu → progression → terminé (états B→E). C'est là que se concentre le budget d'animation : transitions de morphing du bloc central, progression fluide, célébration de fin, animation du quota-cadeau.
- Micro-interactions partout ailleurs, mais discrètes : hover des boutons, apparition des toasts, dépliage des options avancées, curseur bloc du wordmark.
- Chiffres animés en interpolation (vitesse, %, quotas) — jamais de saut brutal.
- **`prefers-reduced-motion` respecté** : toutes les animations décoratives se désactivent, seules les progressions restent (statiques).
- Règle d'or : une animation doit toujours informer (où va ma tâche, qu'est-ce qui a changé) ou récompenser (c'est prêt). Rien de gratuit en dehors du moment signature.
---
## 10. Ton et rédaction (UX writing)
- **Français uniquement**, tutoiement (cohérent avec le message d'inscription fourni), sentence case.
- Neutre et factuel par défaut : les boutons disent ce qu'ils font (`Télécharger`, `Enregistrer le fichier`, `Créer un compte`), les erreurs disent ce qui s'est passé et quoi faire, sans excuses ni vague.
- La personnalité s'exprime uniquement aux moments choisis : l'invitation à s'inscrire (texte fourni §6.1) et le quota-cadeau (§6.4). Partout ailleurs, sobriété d'outil.
- Vocabulaire stable de bout en bout : une action garde le même nom du bouton au toast.
---
## 11. Accessibilité (exigences de base)
- Contrastes **WCAG AA** minimum sur les deux thèmes — point de vigilance : `#A1A1A1` sur `#1A1A1A` et `#B3B3B3` sur `#FFFFFF` sont à réserver aux éléments non essentiels ; le texte informatif utilise les couleurs à fort contraste.
- **Navigation clavier complète** : ordre de focus logique, focus visible (style dédié cohérent avec l'esthétique — ex. liseré 1 px), pièges à focus interdits, drawers et modales refermables à Échap.
- Labels et rôles ARIA corrects (progression annoncée aux lecteurs d'écran via `aria-live`), formulaires correctement étiquetés.
- Cibles tactiles ≥ 44 px, texte redimensionnable à 200 % sans casse.
---
## 12. Livrables attendus de la phase design (Claude Design)
1. **Design system léger** : tokens (couleurs des deux thèmes, échelle typo, espacements, rayons), composants de base (boutons, champs, cartes, toasts, jauges, tables).
2. **Wordmark** : les 3 pistes du §2.1 explorées, une retenue, déclinée (header, favicon, icône PWA).
3. **Maquettes haute fidélité, mobile + desktop, deux thèmes** :
   - page principale dans ses 6 états (A→F),
   - gestionnaire de téléchargements replié/déployé,
   - login / inscription,
   - historique et compte (avec jauge de quota, y compris état dépassé « cadeau »),
   - invitation invité (post-téléchargement et blocage doux),
   - dashboard admin : les 4 sections.
4. **Prototype des animations du moment signature** (états B→E + quota-cadeau).
5. Vérification AA des contrastes sur les maquettes finales.
---
*Document évolutif — les choix ouverts (monospace exacte, wordmark retenu, bibliothèque d'animation) seront tranchés en phase design et consignés dans le design system.*
