import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSavingsData } from "@/hooks/useSavingsData";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeSalaryData, makeConfig } from "../helpers/factories";

beforeEach(() => {
  resetAllStores();
  useFilterStore.getState().setPeriod("all");
});

/** Construit des transactions épargne + sorties + recettes */
function makeSavingsTxs() {
  return [
    // Entrées épargne (type Epargne Banque A = EPARGNE_TYPES)
    makeTx({ date: "2025-01-05", type: "Epargne Banque A", dc: "Débit", montant: 300, monthKey: "2025-01", compte: "Banque A - Courant" }),
    makeTx({ date: "2025-02-05", type: "Epargne Banque A", dc: "Débit", montant: 300, monthKey: "2025-02", compte: "Banque A - Courant" }),
    makeTx({ date: "2025-03-05", type: "Epargne Banque A", dc: "Débit", montant: 300, monthKey: "2025-03", compte: "Banque A - Courant" }),
    // Sortie épargne
    makeTx({ date: "2025-03-15", type: "Sortie Epargne", dc: "Débit", montant: 100, monthKey: "2025-03", compte: "Sortie Epargne" }),
    // Recettes
    makeTx({ date: "2025-03-20", type: "Virement", dc: "Crédit", montant: 2500, monthKey: "2025-03", compte: "Banque A - Courant" }),
  ];
}

describe("useSavingsData — KPIs", () => {
  it("calcule totalEntrees, totalSorties, totalEp", () => {
    useDataStore.getState().setData(makeSavingsTxs(), makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSavingsData());
    expect(result.current.kpis.totalEntrees).toBe(900); // 3 × 300
    expect(result.current.kpis.totalSorties).toBe(100);
    expect(result.current.kpis.totalEp).toBe(800);       // 900 - 100
  });

  it("calcule totalRec et ratio", () => {
    useDataStore.getState().setData(makeSavingsTxs(), makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSavingsData());
    expect(result.current.kpis.totalRec).toBe(2500);
    expect(result.current.kpis.ratio).toBeCloseTo(800 / 2500, 5);
  });

  it("calcule curEp (mois courant)", () => {
    useDataStore.getState().setData(makeSavingsTxs(), makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSavingsData());
    // Mars: entrée 300 - sortie 100 = 200
    expect(result.current.kpis.curEp).toBe(200);
  });

  it("calcule prevEp (mois précédent)", () => {
    useDataStore.getState().setData(makeSavingsTxs(), makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSavingsData());
    // Février: entrée 300, pas de sortie = 300
    expect(result.current.kpis.prevEp).toBe(300);
  });

  it("retourne ratio=0 quand recettes=0", () => {
    const txs = [makeTx({ date: "2025-03-05", type: "Epargne Banque A", dc: "Débit", montant: 200, monthKey: "2025-03", compte: "Banque A - Courant" })];
    useDataStore.getState().setData(txs, makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSavingsData());
    expect(result.current.kpis.ratio).toBe(0);
  });
});

describe("useSavingsData — chartData", () => {
  it("retourne un point par mois dans la plage", () => {
    useDataStore.getState().setData(makeSavingsTxs(), makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSavingsData());
    expect(result.current.chartData).toHaveLength(3); // Jan, Fev, Mars
  });

  it("chaque point a les champs Épargne, Recettes, Ratio", () => {
    useDataStore.getState().setData(makeSavingsTxs(), makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSavingsData());
    const pt = result.current.chartData[2]; // Mars
    expect(pt).toHaveProperty("Épargne");
    expect(pt).toHaveProperty("Recettes");
    expect(pt).toHaveProperty("Ratio");
    expect(pt.monthKey).toBe("2025-03");
  });

  it("les points 2+ ont un champ prev_Épargne pour N-1", () => {
    useDataStore.getState().setData(makeSavingsTxs(), makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSavingsData());
    const pt = result.current.chartData[1] as unknown as Record<string, unknown>;
    expect(pt["prev_Épargne"]).toBeDefined();
  });
});

describe("useSavingsData — donutData", () => {
  it("agrège par type", () => {
    const txs = [
      makeTx({ date: "2025-03-01", type: "Epargne Banque A",       dc: "Débit", montant: 200, monthKey: "2025-03", compte: "Banque A - Courant" }),
      makeTx({ date: "2025-03-02", type: "Epargne Banque B", dc: "Débit", montant: 150, monthKey: "2025-03", compte: "Banque A - Courant" }),
    ];
    useDataStore.getState().setData(txs, makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSavingsData());
    expect(result.current.donutData).toHaveLength(2);
    const ca = result.current.donutData.find((d) => d.name === "Epargne Banque A");
    expect(ca?.value).toBe(200);
  });

  it("filtre par selEpMonth si défini", () => {
    const txs = [
      makeTx({ date: "2025-02-01", type: "Epargne Banque A", dc: "Débit", montant: 100, monthKey: "2025-02", compte: "Banque A - Courant" }),
      makeTx({ date: "2025-03-01", type: "Epargne Banque A", dc: "Débit", montant: 200, monthKey: "2025-03", compte: "Banque A - Courant" }),
    ];
    useDataStore.getState().setData(txs, makeSalaryData(), makeConfig());
    useFilterStore.getState().setSelEpMonth("2025-03");
    const { result } = renderHook(() => useSavingsData());
    const ca = result.current.donutData.find((d) => d.name === "Epargne Banque A");
    expect(ca?.value).toBe(200);
  });
});

describe("useSavingsData — tableRawData", () => {
  it("combine entrées (montant positif) et sorties (montant négatif)", () => {
    useDataStore.getState().setData(makeSavingsTxs(), makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSavingsData());
    const sorties = result.current.tableRawData.filter((t) => (t as { isSortie: boolean }).isSortie);
    expect(sorties.length).toBeGreaterThan(0);
    expect(sorties[0].montant).toBeLessThan(0); // négatif
  });
});
