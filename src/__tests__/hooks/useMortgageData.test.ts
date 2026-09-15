import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMortgageData, LOAN_PRINCIPAL } from "@/hooks/useMortgageData";
import { useDataStore } from "@/stores/useDataStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeSalaryData, makeConfig } from "../helpers/factories";

beforeEach(() => {
  resetAllStores();
});

/**
 * Transactions de prêt FICTIVES, calculées depuis le tableau
 * d'amortissement des constantes LOAN_* : échéances #44 (avr.) et #45
 * (mai 2026). Aucun chiffre ne provient d'un prêt réel.
 */
function makeMortgageTxs() {
  return [
    makeTx({ date: "2026-04-15", type: "Crédit Immobilier", dc: "Débit", montant: 665.18, monthKey: "2026-04", compte: "Banque C - Compte joint" }),
    makeTx({ date: "2026-04-15", type: "Intérêt du prêt",    dc: "Débit", montant: 228.42, monthKey: "2026-04", compte: "Banque C - Compte joint" }),
    makeTx({ date: "2026-05-15", type: "Crédit Immobilier", dc: "Débit", montant: 666.18, monthKey: "2026-05", compte: "Banque C - Compte joint" }),
    makeTx({ date: "2026-05-15", type: "Intérêt du prêt",    dc: "Débit", montant: 227.42, monthKey: "2026-05", compte: "Banque C - Compte joint" }),
    // Transaction hors prêt (doit être ignorée)
    makeTx({ date: "2026-05-20", type: "CB", dc: "Débit", montant: 50, monthKey: "2026-05" }),
  ];
}

describe("useMortgageData — garde-fous", () => {
  it("hasData=false sans transaction de prêt", () => {
    useDataStore.getState().setData([makeTx({})], makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.hasData).toBe(false);
  });
});

describe("useMortgageData — historique", () => {
  it("agrège capital et intérêts par mois (ignore le hors-prêt)", () => {
    useDataStore.getState().setData(makeMortgageTxs(), makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.historyData).toHaveLength(2);
    const mai = result.current.historyData.find((p) => p.monthKey === "2026-05");
    expect(mai?.capital).toBeCloseTo(666.18, 2);
    expect(mai?.interets).toBeCloseTo(227.42, 2);
    expect(mai?.total).toBeCloseTo(893.6, 2);
  });
});

describe("useMortgageData — KPIs", () => {
  beforeEach(() => {
    useDataStore.getState().setData(makeMortgageTxs(), makeSalaryData(), makeConfig());
  });

  it("reconstruit le capital restant dû (~150 990 €)", () => {
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.kpis.capitalRestant).toBeGreaterThan(150800);
    expect(result.current.kpis.capitalRestant).toBeLessThan(151200);
  });

  it("déduit l'échéance courante (#45) et le restant (195)", () => {
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.kpis.echeancesPayees).toBe(45);
    expect(result.current.kpis.echeancesRestantes).toBe(195);
  });

  it("avancement cohérent et capital remboursé = principal − restant", () => {
    const { result } = renderHook(() => useMortgageData());
    const { kpis } = result.current;
    expect(kpis.avancement).toBeGreaterThan(0);
    expect(kpis.avancement).toBeLessThan(1);
    expect(kpis.capitalRembourse).toBeCloseTo(LOAN_PRINCIPAL - kpis.capitalRestant, 2);
  });

  it("coût total des intérêts ≈ 34 464 €", () => {
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.kpis.coutTotalInterets).toBeCloseTo(34464.0, 1);
  });
});

describe("useMortgageData — projection", () => {
  it("génère 240 échéances et termine à un solde nul", () => {
    useDataStore.getState().setData(makeMortgageTxs(), makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.projectionData).toHaveLength(240);
    expect(result.current.projectionData[239].capitalRestant).toBeLessThan(1);
  });
});

describe("useMortgageData — simulateur", () => {
  beforeEach(() => {
    useDataStore.getState().setData(makeMortgageTxs(), makeSalaryData(), makeConfig());
  });

  it("simulate(0) : aucun gain", () => {
    const { result } = renderHook(() => useMortgageData());
    const sim = result.current.simulate(0);
    expect(sim.moisGagnes).toBe(0);
    expect(sim.economieInterets).toBe(0);
    expect(sim.dateFin).toBe(result.current.dateFin);
  });

  it("simulate(500) : prêt raccourci + intérêts économisés", () => {
    const { result } = renderHook(() => useMortgageData());
    const sim = result.current.simulate(500);
    expect(sim.moisGagnes).toBeGreaterThan(0);
    expect(sim.economieInterets).toBeGreaterThan(0);
    expect(sim.dateFin < result.current.dateFin).toBe(true);
  });
});
