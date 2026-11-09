// DM-01 (A7) — export CSV sans injection de formule.
import { describe, it, expect } from "vitest";
import { celluleCsv } from "@/utils/csv";

const S = ";";

describe("celluleCsv (DM-01 A7)", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ["+33 6 00", "'+33 6 00"],
    ["-remise", "'-remise"],
    ["@SOMME(A1)", "'@SOMME(A1)"],
    ["\tcaché", "'\tcaché"],
  ])("neutralise un texte qui commence par une formule : %j", (entree, attendu) => {
    expect(celluleCsv(entree, S)).toBe(attendu);
  });

  it("met entre guillemets après neutralisation si besoin", () => {
    expect(celluleCsv('=HYPERLINK("http://x";"clic")', S)).toBe(`"'=HYPERLINK(""http://x"";""clic"")"`);
  });

  it("ne touche pas aux nombres, même négatifs", () => {
    expect(celluleCsv(-42.5, S)).toBe("-42.5");
    expect(celluleCsv(0, S)).toBe("0");
  });

  it("laisse les textes ordinaires tels quels", () => {
    expect(celluleCsv("Courses", S)).toBe("Courses");
    expect(celluleCsv("2026-03-15", S)).toBe("2026-03-15");
    expect(celluleCsv("a=b", S)).toBe("a=b");
    expect(celluleCsv(null, S)).toBe("");
    expect(celluleCsv(undefined, S)).toBe("");
  });

  it("garde les guillemets pour le séparateur, les guillemets et les retours à la ligne", () => {
    expect(celluleCsv("a;b", S)).toBe('"a;b"');
    expect(celluleCsv('dit "oui"', S)).toBe('"dit ""oui"""');
    expect(celluleCsv("l1\nl2", S)).toBe('"l1\nl2"');
  });
});
