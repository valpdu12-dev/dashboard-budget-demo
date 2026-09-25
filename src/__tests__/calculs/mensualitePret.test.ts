// Lot E.1 — le calcul direct de la mensualité (l'inverse de la recherche de
// taux). Valeurs calculées à la main et écrites en dur : le test ne peut pas
// dériver du code qu'il vérifie.

import { describe, it, expect } from "vitest";
import { mensualiteDepuisTaux } from "@/calculs/calculPret";

describe("mensualiteDepuisTaux", () => {
  it("taux normal : 200 000 € à 3 %/an sur 360 mois → 843,21 €", () => {
    // Valeur de manuel : M = P·r / (1 − (1+r)^−n), r = 0,03/12 = 0,0025.
    expect(mensualiteDepuisTaux(200000, 0.03, 360)).toBeCloseTo(843.21, 2);
  });

  it("taux à 0 % : la mensualité est le montant divisé par la durée", () => {
    // 12 000 € sur 24 mois, sans intérêts → 500 € pile, pas de division par zéro.
    expect(mensualiteDepuisTaux(12000, 0, 24)).toBe(500);
  });

  it("durée d'un mois : la mensualité est le montant plus un mois d'intérêts", () => {
    // n = 1 → M = montant × (1 + r). 1 000 € à 12 %/an (r = 0,01) → 1 010 €.
    expect(mensualiteDepuisTaux(1000, 0.12, 1)).toBe(1010);
  });
});
