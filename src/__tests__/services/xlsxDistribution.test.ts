import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

/**
 * SheetJS ne publie plus sur le registre npm. La dernière version qui s'y
 * trouve est la 0.18.5, et SheetJS la qualifie lui-même de périmée. Le projet
 * installe donc le tarball officiel depuis `vendor/` — voir
 * `vendor/PROVENANCE.md`.
 *
 * Le risque que ces tests ferment est précis : `npm i xlsx`, tapé par réflexe,
 * réinstalle la 0.18.5 du registre. Rien ne casserait, rien ne se verrait, et
 * le projet repartirait en arrière de deux ans sans un message.
 */

describe("distribution de SheetJS", () => {
  it("n'est pas la version périmée du registre npm", () => {
    expect(XLSX.version).not.toBe("0.18.5");
  });

  it("est au moins la 0.20", () => {
    const [majeur, mineur] = XLSX.version.split(".").map(Number);
    expect(majeur > 0 || mineur >= 20, `version installée : ${XLSX.version}`).toBe(true);
  });
});

describe("SheetJS — comportements dont dépend l'import", () => {
  it("relit sans perte ce qu'il vient d'écrire", () => {
    const attendu = [
      ["Date", "Montant", "Sens", "Catégorie"],
      ["03/01/2026", 42.15, "Débit", "Alimentation"],
      ["04/01/2026", 1234.5, "Crédit", "Salaire versé"],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attendu), "Transactions");
    const octets = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const relu = XLSX.utils.sheet_to_json<unknown[]>(
      XLSX.read(octets, { type: "array" }).Sheets["Transactions"],
      { header: 1, raw: true }
    );
    // Les accents des en-têtes comptent : « Catégorie » mal encodé, et la
    // colonne n'est plus reconnue par son nom.
    expect(relu).toEqual(attendu);
  });

  it("convertit une série de date en jour exact, quel que soit le fuseau", () => {
    // Le défaut du 11/08/2026 — des `Date` construits en heure locale, à
    // 21 secondes de minuit, soit la veille sur 100 % des lignes en
    // Europe/Paris. `parse_date_code` est la seule voie exacte, et c'est celle
    // qu'emprunte le worker. Un changement de version ne doit pas la déplacer.
    const serie = (Date.UTC(2026, 0, 1) - Date.UTC(1899, 11, 30)) / 86_400_000;
    const d = XLSX.SSF.parse_date_code(serie);
    expect(d).toBeTruthy();
    expect([d!.y, d!.m, d!.d]).toEqual([2026, 1, 1]);
  });

  it("lit une feuille au nom accentué", () => {
    // La feuille « Paramètres » du format public en dépend.
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Paramètre", "Valeur"]]), "Paramètres");
    const octets = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const relu = XLSX.read(octets, { type: "array" });
    expect(relu.SheetNames).toContain("Paramètres");
  });
});
