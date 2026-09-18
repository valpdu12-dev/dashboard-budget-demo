import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rubriquesDisponibles } from "@/hooks/useRubriques";
import { decodeTransactions } from "@/utils/decode";
import type { RawTransactionsJSON, SalaryData } from "@/types";
import { makeTx, makeTransactions, makeSalaryData, makeSalaryMonth, makeConfig } from "../helpers/factories";
import type { Config } from "@/types";
import { REGLES_DEMO } from "../helpers/parametrageDemo";

/**
 * Les quatre jeux de la recette du lot B.4 : complet, sans paie, sans prêt,
 * sans les deux.
 *
 * La règle défendue ici : la décision se prend sur le JEU COMPLET. Un mois
 * sans échéance ne fait pas disparaître l'onglet Prêt — sinon la navigation
 * se réorganiserait à chaque changement de filtre.
 */

const echeance = () => makeTx({ date: "2025-02-05", type: "Crédit Immobilier", montant: 640 });
const interets = () => makeTx({ date: "2025-02-05", type: "Intérêt du prêt", montant: 253 });

const CONFIG_AVEC_PRET: Config = makeConfig({
  pret: { montant: 180000, mensualite: 893.6, echeances: 240 },
});
const CONFIG_SANS_PRET: Config = makeConfig();

const PAIE = makeSalaryData([makeSalaryMonth({ mk: "2025-01" })]);
const SANS_PAIE = makeSalaryData([]);

describe("les quatre jeux de test", () => {
  it("jeu complet — paie et prêt", () => {
    const r = rubriquesDisponibles([...makeTransactions(), echeance(), interets()], PAIE, CONFIG_AVEC_PRET, REGLES_DEMO);
    expect(r).toEqual({ paie: true, pret: true, epargne: true });
  });

  it("jeu sans paie — le prêt reste", () => {
    const r = rubriquesDisponibles([...makeTransactions(), echeance()], SANS_PAIE, CONFIG_AVEC_PRET, REGLES_DEMO);
    expect(r).toEqual({ paie: false, pret: true, epargne: true });
  });

  it("jeu sans prêt — la paie reste", () => {
    const r = rubriquesDisponibles(makeTransactions(), PAIE, CONFIG_SANS_PRET, REGLES_DEMO);
    expect(r).toEqual({ paie: true, pret: false, epargne: true });
  });

  it("jeu sans paie ni prêt", () => {
    const r = rubriquesDisponibles(makeTransactions(), SANS_PAIE, CONFIG_SANS_PRET, REGLES_DEMO);
    expect(r).toEqual({ paie: false, pret: false, epargne: true });
  });
});

describe("ce qui fait exister un prêt", () => {
  it("des échéances dans les transactions suffisent, sans rien de déclaré", () => {
    expect(rubriquesDisponibles([echeance()], SANS_PAIE, CONFIG_SANS_PRET, REGLES_DEMO).pret).toBe(true);
  });

  it("un prêt déclaré suffit, même sans aucune échéance passée", () => {
    // Un prêt qui commence le mois prochain est un prêt.
    expect(rubriquesDisponibles([], SANS_PAIE, CONFIG_AVEC_PRET, REGLES_DEMO).pret).toBe(true);
  });

  it("un bloc prêt incomplet ne fait PAS exister de prêt", () => {
    const bancal = makeConfig({
      pret: { montant: 180000, mensualite: 0, echeances: 240 },
    });
    expect(rubriquesDisponibles([], SANS_PAIE, bancal, REGLES_DEMO).pret).toBe(false);
  });

  it("ne se laisse pas décider par la période affichée", () => {
    // Le même jeu, dont on ne garderait que janvier : aucune échéance en
    // janvier, mais le prêt existe bel et bien dans le jeu complet.
    const complet = [...makeTransactions(), echeance()];
    const janvierSeul = complet.filter((t) => t.date.startsWith("2025-01"));
    expect(janvierSeul.some((t) => t.type === "Crédit Immobilier")).toBe(false);
    expect(rubriquesDisponibles(complet, PAIE, CONFIG_SANS_PRET, REGLES_DEMO).pret).toBe(true);
  });
});

describe("cas limites", () => {
  it("aucune donnée : aucune rubrique", () => {
    expect(rubriquesDisponibles([], null, null, REGLES_DEMO)).toEqual({ paie: false, pret: false, epargne: true });
  });

  it("une paie vide ne compte pas comme une paie", () => {
    expect(rubriquesDisponibles([], makeSalaryData([]), null, REGLES_DEMO).paie).toBe(false);
  });
});

describe("le jeu de démonstration publié", () => {
  // Non-régression de la démo en ligne : elle doit continuer d'afficher ses
  // neuf écrans. Une rubrique qui disparaîtrait du site serait le premier
  // effet visible d'une erreur dans ce module.
  const lire = <T,>(nom: string): T =>
    JSON.parse(readFileSync(resolve(__dirname, "../../../public/data", nom), "utf8"));

  it("fait exister la paie ET le prêt", () => {
    const tx = decodeTransactions(lire<RawTransactionsJSON>("transactions.json"));
    const salaire = lire<SalaryData>("salary.json");
    const config = lire<Config>("config.json");
    expect(rubriquesDisponibles(tx, salaire, config, REGLES_DEMO)).toEqual({ paie: true, pret: true, epargne: true });
  });
});
