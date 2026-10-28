// ── Calculs du sous-onglet Patrimoine — Patrimoine D-4b (plan 33) ────────
//
// Les cas de l'étape P3 du site privé, recopiés sur un jeu aux noms
// génériques (helpers/patrimoineFictif.ts). Les attendus sont refaits À LA
// MAIN depuis la définition du jeu, k = 0 pour oct. 2025 … k = 11 pour
// sept. 2026 :
//   Courant A 1 000,25 + 10k · Livret A 5 000 + 100k (oublié en août) ·
//   Titres B 2 000 + 50k · Appartement 300 (k + 1) · Compte titres B 500
//   dès juillet · Assurance-vie C 1 000 + 20 (k − 5) dès mars.
// Les 4 premiers comptes ensemble = 8 300,25 + 460k.

import { describe, it, expect } from "vitest";
import {
  construireGrille, dernierMoisComplet, totauxDuMois, plagePeriode,
  variationsMensuelles, serieParBanque, serieParNature, repartitionParBanque,
  lignesComptes, depensesMensuellesMoyennes, calculerKpis, calculerPatrimoine,
  filtrerImmobilier, moisPrecedent, moisSuivant,
} from "@/calculs/calculPatrimoine";
import { reglesVides } from "@/calculs/regles";
import type { ReleveSoldeLu } from "@/services/lectureClasseur";
import { makeTx } from "../helpers/factories";
import { REGLES_DEMO } from "../helpers/parametrageDemo";
import {
  relevesFictifs, COURANT_A, LIVRET_A, ASSURANCE_VIE_C, COMPTE_TITRES_B,
} from "../helpers/patrimoineFictif";

const releves = () => relevesFictifs();
const R = REGLES_DEMO;

// Totaux attendus (à la main)
const T_DEC_2025 = 9220.25;  // k=2 : 8 300,25 + 920
const T_FEV_2026 = 10140.25; // k=4 : 8 300,25 + 1 840 (pas encore d'assurance-vie)
const T_JUIL = 14020.25;     // k=9 : 8 300,25 + 4 140 + AV 1 080 + CT 500
const T_AOUT = 14400.25;     // k=10 : 8 300,25 + 4 600 − 100 (livret repris à 5 900) + AV 1 100 + CT 500
const T_SEPT = 14980.25;     // k=11 : 1 110,25 + 6 100 + 2 550 + 3 600 + 500 + 1 120

describe("outils de mois", () => {
  it("passe d'une année à l'autre", () => {
    expect(moisPrecedent("2026-01")).toBe("2025-12");
    expect(moisSuivant("2025-12")).toBe("2026-01");
    expect(moisPrecedent("2026-10")).toBe("2026-09");
  });
});

describe("grille mois × compte — report du dernier solde", () => {
  const g = construireGrille(releves());

  it("couvre oct. 2025 → sept. 2026 sans trou", () => {
    expect(g.mois).toHaveLength(12);
    expect(g.mois[0]).toBe("2025-10");
    expect(g.mois[11]).toBe("2026-09");
  });

  it("reprend le livret de juillet (5 900) en août, marqué repris", () => {
    expect(g.soldes["2026-08"][LIVRET_A]).toEqual({ montant: 5900, repris: true });
    expect(g.soldes["2026-09"][LIVRET_A]).toEqual({ montant: 6100, repris: false });
  });

  it("compte 1 solde repris en août, 0 les autres mois", () => {
    expect(g.nbRepris["2026-08"]).toBe(1);
    expect(g.nbRepris["2026-07"]).toBe(0);
    expect(g.nbRepris["2026-09"]).toBe(0);
  });

  it("le total d'août ne chute pas à cause de l'oubli", () => {
    expect(totauxDuMois(g, "2026-08")!.total).toBe(T_AOUT);
    // Sans report, il manquerait 5 900 € : 8 500,25.
    expect(totauxDuMois(g, "2026-08")!.total).not.toBe(8500.25);
  });

  it("total de septembre = somme des relevés", () => {
    expect(totauxDuMois(g, "2026-09")!.total).toBe(T_SEPT);
  });

  it("trie les comptes par ordre, 4.1 entre 4 et 5", () => {
    expect(g.comptes.map((c) => c.ordre)).toEqual([1, 2, 3, 4, 4.1, 5]);
  });
});

describe("compte qui démarre tard", () => {
  const g = construireGrille(releves());

  it("l'assurance-vie n'existe pas avant mars 2026", () => {
    expect(g.comptes.find((c) => c.compte === ASSURANCE_VIE_C)!.premierMois).toBe("2026-03");
    expect(g.soldes["2026-02"][ASSURANCE_VIE_C]).toBeUndefined();
    expect(Object.keys(g.soldes["2026-02"])).toHaveLength(4);
  });

  it("n'est pas compté comme « repris » avant son démarrage", () => {
    expect(g.nbRepris["2026-02"]).toBe(0);
    expect(totauxDuMois(g, "2026-02")!.total).toBe(T_FEV_2026);
  });
});

describe("dernier mois complet", () => {
  it("septembre, même si août a un oubli", () => {
    expect(dernierMoisComplet(construireGrille(releves()))).toBe("2026-09");
  });

  it("juillet si septembre a aussi un oubli (août et septembre incomplets)", () => {
    const sansCourantSept = releves().filter((r) => !(r.compte === COURANT_A && r.mk === "2026-09"));
    expect(dernierMoisComplet(construireGrille(sansCourantSept))).toBe("2026-07");
    const res = calculerPatrimoine(sansCourantSept, { inclureImmobilier: true, period: "YTD", transactions: [] }, R);
    expect(res.moisIncomplets).toEqual(["2026-08", "2026-09"]);
    expect(res.kpis!.total).toBe(T_JUIL);
  });

  it("un compte qui démarre le dernier mois ne rend pas les mois d'avant incomplets", () => {
    const avantJuillet = releves().filter((r) => r.mk <= "2026-06");
    expect(dernierMoisComplet(construireGrille(avantJuillet))).toBe("2026-06");
  });

  it("null sans relevé", () => {
    expect(dernierMoisComplet(construireGrille([]))).toBeNull();
  });
});

describe("KPI 1 à 5 (immobilier inclus, période YTD)", () => {
  const g = construireGrille(releves());
  const plage = plagePeriode("YTD", "2026-09", "2025-10");
  const k = calculerKpis(g, "2026-09", plage, [], R)!;

  it("KPI 1 : total 14 980,25, août 14 400,25, flèche +580", () => {
    expect(k.mois).toBe("2026-09");
    expect(k.total).toBe(T_SEPT);
    expect(k.totalMoisPrecedent).toBe(T_AOUT);
    expect(k.variationMois).toBe(580);
  });

  it("KPI 2 : épargne = total − courant = 13 870 (immobilier compris)", () => {
    expect(k.epargne).toBe(13870);
  });

  it("KPI 3 : liquidités 1 110,25 et leur part du total", () => {
    expect(k.liquidites).toBe(1110.25);
    expect(k.partLiquidites).toBeCloseTo(1110.25 / 14980.25, 10);
  });

  it("KPI 4 : sept. − déc. 2025 = 14 980,25 − 9 220,25 = 5 760", () => {
    expect(k.evolutionAnnee!.reference).toBe("2025-12");
    expect(k.evolutionAnnee!.montant).toBe(5760);
    expect(k.evolutionAnnee!.ratio).toBeCloseTo(5760 / T_DEC_2025, 10);
  });

  it("KPI 4 : null si les relevés ne remontent pas à décembre N-1", () => {
    const g2026 = construireGrille(releves().filter((r) => r.mk >= "2026-01"));
    expect(calculerKpis(g2026, "2026-09", plage, [], R)!.evolutionAnnee).toBeNull();
  });

  it("KPI 5 YTD : 9 variations (janv. → sept.), 5 760 ÷ 9 = 640", () => {
    expect(k.gainMensuelMoyen).toEqual({ montant: 640, nbMois: 9 });
  });

  it("KPI 5 en 1M = la seule variation de septembre (+580)", () => {
    const k1 = calculerKpis(g, "2026-09", plagePeriode("1M", "2026-09", "2025-10"), [], R)!;
    expect(k1.gainMensuelMoyen).toEqual({ montant: 580, nbMois: 1 });
  });

  it("KPI 5 en « Tout » : oct. 2025 n'a pas de mois précédent → 11 variations", () => {
    // (14 980,25 − 8 300,25) ÷ 11 = 6 680 ÷ 11 = 607,2727…
    const kt = calculerKpis(g, "2026-09", plagePeriode("all", "2026-09", "2025-10"), [], R)!;
    expect(kt.gainMensuelMoyen!.nbMois).toBe(11);
    expect(kt.gainMensuelMoyen!.montant).toBe(607.27);
  });
});

describe("KPI 6 : matelas de sécurité", () => {
  // Dépense nette de la page Dépenses, sans les transferts internes DÉCLARÉS
  // (configuration de la démo : « Epargne Banque A » est un transfert),
  // moyenne sur les mois de la période qui ont des transactions.
  const tx = [
    makeTx({ date: "2025-12-10", montant: 9999, dc: "Débit" }),                                 // hors YTD
    makeTx({ date: "2026-01-05", montant: 1000, dc: "Débit" }),
    makeTx({ date: "2026-01-06", montant: 500, dc: "Débit", type: "Epargne Banque A" }),        // transfert : exclu
    makeTx({ date: "2026-01-25", montant: 2000, dc: "Crédit", type: "Virement extérieur" }),    // recette : 0
    makeTx({ date: "2026-02-10", montant: 1200, dc: "Débit" }),
    makeTx({ date: "2026-03-10", montant: 800, dc: "Débit", type: "Crédit Immobilier" }),       // prêt : gardé
  ];
  const g = construireGrille(releves());

  it("dépenses YTD : (1 000 + 1 200 + 800) ÷ 3 mois = 1 000", () => {
    expect(depensesMensuellesMoyennes(tx, { from: "2026-01", to: "2026-09" }, R))
      .toEqual({ moyenne: 1000, nbMois: 3 });
  });

  it("matelas YTD = 1 110,25 ÷ 1 000 = 1,11 mois", () => {
    const k = calculerKpis(g, "2026-09", plagePeriode("YTD", "2026-09", "2025-10"), tx, R)!;
    expect(k.matelas!.depensesMensuelles).toBe(1000);
    expect(k.matelas!.nbMoisDepenses).toBe(3);
    expect(k.matelas!.nbMois).toBeCloseTo(1.11025, 10);
  });

  it("suit la période : « Tout » ajoute décembre → 12 999 ÷ 4 = 3 249,75", () => {
    const k = calculerKpis(g, "2026-09", plagePeriode("all", "2026-09", "2025-10"), tx, R)!;
    expect(k.matelas!.depensesMensuelles).toBe(3249.75);
    expect(k.matelas!.nbMois).toBeCloseTo(1110.25 / 3249.75, 10);
  });

  it("null quand la période n'a aucune transaction (1M = septembre)", () => {
    const k = calculerKpis(g, "2026-09", plagePeriode("1M", "2026-09", "2025-10"), tx, R)!;
    expect(k.matelas).toBeNull();
  });

  it("DEMO — un remboursement réduit la dépense, comme la page Dépenses", () => {
    // 200 € recrédités sur un type de dépense (« CB » a une classe) :
    // (1 000 + 1 200 − 200 + 800) ÷ 3 = 2 800 ÷ 3 = 933,33
    const avecRemb = [...tx, makeTx({ date: "2026-02-20", montant: 200, dc: "Crédit", type: "CB" })];
    expect(depensesMensuellesMoyennes(avecRemb, { from: "2026-01", to: "2026-09" }, R))
      .toEqual({ moyenne: 933.33, nbMois: 3 });
  });

  it("DEMO — source sans configuration : aucun transfert n'est exclu", () => {
    // (1 000 + 500 + 1 200 + 800) ÷ 3 = 3 500 ÷ 3 = 1 166,67
    expect(depensesMensuellesMoyennes(tx, { from: "2026-01", to: "2026-09" }, reglesVides()))
      .toEqual({ moyenne: 1166.67, nbMois: 3 });
  });
});

describe("interrupteur « Inclure l'immobilier »", () => {
  const opts = { period: "YTD" as const, transactions: [] };

  it("désactivé, retire la banque « Immobilier »", () => {
    const sans = filtrerImmobilier(releves(), false);
    expect(sans.some((r) => r.banque === "Immobilier")).toBe(false);
    // 57 relevés − 12 de l'appartement = 45
    expect(releves()).toHaveLength(57);
    expect(sans).toHaveLength(45);
  });

  it("activé : KPI identiques au calcul brut", () => {
    const res = calculerPatrimoine(releves(), { ...opts, inclureImmobilier: true }, R);
    expect(res.kpis!.total).toBe(T_SEPT);
    expect(res.aDeLImmobilier).toBe(true);
  });

  it("désactivé, tous les KPI passent en patrimoine financier", () => {
    // Appartement = 300 (k+1) : sept. 3 600, août 3 300, déc. 900
    const res = calculerPatrimoine(releves(), { ...opts, inclureImmobilier: false }, R);
    const k = res.kpis!;
    expect(k.total).toBe(11380.25);                    // 14 980,25 − 3 600
    expect(k.variationMois).toBe(280);                 // 11 380,25 − 11 100,25
    expect(k.epargne).toBe(10270);                     // 13 870 − 3 600
    expect(k.liquidites).toBe(1110.25);
    expect(k.partLiquidites).toBeCloseTo(1110.25 / 11380.25, 10);
    expect(k.evolutionAnnee!.montant).toBe(3060);      // 11 380,25 − 8 320,25
    expect(k.gainMensuelMoyen).toEqual({ montant: 340, nbMois: 9 }); // 3 060 ÷ 9
    expect(res.banques).not.toContain("Immobilier");
    expect(res.aDeLImmobilier).toBe(true);             // l'interrupteur reste affiché
  });
});

describe("graphiques", () => {
  const g = construireGrille(releves());
  const ytd = plagePeriode("YTD", "2026-09", "2025-10");

  it("plages : YTD janv. → sept., 3M juil. → sept., 12M bornée au premier mois", () => {
    expect(ytd).toEqual({ from: "2026-01", to: "2026-09" });
    // Même découpage que filtrerDonnees.ts : 3M = les 3 derniers mois.
    expect(plagePeriode("3M", "2026-09", "2025-10")).toEqual({ from: "2026-07", to: "2026-09" });
    expect(plagePeriode("6M", "2026-09", "2025-10")).toEqual({ from: "2026-04", to: "2026-09" });
    expect(plagePeriode("12M", "2026-09", "2025-10")).toEqual({ from: "2025-10", to: "2026-09" });
    expect(plagePeriode("12M", "2026-06", "2025-10")).toEqual({ from: "2025-10", to: "2026-06" });
  });

  it("par banque : août = 7 000,25 / 3 000 / 3 300 / 1 100", () => {
    const s = serieParBanque(g, ytd);
    expect(s).toHaveLength(9);
    const aout = s.find((l) => l.mk === "2026-08")!;
    expect(aout["Banque A"]).toBe(7000.25);   // 1 100,25 + 5 900 (repris)
    expect(aout["Banque B"]).toBe(3000);      // 2 500 + 500
    expect(aout["Immobilier"]).toBe(3300);
    expect(aout["Banque C"]).toBe(1100);
    expect(aout.total).toBe(T_AOUT);
    expect(aout.soldesRepris).toBe(1);
  });

  it("par nature : août = 1 100,25 liquidités / 13 300 épargne", () => {
    const aout = serieParNature(g, ytd).find((l) => l.mk === "2026-08")!;
    expect(aout["Liquidité"]).toBe(1100.25);
    expect(aout["Epargne"]).toBe(13300);
  });

  it("variations janv. → sept., somme = KPI 4", () => {
    const v = variationsMensuelles(g, ytd);
    expect(v.map((x) => x.variation)).toEqual([460, 460, 1460, 480, 480, 480, 980, 380, 580]);
    expect(v.every((x) => x.hausse)).toBe(true);
  });

  it("une baisse est marquée hausse = false", () => {
    const r = (mk: string, montant: number): ReleveSoldeLu => ({
      ordre: 1, compte: "Compte X", nature: "Liquidité", banque: "Banque X", mk, date: `${mk}-28`, montant,
    });
    const g2 = construireGrille([r("2026-01", 1000), r("2026-02", 700)]);
    expect(variationsMensuelles(g2, { from: "2026-01", to: "2026-02" }))
      .toEqual([{ mk: "2026-02", variation: -300, hausse: false }]);
  });

  it("répartition de septembre par banque, du plus gros au plus petit", () => {
    const rep = repartitionParBanque(g, "2026-09");
    expect(rep.map((p) => [p.banque, p.montant])).toEqual([
      ["Banque A", 7210.25],   // 1 110,25 + 6 100
      ["Immobilier", 3600],
      ["Banque B", 3050],      // 2 550 + 500
      ["Banque C", 1120],
    ]);
    expect(rep[1].part).toBeCloseTo(3600 / T_SEPT, 10);
  });

  it("tableau : lignes de septembre (solde, 1 mois, depuis janvier, poids)", () => {
    const lignes = lignesComptes(g, "2026-09", ytd);
    expect(lignes).toHaveLength(6);
    const la = lignes.find((l) => l.compte === LIVRET_A)!;
    expect(la.solde).toBe(6100);
    expect(la.variation1Mois).toBe(200);           // 6 100 − 5 900 (repris en août)
    expect(la.variationDepuisJanvier).toBe(900);   // 6 100 − 5 200 (déc., k=2)
    expect(la.poids).toBeCloseTo(6100 / T_SEPT, 10);
    expect(la.historique).toHaveLength(9);

    const av = lignes.find((l) => l.compte === ASSURANCE_VIE_C)!;
    expect(av.variation1Mois).toBe(20);
    expect(av.variationDepuisJanvier).toBe(1120);  // ouverte en mars : tout est nouveau
    expect(av.historique).toHaveLength(7);         // mars → sept.

    expect(lignes.find((l) => l.compte === COMPTE_TITRES_B)!.variationDepuisJanvier).toBe(500);
  });

  it("tableau : les variations des comptes s'additionnent au KPI 4 (5 760)", () => {
    const somme = lignesComptes(g, "2026-09", ytd).reduce((s, l) => s + l.variationDepuisJanvier, 0);
    // 90 + 900 + 450 + 2 700 + 500 + 1 120
    expect(Math.round(somme * 100) / 100).toBe(5760);
  });
});

describe("calculerPatrimoine — sans relevé", () => {
  it("rend des listes vides et kpis null", () => {
    const res = calculerPatrimoine([], { inclureImmobilier: true, period: "YTD", transactions: [] }, R);
    expect(res.dernierMoisComplet).toBeNull();
    expect(res.kpis).toBeNull();
    expect(res.serieParBanque).toEqual([]);
    expect(res.comptes).toEqual([]);
    expect(res.aDeLImmobilier).toBe(false);
  });
});
