# `src/` — Code source du dashboard principal

Cœur de l'application React. Les données viennent de l'API D1 Cloudflare ; elles sont chargées dans des stores Zustand, dérivées par des hooks, puis affichées par les pages.

## Fichiers à la racine de `src/`

| Fichier | Rôle |
|---|---|
| `main.tsx` | Point d'entrée : monte React dans le DOM |
| `App.tsx` | Composant racine V3 — orchestre le chargement des données (API D1) et le layout |
| `router.tsx` | Router centralisé avec lazy-loading de chaque page (remplace le switch/case de V1) |
| `index.css` | Styles globaux + directives Tailwind |
| `vite-env.d.ts` | Déclarations de types Vite |

## Sous-dossiers

| Dossier | Rôle | Voir |
|---|---|---|
| `components/` | Composants réutilisables (layout, UI, upload) | `components/INDEX.md` |
| `pages/` | Une page par onglet du dashboard | `pages/INDEX.md` |
| `hooks/` | Hooks de calcul/dérivation des données | `hooks/INDEX.md` |
| `stores/` | Stores Zustand (état global) | `stores/INDEX.md` |
| `utils/` | Fonctions utilitaires pures | `utils/INDEX.md` |
| `config/` | Constantes métier et palettes de couleurs | `config/INDEX.md` |
| `types/` | Types TypeScript partagés | `types/INDEX.md` |
| `__tests__/` | Tests unitaires (miroir de l'arborescence : components, hooks, utils, helpers) | — |
