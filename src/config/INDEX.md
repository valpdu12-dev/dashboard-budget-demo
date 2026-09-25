# `src/config/` — Constantes & couleurs

Configuration métier centralisée (migrée depuis `helpers.js` de V1).

| Fichier | Rôle |
|---|---|
| `constants.ts` | Constantes métier : mois FR, types de virement/épargne, comptes réels, organismes, mapping compte→organisme |
| ~~`accounts.ts`~~ | **Supprimé au lot C.** Il portait les sept comptes et quatre organismes de la démonstration, lus par tout le code. Plus personne ne les lit : la démonstration déclare ses comptes dans `public/data/config.json`, comme n'importe quel fichier source. |
| `colors.ts` | Palettes de couleurs des graphiques (catégories, comptes, organismes, entreprises, épargne, donut) |
| `vocabulaire.ts` | Lot C.1. Le vocabulaire qui NE devient PAS paramétrable — natures, classes, sens répercuté — et la raison de chacun. Liste close : `docs/CONTRAT_PARAMETRAGE.md` §5. |
