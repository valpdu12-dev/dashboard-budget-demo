import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBudgetData } from "@/hooks/useBudgetData";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeConfig } from "../helpers/factories";
import type { Transaction, BudgetData } from "@/types";

/**
 * Bug de la règle des 15 jours (lot 0, étape 0.6).
 *
 * `MIN_DAYS_FOR_MONTH = 15` ne retenait pour la moyenne que les mois comptant
 * au moins 15 jours DISTINCTS avec au moins une transaction. Deux choses sans
 * rapport : un mois où l'on ne paie que quelques prélèvements est un mois
 * complet, pas un mois incomplet.
 *
 * Quand aucun mois ne passait le seuil, la moyenne tombait à 0. Et une moyenne
 * de 0 face à un objectif de 500 € se lit « ok » : le taux de conformité
 * affichait 100 % sur un budget dépassé de 400 €.
 *
 * Ce test reproduit exactement ce cas. Il doit échouer AVANT la correction.
 */

const BUDGETS: BudgetData = {
  budgets: [{ cat2: "Alimentation", target: 500, active: true, updated_at: null }],
};

/** 900 € dépensés sur 3 jours seulement — moins de 15 jours distincts. */
function neufCentsEurosEnTroisJours(mk: string): Transaction[] {
  const [y, m] = mk.split("-");
  return ["05", "12", "23"].map((jour) =>
    makeTx({
      date: `${y}-${m}-${jour}`,
      montant: 300,
      dc: "Débit",
      cat2: "Alimentation",
      monthKey: mk,
    })
  );
}

function seed(transactions: Transaction[]) {
  useDataStore.getState().setData(
    transactions,
    { months: [], cotLast: [], patronLast: [], lastMonth: "" },
    makeConfig()
  );
  useDataStore.getState().setBudgets(BUDGETS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cast partiel volontaire (état de test)
  useFilterStore.setState({ period: "all" } as any);
}

beforeEach(() => resetAllStores());

describe("budget — 900 € dépensés, objectif 500 €, moins de 15 jours de transactions", () => {
  it("n'annonce pas 100 % de conformité sur un budget dépassé", () => {
    // Trois mois, chacun à 900 € payés en trois jours. Aucun ne passait le
    // seuil des 15 jours : la moyenne valait 0 et tout paraissait conforme.
    seed([
      ...neufCentsEurosEnTroisJours("2025-01"),
      ...neufCentsEurosEnTroisJours("2025-02"),
      ...neufCentsEurosEnTroisJours("2025-03"),
    ]);

    const { result } = renderHook(() => useBudgetData());
    const alim = result.current.rows.find((r) => r.cat2 === "Alimentation");

    expect(alim).toBeDefined();
    // Février est le seul mois comparable (janvier et mars sont les bornes).
    // 900 € dépensés face à un objectif de 500 € : c'est un dépassement.
    expect(alim?.averageMonthly).toBe(900);
    expect(alim?.status).toBe("over");
    expect(result.current.kpis.complianceRate).toBe(0);
    expect(result.current.kpis.balance).toBe(-400);
  });

  it("dit « indisponible » plutôt que 0 quand aucun mois n'est comparable", () => {
    // Un seul mois de données : c'est la borne de début ET de fin. Rien n'est
    // comparable. Le bon résultat n'est pas 0, c'est « on ne sait pas ».
    seed(neufCentsEurosEnTroisJours("2025-01"));

    const { result } = renderHook(() => useBudgetData());
    const alim = result.current.rows.find((r) => r.cat2 === "Alimentation");

    expect(alim?.averageMonthly).toBeNull();
    expect(alim?.status).toBe("indisponible");
    expect(result.current.kpis.complianceRate).toBeNull();
    expect(result.current.kpis.balance).toBeNull();
    expect(result.current.kpis.totalActual).toBeNull();
  });
});
