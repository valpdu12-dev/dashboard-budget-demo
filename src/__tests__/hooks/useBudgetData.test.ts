import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBudgetData, countDistinctDays, getBudgetStatus } from "@/hooks/useBudgetData";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeConfig } from "../helpers/factories";
import type { Transaction, BudgetData } from "@/types";

// ── Helpers ─────────────────────────────────────────────────────────────

function seedStores(
  transactions: Transaction[],
  budgets?: BudgetData,
  period: string = "all"
) {
  const cfg = makeConfig();
  useDataStore.getState().setData(
    transactions,
    { months: [], cotLast: [], patronLast: [], lastMonth: "" },
    cfg
  );
  if (budgets) useDataStore.getState().setBudgets(budgets);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cast partiel volontaire (état de test)
  useFilterStore.setState({ period } as any);
}

// ── Dataset : 3 mois complets (>= 15 jours distincts) + 1 mois incomplet
function makeFullMonthTx(mk: string, cat2: string, total: number, nbDays: number): Transaction[] {
  const [y, m] = mk.split("-");
  return Array.from({ length: nbDays }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return makeTx({
      date: `${y}-${m}-${day}`,
      montant: Math.round(total / nbDays),
      dc: "Débit",
      cat2,
      monthKey: mk,
    });
  });
}

/**
 * Le même mois répété sur janvier, février et mars.
 *
 * Depuis le lot 0, la couverture est inférée des données et les deux mois de
 * bord sont exclus : ici, seul FÉVRIER est comparable. La moyenne vaut donc
 * `total`, comme quand ces tests portaient sur un mois unique — mais pour une
 * raison désormais explicite.
 */
function troisMois(cat2: string, total: number, nbDays = 20): Transaction[] {
  return ["2025-01", "2025-02", "2025-03"].flatMap((mk) =>
    makeFullMonthTx(mk, cat2, total, nbDays)
  );
}

const BUDGETS_FIXTURE: BudgetData = {
  budgets: [
    { cat2: "Alimentation", target: 400, active: true, updated_at: null },
    { cat2: "Loisirs", target: 100, active: true, updated_at: null },
    { cat2: "Transport", target: 150, active: true, updated_at: null },
  ],
};

beforeEach(() => {
  resetAllStores();
});

// ═════════════════════════════════════════════════════════════════════════
// 1. Helpers purs
// ═════════════════════════════════════════════════════════════════════════
describe("countDistinctDays", () => {
  it("compte les jours distincts", () => {
    const tx = [
      makeTx({ date: "2025-01-01", monthKey: "2025-01" }),
      makeTx({ date: "2025-01-01", monthKey: "2025-01" }),
      makeTx({ date: "2025-01-15", monthKey: "2025-01" }),
    ];
    expect(countDistinctDays(tx)).toBe(2);
  });
});

describe("getBudgetStatus", () => {
  it("retourne 'ok' si <= budget", () => {
    expect(getBudgetStatus(90, 100)).toBe("ok");
  });
  it("retourne 'warning' si 100-120%", () => {
    expect(getBudgetStatus(110, 100)).toBe("warning");
  });
  it("retourne 'over' si > 120%", () => {
    expect(getBudgetStatus(130, 100)).toBe("over");
  });
  it("retourne 'no-budget' si target null", () => {
    expect(getBudgetStatus(100, null)).toBe("no-budget");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. Calcul d'écart avec données connues
// ═════════════════════════════════════════════════════════════════════════
describe("useBudgetData — écarts", () => {
  it("calcule l'écart valeur et % correctement", () => {
    // 3 mois complets à 460€/mois en Alimentation → moyenne 460, budget 400
    // (makeFullMonthTx(460, 20) → 20 tx × 23€ = 460)
    const tx = [
      ...makeFullMonthTx("2025-01", "Alimentation", 460, 20),
      ...makeFullMonthTx("2025-02", "Alimentation", 460, 20),
      ...makeFullMonthTx("2025-03", "Alimentation", 460, 20),
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    const alim = result.current.rows.find((r) => r.cat2 === "Alimentation");
    expect(alim).toBeDefined();
    if (alim) {
      expect(alim.averageMonthly).toBe(460);
      expect(alim.target).toBe(400);
      expect(alim.ecartValue).toBe(60);   // 460 - 400
      expect(alim.ecartPct).toBe(15);     // (60/400)*100
      expect(alim.status).toBe("warning"); // 115% → warning (100-120%)
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. Exclusion des mois incomplets
// ═════════════════════════════════════════════════════════════════════════
describe("useBudgetData — mois comparables", () => {
  // Ce bloc testait la règle des 15 jours, supprimée au lot 0 (étape 0.6) :
  // elle mesurait la complétude d'un mois par le nombre de jours DISTINCTS
  // portant une transaction, ce qui n'a rien à voir. La complétude vient
  // maintenant de la couverture de la source (voir docs/CONTRAT_COUVERTURE.md).

  it("exclut les mois de bord, dont on ignore s'ils sont entiers", () => {
    // Janvier et mars sont les bornes du jeu : exclus. Reste février, à 300 €.
    const tx = [
      ...makeFullMonthTx("2025-01", "Alimentation", 900, 20),
      ...makeFullMonthTx("2025-02", "Alimentation", 300, 20),
      ...makeFullMonthTx("2025-03", "Alimentation", 900, 20),
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    expect(result.current.comparableMonths).toEqual(["2025-02"]);
    expect(
      result.current.rows.find((r) => r.cat2 === "Alimentation")?.averageMonthly
    ).toBe(300);
  });

  it("compte un mois à trois prélèvements comme un mois entier", () => {
    // Trois jours de transactions en février : l'ancienne règle l'écartait.
    const tx = [
      ...makeFullMonthTx("2025-01", "Alimentation", 300, 20),
      ...makeFullMonthTx("2025-02", "Alimentation", 600, 3),
      ...makeFullMonthTx("2025-03", "Alimentation", 300, 20),
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    expect(
      result.current.rows.find((r) => r.cat2 === "Alimentation")?.averageMonthly
    ).toBe(600);
  });

  it("compte un mois comparable sans dépense comme un mois à 0 €", () => {
    // Rien en février, mais il est encadré : c'est un vrai zéro, qui pèse au
    // dénominateur. Moyenne sur mars et avril : (600 + 0 + 600) / 3 = 400.
    const tx = [
      ...makeFullMonthTx("2025-01", "Alimentation", 300, 20),
      ...makeFullMonthTx("2025-02", "Alimentation", 600, 20),
      ...makeFullMonthTx("2025-04", "Alimentation", 600, 20),
      ...makeFullMonthTx("2025-05", "Alimentation", 300, 20),
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    expect(result.current.comparableMonths).toEqual(["2025-02", "2025-03", "2025-04"]);
    expect(
      result.current.rows.find((r) => r.cat2 === "Alimentation")?.averageMonthly
    ).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. Agrégation Cat2 correcte
// ═════════════════════════════════════════════════════════════════════════
describe("useBudgetData — agrégation Cat2", () => {
  it("groupe par Cat2 et non par type", () => {
    const tx = [
      ...makeFullMonthTx("2025-01", "Alimentation", 200, 20),
      ...makeFullMonthTx("2025-01", "Loisirs", 80, 20),
      ...makeFullMonthTx("2025-01", "Transport", 120, 20),
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    const cats = result.current.rows.map((r) => r.cat2);
    expect(cats).toContain("Alimentation");
    expect(cats).toContain("Loisirs");
    expect(cats).toContain("Transport");
  });

  it("inclut les Cat2 avec budget mais sans transaction", () => {
    // Pas de transaction Transport, mais budget défini
    const tx = troisMois("Alimentation", 200);
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    const transport = result.current.rows.find((r) => r.cat2 === "Transport");
    expect(transport).toBeDefined();
    if (transport) {
      // Un mois comparable existe ; Transport n'y a rien dépensé. C'est 0 €,
      // une vraie valeur — pas une absence.
      expect(transport.averageMonthly).toBe(0);
      expect(transport.target).toBe(150);
      expect(transport.status).toBe("ok"); // 0 <= 150
    }
  });

  it("KPIs agrégés cohérents", () => {
    const tx = [
      ...troisMois("Alimentation", 500), // > 400 → warning
      ...troisMois("Loisirs", 80),       // < 100 → ok
      ...troisMois("Transport", 200),    // > 150 → warning (133%)
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    const { kpis } = result.current;
    expect(kpis.totalBudgeted).toBe(650);  // 400+100+150
    expect(kpis.totalActual).toBe(780);    // 500+80+200
    expect(kpis.overrunCount).toBe(2);     // Alimentation + Transport
    expect(kpis.balance).toBe(-130);       // 650-780
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. Cas vide (pas de budget défini)
// ═════════════════════════════════════════════════════════════════════════
describe("useBudgetData — cas vide", () => {
  it("fonctionne sans budget défini", () => {
    const tx = troisMois("Alimentation", 300);
    seedStores(tx); // pas de budgets

    const { result } = renderHook(() => useBudgetData());
    expect(result.current.rows).toHaveLength(1);
    const alim = result.current.rows[0];
    expect(alim.target).toBeNull();
    expect(alim.ecartValue).toBeNull();
    expect(alim.status).toBe("no-budget");
  });

  it("fonctionne sans transaction — et n'invente pas de dépense à 0", () => {
    seedStores([], BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    // Les 3 budgets définis apparaissent quand même
    expect(result.current.rows.length).toBe(3);
    // Sans données, aucun mois n'est comparable : la moyenne est INCONNUE.
    // Un 0 laisserait croire à trois budgets parfaitement tenus.
    expect(result.current.comparableMonths).toEqual([]);
    result.current.rows.forEach((r) => {
      expect(r.averageMonthly).toBeNull();
      expect(r.status).toBe("indisponible");
    });
    expect(result.current.kpis.totalActual).toBeNull();
    expect(result.current.kpis.balance).toBeNull();
  });

  it("complianceRate vaut null — et non 100 — quand aucun budget n'est défini", () => {
    // Ce test attendait 100 jusqu'au 11/08/2026. La valeur par défaut est
    // défendable pour un tableau vide, trompeuse en KPI : « Taux de
    // conformité : 100 % » se lit comme un succès alors qu'aucune catégorie
    // n'est comparable. L'affichage rend « — », sans couleur.
    seedStores([]);

    const { result } = renderHook(() => useBudgetData());
    expect(result.current.kpis.complianceRate).toBeNull();
  });

  it("topRows filtre les postes sous le seuil", () => {
    const tx = [
      ...troisMois("Alimentation", 300),
      ...troisMois("Loisirs", 30), // < 50€ → exclu du top
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    const topCats = result.current.topRows.map((r) => r.cat2);
    expect(topCats).toContain("Alimentation");
    expect(topCats).not.toContain("Loisirs");
  });
});
