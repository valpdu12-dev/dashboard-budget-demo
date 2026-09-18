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
import { construireClasseurModele } from "@/services/modeleExcel";
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

const MAX_CLES = 12;

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

function poserModele(): void {
  const wb = XLSX.read(construireClasseurModele(), { type: "array", cellDates: false });
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
  // ── filtres ──
  "filtres.nbMois": 25,
  "filtres.nbMoisPeriode": 25,
  "filtres.nbBase": 982,
  "filtres.nbBrut": 1053,
  // ── soldes ──
  "soldes.currentBalances.Banque A - Courant": 5245.42,
  "soldes.currentBalances.Banque B - Courant": 1528.56,
  "soldes.currentBalances.Banque B - Compte joint": 1459.11,
  "soldes.currentBalances.Banque C - Compte joint": 1067.58,
  "soldes.currentBalances.Titres-restaurant": 1220.45,
  "soldes.currentBalances.Total": 10521.12,
  "soldes.balancesByMonth#n": 25,
  "soldes.balancesByMonth#somme": 465954.68,
  "soldes.variationsByMonth#n": 25,
  "soldes.variationsByMonth#somme": 907404.68,
  "soldes.comptesNonInitialises#n": 0,
  "soldes.comptesNonInitialises#somme": 0,
  "soldes.aucunSoldeConnu": 0,
  "soldes.comptesPresents#n": 8,
  "soldes.comptesPresents#somme": 0,
  "soldes.courbe#n": 25,
  "soldes.courbe#somme": 465952,
  // ── kpis ──
  "kpis.curBal.Banque A - Courant": 5245.42,
  "kpis.curBal.Banque B - Courant": 1528.56,
  "kpis.curBal.Banque B - Compte joint": 1459.11,
  "kpis.curBal.Banque C - Compte joint": 1067.58,
  "kpis.curBal.Titres-restaurant": 1220.45,
  "kpis.curBal.Total": 10521.12,
  "kpis.prevBal.Banque A - Courant": 4974.78,
  "kpis.prevBal.Banque B - Courant": 1562.33,
  "kpis.prevBal.Banque B - Compte joint": 1418.56,
  "kpis.prevBal.Banque C - Compte joint": 1078.22,
  "kpis.prevBal.Titres-restaurant": 1180.94,
  "kpis.prevBal.Total": 10214.83,
  "kpis.depCur": 2633.1,
  "kpis.depPrev": 2805.34,
  "kpis.recCur": 3089.39,
  "kpis.recPrev": 3056.42,
  "kpis.netMonth": 456.29,
  "kpis.lastSal.brut": 3722.93,
  "kpis.lastSal.net": 2970.07,
  "kpis.lastSal.cotSal": 752.86,
  "kpis.lastSal.indem": 0,
  "kpis.lastSal.retenues": 25.68,
  "kpis.prevSal.brut": 3630.17,
  "kpis.prevSal.net": 2893.33,
  "kpis.prevSal.cotSal": 736.84,
  "kpis.prevSal.indem": 0,
  "kpis.prevSal.retenues": 27.66,
  "kpis.fixe": 925.46,
  "kpis.occ": 718.46,
  "kpis.tauxEpargne": 0.11,
  // ── epargne ──
  "epargne.kpis.totalEp": 28059.61,
  "epargne.kpis.totalEntrees": 28446.22,
  "epargne.kpis.totalSorties": 386.61,
  "epargne.kpis.totalRec": 78025.35,
  "epargne.kpis.ratio": 0.36,
  "epargne.kpis.nbTx": 104,
  "epargne.kpis.curEp": 1139.18,
  "epargne.kpis.prevEp": 1138.18,
  "epargne.chartData#n": 25,
  "epargne.chartData#somme": 207955.66,
  "epargne.donutData#n": 6,
  "epargne.donutData#somme": 28446.22,
  "epargne.donutTotal": 28446.22,
  "epargne.tableRawData#n": 104,
  "epargne.tableRawData#somme": 28060.61,
  "epargne.tableTotal": 28059.61,
  "epargne.allMonthsInRange#n": 25,
  "epargne.allMonthsInRange#somme": 0,
  // ── depenses ──
  "depenses.organismes#n": 4,
  "depenses.organismes#somme": 0,
  "depenses.expMonthlyLines#n": 25,
  "depenses.expMonthlyLines#somme": 290222,
  "depenses.expByCat2#n": 11,
  "depenses.expByCat2#somme": 73867,
  "depenses.expByType#n": 26,
  "depenses.expByType#somme": 73866,
  "depenses.detailRows#n": 927,
  "depenses.detailRows#somme": 73865.84,
  "depenses.detailTotal": 73865.84,
  "depenses.topMerchants#n": 10,
  "depenses.topMerchants#somme": 39346,
  "depenses.cumulParJour#n": 31,
  "depenses.cumulParJour#somme": 1538024,
  "depenses.compNvsN1#n": 11,
  "depenses.compNvsN1#somme": 50650,
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
  "pret.parametresDeRepli": 0,
  "pret.kpis.principal": 180000,
  "pret.kpis.capitalRestant": 148982.52,
  "pret.kpis.capitalRembourse": 31017.48,
  "pret.kpis.avancement": 0.17,
  "pret.kpis.echeancesPayees": 48,
  "pret.kpis.echeancesRestantes": 192,
  "pret.kpis.mensualite": 893.6,
  "pret.kpis.tauxAnnuel": 0.02,
  "pret.kpis.interetsPayes": 11877.03,
  "pret.kpis.interetsRestants": 22586.97,
  "pret.kpis.coutTotalInterets": 34464,
  "pret.historyData#n": 24,
  "pret.historyData#somme": 42892.8,
  "pret.projectionData#n": 240,
  "pret.projectionData#somme": 22830999,
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
 * Le classeur modèle, lu par la chaîne d'import complète — 51 transactions,
 * 3 mois, aucun objectif de budget.
 */
const REFERENCE_MODELE: Record<string, number> = {
  // ── filtres ──
  "filtres.nbMois": 3,
  "filtres.nbMoisPeriode": 3,
  "filtres.nbBase": 45,
  "filtres.nbBrut": 51,
  // ── soldes ──
  "soldes.currentBalances.Banque A - Courant": 5001.65,
  "soldes.currentBalances.Banque B - Courant": 1500,
  "soldes.currentBalances.Banque B - Compte joint": 1750,
  "soldes.currentBalances.Banque C - Compte joint": 1200,
  "soldes.currentBalances.Titres-restaurant": 636.2,
  "soldes.currentBalances.Total": 10087.85,
  "soldes.balancesByMonth.2026-01#n": 6,
  "soldes.balancesByMonth.2026-01#somme": 15825.9,
  "soldes.balancesByMonth.2026-02#n": 6,
  "soldes.balancesByMonth.2026-02#somme": 17961.8,
  "soldes.balancesByMonth.2026-03#n": 6,
  "soldes.balancesByMonth.2026-03#somme": 20175.7,
  "soldes.variationsByMonth.2026-01#n": 5,
  "soldes.variationsByMonth.2026-01#somme": 2735.9,
  "soldes.variationsByMonth.2026-02#n": 5,
  "soldes.variationsByMonth.2026-02#somme": 5471.8,
  "soldes.variationsByMonth.2026-03#n": 5,
  "soldes.variationsByMonth.2026-03#somme": 8285.7,
  "soldes.comptesNonInitialises#n": 0,
  "soldes.comptesNonInitialises#somme": 0,
  "soldes.aucunSoldeConnu": 0,
  "soldes.comptesPresents#n": 4,
  "soldes.comptesPresents#somme": 0,
  "soldes.courbe#n": 3,
  "soldes.courbe#somme": 53964,
  // ── kpis ──
  "kpis.curBal.Banque A - Courant": 5001.65,
  "kpis.curBal.Banque B - Courant": 1500,
  "kpis.curBal.Banque B - Compte joint": 1750,
  "kpis.curBal.Banque C - Compte joint": 1200,
  "kpis.curBal.Titres-restaurant": 636.2,
  "kpis.curBal.Total": 10087.85,
  "kpis.prevBal.Banque A - Courant": 4375.1,
  "kpis.prevBal.Banque B - Courant": 1500,
  "kpis.prevBal.Banque B - Compte joint": 1450,
  "kpis.prevBal.Banque C - Compte joint": 1200,
  "kpis.prevBal.Titres-restaurant": 455.8,
  "kpis.prevBal.Total": 8980.9,
  "kpis.depCur": 1460.05,
  "kpis.depPrev": 1460.05,
  "kpis.recCur": 2767,
  "kpis.recPrev": 2728,
  "kpis.netMonth": 1306.95,
  "kpis.lastSal.brut": 3150,
  "kpis.lastSal.cotSal": 693,
  "kpis.lastSal.indem": 120,
  "kpis.lastSal.retenues": 0,
  "kpis.lastSal.net": 2577,
  "kpis.prevSal.brut": 3100,
  "kpis.prevSal.cotSal": 682,
  "kpis.prevSal.indem": 120,
  "kpis.prevSal.retenues": 0,
  "kpis.prevSal.net": 2538,
  "kpis.fixe": 486.53,
  "kpis.occ": 331.45,
  "kpis.tauxEpargne": 0.43,
  // ── epargne ──
  "epargne.kpis.totalEp": 2523.33,
  "epargne.kpis.totalEntrees": 2523.33,
  "epargne.kpis.totalSorties": 0,
  "epargne.kpis.totalRec": 8223,
  "epargne.kpis.ratio": 0.31,
  "epargne.kpis.nbTx": 6,
  "epargne.kpis.curEp": 842.07,
  "epargne.kpis.prevEp": 841.11,
  "epargne.chartData#n": 3,
  "epargne.chartData#somme": 17884.54,
  "epargne.donutData#n": 2,
  "epargne.donutData#somme": 2523.33,
  "epargne.donutTotal": 2523.33,
  "epargne.tableRawData#n": 6,
  "epargne.tableRawData#somme": 2523.33,
  "epargne.tableTotal": 2523.33,
  "epargne.allMonthsInRange#n": 3,
  "epargne.allMonthsInRange#somme": 0,
  // ── depenses ──
  "depenses.organismes#n": 2,
  "depenses.organismes#somme": 0,
  "depenses.expMonthlyLines#n": 3,
  "depenses.expMonthlyLines#somme": 14600,
  "depenses.expByCat2#n": 7,
  "depenses.expByCat2#somme": 4381,
  "depenses.expByType#n": 12,
  "depenses.expByType#somme": 4380,
  "depenses.detailRows#n": 39,
  "depenses.detailRows#somme": 4380.15,
  "depenses.detailTotal": 4380.15,
  "depenses.topMerchants#n": 6,
  "depenses.topMerchants#somme": 995,
  "depenses.cumulParJour#n": 31,
  "depenses.cumulParJour#somme": 114948,
  "depenses.compNvsN1#n": 7,
  "depenses.compNvsN1#somme": 4381,
  "depenses.compNvsN1Mois": 3,
  // ── budget ──
  "budget.rows#n": 7,
  "budget.rows#somme": 5839,
  "budget.kpis.totalBudgeted": 0,
  "budget.kpis.totalActual": 0,
  "budget.kpis.overrunCount": 0,
  "budget.kpis.complianceRate#null": 1,
  "budget.kpis.balance": 0,
  "budget.topRows#n": 3,
  "budget.topRows#somme": 5367,
  "budget.isLoading": 0,
  "budget.comparableMonths#n": 3,
  "budget.comparableMonths#somme": 0,
  // ── pret ──
  "pret.hasData": 1,
  "pret.parametresDeRepli": 0,
  "pret.kpis.principal": 180000,
  "pret.kpis.capitalRestant": 167087.6,
  "pret.kpis.capitalRembourse": 12912.4,
  "pret.kpis.avancement": 0.07,
  "pret.kpis.echeancesPayees": 20,
  "pret.kpis.echeancesRestantes": 220,
  "pret.kpis.mensualite": 893.6,
  "pret.kpis.tauxAnnuel": 0.02,
  "pret.kpis.interetsPayes": 5219.31,
  "pret.kpis.interetsRestants": 29244.69,
  "pret.kpis.coutTotalInterets": 34464,
  "pret.historyData#n": 3,
  "pret.historyData#somme": 5361.6,
  "pret.projectionData#n": 240,
  "pret.projectionData#somme": 22831027,
  "pret.donutData#n": 2,
  "pret.donutData#somme": 180000,
  // ── insights ──
  "insights.hausse#n": 0,
  "insights.hausse#somme": 0,
  "insights.baisse#n": 0,
  "insights.baisse#somme": 0,
  "insights.recurring#n": 7,
  "insights.recurring#somme": 331.45,
  // ── rubriques ──
  "rubriques.paie": 1,
  "rubriques.pret": 1,
  // Lot C.5, décision D7 — VALEUR NOUVELLE, pas valeur changée. La rubrique
  // Épargne n'existait pas avant : l'écran s'affichait toujours, y compris
  // sur un jeu sans la moindre ligne d'épargne, où il montrait des zéros.
  // Elle vaut 1 ici parce que la source déclare des types d'épargne.
  "rubriques.epargne": 1,
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
});
