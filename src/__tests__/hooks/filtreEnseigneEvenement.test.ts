import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useExpenseData } from "@/hooks/useExpenseData";
import { filtrerDonnees, garderCategories } from "@/calculs/filtrerDonnees";
import { construireRegles } from "@/calculs/regles";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeConfig } from "../helpers/factories";
import type { Transaction } from "@/types";

/**
 * Filtres « Enseigne » (cat3) et « Événement » (cat4) de la page Dépenses.
 * Repris du site privé (20/10/2026), avec des noms inventés.
 *
 * Jeu : 2025 (janv. → mars) + 2024 pour la comparaison N / N-1.
 *   - Primeur : 40 + 60 (dont 60 dans « Vacances d'été ») + 30 en 2024
 *   - Parking : 25 (« Vacances d'été ») + 15 en 2024
 *   - PARKING : 10 — écrit autrement, NE doit PAS être regroupé avec « Parking »
 *   - Pharmacie : 20 (Santé)
 */
const TX: Transaction[] = [
  makeTx({ date: "2025-01-10", montant: 40, cat2: "Alimentation", cat3: "Primeur", cat4: "" }),
  makeTx({ date: "2025-02-12", montant: 60, cat2: "Alimentation", cat3: "Primeur", cat4: "Vacances d'été" }),
  makeTx({ date: "2025-02-13", montant: 25, cat2: "Transport", cat3: "Parking", cat4: "Vacances d'été" }),
  makeTx({ date: "2025-03-01", montant: 10, cat2: "Transport", cat3: "PARKING", cat4: "x" }),
  makeTx({ date: "2025-03-05", montant: 20, cat2: "Santé", cat3: "Pharmacie", cat4: "" }),
  makeTx({ date: "2024-02-10", montant: 30, cat2: "Alimentation", cat3: "Primeur", cat4: "" }),
  makeTx({ date: "2024-02-11", montant: 15, cat2: "Transport", cat3: "Parking", cat4: "" }),
];

const somme = (tx: { montant: number }[]) => tx.reduce((s, t) => s + t.montant, 0);

beforeEach(() => {
  resetAllStores();
  useDataStore.getState().setData(TX, { months: [], cotLast: [], patronLast: [], lastMonth: "" }, makeConfig());
});

describe("garderCategories — fonction pure partagée", () => {
  it("listes vides : rend le tableau tel quel (même référence)", () => {
    expect(garderCategories(TX, [], [])).toBe(TX);
  });

  it("OU dans une liste, ET entre les listes", () => {
    const r = garderCategories(TX, ["Primeur", "Parking"], ["Vacances d'été"]);
    expect(r.map((t) => t.montant)).toEqual([60, 25]);
  });

  it("filtrerDonnees reste pure : même entrée, même sortie, entrée intacte", () => {
    const copie = JSON.stringify(TX);
    const f = {
      period: "all" as const, cat1Filter: "all", showTransfers: false,
      selMonth: null, selCat2: null, selType: null, selOrg: null,
      selEnseignes: ["Primeur"], selEvenements: [],
    };
    const R = construireRegles(makeConfig());
    const a = filtrerDonnees(TX, f, R);
    const b = filtrerDonnees(TX, f, R);
    expect(somme(a.filteredTx)).toBe(130);
    expect(a).toEqual(b);
    expect(JSON.stringify(TX)).toBe(copie);
  });
});

describe("filteredTx — Enseigne / Événement", () => {
  it("sans choix, toute la période YTD 2025 est gardée", () => {
    const { result } = renderHook(() => useFilteredData());
    expect(somme(result.current.filteredTx)).toBe(155);
  });

  it("Enseigne = Primeur → 40 + 60 = 100", () => {
    useFilterStore.getState().setSelEnseignes(["Primeur"]);
    const { result } = renderHook(() => useFilteredData());
    expect(somme(result.current.filteredTx)).toBe(100);
  });

  it("Événement = Vacances d'été → 60 + 25 = 85", () => {
    useFilterStore.getState().setSelEvenements(["Vacances d'été"]);
    const { result } = renderHook(() => useFilteredData());
    expect(somme(result.current.filteredTx)).toBe(85);
  });

  it("comparaison exacte : « Parking » ne ramène pas « PARKING »", () => {
    useFilterStore.getState().setSelEnseignes(["Parking"]);
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.filteredTx.map((t) => t.montant)).toEqual([25]);
  });

  it("les deux filtres se cumulent (ET) : Primeur + Vacances d'été → 60", () => {
    useFilterStore.setState({ selEnseignes: ["Primeur"], selEvenements: ["Vacances d'été"] });
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.filteredTx.map((t) => t.montant)).toEqual([60]);
  });

  it("se cumulent aussi avec les filtres existants (mois, Cat2)", () => {
    useFilterStore.setState({ selEvenements: ["Vacances d'été"], selCat2: "Transport" });
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.filteredTx.map((t) => t.montant)).toEqual([25]);

    useFilterStore.setState({ selCat2: null, selMonth: "2025-01" });
    const { result: r2 } = renderHook(() => useFilteredData());
    expect(r2.current.filteredTx).toEqual([]);
  });

  it("ne touche pas baseTx (les autres pages ne changent pas)", () => {
    useFilterStore.getState().setSelEnseignes(["Pharmacie"]);
    const { result } = renderHook(() => useFilteredData());
    expect(somme(result.current.baseTx)).toBe(155);
    expect(somme(result.current.filteredTx)).toBe(20);
  });
});

describe("useExpenseData — blocs qui refont leur propre filtre", () => {
  it("bloc 1 « Évolution mensuelle » suit l'enseigne", () => {
    useFilterStore.getState().setSelEnseignes(["Primeur"]);
    const { result } = renderHook(() => useExpenseData());
    const totaux = result.current.expMonthlyLines.map((r) => [r.mk, r.Total]);
    expect(totaux).toEqual([["2025-01", 40], ["2025-02", 60], ["2025-03", 0]]);
  });

  it("bloc 1 suit l'événement", () => {
    useFilterStore.getState().setSelEvenements(["Vacances d'été"]);
    const { result } = renderHook(() => useExpenseData());
    expect(result.current.expMonthlyLines.find((r) => r.mk === "2025-02")?.Total).toBe(85);
    expect(result.current.expMonthlyLines.find((r) => r.mk === "2025-01")?.Total).toBe(0);
  });

  it("bloc 8 « N vs N-1 » : l'année N-1 suit aussi l'enseigne", () => {
    useFilterStore.getState().setSelEnseignes(["Primeur"]);
    const { result } = renderHook(() => useExpenseData());
    const ali = result.current.compNvsN1.find((r) => r.name === "Alimentation");
    expect(ali?.["2025"]).toBe(100);
    expect(ali?.["2024"]).toBe(30);
    // Transport 2024 = Parking, pas Primeur : absent.
    expect(result.current.compNvsN1.find((r) => r.name === "Transport")).toBeUndefined();
  });

  it("bloc 8 : l'année N-1 suit aussi l'événement", () => {
    useFilterStore.getState().setSelEvenements(["Vacances d'été"]);
    const { result } = renderHook(() => useExpenseData());
    const tr = result.current.compNvsN1.find((r) => r.name === "Transport");
    expect(tr?.["2025"]).toBe(25);
    expect(tr?.["2024"]).toBe(0); // le Parking 2024 n'a pas d'événement
  });

  it("le tableau « Détail » porte la colonne Événement (cat4)", () => {
    useFilterStore.getState().setSelEvenements(["Vacances d'été"]);
    const { result } = renderHook(() => useExpenseData());
    expect(result.current.detailRows.map((r) => [r.cat3, r.cat4])).toEqual([
      ["Primeur", "Vacances d'été"],
      ["Parking", "Vacances d'été"],
    ]);
  });

  it("Top 10 enseignes suit le filtre Événement", () => {
    useFilterStore.getState().setSelEvenements(["Vacances d'été"]);
    const { result } = renderHook(() => useExpenseData());
    expect(result.current.topMerchants.map((t) => t.name)).toEqual(["Primeur", "Parking"]);
  });
});

describe("Effacer tout", () => {
  it("clearDepFilters vide aussi Enseigne et Événement", () => {
    useFilterStore.setState({ selEnseignes: ["Pharmacie"], selEvenements: ["Vacances d'été"], selCat2: "Santé" });
    useFilterStore.getState().clearDepFilters();
    const s = useFilterStore.getState();
    expect([s.selEnseignes, s.selEvenements, s.selCat2]).toEqual([[], [], null]);
  });

  it("clearAllFilters vide aussi Enseigne et Événement", () => {
    useFilterStore.setState({ selEnseignes: ["Pharmacie"], selEvenements: ["Vacances d'été"] });
    useFilterStore.getState().clearAllFilters();
    const s = useFilterStore.getState();
    expect([s.selEnseignes, s.selEvenements]).toEqual([[], []]);
  });

  it("listes vides par défaut", () => {
    const s = useFilterStore.getState();
    expect([s.selEnseignes, s.selEvenements]).toEqual([[], []]);
  });
});

describe("choix multiples (OU dans une liste, ET entre les listes)", () => {
  it("Primeur + Pharmacie → 40 + 60 + 20 = 120", () => {
    useFilterStore.getState().setSelEnseignes(["Primeur", "Pharmacie"]);
    const { result } = renderHook(() => useFilteredData());
    expect(somme(result.current.filteredTx)).toBe(120);
  });

  it("Primeur + Parking, ET Vacances d'été → 60 + 25 = 85", () => {
    useFilterStore.setState({ selEnseignes: ["Primeur", "Parking"], selEvenements: ["Vacances d'été"] });
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.filteredTx.map((t) => t.montant)).toEqual([60, 25]);
  });

  it("deux événements cochés → l'un OU l'autre", () => {
    useFilterStore.getState().setSelEvenements(["Vacances d'été", "x"]);
    const { result } = renderHook(() => useFilteredData());
    expect(somme(result.current.filteredTx)).toBe(95);
  });

  it("bloc 1 suit plusieurs enseignes", () => {
    useFilterStore.getState().setSelEnseignes(["Primeur", "Pharmacie"]);
    const { result } = renderHook(() => useExpenseData());
    expect(result.current.expMonthlyLines.map((r) => r.Total)).toEqual([40, 60, 20]);
  });

  it("bloc 8 : N et N-1 suivent plusieurs enseignes", () => {
    useFilterStore.getState().setSelEnseignes(["Primeur", "Parking"]);
    const { result } = renderHook(() => useExpenseData());
    const tr = result.current.compNvsN1.find((r) => r.name === "Transport");
    expect([tr?.["2025"], tr?.["2024"]]).toEqual([25, 15]);
    const ali = result.current.compNvsN1.find((r) => r.name === "Alimentation");
    expect([ali?.["2025"], ali?.["2024"]]).toEqual([100, 30]);
  });
});
