// ── Le vocabulaire de la démonstration, pour les tests ───────────────────
//
// Lot C.4. Ce contenu vivait dans `src/config/accounts.ts`, au milieu du code
// de l'application : sept comptes et quatre organismes écrits en dur, que
// tout le monde lisait. Plus personne ne les lit — la démonstration déclare
// ses comptes dans `public/data/config.json`, comme n'importe quel fichier.
//
// Ce qui reste ici n'est utile qu'aux tests, qui doivent bien nommer un
// compte pour vérifier un calcul (exemption D5).

import { PARAMETRAGE_DEMO } from "./parametrageDemo";

/** Libellés de tous les comptes de la démonstration. */
export const COMPTE_LIBELLES: readonly string[] = PARAMETRAGE_DEMO.comptes.map(
  (c) => c.libelle
);

/** Libellés des comptes portant un solde propre. */
export const COMPTES_AVEC_SOLDE: readonly string[] = PARAMETRAGE_DEMO.comptes
  .filter((c) => c.porteUnSolde)
  .map((c) => c.libelle);

/** Organismes représentés, dans l'ordre de première apparition. */
export const ORGANISMES_UTILISES: readonly string[] = [
  ...new Set(PARAMETRAGE_DEMO.comptes.map((c) => c.organisme).filter((o): o is string => !!o)),
];

/** Les comptes, sous la forme que les anciens tests attendaient. */
export const COMPTES = PARAMETRAGE_DEMO.comptes.map((c) => ({
  id: c.id,
  libelle: c.libelle,
  organisme: c.organisme ?? "",
  soldePropre: c.porteUnSolde,
}));
