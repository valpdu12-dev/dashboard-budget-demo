// ── Lot D.9 — l'arrondi au centime du lecteur est celui d'Excel ───────────
//
// Vu sur un vrai classeur : un compte partagé à 50 %, un brut de 4,35 €.
// Excel écrit 2,18 € ; le lecteur calculait 2,17 € et signalait un écart
// d'un centime — à tort.

import { describe, it, expect } from "vitest";
import { arrondir } from "@/services/lectureValeurs";

describe("arrondir — comme ARRONDI(x ; 2) d'Excel", () => {
  it("le cas réel : 4,35 × 50 % donne 2,18 €", () => {
    expect(arrondir(4.35 * 0.5)).toBe(2.18);
  });
  it("les demi-centimes s'éloignent de zéro", () => {
    expect(arrondir(1.005)).toBe(1.01);
    expect(arrondir(9.785)).toBe(9.79);
    expect(arrondir(-2.175)).toBe(-2.18);
  });
  it("les calculs flottants ordinaires restent justes", () => {
    expect(arrondir(0.1 + 0.2)).toBe(0.3);
    expect(arrondir(192.6 * 0.5)).toBe(96.3);
    expect(arrondir(12.344)).toBe(12.34);
    expect(arrondir(-0.004)).toBe(0);
  });
  it("sait échouer : l'ancienne formule donnait bien 2,17 €", () => {
    expect(Math.round(4.35 * 0.5 * 100) / 100).toBe(2.17);
  });
});
