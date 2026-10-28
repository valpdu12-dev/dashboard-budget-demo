// @vitest-environment node
// ── La feuille « Patrimoine » du modèle publié — Patrimoine D-2 (plan 33) ──
//
// Le modèle que le bouton télécharge porte une feuille « Patrimoine » prête à
// remplir : six colonnes à remplir (en-tête bleu nuit, note de survol), la
// colonne « Epargne/Liquidité » en liste à TROIS valeurs, et des lignes
// d'exemple inventées. Ce test vérifie :
//   - la feuille, sa place, ses en-têtes, leurs notes, ses règles de saisie ;
//   - que le lecteur D-1 (`lireClasseurPublic`) la relit SANS UNE ALERTE, avec
//     des compteurs calculés à la main, à trois dates « aujourd'hui » fixées ;
//   - que le reste du rapport ne change pas (1 053 transactions, 60 bulletins) ;
//   - le Lisez-moi.
// Et il sait échouer.
//
// Les lignes d'exemple (scripts/generer-modele.mjs, § 4.3b), refaites à la main :
//   juin, juillet, août 2026 — 4 comptes, tous remplis              12 lignes
//     Compte courant Banque A (Liquidité)      1 850,00  2 120,40  1 640,75
//     Livret Banque A (Epargne)                6 000,00  6 150,00  6 300,00
//     Assurance-vie Banque B (Epargne)        12 400,00 12 480,55 12 530,10
//     Appartement - capital remboursé (Immo.) 38 000,00 38 620,00 39 245,00
//   septembre 2026 — les 3 premiers comptes, montant VIDE             3 lignes
//   septembre 2026 → décembre 2027 — l'immobilier prérempli,         16 lignes
//     39 245 + 625 × k (k = 1 à 16) : 39 870 en septembre 2026 … 49 245 en décembre 2027
//   Total : 31 lignes portant un nom de compte.

import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { octetsModele } from "../helpers/modelePublie";
import { lireClasseurPublic, type RapportImport } from "@/services/lectureClasseur";

const NUIT = "FF1F3864";
const COLONNES = ["Ordre", "Transaction", "Epargne/Liquidité", "Banque", "Date", "Montant"];
const NATURES = ["Epargne", "Liquidité", "Immobilier"];

type Regle = { type: string; formulae?: unknown[]; showErrorMessage?: boolean; error?: string };
const modele = (ws: ExcelJS.Worksheet) =>
  (ws as unknown as { dataValidations: { model: Record<string, Regle> } }).dataValidations.model;
/** La règle de saisie qui couvre une cellule, s'il y en a une. */
function regleDe(ws: ExcelJS.Worksheet, adr: string): { cle: string; regle: Regle } | undefined {
  const c = ws.getCell(adr);
  for (const [cle, regle] of Object.entries(modele(ws))) {
    const [de, a = de] = cle.replace(/^range:/, "").split(":").map((x) => ws.getCell(x));
    if (Number(c.row) >= Number(de.row) && Number(c.row) <= Number(a.row) &&
      Number(c.col) >= Number(de.col) && Number(c.col) <= Number(a.col)) return { cle, regle };
  }
  return undefined;
}
const texte = (c: ExcelJS.Cell) => (typeof c.value === "string" ? c.value : "");
const couleur = (c: ExcelJS.Cell) => (c.fill?.type === "pattern" ? c.fill.fgColor?.argb : undefined);
const note = (c: ExcelJS.Cell): string => {
  const n = c.note as unknown;
  if (!n) return "";
  if (typeof n === "string") return n;
  return ((n as { texts?: { text: string }[] }).texts ?? []).map((t) => t.text).join("");
};
/** Les valeurs d'une liste écrite en clair : « "a,b,c" ». */
const valeursListe = (r?: Regle) =>
  String(r?.formulae?.[0] ?? "").replace(/^"|"$/g, "").split(",").filter(Boolean);

/** Tous les écarts de la feuille à ce qui a été validé. Vide = conforme. */
function ecarts(wb: ExcelJS.Workbook): string[] {
  const e: string[] = [];
  const noms = wb.worksheets.map((w) => w.name);
  const ws = wb.getWorksheet("Patrimoine");
  if (!ws) return ["feuille Patrimoine absente"];
  if (noms.indexOf("Patrimoine") !== noms.indexOf("Paie") + 1) e.push(`Patrimoine pas juste après Paie : ${noms.join(", ")}`);

  // En-têtes : les six, dans l'ordre, et rien d'autre avant la légende.
  const entetes: string[] = [];
  for (let col = 1; texte(ws.getRow(1).getCell(col)); col++) entetes.push(texte(ws.getRow(1).getCell(col)));
  if (entetes.join("|") !== COLONNES.join("|")) e.push(`en-têtes : ${entetes.join(", ")}`);
  COLONNES.forEach((nom, i) => {
    const c = ws.getRow(1).getCell(i + 1);
    if (couleur(c) !== NUIT) e.push(`${nom} : en-tête pas bleu nuit`);
    if (!/^(Obligatoire|Facultatif)\./.test(note(c))) e.push(`${nom} : note « ${note(c) || "(aucune)"} »`);
  });
  if (!/^Facultatif\./.test(note(ws.getCell("A1")))) e.push("Ordre : devrait être facultatif");

  // Règles de saisie : la liste à trois valeurs, une date, un nombre.
  const nature = regleDe(ws, "C2")?.regle;
  if (nature?.type !== "list") e.push(`Epargne/Liquidité : règle ${nature?.type ?? "absente"}`);
  else if (valeursListe(nature).join("|") !== NATURES.join("|")) e.push(`liste : ${valeursListe(nature).join(", ")}`);
  if (regleDe(ws, "C2001")?.regle !== nature) e.push("liste : ne couvre pas les 2 000 lignes");
  if (regleDe(ws, "E2")?.regle.type !== "date") e.push("Date : pas de règle date");
  if (regleDe(ws, "F2")?.regle.type !== "decimal") e.push("Montant : pas de règle nombre");

  // Les exemples respectent la liste.
  for (let r = 2; texte(ws.getRow(r).getCell(2)); r++) {
    const v = texte(ws.getRow(r).getCell(3));
    if (!valeursListe(nature).includes(v)) e.push(`C${r} : « ${v} » hors de la liste`);
  }
  return e;
}

let wb: ExcelJS.Workbook;
beforeAll(async () => {
  wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(octetsModele()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
}, 120_000);

const lire = (aujourdhui: string): RapportImport =>
  lireClasseurPublic(XLSX.read(octetsModele(), { type: "array", cellDates: false }), { aujourdhui });
/** Somme des relevés d'un mois, au centime. */
const totalDuMois = (r: RapportImport, mk: string) =>
  Math.round(r.patrimoine!.releves.filter((x) => x.mk === mk).reduce((s, x) => s + x.montant, 0) * 100) / 100;

describe("la feuille Patrimoine du modèle publié (D-2)", () => {
  it("feuille, en-têtes, notes, liste à 3 valeurs, règles : 0 écart", () => {
    expect(ecarts(wb)).toEqual([]);
  });

  it("la liste de « Epargne/Liquidité » propose exactement Epargne, Liquidité, Immobilier", () => {
    const r = regleDe(wb.getWorksheet("Patrimoine")!, "C2")?.regle;
    expect(valeursListe(r)).toEqual(["Epargne", "Liquidité", "Immobilier"]);
    expect(r?.showErrorMessage).toBe(true);
    expect(r?.error).toMatch(/Epargne, Liquidité ou Immobilier/);
  });

  it("pas de colonne calculée « Date dépassée », « Annee », « mois » (décision D-2)", () => {
    const ws = wb.getWorksheet("Patrimoine")!;
    const tout: string[] = [];
    ws.getRow(1).eachCell((c) => tout.push(texte(c)));
    expect(tout.filter((t) => /date d[ée]pass[ée]e|^annee$|^mois$/i.test(t))).toEqual([]);
  });

  it("le Lisez-moi présente la feuille et ses règles", () => {
    const lignes: string[] = [];
    wb.getWorksheet("Lisez-moi")!.eachRow((r) => lignes.push(texte(r.getCell(1))));
    const tout = lignes.join("\n");
    expect(tout).toMatch(/4\. Patrimoine \(facultative\)/);
    expect(tout).toMatch(/5\. Visualisation/);
    expect(tout).toMatch(/Feuille Patrimoine \(facultative\)/);
    expect(tout).toMatch(/Montant vide = pas encore saisi.*jamais pour 0/);
    expect(tout).toMatch(/Seules les dates dépassées comptent/);
    expect(tout).toMatch(/un relevé par mois/);
    expect(tout).toMatch(/clôturé.*relevé à 0/);
  });
});

describe("le lecteur D-1 relit la feuille du modèle sans une alerte", () => {
  it("au 15/09/2026 (fin de relevé de la démo) : 12 gardés, 16 futurs, 3 pas saisis", () => {
    const r = lire("2026-09-15");
    expect(r.anomalies).toEqual([]);
    expect(r.patrimoine).toBeDefined();
    expect(r.patrimoine!.compteurs).toEqual({ lignesLues: 31, gardees: 12, futures: 16, nonSaisies: 3, ignorees: 0 });
    expect(r.patrimoine!.nbComptes).toBe(4);
    expect(r.patrimoine!.dernierMois).toBe("2026-08");
    // 1 640,75 + 6 300 + 12 530,10 + 39 245 = 59 715,85
    expect(totalDuMois(r, "2026-08")).toBe(59715.85);
    // 1 850 + 6 000 + 12 400 + 38 000 = 58 250
    expect(totalDuMois(r, "2026-06")).toBe(58250);
    const natures = new Set(r.patrimoine!.releves.map((x) => x.nature));
    expect([...natures].sort()).toEqual(["Epargne", "Immobilier", "Liquidité"]);
  });

  it("au 28/10/2026 : l'immobilier de septembre est dépassé, celui d'octobre pas encore", () => {
    const r = lire("2026-10-28");
    expect(r.anomalies).toEqual([]);
    expect(r.patrimoine!.compteurs).toEqual({ lignesLues: 31, gardees: 13, futures: 15, nonSaisies: 3, ignorees: 0 });
    expect(r.patrimoine!.dernierMois).toBe("2026-09");
    // 39 245 + 625 = 39 870 — le seul relevé de septembre (les 3 autres sont vides)
    expect(r.patrimoine!.releves.filter((x) => x.mk === "2026-09").map((x) => [x.compte, x.montant]))
      .toEqual([["Appartement - capital remboursé", 39870]]);
  });

  it("au 01/01/2028 : tout l'échéancier est dépassé, les montants vides restent « pas saisis »", () => {
    const r = lire("2028-01-01");
    expect(r.anomalies).toEqual([]);
    expect(r.patrimoine!.compteurs).toEqual({ lignesLues: 31, gardees: 28, futures: 0, nonSaisies: 3, ignorees: 0 });
    expect(r.patrimoine!.dernierMois).toBe("2027-12");
    // 39 245 + 625 × 16 = 49 245
    expect(totalDuMois(r, "2027-12")).toBe(49245);
  });

  it("le reste du rapport ne change pas : 1 053 transactions, 60 bulletins, 1 113 acceptées", () => {
    const r = lire("2026-10-28");
    expect(r.transactions).toHaveLength(1053);
    expect(r.paie).toHaveLength(60);
    expect(r.compteurs.acceptees).toBe(1113);
  });
});

describe("sait échouer", () => {
  /** Applique une retouche au classeur ExcelJS, relève les écarts, annule. */
  function avec(retouche: () => () => void): string {
    const annuler = retouche();
    try { return ecarts(wb).join("\n"); } finally { annuler(); }
  }
  const liste = (valeurs: string) => () => {
    const ws = wb.getWorksheet("Patrimoine")!;
    const { cle, regle } = regleDe(ws, "C2")!;
    const m = modele(ws);
    m[cle] = { ...regle, formulae: [valeurs] };
    return () => { m[cle] = regle; };
  };

  it("« Immobilier » retiré de la liste", () => {
    const e = avec(liste('"Epargne,Liquidité"'));
    expect(e).toMatch(/liste : Epargne, Liquidité$/m);
    expect(e).toMatch(/C\d+ : « Immobilier » hors de la liste/);
  });
  it("un en-tête renommé", () => {
    const e = avec(() => {
      const c = wb.getWorksheet("Patrimoine")!.getCell("C1");
      const avant = c.value;
      c.value = "Nature";
      return () => { c.value = avant; };
    });
    expect(e).toMatch(/en-têtes : Ordre, Transaction, Nature/);
  });
  it("une note retirée", () => {
    const e = avec(() => {
      const c = wb.getWorksheet("Patrimoine")!.getCell("F1");
      const avant = c.note;
      c.note = "";
      return () => { c.note = avant!; };
    });
    expect(e).toMatch(/Montant : note « \(aucune\) »/);
  });
  it("une nature inconnue dans les exemples : le lecteur avertit, et ne compte pas la ligne", () => {
    const x = XLSX.read(octetsModele(), { type: "array", cellDates: false });
    x.Sheets["Patrimoine"]["C2"] = { t: "s", v: "Bourse" };
    const r = lireClasseurPublic(x, { aujourdhui: "2026-09-15" });
    expect(r.anomalies.map((a) => a.message).join("\n")).toMatch(/Nature inconnue : « Bourse »/);
    expect(r.patrimoine!.compteurs.ignorees).toBe(1);
    expect(r.patrimoine!.compteurs.gardees).toBe(11);
  });
});
