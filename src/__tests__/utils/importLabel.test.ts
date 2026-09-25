import { describe, it, expect } from "vitest";
import { fmtImportOrigine } from "@/utils/importLabel";

describe("fmtImportOrigine", () => {
  it("nomme le fichier et la date de l'import", () => {
    expect(fmtImportOrigine("Budget_demo.xlsx", "2026-08-11T18:00:00.000Z"))
      .toBe("les donnees de « Budget_demo.xlsx », importees le 11/08/2026");
  });

  it("se passe du nom de fichier quand il manque", () => {
    expect(fmtImportOrigine(null, "2026-08-11T18:00:00.000Z"))
      .toBe("des donnees importees, importees le 11/08/2026");
  });

  it("se passe de la date quand elle manque", () => {
    // Cas d'un import memorise par une version anterieure du dashboard.
    expect(fmtImportOrigine("Budget_demo.xlsx", null))
      .toBe("les donnees de « Budget_demo.xlsx »");
  });

  it("n'affiche jamais une date invalide", () => {
    expect(fmtImportOrigine("Budget_demo.xlsx", "pas-une-date"))
      .toBe("les donnees de « Budget_demo.xlsx »");
  });
});
