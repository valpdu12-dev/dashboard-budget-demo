// Sur le fond blanc du mode Jour, on assombrit (jamais blanc sur blanc).
import { describe, it, expect } from "vitest";
import { assombrirPourContraste, contrastRatio, ensureContrast } from "@/utils/contrast";
import { centimesAPart } from "@/utils/telephone";

const BLANC = "#ffffff";
const COULEURS = ["#22c55e", "#10B981", "#f59e0b", "#06b6d4", "#6366f1", "#e67e22", "#00cec9"];

describe("assombrirPourContraste", () => {
  it("rend chaque couleur lisible sur du blanc (4,5:1 au moins)", () => {
    for (const c of COULEURS) {
      const r = assombrirPourContraste(c, BLANC);
      expect(contrastRatio(r, BLANC)!).toBeGreaterThanOrEqual(4.5);
      expect(r).not.toBe("#000000");
    }
  });

  it("laisse une couleur déjà lisible telle quelle", () => {
    expect(assombrirPourContraste("#0f766e", BLANC)).toBe("#0f766e");
  });

  it("contre-épreuve : éclaircir sur du blanc donne du blanc (le piège évité)", () => {
    expect(ensureContrast("#22c55e", BLANC)).toBe("#ffffff");
  });
});

describe("centimesAPart", () => {
  it("sépare les centimes d'un montant en euros, sans rien perdre", () => {
    expect(centimesAPart("10 520,16 €")).toEqual(["10 520", ",16 €"]);
    expect(centimesAPart("-6,10 €")).toEqual(["-6", ",10 €"]);
    const t = "2 938,78 €";
    expect(centimesAPart(t)!.join("")).toBe(t);
  });

  it("laisse entiers les autres textes", () => {
    for (const t of ["332", "83,2 %", "161,7 k€", "—", "Aucun dépassement", "12 €"]) expect(centimesAPart(t)).toBeNull();
  });
});
