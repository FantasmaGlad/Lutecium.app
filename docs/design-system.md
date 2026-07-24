# Design system — Lutecium

**Statut :** retenu (D-01, session S3, 2026-07-24).
**Source de vérité vivante :** [frontend/src/styles/tokens.css](../frontend/src/styles/tokens.css). Ce document explique et justifie les choix ; en cas de divergence, le code prime.
**Complète :** [docs/ui-ux-cahier-des-charges.md](ui-ux-cahier-des-charges.md) (brief d'origine) — les choix laissés ouverts par ce brief (§2.1, §2.3, §12) sont tranchés ici.

## Couleurs

Palette monochrome « charbon », deux thèmes. Valeurs **corrigées AA** par rapport au brief d'origine — voir [Décisions TRACKING.md](../TRACKING.md) 2026-07-24 (D-05) pour le détail des ratios.

| Rôle | Sombre (défaut) | Clair | Usage |
|---|---|---|---|
| `--color-bg` | `#1a1a1a` | `#ffffff` | Fond de page |
| `--color-surface` | `#2a2a2a` | `#ededed` | Cartes, champs, panneaux |
| `--color-surface-alt` | `#767676` | `#868686` | Bordures des cartes/champs/drawers (≥3:1 non-texte, WCAG 1.4.11) |
| `--color-text` | `#f2f2f2` | `#2b2b2b` | Texte principal |
| `--color-text-secondary` | `#a1a1a1` | `#6a6a6a` | Texte secondaire — **reste du texte informatif réel** (tailles, vitesses, dates, en-têtes de table), ≥4.5:1 garanti |
| `--color-accent` | `#ffffff` | `#2b2b2b` | Boutons primaires, états actifs |
| `--color-success` | `#7fb88f` | `#3a6b4a` | Succès — icône/liseré seulement, jamais d'aplat (CDC §2.2) |
| `--color-error` | `#c97b7b` | `#a8453f` | Erreur — icône/liseré seulement |

Pas d'accent chromatique hors succès/erreur (champ réservé au futur, CDC §2.2). Le toggle de thème (`ThemeToggle.tsx`) mémorise le choix (`localStorage['lutecium-theme']`) et respecte `prefers-color-scheme` à la première visite ([lib/theme.ts](../frontend/src/lib/theme.ts)).

**Règle** : ne jamais coder une couleur en dur dans un composant — toujours passer par un token, y compris pour les nouvelles couleurs fonctionnelles (garantit que D-05 reste valide dans le temps).

## Typographie

- **Monospace — tranchée : JetBrains Mono**, auto-hébergée via `@fontsource/jetbrains-mono` (poids 400/500/700, chargée dans `main.tsx`). Repli système (`ui-monospace`, `Cascadia Code`, `SFMono-Regular`, `Menlo`, `Consolas`) si le chargement échoue. C'est la police qui porte l'identité terminal : wordmark, champ URL, toute donnée technique (tailles, vitesses, %, fps, codecs, quotas, logs admin).
- **Sans-serif — police système** (`system-ui`), pas auto-hébergée : rôle de confort uniquement (labels, paragraphes courants), ne porte pas l'identité, pas besoin d'un poids de téléchargement supplémentaire (CDC §2.3 acceptait explicitement cette option).
- `font-variant-numeric: tabular-nums` sur toute valeur qui change en direct (progression, vitesses, quotas) — déjà systématique dans le code (`ProgressCard`, `DoneCard`, jauges de quota…).

## Espacements et rayons

Échelle géométrique simple, jamais de valeur arbitraire en dehors :

| Token | Valeur |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 16px |
| `--space-4` | 24px |
| `--space-5` | 40px |
| `--radius-sm` | 3px |
| `--radius-md` | 4px |

Exceptions tolérées : micro-ajustements < 4px (badges denses de l'admin, ex. `padding: 1px 4px`) — cohérent avec la densité demandée pour le dashboard (CDC §2.4).

## Composants de base

Pas de bibliothèque de composants séparée : chaque composant React porte son propre fichier CSS colocalisé (`Composant.tsx` + `Composant.css`), tous alimentés par les tokens ci-dessus. Catalogue par famille :

| Famille | Fichiers de référence |
|---|---|
| Champs / cartes de flux | `UrlCard`, `PreviewCard`, `ProgressCard`, `DoneCard`, `ErrorCard`, `GuestInvite` (`components/flow/`) |
| Boutons | pas de composant `Button` générique — classes utilitaires par contexte, toutes ≥44px de cible tactile (10 occurrences vérifiées de `min-height/width: 44px`), bordure 1px `--color-surface-alt` ou fond `--color-accent` pour le primaire |
| Toasts | `Toasts.tsx`/`.css` — empilables, auto-dismiss, bordure fine colorée (succès/erreur) |
| Jauges | jauge linéaire (`AccountPage`, `AccountMenu` — quota), jauges circulaires SVG maison (`AdminWidgets` — CPU/RAM/disque) |
| Tables | style « log terminal » dense, monospace, `AdminUsersPage`/`AdminLogsPage` |
| Drawers | `NavDrawer`, `DownloadManagerDrawer` — fermeture Échap + clic scrim, focus géré (P3-13) |

Convention transverse : coins 3–4px (jamais de gros arrondis), bordures fines 1px plutôt qu'ombres portées, iconographie Lucide uniquement.

## Accessibilité (rappel, détail en D-05)

- Contrastes AA vérifiés et corrigés sur les deux thèmes (texte ≥4.5:1, éléments non-texte/bordures ≥3:1).
- Cibles tactiles ≥44px, `prefers-reduced-motion` respecté (`MotionConfig` Framer Motion + vérifications ad hoc comme la mascotte 3D).
- Focus visible, pas de piège à focus, `aria-live` sur la progression.

## Choix explicitement tranchés ici (anciens points ouverts du CDC)

| Point ouvert (CDC §12 note finale) | Décision |
|---|---|
| Monospace exacte | **JetBrains Mono**, auto-hébergée |
| Wordmark retenu | **`lutecium▌`** (piste 1, curseur bloc) + déclinaison compacte **`lu>`** pour favicon/PWA (détail en D-02) |
| Bibliothèque d'animation | **Framer Motion** (déjà en dépendance, utilisée dans tout le flux B→E) |
