// ── Hook Prêt immobilier — le branchement, rien de plus ──────────────────
//
// Lot C.3. Le calcul vit dans `calculs/calculPret.ts`, en fonction pure.
// Seul `status` reste ici : c'est un état de chargement, pas un calcul.

import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { calculerPret } from "@/calculs/calculPret";
import { useRegles } from "@/hooks/useRegles";

// Les paramètres de REPLI du prêt, quand la source n'en déclare aucun. Ils ne
// nomment aucun compte ni aucun type — ce sont des nombres.
export { LOAN_PRINCIPAL, LOAN_PAYMENT, LOAN_TERMS } from "@/calculs/calculPret";

export function useMortgageData() {
  const { transactions, config, status } = useDataStore();

  const regles = useRegles();

  const calcul = useMemo(
    () => calculerPret(transactions, config, regles),
    [transactions, config, regles]
  );

  return { status, ...calcul };
}
