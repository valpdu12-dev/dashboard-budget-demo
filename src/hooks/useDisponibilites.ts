// ── Ce que la navigation peut montrer : les rubriques + les soldes ───────
//
// Patrimoine D-4c (plan 33). La sous-navigation, les onglets et les routes
// conditionnelles décidaient sur `useRubriques` (paie, prêt, épargne). Le
// sous-onglet Patrimoine (soldes) ajoute une 4e condition : le jeu affiché
// porte-t-il une feuille Patrimoine ?
//
// ⚠️ Pourquoi un hook à part, et pas une clé de plus dans `Rubriques` :
// `Rubriques` est comparé À L'IDENTIQUE par des tests existants (la liste de
// ses clés fait partie du rapprochement des KPI). Il reste donc tel quel ; ce
// hook l'étend pour la navigation seulement.
//
// Règle : `soldes` vaut vrai dès que le jeu a un patrimoine, même vide (la
// page explique alors pourquoi rien n'est lisible). Pas de feuille → faux :
// la pilule et l'adresse disparaissent. Décidé sur le JEU, jamais sur la
// période filtrée, comme les autres rubriques.

import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { useRubriques, type Rubriques } from "@/hooks/useRubriques";

/** Les rubriques, plus la présence d'une feuille Patrimoine. */
export interface Disponibilites extends Rubriques {
  /** Le jeu affiché porte une feuille Patrimoine (soldes). */
  soldes: boolean;
}

/** Une condition de la navigation. */
export type Disponibilite = keyof Disponibilites;

export function useDisponibilites(): Disponibilites {
  const rubriques = useRubriques();
  const aDesSoldes = useDataStore((s) => s.patrimoine !== null);
  return useMemo(() => ({ ...rubriques, soldes: aDesSoldes }), [rubriques, aDesSoldes]);
}
