// ── Dépenses et recettes : la nature « remboursement » ───────────────────
//
// C.7. Un remboursement est un CRÉDIT (de l'argent qui revient) qui, dans les
// comptes, n'est pas un revenu mais une RÉDUCTION de la dépense d'origine —
// exactement ce que faisait un débit négatif dans l'ancien tableur. Le format
// public garde le montant POSITIF (§4.1) ; c'est la nature `remboursement` du
// type qui porte l'effet, et ces trois fonctions le centralisent pour que la
// règle soit la même partout : dépenses, recettes, graphes, tableau, épargne.

import type { Regles } from "@/calculs/regles";

type Sens = { type: string; dc: string };
type Mouvement = Sens & { montant: number };

/**
 * Un remboursement : un crédit dont le type porte la nature `remboursement`,
 * OU un crédit sur un type de DÉPENSE (un type qui a une classe déclarée).
 *
 * F11, amendé le 24/09/2026 : dans le tableur de l'auteur, un remboursement
 * s'écrit sur le type de la dépense qu'il annule (« courses » remboursées) ;
 * il réduit donc SA catégorie. Le type « Remboursement » reste accepté.
 */
export function estRemboursement(t: Sens, regles: Regles): boolean {
  return (
    t.dc === "Crédit" &&
    (regles.aNature(t.type, "remboursement") || regles.classeDe(t.type) !== null)
  );
}

/** Une recette : un crédit qui N'EST PAS un remboursement. */
export function estRecette(t: Sens, regles: Regles): boolean {
  return t.dc === "Crédit" && !estRemboursement(t, regles);
}

/** Ce mouvement pèse-t-il sur les dépenses : un débit, ou un remboursement qui les réduit. */
export function toucheDepenses(t: Sens, regles: Regles): boolean {
  return t.dc === "Débit" || estRemboursement(t, regles);
}

/**
 * Montant du point de vue des dépenses :
 *   +montant pour un débit, −montant pour un remboursement, 0 sinon.
 * Sommer cette valeur sur un ensemble de transactions donne la dépense NETTE.
 */
export function montantDepense(t: Mouvement, regles: Regles): number {
  if (t.dc === "Débit") return t.montant;
  if (estRemboursement(t, regles)) return -t.montant;
  return 0;
}
