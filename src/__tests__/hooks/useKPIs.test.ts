import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKPIs } from "@/hooks/useKPIs";
import { makeTx, makeSalaryMonth } from "../helpers/factories";

const EMPTY_BALANCES: Record<string, Record<string, number>> = {};

describe("useKPIs — sans données", () => {
  it("retourne des zéros quand currentMonth est null", () => {
    const { result } = renderHook(() =>
      useKPIs([], EMPTY_BALANCES, [], null, null)
    );
    expect(result.current.depCur).toBe(0);
    expect(result.current.recCur).toBe(0);
    expect(result.current.netMonth).toBe(0);
    expect(result.current.lastSal).toBeNull();
    // `null` et non 0 : sans mois courant, rien n'est calculable. Un 0 %
    // affirmerait que la personne n'épargne rien.
    expect(result.current.tauxEpargne).toBeNull();
  });
});

describe("useKPIs — dépenses et recettes", () => {
  const txs = [
    makeTx({ date: "2025-03-01", montant: 500,  dc: "Débit",  monthKey: "2025-03" }),
    makeTx({ date: "2025-03-02", montant: 200,  dc: "Débit",  monthKey: "2025-03" }),
    makeTx({ date: "2025-03-03", montant: 2500, dc: "Crédit", monthKey: "2025-03", type: "Virement" }),
    // Mois précédent
    makeTx({ date: "2025-02-01", montant: 400,  dc: "Débit",  monthKey: "2025-02" }),
    makeTx({ date: "2025-02-28", montant: 2500, dc: "Crédit", monthKey: "2025-02", type: "Virement" }),
    // Transfert (doit être exclu)
    makeTx({ date: "2025-03-05", montant: 500,  dc: "Débit",  monthKey: "2025-03", type: "Transfert Banque A vers Banque C" }),
  ];

  it("calcule correctement depCur (hors transferts)", () => {
    const { result } = renderHook(() =>
      useKPIs(txs, EMPTY_BALANCES, [], "2025-03", "2025-02")
    );
    expect(result.current.depCur).toBe(700); // 500 + 200, pas le transfert
  });

  it("calcule correctement recCur", () => {
    const { result } = renderHook(() =>
      useKPIs(txs, EMPTY_BALANCES, [], "2025-03", "2025-02")
    );
    expect(result.current.recCur).toBe(2500);
  });

  it("calcule netMonth = recCur - depCur", () => {
    const { result } = renderHook(() =>
      useKPIs(txs, EMPTY_BALANCES, [], "2025-03", "2025-02")
    );
    expect(result.current.netMonth).toBe(1800); // 2500 - 700
  });

  it("calcule depPrev du mois précédent", () => {
    const { result } = renderHook(() =>
      useKPIs(txs, EMPTY_BALANCES, [], "2025-03", "2025-02")
    );
    expect(result.current.depPrev).toBe(400);
  });
});

describe("useKPIs — soldes", () => {
  it("retourne les soldes du mois courant et précédent", () => {
    const balances = {
      "2025-02": { "Banque A - Courant": 4000, "Banque C - Compte joint": 1500 },
      "2025-03": { "Banque A - Courant": 4500, "Banque C - Compte joint": 1600 },
    };
    const { result } = renderHook(() =>
      useKPIs([], balances, [], "2025-03", "2025-02")
    );
    expect(result.current.curBal["Banque A - Courant"]).toBe(4500);
    expect(result.current.prevBal["Banque A - Courant"]).toBe(4000);
  });

  it("retourne {} quand mois introuvable dans balances", () => {
    const { result } = renderHook(() =>
      useKPIs([], EMPTY_BALANCES, [], "2025-03", "2025-02")
    );
    expect(result.current.curBal).toEqual({});
    expect(result.current.prevBal).toEqual({});
  });
});

describe("useKPIs — salaires", () => {
  const salaryMonths = [
    makeSalaryMonth({ mk: "2025-01", net: 2700 }),
    makeSalaryMonth({ mk: "2025-02", net: 2800 }),
    makeSalaryMonth({ mk: "2025-03", net: 2900 }),
  ];

  it("identifie le dernier salaire et le précédent", () => {
    const { result } = renderHook(() =>
      useKPIs([], EMPTY_BALANCES, salaryMonths, "2025-03", "2025-02")
    );
    expect(result.current.lastSal?.mk).toBe("2025-03");
    expect(result.current.prevSal?.mk).toBe("2025-02");
  });

  it("calcule le taux d'épargne correctement", () => {
    const txs = [makeTx({ date: "2025-03-01", montant: 1000, dc: "Débit", monthKey: "2025-03" })];
    const { result } = renderHook(() =>
      useKPIs(txs, EMPTY_BALANCES, salaryMonths, "2025-03", "2025-02")
    );
    // tauxEpargne = (net - depCur) / net = (2900 - 1000) / 2900
    expect(result.current.tauxEpargne).toBeCloseTo(1900 / 2900, 5);
  });
});

describe("useKPIs — ratio fixe/occasionnel", () => {
  it("sépare correctement fixe et occ", () => {
    const txs = [
      makeTx({ date: "2025-03-01", montant: 800, dc: "Débit", cat1: "Dépense Fixe", monthKey: "2025-03" }),
      makeTx({ date: "2025-03-02", montant: 150, dc: "Débit", cat1: "Dépense Courante", monthKey: "2025-03" }),
      makeTx({ date: "2025-03-03", montant: 50,  dc: "Débit", cat1: "Dépense Occasionnelle", monthKey: "2025-03" }),
    ];
    const { result } = renderHook(() =>
      useKPIs(txs, EMPTY_BALANCES, [], "2025-03", null)
    );
    expect(result.current.fixe).toBe(800);
    expect(result.current.occ).toBe(200); // 150 + 50
  });
});

describe("taux d'épargne — sans feuille de paie", () => {
  it("rend null plutôt que 0 %", () => {
    // Constaté le 16/09/2026 sur un fichier importé sans paie : l'écran
    // annonçait « 0,0 % », une affirmation fausse là où il n'y a rien à dire.
    const tx = [makeTx({ date: "2026-01-05", montant: 100, dc: "Débit" })];
    const { result } = renderHook(() =>
      useKPIs(tx, {}, [], "2026-01", null)
    );
    expect(result.current.tauxEpargne).toBeNull();
  });
});
