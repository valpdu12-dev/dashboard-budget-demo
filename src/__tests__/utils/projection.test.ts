import { describe, it, expect } from "vitest";
import {
  projectMonthEnd,
  daysInMonthOf,
  lastTxDayOfMonth,
} from "@/utils/projection";
import type { Transaction } from "@/types";

function tx(date: string, monthKey: string): Transaction {
  return {
    compte: "Banque A - Courant", type: "CB", date, montant: 10,
    cat1: "", cat2: "", cat3: "", cat4: "", ville: "",
    dc: "Débit", label: "", monthKey,
  };
}

describe("daysInMonthOf", () => {
  it("renvoie le bon nombre de jours par mois", () => {
    expect(daysInMonthOf("2026-01")).toBe(31);
    expect(daysInMonthOf("2026-06")).toBe(30);
    expect(daysInMonthOf("2026-02")).toBe(28); // 2026 non bissextile
    expect(daysInMonthOf("2024-02")).toBe(29); // 2024 bissextile
  });
});

describe("lastTxDayOfMonth", () => {
  it("renvoie le dernier jour avec transaction du mois ciblé", () => {
    const txs = [tx("2026-06-03", "2026-06"), tx("2026-06-15", "2026-06"), tx("2026-05-28", "2026-05")];
    expect(lastTxDayOfMonth(txs, "2026-06")).toBe(15);
    expect(lastTxDayOfMonth(txs, "2026-05")).toBe(28);
  });

  it("renvoie 0 si aucune transaction sur le mois", () => {
    expect(lastTxDayOfMonth([tx("2026-06-03", "2026-06")], "2026-07")).toBe(0);
  });
});

describe("projectMonthEnd", () => {
  it("extrapole linéairement le net sur le mois complet", () => {
    // 15 jours écoulés sur 30 → facteur 2
    const p = projectMonthEnd(600, 1000, 15, 30);
    expect(p.projectedDep).toBe(1200);
    expect(p.projectedRec).toBe(2000);
    expect(p.projectedNet).toBe(800);
    expect(p.currentNet).toBe(400);
    expect(p.reliable).toBe(true);
  });

  it("net négatif si dépenses projetées > recettes projetées", () => {
    const p = projectMonthEnd(900, 300, 10, 30); // facteur 3
    expect(p.projectedDep).toBe(2700);
    expect(p.projectedRec).toBe(900);
    expect(p.projectedNet).toBe(-1800);
  });

  it("mois complet (daysElapsed === daysInMonth) → non fiable, renvoie le réalisé", () => {
    const p = projectMonthEnd(500, 800, 30, 30);
    expect(p.reliable).toBe(false);
    expect(p.projectedNet).toBe(300);
    expect(p.currentNet).toBe(300);
  });

  it("daysElapsed = 0 → non fiable, pas d'extrapolation", () => {
    const p = projectMonthEnd(100, 200, 0, 30);
    expect(p.reliable).toBe(false);
    expect(p.projectedDep).toBe(100);
    expect(p.projectedRec).toBe(200);
    expect(p.projectedNet).toBe(100);
  });
});
