import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInsights } from "@/hooks/useInsights";
import { makeTx } from "../helpers/factories";
import { poserReglesDemo } from "../helpers/poserRegles";

// Les règles viennent du store depuis le lot C.4 : ce test déclare celles de
// la démonstration, dont il vérifie précisément le comportement.
beforeEach(() => {
  poserReglesDemo();
});

describe("useInsights — sans données", () => {
  it("retourne des tableaux vides si currentMonth est null", () => {
    const { result } = renderHook(() => useInsights([], null, null));
    expect(result.current.hausse).toEqual([]);
    expect(result.current.baisse).toEqual([]);
    expect(result.current.recurring).toEqual([]);
  });
});

describe("useInsights — hausses et baisses", () => {
  const txs = [
    // Mars courant
    makeTx({ date: "2025-03-01", cat2: "Alimentation", montant: 400, dc: "Débit", monthKey: "2025-03" }),
    makeTx({ date: "2025-03-02", cat2: "Transport",    montant: 50,  dc: "Débit", monthKey: "2025-03" }),
    makeTx({ date: "2025-03-03", cat2: "Loisirs",      montant: 80,  dc: "Débit", monthKey: "2025-03" }),
    // Février précédent
    makeTx({ date: "2025-02-01", cat2: "Alimentation", montant: 200, dc: "Débit", monthKey: "2025-02" }),
    makeTx({ date: "2025-02-02", cat2: "Transport",    montant: 100, dc: "Débit", monthKey: "2025-02" }),
    makeTx({ date: "2025-02-03", cat2: "Loisirs",      montant: 120, dc: "Débit", monthKey: "2025-02" }),
    // Crédit — doit être ignoré
    makeTx({ date: "2025-03-04", cat2: "Salaire",      montant: 2500, dc: "Crédit", monthKey: "2025-03" }),
  ];

  it("détecte Alimentation comme hausse (200 → 400)", () => {
    const { result } = renderHook(() => useInsights(txs, "2025-03", "2025-02"));
    const alimentation = result.current.hausse.find((h) => h.cat === "Alimentation");
    expect(alimentation).toBeDefined();
    expect(alimentation!.diff).toBe(200);
  });

  it("détecte Transport et Loisirs comme baisses", () => {
    const { result } = renderHook(() => useInsights(txs, "2025-03", "2025-02"));
    const cats = result.current.baisse.map((b) => b.cat);
    expect(cats).toContain("Transport");
    expect(cats).toContain("Loisirs");
  });

  it("trie les hausses par diff décroissant", () => {
    const { result } = renderHook(() => useInsights(txs, "2025-03", "2025-02"));
    const diffs = result.current.hausse.map((h) => h.diff);
    expect(diffs).toEqual([...diffs].sort((a, b) => b - a));
  });

  it("limite à 3 hausses et 3 baisses", () => {
    const extra = [
      makeTx({ date: "2025-03-05", cat2: "Cat4", montant: 50,  dc: "Débit", monthKey: "2025-03" }),
      makeTx({ date: "2025-03-06", cat2: "Cat5", montant: 60,  dc: "Débit", monthKey: "2025-03" }),
      makeTx({ date: "2025-02-05", cat2: "Cat4", montant: 10,  dc: "Débit", monthKey: "2025-02" }),
      makeTx({ date: "2025-02-06", cat2: "Cat5", montant: 10,  dc: "Débit", monthKey: "2025-02" }),
    ];
    const { result } = renderHook(() => useInsights([...txs, ...extra], "2025-03", "2025-02"));
    expect(result.current.hausse.length).toBeLessThanOrEqual(3);
    expect(result.current.baisse.length).toBeLessThanOrEqual(3);
  });

  it("ignore les cat2 vides ou 'x'", () => {
    const txsWithX = [
      ...txs,
      makeTx({ date: "2025-03-07", cat2: "x",  montant: 999, dc: "Débit", monthKey: "2025-03" }),
      makeTx({ date: "2025-03-08", cat2: "",   montant: 999, dc: "Débit", monthKey: "2025-03" }),
    ];
    const { result } = renderHook(() => useInsights(txsWithX, "2025-03", "2025-02"));
    const allCats = [...result.current.hausse, ...result.current.baisse].map((i) => i.cat);
    expect(allCats).not.toContain("x");
    expect(allCats).not.toContain("");
  });

  it("exclut les transferts", () => {
    const withTransfer = [
      ...txs,
      makeTx({ date: "2025-03-09", cat2: "Trans", montant: 999, dc: "Débit",
               type: "Transfert Banque A vers Banque C", monthKey: "2025-03" }),
    ];
    const { result } = renderHook(() => useInsights(withTransfer, "2025-03", "2025-02"));
    const cats = [...result.current.hausse, ...result.current.baisse].map((i) => i.cat);
    expect(cats).not.toContain("Trans");
  });
});

describe("useInsights — récurrents", () => {
  it("détecte un paiement récurrent sur 3+ mois", () => {
    const txs = [
      makeTx({ date: "2025-01-01", cat3: "Abonnement vidéo", montant: 13.99, dc: "Débit", monthKey: "2025-01" }),
      makeTx({ date: "2025-02-01", cat3: "Abonnement vidéo", montant: 13.99, dc: "Débit", monthKey: "2025-02" }),
      makeTx({ date: "2025-03-01", cat3: "Abonnement vidéo", montant: 13.99, dc: "Débit", monthKey: "2025-03" }),
    ];
    const { result } = renderHook(() => useInsights(txs, "2025-03", "2025-02"));
    const abonnement = result.current.recurring.find((r) => r.name === "Abonnement vidéo");
    expect(abonnement).toBeDefined();
    expect(abonnement!.montant).toBe(13.99);
    expect(abonnement!.freq).toBe("3 mois");
  });

  it("n'inclut pas un paiement présent sur 2 mois seulement", () => {
    const txs = [
      makeTx({ date: "2025-02-01", cat3: "Gym", montant: 30, dc: "Débit", monthKey: "2025-02" }),
      makeTx({ date: "2025-03-01", cat3: "Gym", montant: 30, dc: "Débit", monthKey: "2025-03" }),
    ];
    const { result } = renderHook(() => useInsights(txs, "2025-03", "2025-02"));
    const gym = result.current.recurring.find((r) => r.name === "Gym");
    expect(gym).toBeUndefined();
  });

  it("ignore les récurrents avec cat3 vide ou 'x'", () => {
    const txs = [
      makeTx({ date: "2025-01-01", cat3: "x", montant: 50, dc: "Débit", monthKey: "2025-01" }),
      makeTx({ date: "2025-02-01", cat3: "x", montant: 50, dc: "Débit", monthKey: "2025-02" }),
      makeTx({ date: "2025-03-01", cat3: "x", montant: 50, dc: "Débit", monthKey: "2025-03" }),
    ];
    const { result } = renderHook(() => useInsights(txs, "2025-03", "2025-02"));
    const xItem = result.current.recurring.find((r) => r.name === "x");
    expect(xItem).toBeUndefined();
  });

  it("limite les récurrents à 10", () => {
    const txs: ReturnType<typeof makeTx>[] = [];
    for (let i = 0; i < 15; i++) {
      ["2025-01", "2025-02", "2025-03"].forEach((mk) => {
        txs.push(makeTx({ date: mk + "-01", cat3: `Sub${i}`, montant: i + 1, dc: "Débit", monthKey: mk }));
      });
    }
    const { result } = renderHook(() => useInsights(txs, "2025-03", "2025-02"));
    expect(result.current.recurring.length).toBeLessThanOrEqual(10);
  });
});
