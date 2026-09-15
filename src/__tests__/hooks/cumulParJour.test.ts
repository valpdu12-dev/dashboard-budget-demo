import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useExpenseData } from "@/hooks/useExpenseData";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeConfig } from "../helpers/factories";
import type { Transaction } from "@/types";

beforeEach(() => resetAllStores());

/** Même amorçage que `useExpenseData.test.ts`, volontairement dupliqué :
 *  l'helper y est local, et l'exporter élargirait sa surface pour un seul
 *  appelant supplémentaire. */
function seedStores(transactions: Transaction[], overrides?: { period?: string }) {
  useDataStore.getState().setData(
    transactions,
    { months: [], cotLast: [], patronLast: [], lastMonth: "" },
    makeConfig()
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cast partiel volontaire (état de test)
  if (overrides) useFilterStore.setState(overrides as any);
}

/**
 * Courbe d'avancement des dépenses dans le mois.
 *
 * Remplace la heatmap par jour (11/08/2026) : celle-ci disait l'intensité de
 * chaque case sans dire où l'on en est dans le mois. La question posée était
 * « quand se font les dépenses », à laquelle un cumul croissant répond.
 *
 * L'abscisse est le JOUR DU MOIS (1 à 31) et non une date : sur une période
 * de plusieurs mois, les jours de même rang s'additionnent.
 */

const dep = (date: string, montant: number, over: Record<string, unknown> = {}) =>
  makeTx({
    date, montant, dc: "Débit", compte: "Banque A - Courant", cat2: "Alimentation",
    cat3: "Supermarché Ouest", type: "CB", monthKey: date.slice(0, 7), ...over,
  });

function courbe(tx: ReturnType<typeof dep>[]) {
  seedStores(tx, { period: "all" });
  const { result } = renderHook(() => useExpenseData());
  return result.current.cumulParJour;
}

describe("cumulParJour", () => {
  it("rend toujours 31 jours, même sans aucune dépense", () => {
    const c = courbe([]);
    expect(c).toHaveLength(31);
    expect(c[0].jour).toBe(1);
    expect(c[30].jour).toBe(31);
  });

  it("ne descend jamais : le cumul est croissant", () => {
    const c = courbe([dep("2025-01-05", 100), dep("2025-01-20", 50)]);
    for (let i = 1; i < c.length; i++) {
      expect(c[i].cumul).toBeGreaterThanOrEqual(c[i - 1].cumul);
    }
  });

  it("place la dépense au bon jour", () => {
    const c = courbe([dep("2025-01-10", 100)]);
    expect(c[8].cumul).toBe(0);   // jour 9
    expect(c[9].cumul).toBe(100); // jour 10
    expect(c[9].montant).toBe(100);
  });

  it("atteint 100 % au dernier jour porteur de dépense", () => {
    const c = courbe([dep("2025-01-05", 100), dep("2025-01-20", 300)]);
    expect(c[4].part).toBe(25);
    expect(c[19].part).toBe(100);
    expect(c[30].part).toBe(100);
  });

  it("additionne les jours de même rang sur plusieurs mois", () => {
    // Le 10 janvier et le 10 février se cumulent sur le jour 10.
    const c = courbe([dep("2025-01-10", 100), dep("2025-02-10", 40)]);
    expect(c[9].montant).toBe(140);
  });

  it("ignore les recettes", () => {
    const c = courbe([
      dep("2025-01-10", 100),
      dep("2025-01-11", 900, { dc: "Crédit", cat2: "Salaire", type: "Salaire" }),
    ]);
    expect(c[30].cumul).toBe(100);
  });

  it("rend 0 % partout plutôt que NaN quand rien n'est dépensé", () => {
    // `total / 0` produirait NaN, qui s'afficherait tel quel dans l'infobulle.
    const c = courbe([]);
    expect(c.every((d) => d.part === 0)).toBe(true);
    expect(c.every((d) => Number.isFinite(d.cumul))).toBe(true);
  });

  it("porte le total de la période sur son dernier point", () => {
    const c = courbe([dep("2025-01-05", 100), dep("2025-03-28", 250)]);
    expect(c[30].cumul).toBe(350);
  });
});
