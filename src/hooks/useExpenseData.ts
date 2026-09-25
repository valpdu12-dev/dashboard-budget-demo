// ── Hook Dépenses — le branchement, rien de plus ─────────────────────────
//
// Lot C.3. Le calcul vit dans `calculs/calculDepenses.ts`, en fonction pure.

import { useMemo } from "react";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useFilterStore } from "@/stores/useFilterStore";
import { useDataStore } from "@/stores/useDataStore";
import { calculerDepenses } from "@/calculs/calculDepenses";
import { useRegles } from "@/hooks/useRegles";

export type {
  MonthlyLineRow, Cat2Slice, TypeSlice, DetailRow, TopItem, CumulJourRow, CompNvsN1Row,
} from "@/calculs/calculDepenses";

export function useExpenseData() {
  const { baseTx, filteredTx, allMonthsInRange } = useFilteredData();
  const { selCat2, selType, selOrg } = useFilterStore();
  const { transactions: allTransactions } = useDataStore();
  const regles = useRegles();

  return useMemo(
    () => calculerDepenses({
      baseTx, filteredTx, allMonthsInRange, selCat2, selType, selOrg, allTransactions,
    }, regles),
    [baseTx, filteredTx, allMonthsInRange, selCat2, selType, selOrg, allTransactions, regles]
  );
}
