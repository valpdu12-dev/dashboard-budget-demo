import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTransactions, makeTx, makeTransferTx, makeSalaryData, makeConfig } from "../helpers/factories";

beforeEach(() => {
  resetAllStores();
});

describe("useFilteredData — données vides", () => {
  it("retourne des tableaux vides quand aucune transaction", () => {
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.allMonths).toEqual([]);
    expect(result.current.filteredTx).toEqual([]);
    expect(result.current.currentMonth).toBeNull();
    expect(result.current.prevMonth).toBeNull();
    expect(result.current.periodRange).toEqual({ from: "", to: "" });
  });
});

describe("useFilteredData — allMonths et currentMonth", () => {
  it("extrait les mois uniques triés", () => {
    const txs = makeTransactions();
    const sal = makeSalaryData();
    const cfg = makeConfig();
    useDataStore.getState().setData(txs, sal, cfg);

    const { result } = renderHook(() => useFilteredData());
    expect(result.current.allMonths).toEqual(["2025-01", "2025-02", "2025-03"]);
    expect(result.current.currentMonth).toBe("2025-03");
    expect(result.current.prevMonth).toBe("2025-02");
  });

  it("prevMonth est null quand un seul mois", () => {
    const txs = [makeTx({ date: "2025-01-10", monthKey: "2025-01" })];
    useDataStore.getState().setData(txs, makeSalaryData(), makeConfig());

    const { result } = renderHook(() => useFilteredData());
    expect(result.current.prevMonth).toBeNull();
  });
});

describe("useFilteredData — periodRange", () => {
  beforeEach(() => {
    useDataStore.getState().setData(makeTransactions(), makeSalaryData(), makeConfig());
  });

  it('période "1M" → from === to === dernier mois', () => {
    useFilterStore.getState().setPeriod("1M");
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.periodRange).toEqual({ from: "2025-03", to: "2025-03" });
  });

  it('période "3M" → 3 mois en arrière', () => {
    useFilterStore.getState().setPeriod("3M");
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.periodRange.to).toBe("2025-03");
    expect(result.current.periodRange.from).toBe("2025-01");
  });

  it('période "YTD" → depuis janvier de l\'année courante', () => {
    useFilterStore.getState().setPeriod("YTD");
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.periodRange.from).toBe("2025-01");
    expect(result.current.periodRange.to).toBe("2025-03");
  });

  it('période "all" → depuis le premier mois', () => {
    useFilterStore.getState().setPeriod("all");
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.periodRange.from).toBe("2025-01");
  });
});

describe("useFilteredData — filtres cat1 et transferts", () => {
  beforeEach(() => {
    const txs = [
      makeTx({ date: "2025-03-01", cat1: "Dépense Fixe", monthKey: "2025-03" }),
      makeTx({ date: "2025-03-02", cat1: "Dépense Courante", monthKey: "2025-03" }),
      makeTransferTx({ date: "2025-03-03", monthKey: "2025-03" }),
    ];
    useDataStore.getState().setData(txs, makeSalaryData(), makeConfig());
    useFilterStore.getState().setPeriod("1M");
  });

  it("exclut les transferts par défaut", () => {
    const { result } = renderHook(() => useFilteredData());
    const types = result.current.baseTx.map((t) => t.type);
    expect(types).not.toContain("Transfert Banque A vers Banque C");
  });

  it("inclut les transferts quand showTransfers=true", () => {
    useFilterStore.getState().setShowTransfers(true);
    const { result } = renderHook(() => useFilteredData());
    const types = result.current.baseTx.map((t) => t.type);
    expect(types).toContain("Transfert Banque A vers Banque C");
  });

  it('filtre sur cat1 "Dépense Fixe"', () => {
    useFilterStore.getState().setCat1Filter("Dépense Fixe");
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.baseTx.every((t) => t.cat1 === "Dépense Fixe")).toBe(true);
  });
});

describe("useFilteredData — drill-down filteredTx", () => {
  beforeEach(() => {
    const txs = [
      makeTx({ date: "2025-03-01", cat2: "Alimentation", type: "CB", compte: "Banque A - Courant", monthKey: "2025-03" }),
      makeTx({ date: "2025-03-02", cat2: "Transport",    type: "CB", compte: "Banque C - Compte joint", monthKey: "2025-03" }),
    ];
    useDataStore.getState().setData(txs, makeSalaryData(), makeConfig());
    useFilterStore.getState().setPeriod("1M");
  });

  it("filtre par selMonth", () => {
    useFilterStore.getState().setSelMonth("2025-02");
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.filteredTx).toHaveLength(0);
  });

  it("filtre par selCat2", () => {
    useFilterStore.getState().setSelCat2("Transport");
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.filteredTx).toHaveLength(1);
    expect(result.current.filteredTx[0].cat2).toBe("Transport");
  });

  it("filtre par selOrg (organisme)", () => {
    useFilterStore.getState().setSelOrg("Banque C");
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.filteredTx).toHaveLength(1);
    expect(result.current.filteredTx[0].compte).toBe("Banque C - Compte joint");
  });
});
