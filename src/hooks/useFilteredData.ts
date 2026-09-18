// ── Hook dérivé : FilterStore + DataStore → données filtrées ─────────────
//
// Lot C.3. Le calcul vit dans `calculs/filtrerDonnees.ts`, en fonction pure.
// Ce hook ne fait plus que lire les deux stores et mémoïser.

import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { filtrerDonnees, type DonneesFiltrees } from "@/calculs/filtrerDonnees";
import { useRegles } from "@/hooks/useRegles";

export type { DonneesFiltrees };

export function useFilteredData(): DonneesFiltrees {
  const { transactions } = useDataStore();
  const {
    period, cat1Filter, showTransfers,
    selMonth, selCat2, selType, selOrg,
  } = useFilterStore();
  const regles = useRegles();

  return useMemo(
    () => filtrerDonnees(transactions, {
      period, cat1Filter, showTransfers, selMonth, selCat2, selType, selOrg,
    }, regles),
    [transactions, period, cat1Filter, showTransfers, selMonth, selCat2, selType, selOrg, regles]
  );
}
