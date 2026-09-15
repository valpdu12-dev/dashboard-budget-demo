// Lot 1.6 — accessibilité. Tests de `utils/contrast.ts`.
//
// Les valeurs de référence ne sont pas inventées : les ratios attendus sont
// ceux relevés par Lighthouse / axe-core sur la mesure du 04/08 (§ 8 de
// AUDIT_MOBILE_A56.md). Si un de ces tests casse, c'est soit la formule qui a
// dérivé, soit un fond de la palette qui a changé — dans les deux cas il faut
// remesurer, pas ajuster le test.
import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  ensureContrast,
  FOND_SURFACE,
} from "@/utils/contrast";

describe("hexToRgb", () => {
  it("lit une notation longue", () => {
    expect(hexToRgb("#111827")).toEqual([17, 24, 39]);
  });

  it("lit une notation courte en la doublant", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
  });

  it("tolère l'absence de dièse et la casse", () => {
    expect(hexToRgb("6B7280")).toEqual([107, 114, 128]);
  });

  it("rejette ce qui n'est pas une couleur hexadécimale", () => {
    expect(hexToRgb("rgb(1,2,3)")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
    expect(hexToRgb("")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("vaut 0 pour le noir et 1 pour le blanc", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 6);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
  });

  it("renvoie null sur une entrée invalide", () => {
    expect(relativeLuminance("nope")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("donne 21 entre noir et blanc", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 4);
  });

  it("est symétrique", () => {
    const a = contrastRatio("#6B7280", "#111827");
    const b = contrastRatio("#111827", "#6B7280");
    expect(a).toBeCloseTo(b as number, 10);
  });

  // Les 4 couples qui faisaient échouer les cartes KPI au relevé du 04/08.
  it.each([
    ["#6366F1", 3.97],
    ["#2563EB", 3.43],
    ["#DC2626", 3.67],
    ["#64748B", 3.72],
  ])("retrouve le ratio mesuré par axe-core pour %s sur surface", (couleur, attendu) => {
    expect(contrastRatio(couleur, FOND_SURFACE) as number).toBeCloseTo(attendu, 1);
  });

  // L'ancienne et la nouvelle valeur de `text-sec`, sur le pire des 3 fonds.
  it("confirme que #6B7280 échouait sur `border` et que #9CA3AF passe", () => {
    expect(contrastRatio("#6B7280", "#1F2937") as number).toBeCloseTo(3.03, 1);
    expect(contrastRatio("#9CA3AF", "#1F2937") as number).toBeGreaterThanOrEqual(4.5);
  });

  it("confirme le conflit indigo : blanc sur #6366F1 échoue, sur #4F46E5 passe", () => {
    expect(contrastRatio("#ffffff", "#6366F1") as number).toBeLessThan(4.5);
    expect(contrastRatio("#ffffff", "#4F46E5") as number).toBeGreaterThanOrEqual(4.5);
  });

  it("confirme que #818CF8 passe en texte sur surface", () => {
    expect(contrastRatio("#818CF8", FOND_SURFACE) as number).toBeGreaterThanOrEqual(4.5);
  });
});

describe("ensureContrast", () => {
  it("laisse intacte une couleur déjà conforme", () => {
    expect(ensureContrast("#E5E7EB", FOND_SURFACE)).toBe("#E5E7EB");
  });

  it.each(["#6366F1", "#2563EB", "#DC2626", "#64748B"])(
    "relève %s jusqu'à 4,5:1 sur surface",
    (couleur) => {
      const corrige = ensureContrast(couleur, FOND_SURFACE);
      expect(corrige).not.toBe(couleur);
      expect(contrastRatio(corrige, FOND_SURFACE) as number).toBeGreaterThanOrEqual(4.5);
    }
  );

  it("garde la teinte dominante — le bleu reste bleu, le rouge reste rouge", () => {
    const bleu = hexToRgb(ensureContrast("#2563EB", FOND_SURFACE)) as number[];
    expect(bleu[2]).toBeGreaterThan(bleu[0]);
    const rouge = hexToRgb(ensureContrast("#DC2626", FOND_SURFACE)) as number[];
    expect(rouge[0]).toBeGreaterThan(rouge[2]);
  });

  it("respecte une cible personnalisée", () => {
    const corrige = ensureContrast("#6366F1", FOND_SURFACE, 7);
    expect(contrastRatio(corrige, FOND_SURFACE) as number).toBeGreaterThanOrEqual(7);
  });

  it("renvoie l'entrée telle quelle si elle n'est pas une couleur exploitable", () => {
    expect(ensureContrast("var(--x)", FOND_SURFACE)).toBe("var(--x)");
    expect(ensureContrast("#2563EB", "pas-une-couleur")).toBe("#2563EB");
  });

  it("ne boucle pas sur une cible inatteignable", () => {
    expect(ensureContrast("#2563EB", "#ffffff", 21)).toBe("#ffffff");
  });
});
