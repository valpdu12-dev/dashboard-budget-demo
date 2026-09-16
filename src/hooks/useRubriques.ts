// ── Quelles rubriques le jeu de données fait-il exister ? ────────────────
//
// Lot B.4. Sans paie, les écrans Salaire et Salaire/Inflation n'ont rien à
// montrer ; sans prêt, l'écran Prêt immobilier non plus. Jusqu'ici ils
// s'affichaient quand même : des graphiques vides, des tirets, et pour le
// prêt un échéancier calculé sur des constantes de repli — c'est-à-dire un
// prêt inventé, présenté comme celui de la personne.
//
// ⚠️ LA RÈGLE LA PLUS IMPORTANTE DE CE MODULE : la décision se prend sur le
// JEU COMPLET, jamais sur la période filtrée. Un mois sans échéance de prêt
// ne doit pas faire disparaître l'onglet — sinon l'application se réorganise
// sous les doigts de la personne à chaque changement de filtre, et le moindre
// « 1 mois » ferait fondre la navigation.

import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { TYPE_PRET_CAPITAL, TYPE_PRET_INTERETS } from "@/hooks/useMortgageData";
import type { Config, SalaryData, Transaction } from "@/types";

/** Les rubriques que les données rendent légitimes. */
export interface Rubriques {
  /** Au moins un mois de paie. */
  paie: boolean;
  /** Un prêt déclaré par la source, ou des échéances dans les transactions. */
  pret: boolean;
}

/**
 * Décide, sur le jeu COMPLET.
 *
 * Fonction pure, séparée du hook : elle se teste sans React, et les quatre
 * jeux de la recette (complet, sans paie, sans prêt, sans les deux) passent
 * par elle.
 */
export function rubriquesDisponibles(
  transactions: Transaction[],
  salary: SalaryData | null,
  config: Config | null
): Rubriques {
  const paie = (salary?.months?.length ?? 0) > 0;

  const pretDeclare =
    !!config?.pret &&
    typeof config.pret.montant === "number" && config.pret.montant > 0 &&
    typeof config.pret.mensualite === "number" && config.pret.mensualite > 0 &&
    typeof config.pret.echeances === "number" && config.pret.echeances > 0;

  const echeances = transactions.some(
    (t) => t.type === TYPE_PRET_CAPITAL || t.type === TYPE_PRET_INTERETS
  );

  return { paie, pret: pretDeclare || echeances };
}

/** Le même calcul, branché sur le store. Toujours le jeu complet. */
export function useRubriques(): Rubriques {
  const transactions = useDataStore((s) => s.transactions);
  const salary = useDataStore((s) => s.salary);
  const config = useDataStore((s) => s.config);
  return useMemo(
    () => rubriquesDisponibles(transactions, salary, config),
    [transactions, salary, config]
  );
}
