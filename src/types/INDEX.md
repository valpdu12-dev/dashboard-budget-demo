# `src/types/` — Types TypeScript partagés

| Fichier | Rôle |
|---|---|
| `index.ts` | Types principaux du dashboard : `Transaction`, `RawTransactionsJSON`, `SalaryMonth`, `InflationData`, `SmicData`, `BudgetTarget`… |
| `anomalie.ts` | `Anomalie` — un problème situé (feuille, ligne, colonne). La brique de tout ce que l'outil dit à la personne. |
| `budgetConfig.ts` | Lot C.1. `BudgetConfig` et ses lignes brutes : ce que la feuille `Paramètres` étendue déclare, avant et après validation. |
