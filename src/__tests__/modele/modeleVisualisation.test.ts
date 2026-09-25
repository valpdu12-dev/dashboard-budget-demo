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
const ligne = (libelle: string) => {
  const l = viz.find((r) => r[0] === libelle);
  if (!l) throw new Error(`Visualisation : ligne « ${libelle} » introuvable`);
  return l;
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
      expect(nombre(ligne(c)[2]), c).toBeCloseTo(kpis.prevBal[c], 2);
    }
    expect(nombre(ligne("Total")[2])).toBeCloseTo(kpis.prevBal.Total, 2);
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

  it("les catégories font bien le total des dépenses", () => {
    const debut = viz.findIndex((r) => r[0] === "Dépenses du mois par catégorie") + 1;
    const fin = viz.findIndex((r) => r[0] === "Total des dépenses");
    const somme = viz.slice(debut, fin).reduce((s, r) => s + nombre(r[1]), 0);
    expect(somme).toBeCloseTo(kpis.depPrev, 2);
  });
});
