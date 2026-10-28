// ── Patrimoine D-4b — les cas de l'étape P6 du site privé ────────────────
//
// Nature « Immobilier », filtre de la page par la légende de l'Évolution
// (plusieurs valeurs), mois du donut. Recopiés sur le jeu générique
// (helpers/patrimoineFictif.ts). Attendus refaits À LA MAIN,
// septembre 2026 (k = 11) / août 2026 (k = 10) / décembre 2025 (k = 2) :
//   Courant A        Liquidité  Banque A    1 110,25 / 1 100,25 / 1 020,25
//   Livret A         Epargne    Banque A    6 100    / 5 900 (repris) / 5 200
//   Titres B         Epargne    Banque B    2 550    / 2 500    / 2 100
//   Appartement      Epargne    Immobilier  3 600    / 3 300    / 900
//   Compte titres B  Epargne    Banque B      500    /   500    / —
//   Assurance-vie C  Epargne    Banque C    1 120    / 1 100    / —
//   Total septembre = 14 980,25.

import { describe, it, expect } from "vitest";
import {
  calculerPatrimoine, estImmobilier, naturesOrdonnees, construireGrille,
  serieParNature, repartitionParBanque, type OptionsPatrimoine,
} from "@/calculs/calculPatrimoine";
import type { ReleveSoldeLu } from "@/services/lectureClasseur";
import { REGLES_DEMO } from "../helpers/parametrageDemo";
import {
  relevesFictifs, APPARTEMENT, TITRES_B, COMPTE_TITRES_B, ASSURANCE_VIE_C,
} from "../helpers/patrimoineFictif";

const R = REGLES_DEMO;
const releves = () => relevesFictifs();
const opts: OptionsPatrimoine = { inclureImmobilier: true, period: "YTD", transactions: [] };

/** L'appartement passe en nature « Immobilier », dans une banque ordinaire. */
const avecNatureImmobilier = (): ReleveSoldeLu[] =>
  releves().map((r) => (r.compte === APPARTEMENT ? { ...r, nature: "Immobilier", banque: "Banque A" } : r));

describe("P6 — nature Immobilier", () => {
  it("estImmobilier : banque OU nature « Immobilier »", () => {
    const r = releves()[0];
    expect(estImmobilier({ ...r, banque: "Immobilier", nature: "Epargne" })).toBe(true);
    expect(estImmobilier({ ...r, banque: "Banque A", nature: "Immobilier" })).toBe(true);
    expect(estImmobilier({ ...r, banque: "Banque A", nature: "Epargne" })).toBe(false);
  });

  it("par nature : 3 séries, l'immobilier séparé de l'épargne", () => {
    const g = construireGrille(avecNatureImmobilier());
    expect(naturesOrdonnees(g)).toEqual(["Epargne", "Liquidité", "Immobilier"]);
    const sept = serieParNature(g, { from: "2026-09", to: "2026-09" })[0];
    expect(sept["Immobilier"]).toBe(3600);
    expect(sept["Epargne"]).toBe(10270); // 6 100 + 2 550 + 500 + 1 120
    expect(sept["Liquidité"]).toBe(1110.25);
    expect(sept.total).toBe(14980.25);
  });

  it("6 KPI gardés : « Épargne placée » inclut l'immobilier", () => {
    const res = calculerPatrimoine(avecNatureImmobilier(), opts, R);
    expect(res.natures).toEqual(["Epargne", "Liquidité", "Immobilier"]);
    expect(res.kpis!.total).toBe(14980.25);
    expect(res.kpis!.epargne).toBe(13870);
    expect(res.kpis!.liquidites).toBe(1110.25);
  });

  it("interrupteur coupé : la nature Immobilier est retirée, même hors banque Immobilier", () => {
    const res = calculerPatrimoine(avecNatureImmobilier(), { ...opts, inclureImmobilier: false }, R);
    expect(res.aDeLImmobilier).toBe(true);
    expect(res.kpis!.total).toBe(11380.25); // 14 980,25 − 3 600
    expect(res.natures).toEqual(["Epargne", "Liquidité"]);
  });
});

describe("P6 — filtre de la page par la légende", () => {
  it("une banque : KPI, tableau, variations et donut par compte limités à cette banque", () => {
    const res = calculerPatrimoine(releves(), { ...opts, selection: { par: "banque", valeurs: ["Banque B"] } }, R);
    expect(res.selection).toEqual(["Banque B"]);
    expect(res.dernierMoisComplet).toBe("2026-09");
    expect(res.kpis!.total).toBe(3050);         // 2 550 + 500
    expect(res.kpis!.variationMois).toBe(50);   // août 2 500 + 500 = 3 000
    expect(res.kpis!.evolutionAnnee!.montant).toBe(950); // déc. 2025 : 2 100
    expect(res.variations.reduce((s, v) => s + v.variation, 0)).toBe(950);
    expect(res.comptes.map((c) => c.compte)).toEqual([TITRES_B, COMPTE_TITRES_B]);
    expect(res.repartitionParCompte.map((r) => [r.compte, r.montant])).toEqual([[TITRES_B, 2550], [COMPTE_TITRES_B, 500]]);
    expect(res.repartitionParCompte[0].part).toBeCloseTo(2550 / 3050, 10);
    expect(res.comptesSerie).toEqual([TITRES_B, COMPTE_TITRES_B]);
    const sept = res.serieParCompte.find((l) => l.mk === "2026-09")!;
    expect(sept[TITRES_B]).toBe(2550);
    expect(sept[COMPTE_TITRES_B]).toBe(500);
  });

  it("la légende garde toutes les banques ; les autres valent 0 dans l'Évolution", () => {
    const res = calculerPatrimoine(releves(), { ...opts, selection: { par: "banque", valeurs: ["Banque B"] } }, R);
    expect(res.banques).toEqual(["Banque A", "Banque B", "Immobilier", "Banque C"]);
    const sept = res.serieParBanque.find((l) => l.mk === "2026-09")!;
    expect(sept["Banque B"]).toBe(3050);
    expect(sept["Banque A"]).toBe(0);
    expect(sept.total).toBe(3050);
  });

  it("plusieurs banques se cumulent", () => {
    const res = calculerPatrimoine(releves(), {
      ...opts, selection: { par: "banque", valeurs: ["Banque B", "Banque C"] },
    }, R);
    expect(res.kpis!.total).toBe(4170); // 3 050 + 1 120
    expect(res.comptes.map((c) => c.compte)).toEqual([TITRES_B, COMPTE_TITRES_B, ASSURANCE_VIE_C]);
  });

  it("par nature : Liquidité seule", () => {
    const res = calculerPatrimoine(releves(), { ...opts, selection: { par: "nature", valeurs: ["Liquidité"] } }, R);
    expect(res.kpis!.total).toBe(1110.25);
    expect(res.kpis!.liquidites).toBe(1110.25);
    expect(res.kpis!.partLiquidites).toBe(1);
  });

  it("le mois complet se juge sur la sélection : sans Banque A, août est complet", () => {
    // Le seul oubli (livret, août) est chez Banque A : les autres banques
    // seules n'ont aucun solde repris.
    const res = calculerPatrimoine(releves(), {
      ...opts, selection: { par: "banque", valeurs: ["Banque B", "Immobilier", "Banque C"] },
    }, R);
    expect(res.grille.nbRepris["2026-08"]).toBe(0);
    const avecA = calculerPatrimoine(releves(), { ...opts, selection: { par: "banque", valeurs: ["Banque A"] } }, R);
    expect(avecA.dernierMoisComplet).toBe("2026-09");
    expect(avecA.kpis!.total).toBe(7210.25); // 1 110,25 + 6 100
    expect(avecA.grille.nbRepris["2026-08"]).toBe(1); // livret repris
  });

  it("valeur inconnue (ou immobilier coupé) : filtre ignoré, page complète", () => {
    const inconnue = calculerPatrimoine(releves(), { ...opts, selection: { par: "banque", valeurs: ["Banque Z"] } }, R);
    expect(inconnue.selection).toEqual([]);
    expect(inconnue.kpis!.total).toBe(14980.25);
    expect(inconnue.repartitionParCompte).toEqual([]);
    expect(inconnue.serieParCompte).toEqual([]);
    const coupe = calculerPatrimoine(releves(), {
      ...opts, inclureImmobilier: false, selection: { par: "banque", valeurs: ["Immobilier"] },
    }, R);
    expect(coupe.selection).toEqual([]);
    expect(coupe.kpis!.total).toBe(11380.25);
  });

  it("sans filtre : ni donut par compte, ni détail par compte", () => {
    const res = calculerPatrimoine(releves(), opts, R);
    expect(res.selection).toEqual([]);
    expect(res.kpis!.total).toBe(14980.25);
    expect(res.repartitionParCompte).toEqual([]);
    expect(res.comptesSerie).toEqual([]);
  });
});

describe("P6 — mois du donut (clic sur un mois de l'Évolution)", () => {
  it("le donut montre le mois choisi ; KPI et tableau restent au dernier mois complet", () => {
    const res = calculerPatrimoine(releves(), { ...opts, moisRepartition: "2026-03" }, R);
    expect(res.moisRepartition).toBe("2026-03");
    // mars 2026 (k = 5) : A 1 050,25 + 5 500 ; B 2 250 ; appartement 1 800 ; C 1 000
    expect(res.repartition).toEqual(repartitionParBanque(res.grille, "2026-03"));
    expect(res.repartition.find((r) => r.banque === "Banque A")!.montant).toBe(6550.25);
    expect(res.repartition.find((r) => r.banque === "Immobilier")!.montant).toBe(1800);
    expect(res.kpis!.mois).toBe("2026-09");
    expect(res.kpis!.total).toBe(14980.25);
  });

  it("mois inconnu ou après le dernier mois complet : retour au dernier mois complet", () => {
    expect(calculerPatrimoine(releves(), { ...opts, moisRepartition: "2030-01" }, R).moisRepartition).toBe("2026-09");
    expect(calculerPatrimoine(releves(), { ...opts, moisRepartition: null }, R).moisRepartition).toBe("2026-09");
  });

  it("page filtrée + mois choisi : donut par compte au mois choisi", () => {
    const res = calculerPatrimoine(releves(), {
      ...opts, selection: { par: "banque", valeurs: ["Banque B"] }, moisRepartition: "2026-03",
    }, R);
    expect(res.repartitionParCompte.map((r) => [r.compte, r.montant])).toEqual([[TITRES_B, 2250]]);
  });
});
