import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBalances } from "@/hooks/useBalances";
import { makeTx, makeConfig, makeSalaryData } from "../helpers/factories";
import { useDataStore } from "@/stores/useDataStore";
import { poserReglesDemo } from "../helpers/poserRegles";

// Les règles viennent du store depuis le lot C.4 : ce test déclare celles de
// la démonstration, dont il vérifie précisément le comportement.
beforeEach(() => {
  poserReglesDemo();
});
import type { Transaction } from "@/types";

// ── Helpers ─────────────────────────────────────────────────────────────
const INIT_ZERO: Record<string, number> = {
  "Banque A - Courant": 0,
  "Banque B - Compte joint": 0,
  "Banque C - Compte joint": 0,
  "Titres-restaurant": 0,
};

const INIT_CUSTOM: Record<string, number> = {
  "Banque A - Courant": 5000,
  "Banque B - Compte joint": 2000,
  "Banque C - Compte joint": 1500,
  "Titres-restaurant": 100,
};

const MONTHS_3 = ["2025-01", "2025-02", "2025-03"];

// ═════════════════════════════════════════════════════════════════════════
// 1. Cas vide
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — sans données", () => {
  it("retourne des balances vides quand aucun mois", () => {
    const { result } = renderHook(() => useBalances([], [], INIT_ZERO));
    expect(result.current.balancesByMonth).toEqual({});
    expect(result.current.currentBalances).toEqual(
      expect.objectContaining({ Total: 0 })
    );
  });

  it("retourne les soldes initiaux si transactions vides mais mois présents", () => {
    const { result } = renderHook(() =>
      useBalances([], ["2025-01"], INIT_CUSTOM)
    );
    // Pas de transaction → les soldes restent aux initiales
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(5000);
    expect(result.current.balancesByMonth["2025-01"]["Banque B - Compte joint"]).toBe(2000);
    expect(result.current.balancesByMonth["2025-01"]["Banque C - Compte joint"]).toBe(1500);
    expect(result.current.balancesByMonth["2025-01"]["Titres-restaurant"]).toBe(100);
    expect(result.current.balancesByMonth["2025-01"]["Total"]).toBe(8600);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. Règles Banque A - Courant (multi-comptes)
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — règles Banque A - Courant", () => {
  it("Banque A - Courant Crédit → +montant sur Banque A - Courant", () => {
    const tx = [makeTx({ compte: "Banque A - Courant", dc: "Crédit", montant: 1000, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(1000);
  });

  it("Banque A - Courant Débit → -montant sur Banque A - Courant", () => {
    const tx = [makeTx({ compte: "Banque A - Courant", dc: "Débit", montant: 300, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_CUSTOM));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(5000 - 300);
  });

  // ── Lot C.4, décision D2 ────────────────────────────────────────────
  //
  // Avant : le LIBELLÉ DE COMPTE « Sortie Epargne » déclenchait le crédit.
  // Ce compte n'existait nulle part — ni solde, ni couleur, ni icône.
  // Après : c'est le TYPE qui porte la nature `sortie-epargne`, et le compte
  // crédité est déclaré une fois pour toutes dans `Paramètres`.
  it("une ligne de nature sortie-epargne crédite le compte DÉCLARÉ", () => {
    const tx = [makeTx({
      compte: "Sortie Epargne", type: "Sortie Epargne",
      dc: "Crédit", montant: 500, monthKey: "2025-01",
    })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(500);
  });

  it("le LIBELLÉ DE COMPTE seul ne crédite plus rien — le pseudo-compte est retiré", () => {
    const tx = [makeTx({
      compte: "Sortie Epargne", type: "courses",
      dc: "Crédit", montant: 500, monthKey: "2025-01",
    })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(0);
  });

  it("sans compte déclaré pour les recevoir, la sortie n'est créditée nulle part — et c'est chiffré", () => {
    const tx = [makeTx({
      compte: "Sortie Epargne", type: "Sortie Epargne",
      dc: "Crédit", montant: 500, monthKey: "2025-01",
    })];
    // On retire la déclaration du compte crédité, et rien d'autre.
    const config = makeConfig();
    useDataStore.getState().setData([], makeSalaryData([]), {
      ...config,
      parametrage: { ...config.parametrage!, compteCreditSortiesEpargne: null },
    }, "static");

    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(0);
    expect(result.current.sortiesNonCreditees).toEqual({ lignes: 1, montant: 500 });
  });

  it("Appli partagée - Part commune Débit → -montant sur Banque A - Courant", () => {
    const tx = [makeTx({ compte: "Appli partagée - Part commune", dc: "Débit", montant: 100, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(-100);
  });

  it("Appli partagée - Part commune Crédit → aucun impact sur Banque A - Courant", () => {
    const tx = [makeTx({ compte: "Appli partagée - Part commune", dc: "Crédit", montant: 200, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(0);
  });

  it("Banque A - Part commune Débit → -montant sur Banque A - Courant", () => {
    const tx = [makeTx({ compte: "Banque A - Part commune", dc: "Débit", montant: 150, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(-150);
  });

  it("Bourso Crédit (non Virement ext.) → -montant sur Banque A - Courant", () => {
    const tx = [makeTx({ compte: "Banque B - Compte joint", dc: "Crédit", montant: 400, type: "CB", monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    // Impact sur Banque A - Courant : -400 et sur Bourso : +400
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(-400);
    expect(result.current.balancesByMonth["2025-01"]["Banque B - Compte joint"]).toBe(400);
  });

  it("Bourso Crédit Virement extérieur → PAS d'impact sur Banque A - Courant", () => {
    const tx = [makeTx({ compte: "Banque B - Compte joint", dc: "Crédit", montant: 400, type: "Virement extérieur", monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(0);
    expect(result.current.balancesByMonth["2025-01"]["Banque B - Compte joint"]).toBe(400);
  });

  it("CE Crédit (non Virement ext.) → -montant sur Banque A - Courant", () => {
    const tx = [makeTx({ compte: "Banque C - Compte joint", dc: "Crédit", montant: 300, type: "Virement", monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(-300);
    expect(result.current.balancesByMonth["2025-01"]["Banque C - Compte joint"]).toBe(300);
  });

  it("CE Crédit Virement extérieur → PAS d'impact sur Banque A - Courant", () => {
    const tx = [makeTx({ compte: "Banque C - Compte joint", dc: "Crédit", montant: 300, type: "Virement extérieur", monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque A - Courant"]).toBe(0);
    expect(result.current.balancesByMonth["2025-01"]["Banque C - Compte joint"]).toBe(300);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. Règles simples : comptes à solde propre (Bourso joint / CE / Titres-restaurant)
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — comptes simples", () => {
  it("Bourso Débit → -montant sur Bourso", () => {
    const tx = [makeTx({ compte: "Banque B - Compte joint", dc: "Débit", montant: 200, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_CUSTOM));
    expect(result.current.balancesByMonth["2025-01"]["Banque B - Compte joint"]).toBe(2000 - 200);
  });

  it("CE Débit → -montant sur CE", () => {
    const tx = [makeTx({ compte: "Banque C - Compte joint", dc: "Débit", montant: 100, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_CUSTOM));
    expect(result.current.balancesByMonth["2025-01"]["Banque C - Compte joint"]).toBe(1500 - 100);
  });

  it("Titres-restaurant Crédit et Débit", () => {
    const tx = [
      makeTx({ compte: "Titres-restaurant", dc: "Crédit", montant: 200, monthKey: "2025-01" }),
      makeTx({ compte: "Titres-restaurant", dc: "Débit", montant: 50, monthKey: "2025-01" }),
    ];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Titres-restaurant"]).toBe(150);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. Calcul cumulatif multi-mois
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — cumul multi-mois", () => {
  const tx: Transaction[] = [
    makeTx({ compte: "Banque A - Courant", dc: "Crédit", montant: 2500, monthKey: "2025-01" }),
    makeTx({ compte: "Banque A - Courant", dc: "Débit", montant: 800, monthKey: "2025-01" }),
    makeTx({ compte: "Banque A - Courant", dc: "Crédit", montant: 2500, monthKey: "2025-02" }),
    makeTx({ compte: "Banque A - Courant", dc: "Débit", montant: 900, monthKey: "2025-02" }),
    makeTx({ compte: "Banque A - Courant", dc: "Crédit", montant: 2500, monthKey: "2025-03" }),
    makeTx({ compte: "Banque A - Courant", dc: "Débit", montant: 700, monthKey: "2025-03" }),
  ];

  it("les soldes sont cumulatifs d'un mois à l'autre", () => {
    const { result } = renderHook(() => useBalances(tx, MONTHS_3, INIT_ZERO));
    const b = result.current.balancesByMonth;
    // Jan : +2500 -800 = 1700
    expect(b["2025-01"]["Banque A - Courant"]).toBe(1700);
    // Fev : 1700 +2500 -900 = 3300
    expect(b["2025-02"]["Banque A - Courant"]).toBe(3300);
    // Mars : 3300 +2500 -700 = 5100
    expect(b["2025-03"]["Banque A - Courant"]).toBe(5100);
  });

  it("le Total inclut tous les comptes réels", () => {
    const txMixed: Transaction[] = [
      makeTx({ compte: "Banque A - Courant", dc: "Crédit", montant: 1000, monthKey: "2025-01" }),
      makeTx({ compte: "Titres-restaurant", dc: "Crédit", montant: 200, monthKey: "2025-01" }),
    ];
    const { result } = renderHook(() => useBalances(txMixed, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Total"]).toBe(1200);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. currentBalances
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — currentBalances", () => {
  it("retourne les soldes du dernier mois", () => {
    const tx = [
      makeTx({ compte: "Banque A - Courant", dc: "Crédit", montant: 1000, monthKey: "2025-01" }),
      makeTx({ compte: "Banque A - Courant", dc: "Crédit", montant: 500, monthKey: "2025-02" }),
    ];
    const { result } = renderHook(() =>
      useBalances(tx, ["2025-01", "2025-02"], INIT_ZERO)
    );
    // Cumul : Jan 1000, Fev 1500
    expect(result.current.currentBalances["Banque A - Courant"]).toBe(1500);
  });

  it("retourne un objet avec Total:0 quand allMonths est vide", () => {
    const { result } = renderHook(() => useBalances([], [], INIT_ZERO));
    expect(result.current.currentBalances.Total).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 6. balanceChartData
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — balanceChartData", () => {
  it("retourne un tableau formaté pour le LineChart", () => {
    const tx = [
      makeTx({ compte: "Banque A - Courant", dc: "Crédit", montant: 3000, monthKey: "2025-01" }),
      makeTx({ compte: "Banque B - Compte joint", dc: "Crédit", montant: 500, type: "Virement extérieur", monthKey: "2025-01" }),
    ];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    const chartData = result.current.balanceChartData(["2025-01"]);

    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      monthKey: "2025-01",
      "Banque A - Courant": 3000,
      "Banque B - Compte joint": 500,
    });
  });

  it("retourne un tableau vide si monthsInRange est vide", () => {
    const { result } = renderHook(() => useBalances([], ["2025-01"], INIT_ZERO));
    const chartData = result.current.balanceChartData([]);
    expect(chartData).toEqual([]);
  });

  it("arrondit les valeurs à l'entier", () => {
    // Titres-restaurant : 0.1 + 0.2 ≈ 0.3 (float)
    const tx = [
      makeTx({ compte: "Titres-restaurant", dc: "Crédit", montant: 0.1, monthKey: "2025-01" }),
      makeTx({ compte: "Titres-restaurant", dc: "Crédit", montant: 0.2, monthKey: "2025-01" }),
    ];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    const chartData = result.current.balanceChartData(["2025-01"]);
    // Math.round(0.3) = 0
    expect(chartData[0]["Titres-restaurant"]).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 7. Scénario intégré multi-comptes
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — scénario intégré", () => {
  it("gère un flux réaliste multi-comptes sur 2 mois", () => {
    const tx: Transaction[] = [
      // Janvier : salaire Banque A - Courant, dépense CB Banque A - Courant, virement vers Bourso
      makeTx({ compte: "Banque A - Courant", dc: "Crédit", montant: 2500, monthKey: "2025-01" }),
      makeTx({ compte: "Banque A - Courant", dc: "Débit", montant: 800, monthKey: "2025-01" }),
      makeTx({ compte: "Banque B - Compte joint", dc: "Crédit", montant: 600, type: "Virement", monthKey: "2025-01" }),
      // → Banque A - Courant = 5000+2500-800-600 = 6100, Bourso = 2000+600 = 2600
      // Février : Titres-restaurant rechargé, sortie épargne
      makeTx({ compte: "Titres-restaurant", dc: "Crédit", montant: 180, monthKey: "2025-02" }),
      makeTx({ compte: "Sortie Epargne", type: "Sortie Epargne", dc: "Débit", montant: 300, monthKey: "2025-02" }),
      // → Banque A - Courant = 6100+300 = 6400, Titres-restaurant = 100+180 = 280
    ];

    const { result } = renderHook(() =>
      useBalances(tx, ["2025-01", "2025-02"], INIT_CUSTOM)
    );

    const jan = result.current.balancesByMonth["2025-01"];
    expect(jan["Banque A - Courant"]).toBe(6100);
    expect(jan["Banque B - Compte joint"]).toBe(2600);
    expect(jan["Banque C - Compte joint"]).toBe(1500);
    expect(jan["Titres-restaurant"]).toBe(100);
    expect(jan["Total"]).toBe(6100 + 2600 + 1500 + 100);

    const feb = result.current.balancesByMonth["2025-02"];
    expect(feb["Banque A - Courant"]).toBe(6400);
    expect(feb["Titres-restaurant"]).toBe(280);

    // currentBalances = dernier mois (février)
    expect(result.current.currentBalances["Banque A - Courant"]).toBe(6400);
  });
});
