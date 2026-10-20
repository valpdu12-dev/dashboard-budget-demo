// ── Hook : options Enseigne / Événement de la page Dépenses ──────────────
//
// Le calcul vit dans `calculs/optionsCategorie.ts`, en fonction pure. Ce
// hook ne fait que lire le jeu chargé (TOUTES les transactions, pas la
// période) et mémoïser.

import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { construireOptions } from "@/calculs/optionsCategorie";

export type { OptionCategorie } from "@/calculs/optionsCategorie";

/** Options Enseigne et Événement, recalculées à chaque chargement des données. */
export function useOptionsCategorie() {
  const { transactions } = useDataStore();
  const enseignes = useMemo(() => construireOptions(transactions, "cat3"), [transactions]);
  const evenements = useMemo(() => construireOptions(transactions, "cat4"), [transactions]);
  return { enseignes, evenements };
}
