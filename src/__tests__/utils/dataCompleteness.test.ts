import { describe, it, expect } from "vitest";
import { detecterManques, fmtManques } from "@/utils/dataCompleteness";
import type { SourcesDisponibles } from "@/utils/dataCompleteness";
import type { SalaryData, BudgetData } from "@/types";

/**
 * Détection des données manquantes (point ouvert n° 14).
 *
 * Le cas qui a motivé ce module : sans budgets cibles, « Budget mensuel »
 * n'affiche pas des cases vides mais des chiffres FAUX — budget total à 0 €
 * et taux de conformité à 100 % par défaut (`useBudgetData.ts:203`).
 */

const sources = (o: Partial<SourcesDisponibles> = {}): SourcesDisponibles => ({
  salary: null,
  budgets: null,
  ...o,
});

const salaryComplet = {
  months: [], cotLast: [], patronLast: [],
  inflation: [{ year: "2025" }],
  smic: [{ year: "2025" }],
  inflationByCategory: [{ year: "2025" }],
} as unknown as SalaryData;

const budgetsPeuples = { budgets: [{ cat2: "Courses", target: 400, active: true }] } as unknown as BudgetData;

describe("detecterManques", () => {
  it("ne signale rien quand tout est présent", () => {
    const m = detecterManques(
      ["inflation", "smic", "budgets"],
      sources({ salary: salaryComplet, budgets: budgetsPeuples })
    );
    expect(m).toEqual([]);
  });

  it("signale les budgets absents", () => {
    const m = detecterManques(["budgets"], sources({ salary: salaryComplet }));
    expect(m).toHaveLength(1);
    expect(m[0].besoin).toBe("budgets");
  });

  it("traite un tableau VIDE comme manquant", () => {
    // C'est précisément ce que produit le repli `?? []`, et ce que
    // l'utilisateur voit sous forme de tirets ou de zéros.
    const m = detecterManques(["budgets"], sources({ budgets: { budgets: [] } as unknown as BudgetData }));
    expect(m).toHaveLength(1);
  });

  it("ne signale que ce que la page a déclaré attendre", () => {
    // Une page qui n'utilise pas le SMIC ne doit pas s'en plaindre.
    const sansSmic = { ...salaryComplet, smic: [] } as unknown as SalaryData;
    expect(detecterManques(["inflation"], sources({ salary: sansSmic }))).toEqual([]);
    expect(detecterManques(["smic"], sources({ salary: sansSmic }))).toHaveLength(1);
  });

  it("conserve l'ordre déclaré par la page", () => {
    const m = detecterManques(["smic", "inflation"], sources());
    expect(m.map((x) => x.besoin)).toEqual(["smic", "inflation"]);
  });

  it("signale tout quand aucune donnée n'est arrivée", () => {
    const m = detecterManques(["inflation", "smic", "inflationParCategorie", "budgets"], sources());
    expect(m).toHaveLength(4);
  });
});

describe("fmtManques", () => {
  it("rend une chaîne vide quand rien ne manque", () => {
    expect(fmtManques([])).toBe("");
  });

  it("nomme un manque unique", () => {
    const m = detecterManques(["budgets"], sources());
    expect(fmtManques(m)).toBe(
      "Cette page est incomplète : impossible de charger les budgets cibles."
    );
  });

  it("énumère deux manques avec « et »", () => {
    const m = detecterManques(["inflation", "smic"], sources());
    expect(fmtManques(m)).toContain("les indices d'inflation INSEE et l'historique du SMIC");
  });

  it("reste correct avec un libellé pluriel seul en liste", () => {
    // Une formulation a verbe accorde sur le NOMBRE D'ELEMENTS produisait
    // « les budgets cibles n'a pas pu etre charge ». La tournure
    // impersonnelle supprime la question de l'accord.
    const phrase = fmtManques(detecterManques(["budgets"], sources()));
    expect(phrase).not.toMatch(/n'a pas pu/);
    expect(phrase).not.toMatch(/n'ont pas pu/);
  });

  it("énumère trois manques avec des virgules puis « et »", () => {
    const m = detecterManques(["inflation", "smic", "budgets"], sources());
    expect(fmtManques(m)).toContain(
      "les indices d'inflation INSEE, l'historique du SMIC et les budgets cibles"
    );
  });
});
