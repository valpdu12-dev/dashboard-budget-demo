# `src/pages/` — Pages du dashboard

Une page par onglet. Chaque page assemble des composants UI et consomme un hook de données dédié (`src/hooks/`). Toutes sont chargées en lazy-loading via `src/router.tsx`.

| Fichier | Onglet | Contenu |
|---|---|---|
| `Comptes.tsx` | Comptes | Vue d'ensemble des soldes et flux entre comptes |
| `Recettes.tsx` | Recettes | Suivi des revenus et entrées |
| `Depenses.tsx` | Dépenses | Analyse détaillée des dépenses (graphiques, heatmap, comparaison N/N-1) |
| `BudgetMensuel.tsx` | Budget Mensuel | Budget cible vs dépense réelle par catégorie, écarts, sparklines |
| `Epargne.tsx` | Épargne | KPIs + graphique dual-axe + donut par type + table |
| `Insights.tsx` | Insights | Top hausses/baisses + dépenses récurrentes |
| `PretImmobilier.tsx` | Prêt Immobilier | KPIs + progression + projection du prêt |
| `Salaire.tsx` | Salaire | Historique des salaires par entreprise, KPIs, projection |
| `SalaireInflation.tsx` | Salaire vs Inflation | Pouvoir d'achat : indices base 100 (net / inflation / SMIC) |
