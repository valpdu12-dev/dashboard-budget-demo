// ── Hook Insights — le branchement, rien de plus ─────────────────────────
//
// Lot C.3. Le calcul vit dans `calculs/calculInsights.ts`, en fonction pure.

import { useMemo } from "react";
import { calculerInsights, type InsightsResult } from "@/calculs/calculInsights";
import { useRegles } from "@/hooks/useRegles";
import type { Transaction } from "@/types";

export type { InsightsResult };

export function useInsights(
  transactions: Transaction[],
  currentMonth: string | null,
  prevMonth: string | null
): InsightsResult {
  const regles = useRegles();
  return useMemo(
    () => calculerInsights(transactions, currentMonth, prevMonth, regles),
    [transactions, currentMonth, prevMonth, regles]
  );
}
