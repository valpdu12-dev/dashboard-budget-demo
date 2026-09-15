import { describe, it, expect } from "vitest";
import { partDuTotal } from "@/utils/formatters";

/**
 * Part affichée dans la légende du donut « Répartition par Catégorie ».
 *
 * Elle existe parce que Recharts ne peut pas afficher d'infobulle au doigt sur
 * un PieChart (constaté sur A56 le 11/08/2026, cause lue dans
 * `generateCategoricalChart.js:1684`) : l'information est écrite en clair.
 */
describe("partDuTotal", () => {
  it("rend un pourcentage entier suivi du symbole", () => {
    expect(partDuTotal(320, 1000)).toBe("32 %");
  });

  it("arrondit au plus proche", () => {
    expect(partDuTotal(1, 3)).toBe("33 %");
    expect(partDuTotal(2, 3)).toBe("67 %");
  });

  it("rend 100 % pour la totalité", () => {
    expect(partDuTotal(500, 500)).toBe("100 %");
  });

  it("rend un tiret plutôt qu'un zéro inventé quand le total est nul", () => {
    expect(partDuTotal(0, 0)).toBe("—");
  });

  it("rend un tiret sur un total négatif ou absurde", () => {
    expect(partDuTotal(10, -50)).toBe("—");
  });

  it("ne laisse jamais fuir NaN dans l'interface", () => {
    expect(partDuTotal(NaN, 100)).toBe("—");
    expect(partDuTotal(10, NaN)).toBe("—");
    expect(partDuTotal(10, Infinity)).toBe("—");
  });
});
