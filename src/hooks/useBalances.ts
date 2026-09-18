// ── Hook de calcul des soldes — le branchement, rien de plus ─────────────
//
// Lot C.3 pour la séparation, lot C.4 pour les règles : le calcul ne connaît
// plus aucun nom de compte, il reçoit ce que la source déclare.

import { useMemo } from "react";
import type { Transaction } from "@/types";
import { calculerSoldes, type SoldesCalcules } from "@/calculs/calculSoldes";
import { useRegles } from "@/hooks/useRegles";

export type { SoldesCalcules };

export function useBalances(
  transactions: Transaction[],
  allMonths: string[],
  initBalances: Record<string, number>
): SoldesCalcules {
  const regles = useRegles();
  return useMemo(
    () => calculerSoldes(transactions, allMonths, initBalances, regles),
    [transactions, allMonths, initBalances, regles]
  );
}
