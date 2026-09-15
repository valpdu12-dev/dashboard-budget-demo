import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSalaryInflationData, EMPLOYER_ALL } from "@/hooks/useSalaryInflationData";
import { useDataStore } from "@/stores/useDataStore";
import { resetAllStores } from "../helpers/storeReset";
import {
  makeTx, makeSalaryMonth, makeSalaryData, makeConfig, makeInflation, makeSmic,
} from "../helpers/factories";
import type { SalaryMonth } from "@/types";

beforeEach(() => resetAllStores());

/** 12 mois d'une année à net constant. */
function year(y: string, net: number, entreprise = "Employeur E"): SalaryMonth[] {
  return Array.from({ length: 12 }, (_, i) =>
    makeSalaryMonth({ mk: `${y}-${String(i + 1).padStart(2, "0")}`, net, brut: net * 1.3, entreprise })
  );
}

/** Dataset multi-années cohérent : 2013, 2014, 2024, 2025 complets + 2026 en cours. */
function fullSalary() {
  const months: SalaryMonth[] = [
    ...year("2013", 1000, "Employeur A"),
    ...year("2014", 1100),
    ...year("2024", 2000),
    ...year("2025", 2100),
    makeSalaryMonth({ mk: "2026-01", net: 2200 }),
    makeSalaryMonth({ mk: "2026-02", net: 2200 }),
  ];
  return makeSalaryData(months, {
    inflation: [
      makeInflation({ year: "2013", rate_annual: 0 }),
      makeInflation({ year: "2014", rate_annual: 2.0 }),
      makeInflation({ year: "2024", rate_annual: 5.0 }),
      makeInflation({ year: "2025", rate_annual: 2.0 }),
    ],
    smic: [
      makeSmic({ year: "2013", net_monthly: 1000 }),
      makeSmic({ year: "2014", net_monthly: 1050 }),
      makeSmic({ year: "2024", net_monthly: 1300 }),
      makeSmic({ year: "2025", net_monthly: 1350 }),
    ],
    inflationByCategory: [
      makeInflation({ year: "2025", rate_alimentation: 5, rate_services: 2, rate_transports: 3, rate_energie: 10, rate_produits_manufactures: 1 }),
    ],
  });
}

/** Dépenses 2025 rattachables : Alimentation 100, Logement 300 (services), Transports 100. */
function spend2025() {
  return [
    makeTx({ date: "2025-04-01", cat2: "Alimentation", montant: 100, dc: "Débit", monthKey: "2025-04" }),
    makeTx({ date: "2025-04-02", cat2: "Logement", montant: 300, dc: "Débit", monthKey: "2025-04" }),
    makeTx({ date: "2025-04-03", cat2: "Transports", montant: 100, dc: "Débit", monthKey: "2025-04" }),
  ];
}

describe("useSalaryInflationData — garde-fous", () => {
  it("hasData=false si inflation/SMIC absents", () => {
    useDataStore.getState().setData([], makeSalaryData(), makeConfig());
    const { result } = renderHook(() => useSalaryInflationData());
    expect(result.current.hasData).toBe(false);
    expect(result.current.indices).toHaveLength(0);
  });

  it("hasData=false si aucun mois de salaire", () => {
    useDataStore.getState().setData([], makeSalaryData([]), makeConfig());
    const { result } = renderHook(() => useSalaryInflationData());
    expect(result.current.hasData).toBe(false);
  });
});

describe("useSalaryInflationData — agrégation & filtre employeur", () => {
  beforeEach(() => useDataStore.getState().setData(spend2025(), fullSalary(), makeConfig()));

  it("agrège le net moyen annuel et signale l'année en cours (2026)", () => {
    const { result } = renderHook(() => useSalaryInflationData());
    const y2025 = result.current.yearly.find((y) => y.year === "2025");
    expect(y2025?.avgNet).toBeCloseTo(2100, 5);
    expect(y2025?.months).toBe(12);
    expect(y2025?.incomplet).toBe(false);
    const y2026 = result.current.yearly.find((y) => y.year === "2026");
    expect(y2026?.incomplet).toBe(true);
    expect(result.current.inProgressYear).toBe("2026");
    // 2026 (en cours) exclu des indices cumulés
    expect(result.current.indices.some((p) => p.year === "2026")).toBe(false);
  });

  it("filtre par employeur (Employeur E exclut 2013/Employeur A)", () => {
    const { result } = renderHook(() => useSalaryInflationData());
    expect(result.current.employers.map((e) => e.name)).toEqual(
      expect.arrayContaining([EMPLOYER_ALL, "Employeur A", "Employeur E"])
    );
    expect(result.current.yearly.some((y) => y.year === "2013")).toBe(true);
    act(() => result.current.setEmployer("Employeur E"));
    expect(result.current.yearly.some((y) => y.year === "2013")).toBe(false);
  });
});

describe("useSalaryInflationData — indices, écart SMIC, pouvoir d'achat", () => {
  beforeEach(() => useDataStore.getState().setData(spend2025(), fullSalary(), makeConfig()));

  it("indices cumulés base 100 (net / inflation / SMIC) à 2025", () => {
    const { result } = renderHook(() => useSalaryInflationData());
    expect(result.current.baseYear).toBe("2013");
    const p = result.current.indices.find((x) => x.year === "2025")!;
    expect(p.salaryIndex).toBeCloseTo(210, 5);        // 2100/1000
    expect(p.inflationIndex).toBeCloseTo(109.242, 3); // 100·1.02·1.05·1.02
    expect(p.smicIndex).toBeCloseTo(135, 5);          // 1350/1000
  });

  it("écart SMIC 2025 = (2100−1350)/1350 ≈ 55,6 %", () => {
    const { result } = renderHook(() => useSalaryInflationData());
    const g = result.current.smicGap.find((x) => x.year === "2025")!;
    expect(g.gapPct).toBeCloseTo(55.5556, 3);
  });

  it("pouvoir d'achat : 1000 € de 2013 ≈ 1092,42 € en euros 2025", () => {
    const { result } = renderHook(() => useSalaryInflationData());
    const p = result.current.purchasing.find((x) => x.year === "2013")!;
    expect(p.currentEuros).toBeCloseTo(1092.42, 2);
    expect(result.current.insights.euroEquivalent?.toEuros).toBeCloseTo(1092.42, 2);
    expect(result.current.insights.cumInflationPct).toBeCloseTo(9.242, 3);
  });
});

describe("useSalaryInflationData — inflation personnalisée", () => {
  beforeEach(() => useDataStore.getState().setData(spend2025(), fullSalary(), makeConfig()));

  it("calcule l'inflation perso 2025 (pondérée) et renvoie null hors 2024-2025", () => {
    const { result } = renderHook(() => useSalaryInflationData());
    const p2025 = result.current.personalInflation.find((x) => x.year === "2025")!;
    // 0.2·5 + 0.6·2 + 0.2·3 = 2,8
    expect(p2025.rate).toBeCloseTo(2.8, 5);
    expect(result.current.personalInflation.find((x) => x.year === "2013")!.rate).toBeNull();
    // 2024 : pas de détail sectoriel fourni → null
    expect(result.current.personalInflation.find((x) => x.year === "2024")!.rate).toBeNull();
  });
});
