// ── Hook des KPIs — le branchement, rien de plus ─────────────────────────
//
// Lot C.3. Le calcul vit dans `calculs/calculKPIs.ts`, en fonction pure.

import { useMemo } from "react";
import { calculerKPIs } from "@/calculs/calculKPIs";
import { useRegles } from "@/hooks/useRegles";
import type { Transaction, SalaryMonth, KPIs } from "@/types";

export function useKPIs(
  transactions: Transaction[],
  balancesByMonth: Record<string, Record<string, number>>,
  salary: SalaryMonth[],
  currentMonth: string | null,
  prevMonth: string | null
): KPIs {
  const regles = useRegles();
  return useMemo(
    () => calculerKPIs(transactions, balancesByMonth, salary, currentMonth, prevMonth, regles),
    [transactions, balancesByMonth, salary, currentMonth, prevMonth, regles]
  );
}
