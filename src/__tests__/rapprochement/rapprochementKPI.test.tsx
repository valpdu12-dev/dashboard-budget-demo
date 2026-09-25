// ── Le rapprochement à zéro écart — lot C.3 ──────────────────────────────
//
// Ce fichier est écrit AVANT le déplacement des calculs, et il doit être vert
// AVANT comme APRÈS. C'est sa seule raison d'être : le C.3 déplace des
// calculs sans les changer, et un écart d'un centime y passerait inaperçu.
//
// ⚠️ LES VALEURS DE RÉFÉRENCE SONT ÉCRITES EN TOUTES LETTRES, pas capturées
// par un instantané. Un instantané se régénère d'un geste, et c'est
// exactement ce qu'on ne veut pas : si un chiffre bouge, il doit bouger dans
// le diff, sous les yeux de quelqu'un. Aucune commande ne régénère ce
// fichier.
//
// Deux jeux, parce qu'un seul ne prouverait rien :
//   1. le jeu de démonstration publié — 1 053 transactions, 8 comptes ;
//   2. le classeur modèle, lu par la chaîne d'import complète.
//
// Ce que le rapprochement NE prouve pas : que les règles sont justes. Il
// prouve seulement qu'elles n'ont pas changé. La généralisation, elle, est
// vérifiée au C.4 par un second jeu qui ne ressemble à aucun des deux.

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

import { useBalances } from "@/hooks/useBalances";
import { useKPIs } from "@/hooks/useKPIs";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useSavingsData } from "@/hooks/useSavingsData";
import { useExpenseData } from "@/hooks/useExpenseData";
import { useBudgetData } from "@/hooks/useBudgetData";
import { useMortgageData } from "@/hooks/useMortgageData";
import { useInsights } from "@/hooks/useInsights";
import { useRubriques } from "@/hooks/useRubriques";

import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { decodeTransactions } from "@/utils/decode";
import { octetsModele } from "../helpers/modelePublie";
import { lireClasseurPublic } from "@/services/lectureClasseur";
import { construireJeuDepuisRapport } from "@/services/jeuDonnees";
import { resetAllStores } from "../helpers/storeReset";
import type { BudgetTarget, Config, RawTransactionsJSON, SalaryData } from "@/types";

// ─────────────────────────────────────────────────────────────────────────
// L'APLATISSEUR
// ─────────────────────────────────────────────────────────────────────────
//
// Il transforme le résultat d'un hook en une liste plate de nombres, pour que
// la comparaison porte sur des VALEURS et non sur des objets. Les grandes
// structures — un solde par compte et par mois — sont résumées : leur nombre
// de clés et la somme de leurs feuilles numériques. Les écrire toutes ferait
// une référence illisible, que personne ne relirait.

// F.2 (24/09/2026) : 12 → 13. Le résultat de l'écran Prêt a gagné `controle`
// et passait à 13 clés : il était alors RÉSUMÉ en deux nombres, et le
// rapprochement ne voyait plus un seul KPI du prêt. Relevé parce que la liste
// des clés comparées a changé — c'est ce contrôle-là qui l'a attrapé.
const MAX_CLES = 13;

function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
}

function sommeFeuilles(v: unknown, profondeur = 0): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (profondeur > 4 || v === null || typeof v !== "object") return 0;
  return Object.values(v as Record<string, unknown>).reduce<number>(
    (s, x) => s + sommeFeuilles(x, profondeur + 1),
    0
  );
}

function aplatir(
  prefixe: string,
  v: unknown,
  out: Record<string, number>,
  profondeur = 0
): void {
  if (typeof v === "number") {
    out[prefixe] = isFinite(v) ? arrondi(v) : Number.NaN;
    return;
  }
  if (typeof v === "boolean") {
    out[prefixe] = v ? 1 : 0;
    return;
  }
  // `null` est une VALEUR dans ce projet — « non calculable », jamais 0. Il
  // est donc rapproché comme les autres.
  if (v === null) {
    out[`${prefixe}#null`] = 1;
    return;
  }
  if (typeof v === "string" || typeof v === "undefined" || typeof v === "function") return;

  if (Array.isArray(v)) {
    out[`${prefixe}#n`] = v.length;
    out[`${prefixe}#somme`] = arrondi(sommeFeuilles(v));
    return;
  }

  const cles = Object.keys(v as Record<string, unknown>);
  if (profondeur >= 2 || cles.length > MAX_CLES) {
    out[`${prefixe}#n`] = cles.length;
    out[`${prefixe}#somme`] = arrondi(sommeFeuilles(v));
    return;
  }
  for (const k of cles) {
    aplatir(`${prefixe}.${k}`, (v as Record<string, unknown>)[k], out, profondeur + 1);
  }
}

/** Mesure un écran : le résultat d'un hook, aplati et préfixé. */
function mesurer(ecran: string, resultat: unknown, out: Record<string, number>): void {
  aplatir(ecran, resultat, out);
}

// ─────────────────────────────────────────────────────────────────────────
// LES DEUX JEUX
// ─────────────────────────────────────────────────────────────────────────

const lireJSON = <T,>(nom: string): T =>
  JSON.parse(readFileSync(resolve(__dirname, "../../../public/data", nom), "utf8"));

function poserDemo(): void {
  const tx = decodeTransactions(lireJSON<RawTransactionsJSON>("transactions.json"));
  const config = lireJSON<Config>("config.json");
  const salary = lireJSON<SalaryData>("salary.json");
  const budgets = lireJSON<BudgetTarget[]>("budgets.json");
  useDataStore.getState().setData(tx, salary, config, "static");
  useDataStore.getState().setBudgets({ budgets });
}

function poserModele(retoucher?: (wb: XLSX.WorkBook) => void): void {
  const wb = XLSX.read(octetsModele(), { type: "array", cellDates: false });
  retoucher?.(wb);
  const jeu = construireJeuDepuisRapport(
    lireClasseurPublic(wb),
    "Budget_modele.xlsx",
    "2026-09-17T00:00:00.000Z"
  );
  useDataStore.getState().poserJeu(jeu);
}

/**
 * Les filtres sont ÉPINGLÉS.
 *
 * Sans cela le rapprochement dépendrait de l'état par défaut du store, qui
 * peut changer pour de bonnes raisons — et l'écart serait alors attribué au
 * déplacement des calculs.
 */
function epinglerFiltres(): void {
  useFilterStore.setState({
    period: "all",
    cat1Filter: "all",
    showTransfers: false,
    selMonth: null,
    selCat2: null,
    selType: null,
    selOrg: null,
  });
}

/** Rend tous les écrans et rend la mesure complète. */
function mesureComplete(): Record<string, number> {
  const out: Record<string, number> = {};

  const { result: filtres } = renderHook(() => useFilteredData());
  const f = filtres.current;
  mesurer("filtres", { nbMois: f.allMonths.length, nbMoisPeriode: f.allMonthsInRange.length, nbBase: f.baseTx.length, nbBrut: f.rawPeriodTx.length }, out);

  const transactions = useDataStore.getState().transactions;
  const config = useDataStore.getState().config;
  const salaryMonths = useDataStore.getState().salary?.months ?? [];

  const { result: soldes } = renderHook(() =>
    useBalances(transactions, f.allMonths, config?.init ?? {})
  );
  const s = soldes.current;
  mesurer("soldes", {
    currentBalances: s.currentBalances,
    balancesByMonth: s.balancesByMonth,
    variationsByMonth: s.variationsByMonth,
    comptesNonInitialises: s.comptesNonInitialises,
    aucunSoldeConnu: s.aucunSoldeConnu,
    comptesPresents: s.comptesPresents,
    courbe: s.balanceChartData(f.allMonthsInRange),
  }, out);

  const { result: kpis } = renderHook(() =>
    useKPIs(f.baseTx, s.balancesByMonth, salaryMonths, f.currentMonth, f.prevMonth)
  );
  mesurer("kpis", kpis.current, out);

  mesurer("epargne", renderHook(() => useSavingsData()).result.current, out);
  mesurer("depenses", renderHook(() => useExpenseData()).result.current, out);
  mesurer("budget", renderHook(() => useBudgetData()).result.current, out);
  mesurer("pret", renderHook(() => useMortgageData()).result.current, out);
  // ⚠️ Mêmes arguments que la page Insights : `rawPeriodTx`, pas `baseTx`.
  // La première version de ce fichier appelait `useInsights()` sans argument —
  // le hook rendait trois listes vides, et la mesure était verte en ne
  // mesurant rien. C'est le défaut n° 1 du lot A, revenu une fois de plus.
  mesurer(
    "insights",
    renderHook(() => useInsights(f.rawPeriodTx, f.currentMonth, f.prevMonth)).result.current,
    out
  );
  mesurer("rubriques", renderHook(() => useRubriques()).result.current, out);

  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// LES RÉFÉRENCES — écrites à la main, jamais régénérées
// ─────────────────────────────────────────────────────────────────────────

/**
 * Le jeu de démonstration publié — 1 053 transactions, 8 comptes, 25 mois.
 * Mesuré le 17/09/2026, avant tout déplacement de calcul.
 */
const REFERENCE_DEMO: Record<string, number> = {
  // F.3 (24/09/2026), décision O6 — le prêt de la démo passe en forme
  // « taux » : 1,80 %/an, mensualité CALCULÉE 893,64 € au lieu de 893,60 €.
  // 37 valeurs bougent, TOUTES par ce seul fait (mesuré : même liste d'écarts
  // avec ou sans la déclaration des types de dépense, qui n'en change aucune).
  // Chaque échéance coûte 0,04 € de plus : +0,96 € d'intérêts sur 24 mois,
  // −0,96 € sur le compte qui les paie, coût total 893,64 × 240 − 180 000.
  // ── filtres ──
  "filtres.nbMois": 25,
  "filtres.nbMoisPeriode": 25,
  "filtres.nbBase": 982,
  "filtres.nbBrut": 1053,
  // ── soldes ──
  "soldes.currentBalances.Banque A - Courant": 5245.42,
  "soldes.currentBalances.Banque B - Courant": 1528.56,
  "soldes.currentBalances.Banque B - Compte joint": 1459.11,
  "soldes.currentBalances.Banque C - Compte joint": 1066.62,
  "soldes.currentBalances.Titres-restaurant": 1220.45,
  "soldes.currentBalances.Total": 10520.16,
  "soldes.balancesByMonth#n": 25,
  "soldes.balancesByMonth#somme": 465929.88,
  "soldes.variationsByMonth#n": 25,
  "soldes.variationsByMonth#somme": 907379.88,
  "soldes.comptesNonInitialises#n": 0,
  "soldes.comptesNonInitialises#somme": 0,
  "soldes.aucunSoldeConnu": 0,
  "soldes.comptesPresents#n": 8,
  "soldes.comptesPresents#somme": 0,
  "soldes.courbe#n": 25,
  "soldes.courbe#somme": 465925,
  // ── kpis ──
  "kpis.curBal.Banque A - Courant": 5245.42,
  "kpis.curBal.Banque B - Courant": 1528.56,
  "kpis.curBal.Banque B - Compte joint": 1459.11,
  "kpis.curBal.Banque C - Compte joint": 1066.62,
  "kpis.curBal.Titres-restaurant": 1220.45,
  "kpis.curBal.Total": 10520.16,
  "kpis.prevBal.Banque A - Courant": 4974.78,
  "kpis.prevBal.Banque B - Courant": 1562.33,
  "kpis.prevBal.Banque B - Compte joint": 1418.56,
  "kpis.prevBal.Banque C - Compte joint": 1077.3,
  "kpis.prevBal.Titres-restaurant": 1180.94,
  "kpis.prevBal.Total": 10213.91,
  "kpis.depCur": 2633.14,
  "kpis.depPrev": 2805.38,
  "kpis.recCur": 3089.39,
  "kpis.recPrev": 3056.42,
  "kpis.netMonth": 456.25,
  "kpis.lastSal.brut": 3722.93,
  // F.3 — le net retire désormais les « autres retenues » (2970.07 avant).
  "kpis.lastSal.net": 2944.39,
  "kpis.lastSal.cotSal": 752.86,
  "kpis.lastSal.indem": 0,
  "kpis.lastSal.retenues": 25.68,
  "kpis.prevSal.brut": 3630.17,
  // F.3 — le net retire désormais les « autres retenues » (2893.33 avant).
  "kpis.prevSal.net": 2865.67,
  "kpis.prevSal.cotSal": 736.84,
  "kpis.prevSal.indem": 0,
  "kpis.prevSal.retenues": 27.66,
  "kpis.fixe": 925.52,
  "kpis.occ": 718.46,
  "kpis.tauxEpargne": 0.11,
  // ── epargne ──
  "epargne.kpis.totalEp": 28059.09,
  "epargne.kpis.totalEntrees": 28445.7,
  "epargne.kpis.totalSorties": 386.61,
  "epargne.kpis.totalRec": 78025.35,
  "epargne.kpis.ratio": 0.36,
  "epargne.kpis.nbTx": 104,
  "epargne.kpis.curEp": 1139.16,
  "epargne.kpis.prevEp": 1138.16,
  "epargne.chartData#n": 25,
  "epargne.chartData#somme": 207955.66,
  "epargne.donutData#n": 6,
  "epargne.donutData#somme": 28445.7,
  "epargne.donutTotal": 28445.7,
  "epargne.tableRawData#n": 104,
  "epargne.tableRawData#somme": 28060.09,
  "epargne.tableTotal": 28059.09,
  "epargne.allMonthsInRange#n": 25,
  "epargne.allMonthsInRange#somme": 0,
  // ── depenses ──
  "depenses.organismes#n": 4,
  "depenses.organismes#somme": 0,
  "depenses.expMonthlyLines#n": 25,
  "depenses.expMonthlyLines#somme": 290226,
  "depenses.expByCat2#n": 11,
  "depenses.expByCat2#somme": 73868,
  "depenses.expByType#n": 26,
  "depenses.expByType#somme": 73867,
  "depenses.detailRows#n": 927,
  "depenses.detailRows#somme": 73866.8,
  "depenses.detailTotal": 73866.8,
  "depenses.topMerchants#n": 10,
  "depenses.topMerchants#somme": 39347,
  "depenses.cumulParJour#n": 31,
  "depenses.cumulParJour#somme": 1538051,
  "depenses.compNvsN1#n": 11,
  "depenses.compNvsN1#somme": 50651,
  "depenses.compNvsN1Mois": 9,
  // ── budget ──
  "budget.rows#n": 11,
  "budget.rows#somme": 147844,
  "budget.kpis.totalBudgeted": 2742,
  "budget.kpis.totalActual": 2589,
  "budget.kpis.overrunCount": 3,
  "budget.kpis.complianceRate": 67,
  "budget.kpis.balance": 153,
  "budget.topRows#n": 9,
  "budget.topRows#somme": 145810,
  "budget.isLoading": 0,
  "budget.comparableMonths#n": 24,
  "budget.comparableMonths#somme": 0,
  // ── pret ──
  "pret.hasData": 1,
  "pret.pretDeclare": 1,
  "pret.positionEstimee": 0,
  // F.2 — la démo concorde avec sa déclaration : 24 mois comparés, 0 écart.
  "pret.controle.moisCompares": 24,
  "pret.controle.ecarts#n": 0,
  "pret.controle.ecarts#somme": 0,
  "pret.kpis.principal": 180000,
  // F.1 (24/09/2026) — position CALCULÉE depuis la date (2022-10, échéance
  // n° 48) au lieu d'être déduite des intérêts du dernier mois. Avant :
  // 148 982,52 / 31 017,48. L'ancienne méthode divisait des intérêts arrondis
  // au centime par le taux mensuel (0,15 %) : 0,005 € d'arrondi pèse jusqu'à
  // 3,33 € sur le capital. La nouvelle valeur est le solde exact du tableau
  // d'amortissement du générateur, qui est le même calcul.
  "pret.kpis.capitalRestant": 148985.4,
  "pret.kpis.capitalRembourse": 31014.6,
  "pret.kpis.avancement": 0.17,
  "pret.kpis.echeancesPayees": 48,
  "pret.kpis.echeancesRestantes": 192,
  "pret.kpis.mensualite": 893.64,
  "pret.kpis.tauxAnnuel": 0.02,
  "pret.kpis.interetsPayes": 11880.12,
  "pret.kpis.interetsRestants": 22593.48,
  "pret.kpis.coutTotalInterets": 34473.6,
  "pret.historyData#n": 24,
  "pret.historyData#somme": 42894.72,
  "pret.projectionData#n": 240,
  "pret.projectionData#somme": 22831296,
  "pret.donutData#n": 2,
  "pret.donutData#somme": 180000,
  // ── insights ──
  "insights.hausse#n": 2,
  "insights.hausse#somme": 816.45,
  "insights.baisse#n": 3,
  "insights.baisse#somme": 846.66,
  "insights.recurring#n": 3,
  "insights.recurring#somme": 27.7,
  // ── rubriques ──
  "rubriques.paie": 1,
  "rubriques.pret": 1,
  // Lot C.5, décision D7 — VALEUR NOUVELLE, pas valeur changée. La rubrique
  // Épargne n'existait pas avant : l'écran s'affichait toujours, y compris
  // sur un jeu sans la moindre ligne d'épargne, où il montrait des zéros.
  // Elle vaut 1 ici parce que la source déclare des types d'épargne.
  "rubriques.epargne": 1,
};

/**
 * Le classeur modèle PUBLIÉ, lu par la chaîne d'import complète — lot F.5.
 *
 * Il porte les données de la démonstration (décision F6). Importé, il doit
 * donc redonner CHAQUE chiffre de la démonstration : sa référence EST celle
 * de la démonstration. Ce n'est pas une facilité : c'est le critère. Si une
 * seule transaction, un taux ou une date du modèle s'écartait de la démo, un
 * KPI bougerait ici.
 *
 * Une seule exception, et elle est structurelle : l'écran Budget. Le format
 * de fichier ne porte pas d'objectifs de budget (lot B) — le modèle importé
 * n'en a donc aucun. Ses 12 clés sont mesurées à part : mêmes 11 lignes, 9 en
 * tête, 24 mois comparables que la démo ; aucun montant budgété, taux de
 * respect « non calculable ». Les sommes de lignes (76 856, 76 273) sont
 * celles de la démo moins ses objectifs.
 *
 * L'ancienne référence (51 transactions, 3 mois) décrivait le modèle écrit à
 * la main dans `modeleExcel.ts`, disparu au F.5 (F9).
 */
const REFERENCE_MODELE: Record<string, number> = {
  ...Object.fromEntries(
    Object.entries(REFERENCE_DEMO).filter(([k]) => !k.startsWith("budget."))
  ),
  "budget.rows#n": 11,
  "budget.rows#somme": 76856,
  "budget.kpis.totalBudgeted": 0,
  "budget.kpis.totalActual": 0,
  "budget.kpis.overrunCount": 0,
  "budget.kpis.complianceRate#null": 1,
  "budget.kpis.balance": 0,
  "budget.topRows#n": 9,
  "budget.topRows#somme": 76273,
  "budget.isLoading": 0,
  "budget.comparableMonths#n": 24,
  "budget.comparableMonths#somme": 0,
};

// ─────────────────────────────────────────────────────────────────────────

function comparer(mesure: Record<string, number>, reference: Record<string, number>) {
  const clesMesure = Object.keys(mesure).sort();
  const clesReference = Object.keys(reference).sort();

  // Une clé qui disparaît est un écart, même si aucune valeur n'a bougé : un
  // KPI qu'on cesse de calculer ne se voit pas dans une comparaison de
  // valeurs.
  expect(clesMesure).toEqual(clesReference);

  const ecarts: string[] = [];
  for (const k of clesReference) {
    if (!Object.is(mesure[k], reference[k])) {
      ecarts.push(`${k} : attendu ${reference[k]}, mesuré ${mesure[k]}`);
    }
  }
  expect(ecarts).toEqual([]);
}

describe("rapprochement à zéro écart — jeu de démonstration", () => {
  beforeEach(() => {
    resetAllStores();
    poserDemo();
    epinglerFiltres();
  });

  it("chaque KPI de chaque écran donne le chiffre attendu", () => {
    comparer(mesureComplete(), REFERENCE_DEMO);
  });
});

describe("rapprochement à zéro écart — classeur modèle", () => {
  beforeEach(() => {
    resetAllStores();
    poserModele();
    epinglerFiltres();
  });

  it("chaque KPI de chaque écran donne le chiffre attendu", () => {
    comparer(mesureComplete(), REFERENCE_MODELE);
  });

  // F.6 — la preuve qui sait échouer. Une seule transaction effacée du modèle
  // (sa ligne vidée, comme on la supprimerait dans Excel) : le rapprochement
  // doit tomber. S'il restait vert, il ne mesurerait pas le modèle.
  it("sait échouer : une transaction retirée du modèle fait bouger les KPI", () => {
    resetAllStores();
    poserModele((wb) => {
      const ws = wb.Sheets["Transactions"];
      for (const col of "ABCDEFGHIJKLMNOPQRSTU") delete ws[`${col}2`];
    });
    epinglerFiltres();
    expect(useDataStore.getState().transactions).toHaveLength(1052);
    expect(() => comparer(mesureComplete(), REFERENCE_MODELE)).toThrow();
  });
});
