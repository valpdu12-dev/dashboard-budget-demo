# `src/utils/` — Fonctions utilitaires

Fonctions pures réutilisables, sans état ni dépendance React.

| Fichier | Rôle |
|---|---|
| `dictionnaire.ts` | Objet sans propriétés héritées, pour regrouper par un nom choisi par l'utilisateur (`constructor`, `__proto__`… sans danger) — DM-01 A8 |
| `csv.ts` | Une cellule d'export CSV : guillemets, et apostrophe devant un texte qui commence par `=`, `+`, `-`, `@` (pas d'injection de formule) — DM-01 A7 |
| `decode.ts` | Décode les transactions JSON (encodage dictionnaire) ; extrait la liste des mois |
| `axeEuros.ts` | Axe vertical des graphiques de la page Patrimoine, sur une ligne (`fmtAxe` : « 700 € », « 1,4 k€ », espaces insécables) |
| `formatters.ts` | Formatage : montants, pourcentages, dates, libellés (`fmt`, `fmtPct`, `fmtDate`…) |
| `organisme.ts` | Mapping compte → organisme (source unique de vérité) |
| `projection.ts` | Projection de fin de mois (jours restants, dernière transaction, estimation) |
