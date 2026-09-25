# `src/utils/` — Fonctions utilitaires

Fonctions pures réutilisables, sans état ni dépendance React.

| Fichier | Rôle |
|---|---|
| `decode.ts` | Décode les transactions JSON (encodage dictionnaire) ; extrait la liste des mois |
| `formatters.ts` | Formatage : montants, pourcentages, dates, libellés (`fmt`, `fmtPct`, `fmtDate`…) |
| `organisme.ts` | Mapping compte → organisme (source unique de vérité) |
| `projection.ts` | Projection de fin de mois (jours restants, dernière transaction, estimation) |
