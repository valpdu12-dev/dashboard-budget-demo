import { describe, it, expect } from "vitest";
import { fmtAxe } from "@/utils/axeEuros";
import { fmtShort } from "@/utils/formatters";

// Points ouverts Patrimoine (29/10/2026) : l'axe vertical tient sur une ligne.
const NBSP = "\u00a0";

describe("fmtAxe — axe vertical en euros, sur une ligne", () => {
  it("sous 1 000 € : sans centimes, espace insécable avant €", () => {
    expect(fmtAxe(700)).toBe(`700${NBSP}€`);
    expect(fmtAxe(350)).toBe(`350${NBSP}€`);
    expect(fmtAxe(0)).toBe(`0${NBSP}€`);
    expect(fmtAxe(175.5)).toBe(`176${NBSP}€`);
  });
  it("négatif : signe moins typographique, comme fmt", () => {
    expect(fmtAxe(-350)).toBe(`−350${NBSP}€`);
    expect(fmtAxe(-0.4)).toBe(`0${NBSP}€`);
  });
  it("à partir de 1 000 € : même texte que fmtShort, espaces insécables", () => {
    expect(fmtAxe(1400)).toBe(`1,4${NBSP}k€`);
    expect(fmtAxe(-1400)).toBe(fmtShort(-1400).replace(/ /g, NBSP));
    expect(fmtAxe(2500000)).toBe(`2,5${NBSP}M€`);
  });
  it("aucune espace ordinaire : Recharts ne peut pas couper l'étiquette", () => {
    for (const v of [0, 1, 99.99, 700, -350, 999, 1000, 65000, -1400, 1e6]) {
      expect(fmtAxe(v)).not.toMatch(/ /);
    }
  });
  it("valeur non finie : 0 €", () => {
    expect(fmtAxe(Number.NaN)).toBe(`0${NBSP}€`);
  });
});
