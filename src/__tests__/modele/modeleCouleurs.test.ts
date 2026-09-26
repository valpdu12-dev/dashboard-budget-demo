// @vitest-environment node
// ── Les deux couleurs du modèle — lot H.1 ───────────────────────────────
//
// Décision H3 du lot H : une cellule à remplir se distingue d'une cellule
// calculée au premier coup d'œil. Jaune pâle et DÉVERROUILLÉE pour la
// saisie ; gris pâle et VERROUILLÉE pour le calcul (le verrou n'agira
// qu'avec la protection, H.5). Ce test lit le modèle PUBLIÉ et vérifie la
// règle cellule par cellule. Et il sait échouer : chaque dérive qu'on lui
// injecte le fait tomber, en nommant la cellule.

import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import { octetsModele } from "../helpers/modelePublie";

const SAISIE = "FFFFF2CC";
const CALCUL = "FFF2F2F2";
const ENTETE_SAISIE = "FF1F3864";
const ENTETE_CALCUL = "FF7F7F7F";

type Cellule = ExcelJS.Cell;
const couleur = (c: Cellule): string | undefined =>
  c.fill?.type === "pattern" ? c.fill.fgColor?.argb : undefined;
const ouverte = (c: Cellule) => c.protection?.locked === false;
const estFormule = (c: Cellule) => c.type === ExcelJS.ValueType.Formula;
const texte = (c: Cellule) => (typeof c.value === "string" ? c.value : "");
const nature = (c: Cellule) =>
  `${estFormule(c) ? "formule" : "saisie"}, ${couleur(c) ?? "sans couleur"}, ${ouverte(c) ? "ouverte" : "verrouillée"}`;

/** Tous les écarts à la règle, lisibles. Vide = modèle conforme. */
function ecarts(wb: ExcelJS.Workbook): string[] {
  const e: string[] = [];

  // 1. Partout : une formule est grise et verrouillée ; une cellule jaune est
  //    ouverte ; chaque feuille porte sa légende, bien peinte.
  wb.eachSheet((ws) => {
    let legendeSaisie = false;
    let legendeCalcul = false;
    ws.eachRow((row) => row.eachCell((c) => {
      const k = couleur(c);
      if (estFormule(c) && (k !== CALCUL || ouverte(c))) e.push(`${ws.name}!${c.address} : ${nature(c)}`);
      if (k === SAISIE && !ouverte(c)) e.push(`${ws.name}!${c.address} : jaune mais verrouillée`);
      if (texte(c).startsWith("À remplir") && k === SAISIE) legendeSaisie = true;
      if (texte(c).startsWith("Calculé") && k === CALCUL) legendeCalcul = true;
    }));
    if (!legendeSaisie || !legendeCalcul) e.push(`${ws.name} : légende absente ou mal peinte`);

    // 2. Une cellule qui porte une liste ou une validation est à remplir.
    const dv = (ws as unknown as { dataValidations: { model: Record<string, unknown> } })
      .dataValidations.model;
    for (const cle of Object.keys(dv)) {
      const [debut, fin = debut] = cle.replace(/^range:/, "").split(":");
      for (const adr of [debut, fin]) {
        const c = ws.getCell(adr);
        if (couleur(c) !== SAISIE || !ouverte(c)) e.push(`${ws.name}!${adr} : liste, mais ${nature(c)}`);
      }
    }
  });

  // 3. Transactions et Paie : l'en-tête dit la nature de la colonne, et la
  //    colonne entière la respecte, jusqu'à la dernière ligne préparée.
  for (const nom of ["Transactions", "Paie"]) {
    const ws = wb.getWorksheet(nom)!;
    for (let col = 1; texte(ws.getRow(1).getCell(col)); col++) {
      const h = ws.getRow(1).getCell(col);
      // H.5b — en-tête bleu nuit (dans le filtre) ouvert, sinon Excel refuse
      // de trier ; en-tête gris verrouillé.
      if ((couleur(h) === ENTETE_SAISIE) !== ouverte(h)) {
        e.push(`${nom}!${h.address} : en-tête ${ouverte(h) ? "déverrouillé" : "verrouillé"}`);
      }
      const k = couleur(h);
      if (k !== ENTETE_SAISIE && k !== ENTETE_CALCUL) {
        e.push(`${nom}!${h.address} : en-tête ni bleu nuit ni gris (${k})`);
        continue;
      }
      for (let r = 2; r <= ws.rowCount; r++) {
        const c = ws.getRow(r).getCell(col);
        const bonne = k === ENTETE_SAISIE
          ? !estFormule(c) && couleur(c) === SAISIE && ouverte(c)
          : estFormule(c);
        if (!bonne) {
          e.push(`${nom}!${c.address} : colonne ${k === ENTETE_SAISIE ? "à remplir" : "calculée"}, cellule ${nature(c)}`);
          break;
        }
      }
    }
  }

  // 4. Paramètres : tout est à remplir. Chaque tableau (en-tête bleu nuit)
  //    est jaune sur ses 40 premières lignes, et les listes lisent des cases
  //    jaunes. H.3 : les en-têtes ne sont plus en ligne 1 (encadrés au-dessus) ;
  //    leur ligne est celle de la cellule « Paramètre ».
  const par = wb.getWorksheet("Paramètres")!;
  let pe = 0;
  par.eachRow((row, n) => { if (!pe && texte(row.getCell(1)) === "Paramètre") pe = n; });
  if (!pe) e.push("Paramètres : cellule « Paramètre » introuvable");
  let tableaux = 0;
  for (let col = 1; pe && col <= par.columnCount; col++) {
    if (couleur(par.getRow(pe).getCell(col)) !== ENTETE_SAISIE) continue;
    tableaux++;
    for (let r = pe + 1; r <= pe + 40; r++) {
      const c = par.getRow(r).getCell(col);
      if (estFormule(c) || couleur(c) !== SAISIE || !ouverte(c)) {
        e.push(`Paramètres!${c.address} : ${nature(c)}`);
        break;
      }
    }
  }
  // 2 (réglages) + 8 (comptes) + 5 (types) + 2 (catégories) + 1 (employeurs)
  if (tableaux !== 18) e.push(`Paramètres : ${tableaux} colonnes à en-tête bleu nuit, 18 attendues`);
  for (const nom of ["ListeComptes", "ListeTypes"]) {
    for (const plage of wb.definedNames.getRanges(nom).ranges) {
      const m = /!\$([A-Z]+)\$(\d+):\$[A-Z]+\$(\d+)$/.exec(plage);
      if (!m) { e.push(`${nom} : plage illisible ${plage}`); continue; }
      for (let r = Number(m[2]); r <= Number(m[3]); r++) {
        const c = par.getCell(`${m[1]}${r}`);
        if (couleur(c) !== SAISIE || !ouverte(c)) { e.push(`${nom} → Paramètres!${c.address} : ${nature(c)}`); break; }
      }
    }
  }
  return e;
}

/** Change le style d'une cellule SANS toucher aux objets de style partagés ;
 *  rend la fonction qui annule. */
function retoucher(c: Cellule, patch: Partial<ExcelJS.Style>): () => void {
  const avant = c.style;
  c.style = { ...avant, ...patch } as ExcelJS.Style;
  return () => { c.style = avant; };
}
const GRIS_PALE = { type: "pattern", pattern: "solid", fgColor: { argb: CALCUL } } as ExcelJS.Fill;
const JAUNE = { type: "pattern", pattern: "solid", fgColor: { argb: SAISIE } } as ExcelJS.Fill;
const NUIT = { type: "pattern", pattern: "solid", fgColor: { argb: ENTETE_SAISIE } } as ExcelJS.Fill;

let wb: ExcelJS.Workbook;
beforeAll(async () => {
  wb = new ExcelJS.Workbook();
  // Les types d'exceljs datent d'avant le Buffer générique de Node : même
  // objet à l'exécution, le transtypage ne fait que les réconcilier.
  await wb.xlsx.load(Buffer.from(octetsModele()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
}, 120_000);

/** Applique des retouches, relève les écarts, annule tout. */
function avec(retouches: (() => void)[]): string[] {
  try { return ecarts(wb); } finally { retouches.reverse().forEach((annuler) => annuler()); }
}
const tx = () => wb.getWorksheet("Transactions")!;
const lignes = (ws: ExcelJS.Worksheet, col: string) =>
  Array.from({ length: ws.rowCount - 1 }, (_, i) => ws.getCell(`${col}${i + 2}`));

describe("les deux couleurs du modèle publié (lot H.1)", () => {
  it("à remplir = jaune pâle et ouvert ; calculé = gris pâle et verrouillé : 0 écart", () => {
    expect(ecarts(wb)).toEqual([]);
  });

  describe("sait échouer", () => {
    it("une colonne calculée repeinte en « à remplir »", () => {
      const e = avec(lignes(tx(), "K").map((c) => retoucher(c, { fill: JAUNE, protection: { locked: false } })));
      expect(e.join("\n")).toMatch(/Transactions!K2 : formule, FFFFF2CC, ouverte/);
    });
    it("une seule cellule calculée déverrouillée", () => {
      const e = avec([retoucher(tx().getCell("Q20"), { protection: { locked: false } })]);
      expect(e).toEqual(["Transactions!Q20 : formule, FFF2F2F2, ouverte"]);
    });
    it("une colonne à remplir repeinte en gris", () => {
      const paie = wb.getWorksheet("Paie")!;
      const e = avec(lignes(paie, "A").map((c) => retoucher(c, { fill: GRIS_PALE })));
      expect(e.join("\n")).toMatch(/Paie!A2 : colonne à remplir, cellule saisie, FFF2F2F2/);
    });
    it("un en-tête de colonne calculée passé en bleu nuit", () => {
      const e = avec([retoucher(tx().getCell("K1"), { fill: NUIT })]);
      expect(e.join("\n")).toMatch(/Transactions!K2 : colonne à remplir, cellule formule/);
    });
    it("un en-tête à remplir reverrouillé (Excel refuserait de trier)", () => {
      const e = avec([retoucher(tx().getCell("A1"), { protection: { locked: true } })]);
      expect(e).toEqual(["Transactions!A1 : en-tête verrouillé"]);
    });
    it("un en-tête calculé déverrouillé", () => {
      const e = avec([retoucher(tx().getCell("K1"), { protection: { locked: false } })]);
      expect(e).toEqual(["Transactions!K1 : en-tête déverrouillé"]);
    });
    it("une légende retirée", () => {
      const paie = wb.getWorksheet("Paie")!;
      const c = paie.getCell("J1");
      const avant = c.value;
      c.value = "";
      const e = avec([() => { c.value = avant; }]);
      expect(e).toEqual(["Paie : légende absente ou mal peinte"]);
    });
    it("une case de Paramètres laissée blanche", () => {
      const par = wb.getWorksheet("Paramètres")!;
      const e = avec([retoucher(par.getCell("D30"), { fill: undefined })]);
      expect(e.join("\n")).toMatch(/Paramètres!D30 : saisie, sans couleur/);
    });
  });
});
