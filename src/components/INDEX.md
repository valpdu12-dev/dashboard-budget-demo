# `src/components/` — Composants réutilisables

Composants partagés à travers les pages, regroupés en trois familles : layout, UI et upload.

## `layout/` — Structure de la page

| Fichier | Rôle |
|---|---|
| `AppShell.tsx` | Layout principal : assemble Header + Sidebar/BottomNav + zone de contenu |
| `Header.tsx` | En-tête sticky avec les filtres globaux (au téléphone : `EnTeteTelephone`) |
| `EnTeteTelephone.tsx` | En-tête au téléphone (< 768 px) : titre de la page + pastille « Démo · mois » ou « Mes données » |
| `FiltresTelephone.tsx` | Bouton « Filtres (n) » au téléphone : période, classe, transferts, Paramètres, import, profil, apparence |
| `Sidebar.tsx` | Navigation latérale (desktop), via React Router NavLink |
| `BottomNav.tsx` | Navigation basse (mobile), via React Router NavLink |
| `SubNav.tsx` | Sous-navigation contextuelle (pills), affichée seulement si l'onglet a des sous-vues |

## `ui/` — Briques d'interface

| Fichier | Rôle |
|---|---|
| `KPICard.tsx` | Carte d'indicateur clé (mémoïsée) — factorise ~5 copies de V1 |
| `ChartTooltip.tsx` | Tooltip Recharts partagé, avec support comparaison N-1 |
| `DataTable.tsx` | Table paginée, triable, exportable en CSV |
| `Chip.tsx` | Chip / tag de filtre |
| `PageHeader.tsx` | En-tête de page avec fil d'Ariane (titre caché au téléphone, `noteTelephone`) |
| `ChoixApparence.tsx` | Les trois pilules Auto · Jour · Nuit (boutons radio) |
| `MontantTelephone.tsx` | Un montant au téléphone, centimes en gris |
| `EmptyState.tsx` | État vide (aucune donnée à afficher) |
| `ListeRecherche.tsx` | Liste déroulante à choix multiples avec recherche (Enseigne / Événement, page Dépenses) — reprise du site privé |
| `Skeleton.tsx` | Loaders animés (KPI, graphiques, donut, table) pour le chargement |

## `upload/` — Import de données

| Fichier | Rôle |
|---|---|
| `DataUploader.tsx` | Modale d'upload Excel (+ `UploadButton`) — Tailwind + Lucide + Zustand + Web Worker |
| `parseExcel.worker.ts` | Web Worker de parsing Excel (déchargé du thread principal) |
