# `src/hooks/` — Hooks de données

Chaque hook isole le calcul et la dérivation des données d'une page ou d'une fonction transverse (extraits des `useMemo` inline de V1). Ils consomment les stores et renvoient des données prêtes à afficher.

## Hooks transverses

| Fichier | Rôle |
|---|---|
| `useFilteredData.ts` | Connecte FilterStore + DataStore → jeu de données filtré |
| `useFilterSync.ts` | Synchronise les filtres Zustand ↔ URL (bidirectionnel) |
| `useBalances.ts` | Calcule les soldes des comptes (optimisé via Map groupBy) |
| `useKPIs.ts` | Calcule les KPIs globaux |
| `useInsights.ts` | Calcule les insights (hausses/baisses, récurrents) |
| `useResponsive.ts` | Détection responsive avec listener de resize |
| `useExcelWorker.ts` | Pont Web Worker ↔ DataUploader ↔ DataStore (parsing Excel + rapport de validation) |

## Hooks par page

| Fichier | Page associée |
|---|---|
| `useExpenseData.ts` | Dépenses |
| `useBudgetData.ts` | Budget Mensuel |
| `useSalaryPageData.ts` | Salaire |
| `useSalaryInflationData.ts` | Salaire vs Inflation (pouvoir d'achat) |
| `useSavingsData.ts` | Épargne |
| `useMortgageData.ts` | Prêt Immobilier (inclut les constantes du prêt) |
