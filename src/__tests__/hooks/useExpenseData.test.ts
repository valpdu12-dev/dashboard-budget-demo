import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useExpenseData } from "@/hooks/useExpenseData";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeConfig } from "../helpers/factories";
import type { Transaction } from "@/types";

// ── Helpers ─────────────────────────────────────────────────────────────

/** Charge les transactions dans le DataStore et configure le FilterStore */
function seedStores(
  transactions: Transaction[],
  overrides?: {
    period?: string;
    selCat2?: string | null;
    selType?: string | null;
    selMonth?: string | null;
    selOrg?: string | null;
    showTransfers?: boolean;
  }
) {
  const cfg = makeConfig();
  useDataStore.getState().setData(transactions, { months: [], cotLast: [], patronLast: [], lastMonth: "" }, cfg);
  if (overrides) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cast partiel volontaire (état de test)
    useFilterStore.setState(overrides as any);
  }
}

// ── Dataset de test ─────────────────────────────────────────────────────

const BASE_TX: Transaction[] = [
  // Janvier 2025 — Alimentation Banque A - Courant
  makeTx({ date: "2025-01-10", montant: 200, dc: "Débit", compte: "Banque A - Courant", cat2: "Alimentation", cat3: "Supermarché Ouest", type: "CB", ville: "Paris", monthKey: "2025-01" }),
  makeTx({ date: "2025-01-15", montant: 100, dc: "Débit", compte: "Banque B - Compte joint", cat2: "Alimentation", cat3: "Supermarché Centre", type: "CB", ville: "Lyon", monthKey: "2025-01" }),
  // Janvier 2025 — Loisirs
  makeTx({ date: "2025-01-20", montant: 50, dc: "Débit", compte: "Banque A - Courant", cat2: "Loisirs", cat3: "Cinéma", type: "CB", ville: "Paris", monthKey: "2025-01" }),
  // Janvier 2025 — Crédit (ne doit PAS être dans les dépenses)
  makeTx({ date: "2025-01-25", montant: 2500, dc: "Crédit", compte: "Banque A - Courant", cat2: "", cat3: "Salaire", type: "Virement", ville: "", monthKey: "2025-01" }),
  // Février 2025
  makeTx({ date: "2025-02-10", montant: 300, dc: "Débit", compte: "Banque A - Courant", cat2: "Logement", cat3: "Loyer", type: "Prélèvement", ville: "Paris", monthKey: "2025-02" }),
  makeTx({ date: "2025-02-15", montant: 80, dc: "Débit", compte: "Banque C - Compte joint", cat2: "Transport", cat3: "Transport urbain", type: "CB", ville: "Paris", monthKey: "2025-02" }),
  // Mars 2025
  makeTx({ date: "2025-03-05", montant: 120, dc: "Débit", compte: "Banque A - Courant", cat2: "Alimentation", cat3: "Supermarché Ouest", type: "CB", ville: "Paris", monthKey: "2025-03" }),
  makeTx({ date: "2025-03-12", montant: 45, dc: "Débit", compte: "Titres-restaurant", cat2: "Alimentation", cat3: "Boulangerie", type: "CB", ville: "Villebourg", monthKey: "2025-03" }),
];

// Données 2024 pour la comparaison N vs N-1
const TX_2024: Transaction[] = [
  makeTx({ date: "2024-01-10", montant: 180, dc: "Débit", compte: "Banque A - Courant", cat2: "Alimentation", cat3: "Supermarché Ouest", type: "CB", ville: "Paris", monthKey: "2024-01" }),
  makeTx({ date: "2024-01-20", montant: 250, dc: "Débit", compte: "Banque A - Courant", cat2: "Logement", cat3: "Loyer", type: "Prélèvement", ville: "Paris", monthKey: "2024-01" }),
];

beforeEach(() => {
  resetAllStores();
});

// ═════════════════════════════════════════════════════════════════════════
// 1. Cas vide
// ═════════════════════════════════════════════════════════════════════════
describe("useExpenseData — sans données", () => {
  it("retourne des tableaux vides quand le store est vide", () => {
    const { result } = renderHook(() => useExpenseData());
    expect(result.current.expMonthlyLines).toEqual([]);
    expect(result.current.expByCat2).toEqual([]);
    expect(result.current.expByType).toEqual([]);
    expect(result.current.detailRows).toEqual([]);
    expect(result.current.detailTotal).toBe(0);
    expect(result.current.topMerchants).toEqual([]);
    expect(result.current.compNvsN1).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. expMonthlyLines (évolution mensuelle par organisme)
// ═════════════════════════════════════════════════════════════════════════
describe("useExpenseData — expMonthlyLines", () => {
  it("crée une ligne par mois dans la plage", () => {
    seedStores(BASE_TX, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    // 3 mois de données
    expect(result.current.expMonthlyLines.length).toBeGreaterThanOrEqual(3);
  });

  it("ventile les montants par organisme (Banque A, Banque B, etc.)", () => {
    seedStores(BASE_TX, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const jan = result.current.expMonthlyLines.find((r) => r.mk === "2025-01");
    expect(jan).toBeDefined();
    if (jan) {
      // Banque A - Courant : 200 (Alimentation) + 50 (Loisirs) = 250 → Banque A
      expect(jan["Banque A"]).toBe(250);
      // Banque B - Compte joint : 100 → Banque B
      expect(jan["Banque B"]).toBe(100);
      expect(jan["Total"]).toBe(350);
    }
  });

  it("ajoute prev_* pour comparaison tooltip (à partir du 2e mois)", () => {
    seedStores(BASE_TX, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const lines = result.current.expMonthlyLines;
    if (lines.length >= 2) {
      expect(lines[1]).toHaveProperty("prev_Total");
      expect(lines[1]["prev_Total"]).toBe(lines[0].Total);
    }
  });

  it("filtre par selCat2 quand défini", () => {
    seedStores(BASE_TX, { period: "all", selCat2: "Alimentation" });
    const { result } = renderHook(() => useExpenseData());
    const jan = result.current.expMonthlyLines.find((r) => r.mk === "2025-01");
    if (jan) {
      // Uniquement Alimentation : 200 (CA) + 100 (Bourso) = 300 Total
      expect(jan["Total"]).toBe(300);
    }
  });

  it("filtre par selType quand défini", () => {
    seedStores(BASE_TX, { period: "all", selType: "Prélèvement" });
    const { result } = renderHook(() => useExpenseData());
    const feb = result.current.expMonthlyLines.find((r) => r.mk === "2025-02");
    if (feb) {
      // Seul le prélèvement du loyer (300) correspond
      expect(feb["Banque A"]).toBe(300);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. expByCat2 (donut par catégorie)
// ═════════════════════════════════════════════════════════════════════════
describe("useExpenseData — expByCat2", () => {
  it("agrège les montants par catégorie, triés desc", () => {
    seedStores(BASE_TX, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const cats = result.current.expByCat2;
    expect(cats.length).toBeGreaterThan(0);
    // Vérifie le tri descendant
    for (let i = 1; i < cats.length; i++) {
      expect(cats[i - 1].value).toBeGreaterThanOrEqual(cats[i].value);
    }
  });

  it("exclut les cat2 vides ou 'x'", () => {
    const tx = [
      makeTx({ date: "2025-01-01", montant: 100, dc: "Débit", cat2: "x", monthKey: "2025-01" }),
      makeTx({ date: "2025-01-02", montant: 200, dc: "Débit", cat2: "", monthKey: "2025-01" }),
      makeTx({ date: "2025-01-03", montant: 300, dc: "Débit", cat2: "Alimentation", monthKey: "2025-01" }),
    ];
    seedStores(tx, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    expect(result.current.expByCat2).toHaveLength(1);
    expect(result.current.expByCat2[0].name).toBe("Alimentation");
  });

  it("ne compte que les débits", () => {
    const tx = [
      makeTx({ date: "2025-01-01", montant: 500, dc: "Crédit", cat2: "Alimentation", monthKey: "2025-01" }),
      makeTx({ date: "2025-01-02", montant: 100, dc: "Débit", cat2: "Alimentation", monthKey: "2025-01" }),
    ];
    seedStores(tx, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    expect(result.current.expByCat2[0].value).toBe(100);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. expByType (bar chart par type)
// ═════════════════════════════════════════════════════════════════════════
describe("useExpenseData — expByType", () => {
  it("agrège par type de dépense, triés desc", () => {
    seedStores(BASE_TX, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const types = result.current.expByType;
    expect(types.length).toBeGreaterThan(0);
    for (let i = 1; i < types.length; i++) {
      expect(types[i - 1].value).toBeGreaterThanOrEqual(types[i].value);
    }
  });

  it("tronque les noms à 40 chars avec fullName complet", () => {
    const longType = "A".repeat(50);
    const tx = [makeTx({ date: "2025-01-01", montant: 100, dc: "Débit", type: longType, monthKey: "2025-01" })];
    seedStores(tx, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const entry = result.current.expByType[0];
    expect(entry.name.length).toBeLessThanOrEqual(40);
    expect(entry.name).toContain("…");
    expect(entry.fullName).toBe(longType);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. detailRows + detailTotal
// ═════════════════════════════════════════════════════════════════════════
describe("useExpenseData — detailRows", () => {
  it("ne contient que les débits", () => {
    seedStores(BASE_TX, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    result.current.detailRows.forEach((r) => {
      // Tous les montants doivent correspondre à des débits originaux
      expect(r.montant).toBeGreaterThan(0);
    });
    // Pas de crédit (2500) dans les détails
    const hasSalary = result.current.detailRows.some((r) => r.label === "Salaire" || r.montant === 2500);
    expect(hasSalary).toBe(false);
  });

  it("detailTotal = somme de tous les montants détail", () => {
    seedStores(BASE_TX, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const expected = result.current.detailRows.reduce((s, r) => s + r.montant, 0);
    expect(result.current.detailTotal).toBe(expected);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 6. topMerchants (Top 10 Cat3)
// ═════════════════════════════════════════════════════════════════════════
describe("useExpenseData — topMerchants", () => {
  it("retourne les marchands triés par montant desc", () => {
    seedStores(BASE_TX, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const merchants = result.current.topMerchants;
    for (let i = 1; i < merchants.length; i++) {
      expect(merchants[i - 1].value).toBeGreaterThanOrEqual(merchants[i].value);
    }
  });

  it("exclut les cat3 vides ou 'x'", () => {
    const tx = [
      makeTx({ date: "2025-01-01", montant: 100, dc: "Débit", cat3: "x", monthKey: "2025-01" }),
      makeTx({ date: "2025-01-02", montant: 200, dc: "Débit", cat3: "", monthKey: "2025-01" }),
      makeTx({ date: "2025-01-03", montant: 300, dc: "Débit", cat3: "Supermarché Ouest", monthKey: "2025-01" }),
    ];
    seedStores(tx, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    expect(result.current.topMerchants).toHaveLength(1);
  });

  it("limite à 10 entrées maximum", () => {
    const tx = Array.from({ length: 15 }, (_, i) =>
      makeTx({ date: "2025-01-01", montant: 100 + i, dc: "Débit", cat3: `Marchand${i}`, monthKey: "2025-01" })
    );
    seedStores(tx, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    expect(result.current.topMerchants.length).toBeLessThanOrEqual(10);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 9. compNvsN1 (comparaison annuelle)
// ═════════════════════════════════════════════════════════════════════════
describe("useExpenseData — compNvsN1", () => {
  it("compare les catégories entre 2025 et 2024", () => {
    seedStores([...BASE_TX, ...TX_2024], { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const comp = result.current.compNvsN1;
    expect(comp.length).toBeGreaterThan(0);

    const alim = comp.find((r) => r.name === "Alimentation");
    expect(alim).toBeDefined();
    if (alim) {
      // 2025 : 200+100+120+45 = 465
      expect(alim["2025"]).toBeGreaterThan(0);
      // 2024 : 180
      expect(alim["2024"]).toBe(180);
    }
  });

  it("ignore une catégorie de N-1 située HORS de la fenêtre comparée", () => {
    // Ce test figurait l'ancien comportement, celui d'avant le 11/08/2026 :
    // il attendait qu'une dépense de mars N-1 apparaisse alors que la période
    // affichée ne couvre que janvier. C'était précisément le défaut — l'année
    // précédente était prise en entier, et la comparaison faussée.
    const tx = [
      makeTx({ date: "2024-03-01", montant: 100, dc: "Débit", cat2: "Santé", cat3: "Pharmacie", type: "CB", monthKey: "2024-03" }),
      makeTx({ date: "2025-01-01", montant: 50, dc: "Débit", cat2: "Alimentation", cat3: "Supermarché Ouest", type: "CB", monthKey: "2025-01" }),
    ];
    seedStores(tx, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    // La fenêtre comparée est « janvier » : mars 2024 n'en fait pas partie.
    expect(result.current.compNvsN1.find((r) => r.name === "Santé")).toBeUndefined();
  });

  it("retient une catégorie de N-1 située DANS la fenêtre comparée", () => {
    const tx = [
      makeTx({ date: "2024-01-05", montant: 100, dc: "Débit", cat2: "Santé", cat3: "Pharmacie", type: "CB", monthKey: "2024-01" }),
      makeTx({ date: "2025-01-01", montant: 50, dc: "Débit", cat2: "Alimentation", cat3: "Supermarché Ouest", type: "CB", monthKey: "2025-01" }),
    ];
    seedStores(tx, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const sante = result.current.compNvsN1.find((r) => r.name === "Santé");
    expect(sante).toBeDefined();
    expect(sante?.["2024"]).toBe(100);
    expect(sante?.["2025"]).toBe(0);
  });

  it("exclut les transferts de la comparaison 2024", () => {
    const txWithTransfer = [
      ...BASE_TX,
      makeTx({ date: "2024-01-10", montant: 500, dc: "Débit", cat2: "Alimentation", type: "Transfert Banque A vers Banque C", monthKey: "2024-01" }),
    ];
    seedStores(txWithTransfer, { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const alim = result.current.compNvsN1.find((r) => r.name === "Alimentation");
    // Le transfert de 500 ne doit PAS être dans 2024 Alimentation
    if (alim) {
      expect(alim["2024"]).toBe(0);
    }
  });

  it("est trié par montant 2025 desc", () => {
    seedStores([...BASE_TX, ...TX_2024], { period: "all" });
    const { result } = renderHook(() => useExpenseData());
    const comp = result.current.compNvsN1;
    for (let i = 1; i < comp.length; i++) {
      expect((comp[i - 1]["2025"] as number)).toBeGreaterThanOrEqual(comp[i]["2025"] as number);
    }
  });
});
