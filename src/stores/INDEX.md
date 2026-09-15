# `src/stores/` — Stores Zustand (état global)

État partagé de l'application, remplace le props-drilling de V1.

| Fichier | Rôle |
|---|---|
| `useDataStore.ts` | Données chargées (transactions, salaires…) depuis l'API |
| `useFilterStore.ts` | Filtres globaux (période, comptes, catégories…) |
| `useUIStore.ts` | État d'interface (onglet actif, modales, préférences d'affichage) |
