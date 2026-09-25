# `src/calculs/` — Les calculs, hors de React

Lot C.3. Chaque fichier porte le calcul d'un écran, en **fonction pure** :
il reçoit ce dont il a besoin, il ne lit aucun store, il ne dépend d'aucun
contexte. Les hooks de `src/hooks/` n'en sont plus que le branchement — ils
lisent les stores et mémoïsent.

Patron d'origine : `rubriquesDisponibles` / `useRubriques`, posé au lot B.4.

## Pourquoi cette séparation

Pour que le C.4 soit possible. Un calcul qui va chercher son contexte lui-même
ne peut pas être joué **deux fois sur deux configurations différentes** — et
c'est exactement ce que le second jeu de test du C.4 exige : des comptes et un
taux qui n'existent nulle part dans la démonstration.

Accessoirement, ces fonctions se testent sans React :
`src/__tests__/calculs/calculsSansReact.test.ts` les appelle directement.

## Ce que le C.3 n'a PAS changé

Rien. Le déplacement est à **zéro écart**, vérifié valeur par valeur par
`src/__tests__/rapprochement/rapprochementKPI.test.tsx` sur le jeu de
démonstration et sur le classeur modèle.

| Fichier | Rôle | Vocabulaire encore en dur, à généraliser au C.4 |
|---|---|---|
| `filtrerDonnees.ts` | Période, mois, transferts, drill-downs | `TRANSFER_TYPES` |
| `calculSoldes.ts` | Soldes, variations cumulées, courbe | Les 3 règles nommées (compte lié, `Virement extérieur`, `Sortie Epargne`), `COMPTES_REELS`, les 5 séries de la courbe |
| `calculKPIs.ts` | Dépenses, recettes, net, taux d'épargne | `TRANSFER_TYPES` |
| `calculEpargne.ts` | Écran Épargne | `EPARGNE_TYPES`, `Sortie Epargne` |
| `calculDepenses.ts` | Écran Dépenses | `TRANSFER_TYPES` |
| `calculPret.ts` | Écran Prêt immobilier | `TYPE_PRET_CAPITAL`, `TYPE_PRET_INTERETS` |
| `calculInsights.ts` | Hausses, baisses, récurrents | `TRANSFER_TYPES` |

## Ce qui n'a pas été déplacé, et pourquoi

`useBudgetData`, `useSalaryPageData` et `useSalaryInflationData` lisent encore
les stores directement. Aucun des trois ne porte de nom de compte ni de
libellé de type : le C.4 ne les touchera pas. Les déplacer maintenant serait
du remue-ménage sans raison — et chaque déplacement est une occasion d'écart.
