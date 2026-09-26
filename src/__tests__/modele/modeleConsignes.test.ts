// @vitest-environment node
// ── Les consignes du modèle — lot H.3 ────────────────────────────────────
//
// Décision H1 du lot H : un encadré « comment remplir » près de chaque
// tableau de Paramètres (posé AU-DESSUS, décision du 25/09 : pas de place à
// droite), et une note sur chaque en-tête de Transactions, Paie, Paramètres.
//
// Le piège nommé d'avance : un encadré lu comme une donnée. Le lecteur lit un
// tableau de Paramètres de son en-tête jusqu'au bas de la feuille ; un texte
// posé dans sa colonne-clé deviendrait un compte, un type… Ce test relit donc
// le modèle avec le VRAI lecteur de l'application et exige la configuration
// de la démonstration, à l'identique, sans une alerte. Et il sait échouer.

import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { octetsModele } from "../helpers/modelePublie";
import { lireClasseurPublic } from "@/services/lectureClasseur";
import type { BudgetConfig } from "@/types/budgetConfig";

const PE = 9; // la ligne des en-têtes de Paramètres (vérifiée plus bas)
const NUIT = "FF1F3864";
const GRIS = "FF7F7F7F";
const OUVRANTS = ["Paramètre", "Compte", "Type", "Catégorie", "Employeur"];

const attendu = (JSON.parse(readFileSync(resolve(__dirname, "../../../public/data/config.json"), "utf8")) as {
  parametrage: BudgetConfig;
}).parametrage;

const texte = (c: ExcelJS.Cell) => (typeof c.value === "string" ? c.value : "");
const couleur = (c: ExcelJS.Cell) => (c.fill?.type === "pattern" ? c.fill.fgColor?.argb : undefined);
const note = (c: ExcelJS.Cell): string => {
  const n = c.note as unknown;
  if (!n) return "";
  if (typeof n === "string") return n;
  return ((n as { texts?: { text: string }[] }).texts ?? []).map((t) => t.text).join("");
};

let wb: ExcelJS.Workbook;
beforeAll(async () => {
  wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(octetsModele()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
}, 120_000);

/** Ce que le lecteur de l'application tire d'un classeur SheetJS. */
const lire = (x: XLSX.WorkBook) => lireClasseurPublic(x);
const classeurSheetJS = () => XLSX.read(octetsModele(), { type: "array", cellDates: false });

/** Les écarts de configuration entre ce que lit l'application et la démo. */
function ecartsConfig(lu: BudgetConfig): string[] {
  const e: string[] = [];
  const noms = (l: { libelle: string }[]) => l.map((x) => x.libelle).join(" | ");
  if (noms(lu.comptes) !== noms(attendu.comptes)) e.push(`comptes lus : ${noms(lu.comptes)}`);
  else expect(lu.comptes).toEqual(attendu.comptes);
  if (noms(lu.categories) !== noms(attendu.categories)) e.push(`catégories lues : ${noms(lu.categories)}`);
  if (lu.employeurs.join("|") === "") e.push("aucun employeur lu");
  for (const t of attendu.types) {
    const l = lu.types.find((x) => x.libelle === t.libelle);
    if (!l) { e.push(`type « ${t.libelle} » non lu`); continue; }
    if ([...l.natures].sort().join(",") !== [...t.natures].sort().join(",")) e.push(`natures de « ${t.libelle} »`);
    if ((l.classeParDefaut ?? null) !== (t.classeParDefaut ?? null)) e.push(`classe de « ${t.libelle} »`);
  }
  if (lu.compteCreditSortiesEpargne !== attendu.compteCreditSortiesEpargne) e.push("compte des sorties d'épargne");
  return e;
}

describe("les consignes du modèle publié (lot H.3)", () => {
  it(`Paramètres : les tableaux commencent en ligne ${PE}, un encadré au-dessus de chacun`, () => {
    const par = wb.getWorksheet("Paramètres")!;
    expect(texte(par.getCell(`A${PE}`))).toBe("Paramètre");
    for (const [col, titre] of [["A", "RÉGLAGES"], ["D", "COMPTES"], ["M", "TYPES"], ["S", "CATÉGORIES"]]) {
      expect(texte(par.getCell(`${col}1`)), col).toContain(titre);
      expect(texte(par.getCell(`${col}2`)).length, col).toBeGreaterThan(40);
    }
  });

  it("aucune cellule au-dessus des tableaux ne porte un nom d'en-tête (le piège)", () => {
    const par = wb.getWorksheet("Paramètres")!;
    for (let r = 1; r < PE; r++) {
      par.getRow(r).eachCell((c) => {
        expect(OUVRANTS, `Paramètres!${c.address}`).not.toContain(texte(c).trim());
      });
    }
  });

  it("chaque en-tête a sa note : obligatoire ou facultatif pour la saisie, « Calculé » pour le calcul", () => {
    const manques: string[] = [];
    for (const [nom, ligne] of [["Transactions", 1], ["Paie", 1], ["Paramètres", PE]] as const) {
      wb.getWorksheet(nom)!.getRow(ligne).eachCell((c) => {
        const k = couleur(c);
        if (k !== NUIT && k !== GRIS) return;
        const n = note(c);
        const ok = k === GRIS ? n.startsWith("Calculé")
          : ["Paramètre", "Valeur"].includes(texte(c)) ? n.length > 10
          : /^(Obligatoire|Facultatif)\./.test(n);
        if (!ok) manques.push(`${nom}!${c.address} « ${texte(c)} » : ${n || "(aucune note)"}`);
      });
    }
    expect(manques).toEqual([]);
  });

  it("le Lisez-moi renvoie aux encadrés et aux notes", () => {
    const lignes: string[] = [];
    wb.getWorksheet("Lisez-moi")!.eachRow((r) => lignes.push(texte(r.getCell(1))));
    const tout = lignes.join("\n");
    expect(tout).toMatch(/encadré « comment remplir »/);
    expect(tout).toMatch(/une note dit quoi écrire/);
    // H.6 — le verrou se lève sans mot de passe, et le Lisez-moi dit comment.
    expect(tout).toMatch(/Ôter la protection de la feuille/);
  });

  it("l'application relit la configuration de la démonstration, à l'identique, sans une alerte", () => {
    const rapport = lire(classeurSheetJS());
    expect(rapport.anomalies).toEqual([]);
    expect(ecartsConfig(rapport.parametres.config)).toEqual([]);
  });

  it("sait échouer : un texte d'aide glissé dans la colonne des comptes devient un compte", () => {
    const x = classeurSheetJS();
    const ws = x.Sheets["Paramètres"];
    ws[`D${PE + 30}`] = { t: "s", v: "Exemple : mon livret" };
    const rapport = lire(x);
    expect(ecartsConfig(rapport.parametres.config).join("\n")).toMatch(/comptes lus : .*Exemple : mon livret/);
  });
});
