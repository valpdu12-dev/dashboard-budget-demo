// ── Hook Épargne — le branchement, rien de plus ──────────────────────────
//
// Lot C.3. Le calcul vit dans `calculs/calculEpargne.ts`, en fonction pure.

import { useMemo } from "react";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useFilterStore } from "@/stores/useFilterStore";
import { calculerEpargne } from "@/calculs/calculEpargne";
import { useRegles } from "@/hooks/useRegles";
import type { DonutSlice, SavingsChartPoint, SavingsKPIs } from "@/calculs/calculEpargne";

export type { DonutSlice, SavingsChartPoint, SavingsKPIs };

export function useSavingsData() {
  const { rawPeriodTx, baseTx, allMonthsInRange, currentMonth, prevMonth } = useFilteredData();
  const { selEpMonth } = useFilterStore();
  const regles = useRegles();

  const txSource = rawPeriodTx || baseTx;

  return useMemo(
    () => calculerEpargne({
      txSource, baseTx, allMonthsInRange, currentMonth, prevMonth, selEpMonth,
    }, regles),
    [txSource, baseTx, allMonthsInRange, currentMonth, prevMonth, selEpMonth, regles]
  );
}
