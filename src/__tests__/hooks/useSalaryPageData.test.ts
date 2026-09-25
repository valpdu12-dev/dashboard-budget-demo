import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSalaryPageData } from "@/hooks/useSalaryPageData";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeSalaryMonth, makeSalaryData, makeConfig } from "../helpers/factories";
import type { SalaryMonth } from "@/types";

// ── Helpers ─────────────────────────────────────────────────────────────

function seedSalary(months: SalaryMonth[], patronLast?: [string, number][]) {
  const sal = makeSalaryData(months);
  if (patronLast) sal.patronLast = patronLast;
  const cfg = makeConfig();
  useDataStore.getState().setData([], sal, cfg);
}

// Dataset multi-entreprises sur 2 ans
const MONTHS_MULTI: SalaryMonth[] = [
  // 2024 — Employeur F
  makeSalaryMonth({ mk: "2024-01", entreprise: "Employeur F", brut: 3200, net: 2500, cotSal: 600, indem: 50, retenues: 50 }),
  makeSalaryMonth({ mk: "2024-02", entreprise: "Employeur F", brut: 3200, net: 2500, cotSal: 600, indem: 50, retenues: 50 }),
  makeSalaryMonth({ mk: "2024-03", entreprise: "Employeur F", brut: 3200, net: 2500, cotSal: 600, indem: 50, retenues: 50 }),
  // 2024 — Employeur E (changement d'entreprise)
  makeSalaryMonth({ mk: "2024-04", entreprise: "Employeur E", brut: 3500, net: 2800, cotSal: 700, indem: 0, retenues: 0 }),
  makeSalaryMonth({ mk: "2024-05", entreprise: "Employeur E", brut: 3500, net: 2800, cotSal: 700, indem: 0, retenues: 0 }),
  makeSalaryMonth({ mk: "2024-06", entreprise: "Employeur E", brut: 3500, net: 2800, cotSal: 700, indem: 0, retenues: 0 }),
  // 2025 — Employeur E
  makeSalaryMonth({ mk: "2025-01", entreprise: "Employeur E", brut: 3600, net: 2900, cotSal: 700, indem: 0, retenues: 0 }),
  makeSalaryMonth({ mk: "2025-02", entreprise: "Employeur E", brut: 3600, net: 2900, cotSal: 700, indem: 0, retenues: 0 }),
  makeSalaryMonth({ mk: "2025-03", entreprise: "Employeur E", brut: 3700, net: 3000, cotSal: 700, indem: 0, retenues: 0 }),
];

beforeEach(() => {
  resetAllStores();
});

// ═════════════════════════════════════════════════════════════════════════
// 1. Cas vide
// ═════════════════════════════════════════════════════════════════════════
describe("useSalaryPageData — sans données", () => {
  it("retourne des valeurs par défaut quand salary est null", () => {
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.months).toEqual([]);
    expect(result.current.filteredHistData).toEqual([]);
    expect(result.current.entreprises).toEqual([]);
    expect(result.current.entKPIs).toBeNull();
    expect(result.current.monthKPIs).toBeNull();
    expect(result.current.stackedData).toEqual([]);
    expect(result.current.projection).toBeNull();
    expect(result.current.selSal).toBeNull();
    expect(result.current.lastSal).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. histData + entrepriseChanges
// ═════════════════════════════════════════════════════════════════════════
describe("useSalaryPageData — histData & entrepriseChanges", () => {
  it("génère un point par mois dans histData", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.filteredHistData).toHaveLength(MONTHS_MULTI.length);
  });

  it("chaque point contient mk, label, Net, Brut, entreprise", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    const first = result.current.filteredHistData[0];
    expect(first).toHaveProperty("mk", "2024-01");
    expect(first).toHaveProperty("Net", 2500);
    expect(first).toHaveProperty("Brut", 3200);
    expect(first).toHaveProperty("entreprise", "Employeur F");
    expect(first).toHaveProperty("label");
  });

  it("détecte les changements d'entreprise", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    // 2 entreprises : Employeur F (début) + Employeur E (à partir de 2024-04)
    expect(result.current.entrepriseChanges).toHaveLength(2);
    expect(result.current.entrepriseChanges[0]).toMatchObject({ mk: "2024-01", entreprise: "Employeur F" });
    expect(result.current.entrepriseChanges[1]).toMatchObject({ mk: "2024-04", entreprise: "Employeur E" });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. filteredHistData (filtrage par entreprise / année)
// ═════════════════════════════════════════════════════════════════════════
describe("useSalaryPageData — filteredHistData", () => {
  it("filtre par selEntreprise", () => {
    seedSalary(MONTHS_MULTI);
    useFilterStore.setState({ selEntreprise: "Employeur F" });
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.filteredHistData).toHaveLength(3); // 3 mois Employeur F
    result.current.filteredHistData.forEach((d) => {
      expect(d.entreprise).toBe("Employeur F");
    });
  });

  it("filtre par selYear", () => {
    seedSalary(MONTHS_MULTI);
    useFilterStore.setState({ selYear: "2025" });
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.filteredHistData).toHaveLength(3); // 3 mois 2025
    result.current.filteredHistData.forEach((d) => {
      expect(d.mk.startsWith("2025")).toBe(true);
    });
  });

  it("combine selEntreprise + selYear", () => {
    seedSalary(MONTHS_MULTI);
    useFilterStore.setState({ selEntreprise: "Employeur E", selYear: "2024" });
    const { result } = renderHook(() => useSalaryPageData());
    // Employeur E en 2024 : avril, mai, juin
    expect(result.current.filteredHistData).toHaveLength(3);
  });

  it("retourne tout si aucun filtre", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.filteredHistData).toHaveLength(9);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. entreprises (liste dédupliquée)
// ═════════════════════════════════════════════════════════════════════════
describe("useSalaryPageData — entreprises", () => {
  it("retourne la liste unique des entreprises", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.entreprises).toContain("Employeur F");
    expect(result.current.entreprises).toContain("Employeur E");
    expect(result.current.entreprises).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. entKPIs (bandeau KPI entreprise)
// ═════════════════════════════════════════════════════════════════════════
describe("useSalaryPageData — entKPIs", () => {
  it("calcule les KPIs sur la carrière complète sans filtre", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    const kpis = result.current.entKPIs!;
    expect(kpis).not.toBeNull();
    expect(kpis.months).toBe(9);
    expect(kpis.label).toBe("Carrière complète");
    // totalNet = 2500*3 + 2800*3 + 2900*2 + 3000 = 7500+8400+5800+3000 = 24700
    expect(kpis.totalNet).toBe(24700);
    expect(kpis.avgNet).toBeCloseTo(24700 / 9, 1);
    expect(kpis.ratio).toBeCloseTo(24700 / kpis.totalBrut, 4);
  });

  it("filtre par entreprise quand selEntreprise est défini", () => {
    seedSalary(MONTHS_MULTI);
    useFilterStore.setState({ selEntreprise: "Employeur F" });
    const { result } = renderHook(() => useSalaryPageData());
    const kpis = result.current.entKPIs!;
    expect(kpis.months).toBe(3);
    expect(kpis.label).toBe("Employeur F");
    expect(kpis.totalNet).toBe(7500);
  });

  it("retourne null si le filtre ne matche aucune donnée", () => {
    seedSalary(MONTHS_MULTI);
    useFilterStore.setState({ selEntreprise: "INEXISTANT" });
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.entKPIs).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 6. monthKPIs (KPIs mois sélectionné dans le comparateur)
// ═════════════════════════════════════════════════════════════════════════
describe("useSalaryPageData — monthKPIs", () => {
  it("calcule tauxCot = cotSal / brut", () => {
    seedSalary(MONTHS_MULTI, [["Patronal", 500]]);
    const { result } = renderHook(() => useSalaryPageData());
    const kpis = result.current.monthKPIs!;
    // selSal = dernier mois (2025-03), brut=3700, cotSal=700
    expect(kpis.tauxCot).toBeCloseTo(700 / 3700, 4);
  });

  it("cumNet est la somme net de l'année en cours", () => {
    seedSalary(MONTHS_MULTI, [["Patronal", 500]]);
    const { result } = renderHook(() => useSalaryPageData());
    const kpis = result.current.monthKPIs!;
    // Année 2025 : 2900 + 2900 + 3000 = 8800
    expect(kpis.cumNet).toBe(8800);
    expect(kpis.year).toBe("2025");
  });

  it("prevCumNet est ramené à la même plage de mois que l'année en cours", () => {
    seedSalary(MONTHS_MULTI, [["Patronal", 500]]);
    const { result } = renderHook(() => useSalaryPageData());
    const kpis = result.current.monthKPIs!;
    // 2025 porte janv.→mars, donc 2024 est ramené à janv.→mars : 2500 × 3.
    // Avant le 29/07/2026 ce chiffre valait 15900, soit les 6 mois de 2024 —
    // deux indicateurs « vs 2025 » de la même page ne disaient alors pas la
    // même chose. Les deux blocs suivent désormais la même règle.
    expect(kpis.prevCumNet).toBe(7500);
    expect(kpis.nbMoisYear).toBe(3);
    expect(kpis.nbMoisPrevYear).toBe(3);
    expect(kpis.prevYear).toBe("2024");
  });

  it("patronTotal = somme des cotisations patronales", () => {
    seedSalary(MONTHS_MULTI, [["Patronal 1", 400], ["Patronal 2", 300]]);
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.monthKPIs!.patronTotal).toBe(700);
  });

  it("coutTotal inclut le patronal uniquement pour le dernier mois", () => {
    seedSalary(MONTHS_MULTI, [["Patronal", 500]]);
    const { result } = renderHook(() => useSalaryPageData());
    // selSal = dernier mois (2025-03) = lastSal, donc patron inclus
    // coutTotal = brut + patronTotal = 3700 + 500 = 4200
    expect(result.current.monthKPIs!.coutTotal).toBe(4200);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 7. stackedData (AreaChart anatomie du salaire)
// ═════════════════════════════════════════════════════════════════════════
describe("useSalaryPageData — stackedData", () => {
  it("génère un point par mois avec les composantes du salaire", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.stackedData).toHaveLength(9);
    const point = result.current.stackedData[0];
    expect(point).toHaveProperty("net", 2500);
    expect(point).toHaveProperty("cotSal", 600);
    expect(point).toHaveProperty("retenues", 50);
    expect(point).toHaveProperty("indem", 50);
    expect(point).toHaveProperty("brut", 3200);
    expect(point).toHaveProperty("label");
    expect(point).toHaveProperty("mk", "2024-01");
  });

  it("filtre par selEntreprise", () => {
    seedSalary(MONTHS_MULTI);
    useFilterStore.setState({ selEntreprise: "Employeur E" });
    const { result } = renderHook(() => useSalaryPageData());
    // Employeur E : 6 mois (2024-04 à 2024-06 + 2025-01 à 2025-03)
    expect(result.current.stackedData).toHaveLength(6);
  });

  it("retourne un tableau vide si pas de données", () => {
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.stackedData).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 8. projection (bilan annuel N vs N-1)
// ═════════════════════════════════════════════════════════════════════════
describe("useSalaryPageData — projection sur période comparable", () => {
  // Règle posée le 29/07/2026 : l'année précédente est ramenée aux **mêmes
  // numéros de mois** que l'année en cours. Le jeu d'essai est justement un cas
  // partiel — 2025 porte janv.→mars, 2024 porte janv.→juin.
  it("ne retient de l'année précédente que les mois présents dans l'année en cours", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    const proj = result.current.projection!;
    expect(proj.year).toBe("2025");
    expect(proj.prevYear).toBe("2024");
    // 2025 net : 2900+2900+3000 = 8800 sur 3 mois
    expect(proj.netY).toBe(8800);
    expect(proj.brutY).toBe(10900);
    expect(proj.nbY).toBe(3);
    // 2024 ramené à janv.→mars : 2500 × 3 = 7500, et non 15900 sur 6 mois.
    expect(proj.netPY).toBe(7500);
    expect(proj.nbPY).toBe(3);
  });

  it("compare des périodes de même longueur", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    const proj = result.current.projection!;
    expect(proj.nbPY).toBe(proj.nbY);
  });

  it("apparie par numéro de mois et non par rang", () => {
    // 2025 saute février : la comparaison doit retenir janv. et mars 2024,
    // et surtout pas les deux premiers bulletins 2024 (janv. et févr.).
    const avecTrou = MONTHS_MULTI.filter((m) => m.mk !== "2025-02");
    seedSalary(avecTrou);
    const { result } = renderHook(() => useSalaryPageData());
    const proj = result.current.projection!;
    expect(proj.nbY).toBe(2);
    expect(proj.nbPY).toBe(2);
    // janv. + mars 2024 = 2500 + 2500 = 5000
    expect(proj.netPY).toBe(5000);
  });

  it("expose la plage comparée en libellé", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.projection!.periodLabel).toBe("janv.–mars");
  });

  it("réduit le libellé au mois seul quand l'année en cours n'en porte qu'un", () => {
    const unSeulMois = MONTHS_MULTI.filter((m) => !m.mk.startsWith("2025") || m.mk === "2025-01");
    seedSalary(unSeulMois);
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.projection!.periodLabel).toBe("janv.");
  });

  it("deltaNet est le pourcentage d'évolution sur la période comparable", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    const proj = result.current.projection!;
    // (8800 − 7500) / 7500 × 100 — une hausse, là où la comparaison
    // année pleine contre année partielle affichait une chute de 44,7 %.
    const expected = ((8800 - 7500) / 7500 * 100).toFixed(1);
    expect(proj.deltaNet).toBe(expected);
    expect(Number(proj.deltaNet)).toBeGreaterThan(0);
  });

  it("deltaNet est null si pas de données N-1", () => {
    const months2025Only = MONTHS_MULTI.filter((m) => m.mk.startsWith("2025"));
    seedSalary(months2025Only);
    const { result } = renderHook(() => useSalaryPageData());
    const proj = result.current.projection!;
    expect(proj.deltaNet).toBeNull();
  });

  it("retourne null si selSal est null", () => {
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.projection).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 9. Comparateur (navigation entre mois)
// ═════════════════════════════════════════════════════════════════════════
describe("useSalaryPageData — mois de référence", () => {
  // Le comparateur mensuel navigable a été retiré le 29/07/2026 : `goPrev`,
  // `goNext`, `canPrev`, `canNext`, `compMax` et `effectiveIdx` n'existent
  // plus. Le mois de référence est toujours le dernier connu, ce qui était
  // déjà le comportement par défaut de l'ancien comparateur.
  it("selSal est le dernier mois connu", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.selSal!.mk).toBe("2025-03");
  });

  it("selSal est null quand il n'y a aucun mois", () => {
    seedSalary([]);
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.selSal).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 10. hasFilters + clearRevFilters
// ═════════════════════════════════════════════════════════════════════════
describe("useSalaryPageData — hasFilters", () => {
  it("est false quand aucun filtre salaire actif", () => {
    seedSalary(MONTHS_MULTI);
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.hasFilters).toBe(false);
  });

  it("est true quand selEntreprise est défini", () => {
    seedSalary(MONTHS_MULTI);
    useFilterStore.setState({ selEntreprise: "Employeur E" });
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.hasFilters).toBe(true);
  });

  it("est true quand selYear est défini", () => {
    seedSalary(MONTHS_MULTI);
    useFilterStore.setState({ selYear: "2025" });
    const { result } = renderHook(() => useSalaryPageData());
    expect(result.current.hasFilters).toBe(true);
  });

  it("clearRevFilters remet les filtres à null", () => {
    seedSalary(MONTHS_MULTI);
    useFilterStore.setState({ selEntreprise: "Employeur E", selYear: "2025" });
    const { result } = renderHook(() => useSalaryPageData());
    act(() => { result.current.clearRevFilters(); });
    expect(useFilterStore.getState().selEntreprise).toBeNull();
    expect(useFilterStore.getState().selYear).toBeNull();
  });
});
