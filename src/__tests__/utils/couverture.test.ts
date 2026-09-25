import { describe, it, expect } from "vitest";
import { moisComparables, moisEntre, decalerMois } from "@/utils/couverture";

/**
 * Couverture temporelle (lot 0, étape 0.5).
 *
 * Règle et justification : docs/CONTRAT_COUVERTURE.md. Ces tests fixent les
 * cas limites, qui sont l'essentiel du sujet : c'est aux bords que la
 * distinction entre « mois sans dépense » et « mois non couvert » se joue.
 */

describe("decalerMois", () => {
  it("avance et recule dans le même mois", () => {
    expect(decalerMois("2025-03", 1)).toBe("2025-04");
    expect(decalerMois("2025-03", -1)).toBe("2025-02");
  });

  it("franchit les fins d'année", () => {
    expect(decalerMois("2025-12", 1)).toBe("2026-01");
    expect(decalerMois("2025-01", -1)).toBe("2024-12");
    expect(decalerMois("2025-06", -18)).toBe("2023-12");
  });
});

describe("moisEntre", () => {
  it("rend les mois du calendrier, bornes incluses", () => {
    expect(moisEntre("2025-11", "2026-02")).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02",
    ]);
  });

  it("rend un seul mois quand les bornes sont égales", () => {
    expect(moisEntre("2025-05", "2025-05")).toEqual(["2025-05"]);
  });

  it("rend une liste vide si les bornes sont inversées ou absentes", () => {
    expect(moisEntre("2025-06", "2025-03")).toEqual([]);
    expect(moisEntre("", "2025-03")).toEqual([]);
  });
});

describe("moisComparables — couverture inférée (format actuel)", () => {
  it("ne rend rien sans aucune donnée", () => {
    expect(moisComparables([])).toEqual([]);
  });

  it("ne rend rien avec un seul mois : c'est les deux bornes à la fois", () => {
    expect(moisComparables(["2025-04"])).toEqual([]);
  });

  it("ne rend rien avec deux mois : deux bornes, rien entre", () => {
    expect(moisComparables(["2025-04", "2025-05"])).toEqual([]);
  });

  it("rend le mois du milieu avec trois mois", () => {
    expect(moisComparables(["2025-04", "2025-05", "2025-06"])).toEqual(["2025-05"]);
  });

  it("rend les mois du calendrier, y compris ceux sans aucune transaction", () => {
    // Rien en mars : c'est un mois couvert à 0 €, pas un mois absent.
    expect(moisComparables(["2025-01", "2025-02", "2025-04", "2025-05"])).toEqual([
      "2025-02", "2025-03", "2025-04",
    ]);
  });

  it("franchit les fins d'année", () => {
    expect(moisComparables(["2025-11", "2025-12", "2026-01", "2026-02"])).toEqual([
      "2025-12", "2026-01",
    ]);
  });

  it("exclut toujours le dernier mois — donc le mois en cours", () => {
    const mois = ["2026-07", "2026-08", "2026-09"];
    expect(moisComparables(mois)).not.toContain("2026-09");
  });
});

describe("moisComparables — bornes déclarées (lot B)", () => {
  it("garde les mois de bord quand ils sont entiers", () => {
    expect(
      moisComparables([], { debut: "2025-03-01", fin: "2025-05-31" })
    ).toEqual(["2025-03", "2025-04", "2025-05"]);
  });

  it("écarte un premier mois entamé en cours de route", () => {
    expect(
      moisComparables([], { debut: "2025-03-17", fin: "2025-05-31" })
    ).toEqual(["2025-04", "2025-05"]);
  });

  it("écarte un dernier mois inachevé", () => {
    expect(
      moisComparables([], { debut: "2025-03-01", fin: "2025-05-12" })
    ).toEqual(["2025-03", "2025-04"]);
  });

  it("tient compte des mois courts et des années bissextiles", () => {
    expect(
      moisComparables([], { debut: "2024-02-01", fin: "2024-02-29" })
    ).toEqual(["2024-02"]);
    // 2025 n'est pas bissextile : le 29 février n'existe pas, le 28 clôt le mois.
    expect(
      moisComparables([], { debut: "2025-02-01", fin: "2025-02-28" })
    ).toEqual(["2025-02"]);
  });

  it("ne rend rien si la déclaration ne couvre aucun mois entier", () => {
    expect(
      moisComparables([], { debut: "2025-03-10", fin: "2025-04-20" })
    ).toEqual([]);
  });

  it("prime sur les dates des transactions", () => {
    // Les transactions s'arrêtent en avril, mais le relevé couvre jusqu'en juin :
    // mai et juin sont des mois à 0 €, pas des mois absents.
    expect(
      moisComparables(["2025-03", "2025-04"], { debut: "2025-03-01", fin: "2025-06-30" })
    ).toEqual(["2025-03", "2025-04", "2025-05", "2025-06"]);
  });
});
