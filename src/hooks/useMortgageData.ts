// ── Hook Prêt immobilier — le branchement, rien de plus ──────────────────
//
// Lot C.3. Le calcul vit dans `calculs/calculPret.ts`, en fonction pure.
// Seul `status` reste ici : c'est un état de chargement, pas un calcul.

import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { calculerPret } from "@/calculs/calculPret";
import { useRegles } from "@/hooks/useRegles";

export function useMortgageData() {
  const { transactions, config, status } = useDataStore();

  const regles = useRegles();

  const calcul = useMemo(
    () => calculerPret(transactions, config, regles),
    [transactions, config, regles]
  );

  return { status, ...calcul };
}
