// @vitest-environment node
// ── Patrimoine D-4b — les calculs sur le jeu du profil Démo ──────────────
//
// Les fichiers PUBLIÉS (`public/data/patrimoine.json`, `transactions.json`,
// `config.json`) passés aux calculs. Attendus refaits À LA MAIN depuis le
// jeu (voir l'en-tête de src/__tests__/data/patrimoineDemo.test.ts),
// k = 0 pour septembre 2024 … k = 23 pour août 2026 :
//
//   compte                          | nature     | août 2026 (k = 23) | juil. 2026 | déc. 2025
//   Banque A - Courant              | Liquidité  |   2 575,40         |  2 530,40  |  2 485,40
//   Banque B - Courant              | Liquidité  |   1 910            |  1 880     |  1 910
//   Banque A - Livret               | Epargne    |   9 450            |  9 300     |  8 250
//   Banque C - Livret               | Epargne    |   8 100            |  7 900     |  6 500
//   Banque B - Compte titres        | Epargne    |   2 840            |  2 760     |  2 200
//   Assurance-vie Banque B          | Epargne    |   6 920            |  6 800     |  5 960
//   Retraite Banque C               | Epargne    |   4 300            |  4 200     |  3 500
//   Appartement - capital remboursé | Immobilier |  30 345,45         | 29 677,29  | 25 028,13
//   Total                                        |  66 440,85         | 65 047,69  | 55 833,53
//
// Dépenses (KPI 6), janvier → août 2026, dépense nette sans les transferts
// internes déclarés : 3 781,30 + 3 367,86 + 1 085,63 + 3 139,74 + 3 441,10
// + 3 037,00 + 3 157,87 + 2 805,38 = 23 815,88 € sur 8 mois = 2 976,985
// → 2 976,99 €/mois. Transferts internes exclus sur la période : 1 050 €.

import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculerPatrimoine, type OptionsPatrimoine } from "@/calculs/calculPatrimoine";
import { decodeTransactions } from "@/utils/decode";
import type { PatrimoineLu } from "@/services/lectureClasseur";
import type { RawTransactionsJSON } from "@/types";
import { REGLES_DEMO } from "../helpers/parametrageDemo";

const DATA = resolve(__dirname, "../../../public/data");
const patrimoine = JSON.parse(readFileSync(resolve(DATA, "patrimoine.json"), "utf8")) as PatrimoineLu;
const transactions = decodeTransactions(
  JSON.parse(readFileSync(resolve(DATA, "transactions.json"), "utf8")) as RawTransactionsJSON,
);
const R = REGLES_DEMO;
const releves = patrimoine.releves;
const OPTS: OptionsPatrimoine = { inclureImmobilier: true, period: "YTD", transactions };
const calcul = (o: Partial<OptionsPatrimoine> = {}) => calculerPatrimoine(releves, { ...OPTS, ...o }, R);

const LIVRET_A = "Banque A - Livret";
const COURANT_B = "Banque B - Courant";
const TITRES_B = "Banque B - Compte titres";
const AV_B = "Assurance-vie Banque B";
const DEPENSES = 2976.99;

describe("profil Démo — dernier mois complet et KPI (YTD, immobilier inclus)", () => {
  const res = calcul();
  const k = res.kpis!;

  it("dernier mois complet = août 2026, aucune saisie en cours", () => {
    expect(res.dernierMoisComplet).toBe("2026-08");
    expect(res.moisIncomplets).toEqual([]);
    expect(res.plage).toEqual({ from: "2026-01", to: "2026-08" });
    expect(res.grille.mois).toHaveLength(24);
  });

  it("KPI 1 : 66 440,85 €, juillet 65 047,69 → +1 393,16", () => {
    expect(k.mois).toBe("2026-08");
    expect(k.total).toBe(66440.85);
    expect(k.totalMoisPrecedent).toBe(65047.69);
    expect(k.variationMois).toBe(1393.16);
  });

  it("KPI 2 : épargne placée 61 955,45 € = 31 610 + immobilier 30 345,45", () => {
    expect(k.epargne).toBe(61955.45);
  });

  it("KPI 3 : liquidités 4 485,40 € = 2 575,40 + 1 910", () => {
    expect(k.liquidites).toBe(4485.4);
    expect(k.partLiquidites).toBeCloseTo(4485.4 / 66440.85, 10);
  });

  it("KPI 4 : 66 440,85 − 55 833,53 (déc. 2025) = +10 607,32", () => {
    expect(k.evolutionAnnee!.reference).toBe("2025-12");
    expect(k.evolutionAnnee!.montant).toBe(10607.32);
    expect(k.evolutionAnnee!.ratio).toBeCloseTo(10607.32 / 55833.53, 10);
  });

  it("KPI 5 : 8 variations (janv. → août), 10 607,32 ÷ 8 = 1 325,915 → 1 325,92", () => {
    expect(k.gainMensuelMoyen).toEqual({ montant: 1325.92, nbMois: 8 });
    expect(res.variations.map((v) => v.mk)).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
    ]);
  });

  it("KPI 6 : 4 485,40 ÷ 2 976,99 = 1,51 mois (transferts internes exclus)", () => {
    expect(k.matelas!.depensesMensuelles).toBe(DEPENSES);
    expect(k.matelas!.nbMoisDepenses).toBe(8);
    expect(k.matelas!.nbMois).toBeCloseTo(4485.4 / DEPENSES, 10);
    expect(k.matelas!.nbMois.toFixed(2)).toBe("1.51");
  });
});

describe("profil Démo — report du dernier solde et compte qui démarre tard", () => {
  const g = calcul().grille;

  it("novembre 2025 : 1 solde repris, le livret de Banque A à 7 950 €", () => {
    expect(g.nbRepris["2025-11"]).toBe(1);
    expect(g.soldes["2025-11"][LIVRET_A]).toEqual({ montant: 7950, repris: true });
    expect(g.soldes["2025-12"][LIVRET_A]).toEqual({ montant: 8250, repris: false });
  });

  it("c'est le seul mois avec un solde repris", () => {
    expect(Object.entries(g.nbRepris).filter(([, n]) => n > 0)).toEqual([["2025-11", 1]]);
  });

  it("le total de novembre 2025 garde le livret : 54 298,34 € (et non 46 348,34)", () => {
    const total = calcul({ period: "all" }).serieParBanque.find((l) => l.mk === "2025-11")!.total;
    expect(total).toBe(54298.34);
  });

  it("avril 2025 : premier mois à 8 comptes (l'assurance-vie démarre)", () => {
    expect(Object.keys(g.soldes["2025-03"])).toHaveLength(7);
    expect(Object.keys(g.soldes["2025-04"])).toHaveLength(8);
    expect(g.comptes.find((c) => c.compte === AV_B)!.premierMois).toBe("2025-04");
    expect(g.nbRepris["2025-03"]).toBe(0);
    const tout = calcul({ period: "all" }).serieParBanque;
    expect(tout.find((l) => l.mk === "2025-03")!.total).toBe(39032.28);
    expect(tout.find((l) => l.mk === "2025-04")!.total).toBe(45289.6);
  });
});

describe("profil Démo — graphiques", () => {
  const res = calcul();

  it("répartition d'août par banque", () => {
    expect(res.repartition.map((p) => [p.banque, p.montant])).toEqual([
      ["Immobilier", 30345.45],
      ["Banque C", 12400],     // 8 100 + 4 300
      ["Banque A", 12025.4],   // 2 575,40 + 9 450
      ["Banque B", 11670],     // 1 910 + 2 840 + 6 920
    ]);
  });

  it("par nature : l'immobilier séparé de l'épargne", () => {
    expect(res.natures).toEqual(["Epargne", "Liquidité", "Immobilier"]);
    const aout = res.serieParNature.find((l) => l.mk === "2026-08")!;
    expect(aout["Epargne"]).toBe(31610);
    expect(aout["Liquidité"]).toBe(4485.4);
    expect(aout["Immobilier"]).toBe(30345.45);
  });

  it("« Tout » : 23 variations, de 31 898,81 (sept. 2024) à 66 440,85", () => {
    const tout = calcul({ period: "all" });
    expect(tout.serieParBanque[0]).toMatchObject({ mk: "2024-09", total: 31898.81 });
    expect(tout.kpis!.gainMensuelMoyen!.nbMois).toBe(23);
    // (66 440,85 − 31 898,81) ÷ 23 = 34 542,04 ÷ 23 = 1 501,827…
    expect(tout.kpis!.gainMensuelMoyen!.montant).toBe(1501.83);
  });

  it("tableau des comptes : 8 lignes, total = KPI 1", () => {
    const somme = res.comptes.reduce((s, l) => s + l.solde, 0);
    expect(res.comptes).toHaveLength(8);
    expect(Math.round(somme * 100) / 100).toBe(66440.85);
  });
});

describe("profil Démo — interrupteur « Inclure l'immobilier » coupé", () => {
  const res = calcul({ inclureImmobilier: false });
  const k = res.kpis!;

  it("tous les KPI passent en patrimoine financier", () => {
    expect(k.total).toBe(36095.4);              // 66 440,85 − 30 345,45
    expect(k.epargne).toBe(31610);
    expect(k.liquidites).toBe(4485.4);
    expect(k.variationMois).toBe(725);          // 36 095,40 − 35 370,40
    expect(k.evolutionAnnee!.montant).toBe(5290); // − 30 805,40 (déc. 2025)
    expect(k.gainMensuelMoyen).toEqual({ montant: 661.25, nbMois: 8 });
    expect(k.matelas!.nbMois).toBeCloseTo(4485.4 / DEPENSES, 10); // inchangé
  });

  it("l'immobilier disparaît des légendes, l'interrupteur reste affiché", () => {
    expect(res.banques).toEqual(["Banque A", "Banque B", "Banque C"]);
    expect(res.natures).toEqual(["Epargne", "Liquidité"]);
    expect(res.aDeLImmobilier).toBe(true);
  });
});

describe("profil Démo — page filtrée sur « Banque B » seule", () => {
  const res = calcul({ selection: { par: "banque", valeurs: ["Banque B"] } });
  const k = res.kpis!;

  it("KPI limités à Banque B : 11 670 € = 1 910 + 2 840 + 6 920", () => {
    expect(res.dernierMoisComplet).toBe("2026-08");
    expect(k.total).toBe(11670);
    expect(k.liquidites).toBe(1910);
    expect(k.epargne).toBe(9760);
    expect(k.variationMois).toBe(230);          // juillet 1 880 + 2 760 + 6 800 = 11 440
    expect(k.evolutionAnnee!.montant).toBe(1600); // déc. 2025 1 910 + 2 200 + 5 960 = 10 070
    expect(k.matelas!.nbMois).toBeCloseTo(1910 / DEPENSES, 10);
  });

  it("tableau, donut et détail par compte : les 3 comptes de Banque B", () => {
    expect(res.comptes.map((c) => c.compte)).toEqual([COURANT_B, TITRES_B, AV_B]);
    expect(res.repartitionParCompte.map((r) => [r.compte, r.montant])).toEqual([
      [AV_B, 6920], [TITRES_B, 2840], [COURANT_B, 1910],
    ]);
    expect(res.comptesSerie).toEqual([COURANT_B, TITRES_B, AV_B]);
  });

  it("la légende garde les 4 banques ; les autres valent 0", () => {
    expect(res.banques).toEqual(["Banque A", "Banque B", "Banque C", "Immobilier"]);
    const aout = res.serieParBanque.find((l) => l.mk === "2026-08")!;
    expect(aout["Banque B"]).toBe(11670);
    expect(aout["Banque A"]).toBe(0);
  });
});

describe("profil Démo — mois du donut", () => {
  it("avril 2025 cliqué : répartition d'avril, KPI toujours en août", () => {
    // k = 7 : A 2 395,40 + 7 050 ; B 1 910 + 1 560 + 5 000 ; C 4 900 + 2 700 ;
    // Immobilier = 45 289,60 − 9 445,40 − 8 470 − 7 600 = 19 774,20
    const res = calcul({ moisRepartition: "2025-04" });
    expect(res.moisRepartition).toBe("2025-04");
    expect(Object.fromEntries(res.repartition.map((p) => [p.banque, p.montant]))).toEqual({
      "Banque A": 9445.4, "Banque B": 8470, "Banque C": 7600, Immobilier: 19774.2,
    });
    expect(res.kpis!.mois).toBe("2026-08");
  });
});

describe("la date du jour n'est jamais lue", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("mêmes chiffres en 2026 et en 2031", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 12));
    const avant = calcul();
    vi.setSystemTime(new Date(2031, 1, 3, 12));
    const apres = calcul();
    expect(apres).toEqual(avant);
    expect(apres.kpis!.total).toBe(66440.85);
  });
});
