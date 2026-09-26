// ── La Visualisation du modèle calcule comme l'application — lot F.6 ──────
//
// Le modèle publié porte, en cache, les résultats de sa feuille Visualisation
// pour août 2026 (le mois par défaut). Excel les recalcule à l'identique
// (mesuré au F.3 et au F.6). Ce test vérifie que ces résultats sont AUSSI ceux
// de l'application, calculés par ses propres fonctions sur la démonstration :
// soldes de fin de mois, dépenses, recettes, épargne.
//
// Deux calculs indépendants — des formules Excel d'un côté, le code de
// l'application de l'autre — qui doivent tomber sur les mêmes centimes. S'ils
// divergent, l'utilisateur verrait un chiffre dans son fichier et un autre
// dans le tableau de bord.

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { octetsModele } from "../helpers/modelePublie";
import { decodeTransactions } from "@/utils/decode";
import { construireRegles } from "@/calculs/regles";
import { calculerSoldes } from "@/calculs/calculSoldes";
import { calculerKPIs } from "@/calculs/calculKPIs";
import { calculerEpargne } from "@/calculs/calculEpargne";
import { filtrerDonnees } from "@/calculs/filtrerDonnees";
import type { Config, RawTransactionsJSON, SalaryData } from "@/types";

const lire = <T,>(nom: string): T =>
  JSON.parse(readFileSync(resolve(__dirname, "../../../public/data", nom), "utf8"));

// ── Le côté application ─────────────────────────────────────────────────
const tx = decodeTransactions(lire<RawTransactionsJSON>("transactions.json"));
const config = lire<Config>("config.json");
const salary = lire<SalaryData>("salary.json");
const regles = construireRegles(config);
const f = filtrerDonnees(tx, {
  period: "all", cat1Filter: "all", showTransfers: false,
  selMonth: null, selCat2: null, selType: null, selOrg: null,
}, regles);
const soldes = calculerSoldes(tx, f.allMonths, config.init ?? {}, regles);
// Mois courant septembre, mois précédent août : les KPI « prev » sont ceux d'août.
const kpis = calculerKPIs(f.baseTx, soldes.balancesByMonth, salary.months, "2026-09", "2026-08", regles);
const epargne = calculerEpargne({
  txSource: tx, baseTx: f.baseTx, allMonthsInRange: f.allMonthsInRange,
  currentMonth: "2026-09", prevMonth: "2026-08", selEpMonth: null,
}, regles);

// ── Le côté modèle : les valeurs en cache de la feuille Visualisation ────
const wb = XLSX.read(octetsModele(), { type: "array", cellDates: false });
const viz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Visualisation"], { header: 1, raw: true, defval: null });
// H.4 — les blocs sont côte à côte : un libellé peut être dans n'importe
// quelle colonne. `ou` le trouve ; `ligne` rend la ligne À PARTIR de lui, si
// bien que [1] est toujours la première valeur à sa droite.
const ou = (libelle: string): [number, number] => {
  for (let r = 0; r < viz.length; r++) {
    const c = (viz[r] ?? []).indexOf(libelle);
    if (c >= 0) return [r, c];
  }
  throw new Error(`Visualisation : « ${libelle} » introuvable`);
};
const ligne = (libelle: string) => {
  const [r, c] = ou(libelle);
  return viz[r].slice(c);
};
/** H.8 — un libellé cherché SOUS une ancre (le même compte figure dans plusieurs blocs). */
const ligneApres = (ancre: string, libelle: string) => {
  const [r0] = ou(ancre);
  for (let r = r0 + 1; r < viz.length; r++) {
    const c = (viz[r] ?? []).indexOf(libelle);
    if (c >= 0) return viz[r].slice(c);
  }
  throw new Error(`Visualisation : « ${libelle} » introuvable sous « ${ancre} »`);
};
const nombre = (v: unknown) => (typeof v === "number" ? v : 0); // une somme nulle peut être écrite vide

describe("F.6 — la Visualisation du modèle donne les chiffres de l'application", () => {
  it("le mois affiché par défaut est août 2026", () => {
    // Lu en numéro de série, pas en Date : un Date JavaScript porterait le
    // fuseau de la machine, et minuit à Paris est la veille en UTC.
    const d = XLSX.SSF.parse_date_code(viz[0][1] as number);
    expect([d.y, d.m, d.d]).toEqual([2026, 8, 1]);
  });

  it("les soldes de fin de mois de chaque compte", () => {
    const comptes = Object.keys(kpis.prevBal).filter((c) => c !== "Total");
    expect(comptes.length).toBe(5);
    for (const c of comptes) {
      expect(nombre(ligneApres("Comptes", c)[2]), c).toBeCloseTo(kpis.prevBal[c], 2);
    }
    expect(nombre(ligneApres("Comptes", "Total")[2])).toBeCloseTo(kpis.prevBal.Total, 2);
  });

  it("les dépenses du mois (transferts internes exclus, remboursements déduits)", () => {
    expect(nombre(ligne("Total des dépenses")[1])).toBeCloseTo(kpis.depPrev, 2);
  });

  it("les recettes du mois", () => {
    expect(nombre(ligne("Total des recettes")[1])).toBeCloseTo(kpis.recPrev, 2);
  });

  it("l'épargne du mois", () => {
    expect(nombre(ligne("Total épargné")[1])).toBeCloseTo(epargne.kpis.prevEp, 2);
  });

  it("F.7 — les libellés sont LUS dans Paramètres, jamais écrits en dur", () => {
    const avecFormules = XLSX.read(octetsModele(), { type: "array", cellFormula: true });
    const ws = avecFormules.Sheets["Visualisation"];
    const ref = XLSX.utils.decode_range(ws["!ref"]!);
    const comptes = config.parametrage!.comptes.filter((c) => c.porteUnSolde).map((c) => c.libelle);
    const categories = config.parametrage!.categories.map((c) => c.libelle);
    // Les blocs du haut seulement : la liste des dépenses, en dessous, montre
    // des comptes et des catégories lus dans Transactions, ligne à ligne.
    const limite = ou("Dépenses du mois, ligne à ligne")[0];
    // H.8 — un même compte figure dans plusieurs blocs ; seule E13, le compte
    // choisi pour son solde, est une cellule à remplir (écrite, pas lue).
    const vus = new Set<string>();
    for (let r = ref.s.r; r < limite; r++) {
      for (let col = ref.s.c; col <= ref.e.c; col++) {
        const adr = XLSX.utils.encode_cell({ r, c: col });
        const c = ws[adr];
        if (!c || !(comptes.includes(c.v) || categories.includes(c.v)) || adr === "E13") continue;
        expect(c.f, `Visualisation!${adr} (« ${c.v} »)`).toMatch(/Param/);
        vus.add(c.v);
      }
    }
    expect([...vus].sort()).toEqual([...comptes, ...categories].sort());
  });

  it("F.7 — les lignes « Autres » sont à zéro sur la démo : tout y est déclaré", () => {
    expect(nombre(ligne("Autres recettes (type non listé)")[1])).toBe(0);
    expect(nombre(ligne("Autres catégories (non listées)")[1])).toBe(0);
  });

  it("les catégories font bien le total des dépenses", () => {
    const [d, col] = ou("Dépenses du mois par catégorie");
    const [fin] = ou("Total des dépenses");
    const somme = viz.slice(d + 1, fin).reduce((s, r) => s + nombre(r[col + 1]), 0);
    expect(somme).toBeCloseTo(kpis.depPrev, 2);
  });

  it("H.8 — E13 : le solde de fin de mois du compte principal, comme l'application", () => {
    const principal = config.parametrage!.comptes.find((c) => c.id === config.parametrage!.compteCreditSortiesEpargne)!.libelle;
    expect(viz[12][4]).toBe(principal);
    expect(nombre(viz[12][5])).toBeCloseTo(kpis.prevBal[principal], 2);
  });

  it("H.8 — les dépenses par compte et le détail par type retombent sur le total de l'application", () => {
    expect(nombre(ligne("Dépenses totales")[1])).toBeCloseTo(kpis.depPrev, 2);
    const [d, col] = ou("Dépenses du mois par compte");
    const [fin] = ou("Solde du mois (revenus totaux − dépenses totales)");
    const parCompte = viz.slice(d + 2, fin).reduce((s, r) => s + nombre(r[col + 1]), 0);
    expect(parCompte).toBeCloseTo(kpis.depPrev, 2);
    const [dd] = ou("Détail des dépenses du mois");
    const entete = viz[dd];
    const cTotal = entete.indexOf("Total");
    expect(nombre(ligne("Toutes les dépenses")[cTotal])).toBeCloseTo(kpis.depPrev, 2);
    const [finDetail] = ou("Dépenses du mois, ligne à ligne");
    const parType = viz.slice(dd + 2, finDetail).reduce((s, r) => s + nombre(r[cTotal]), 0);
    expect(parType).toBeCloseTo(kpis.depPrev, 2);
  });

  it("H.8 — revenus totaux et solde du mois se tiennent", () => {
    const revenus = nombre(ligne("Revenus totaux")[1]);
    const attendu = nombre(ligne("Total des recettes")[1]) + nombre(ligne("Sorties d'épargne du mois")[1]) +
      nombre(ligneApres("Comptes", "Total")[1]);
    expect(revenus).toBeCloseTo(attendu, 2);
    expect(nombre(ligne("Solde du mois (revenus totaux − dépenses totales)")[1]))
      .toBeCloseTo(revenus - kpis.depPrev, 2);
  });

  it("H.4 — la liste des dépenses du mois : les débits d'août, sans transfert interne, comme l'application", () => {
    // Le côté application : les transactions d'août 2026, au débit, qui ne
    // sont pas des transferts internes — calculées par ses propres règles.
    const attendues = f.baseTx.filter((t) =>
      t.date.startsWith("2026-08") && t.dc === "Débit" && !regles.aNature(t.type, "transfert-interne"));
    const [d] = ou("Dépenses du mois, ligne à ligne");
    expect(viz[d][1]).toBe(attendues.length);
    expect(viz[d][2]).toBe(`${attendues.length} dépense(s) ce mois-ci.`);
    const lignesListe = viz.slice(d + 2, d + 2 + 200).filter((r) => r[0] !== null && r[0] !== "");
    expect(lignesListe).toHaveLength(attendues.length);
    const total = lignesListe.reduce((s, r) => s + nombre(r[5]), 0);
    expect(total).toBeCloseTo(attendues.reduce((s, t) => s + t.montant, 0), 2);
  });
});
