// ── DM-01 (A8) — des noms qui piègent les objets JavaScript ──────────────
//
// Un objet ordinaire `{}` hérite de propriétés : `constructor`, `toString`,
// `__proto__`… Regrouper des montants dans `{}` avec un nom de catégorie,
// de compte ou de type choisi par l'utilisateur donne alors un montant faux
// (« constructor » part de la fonction Object au lieu de 0) ou perdu
// (« __proto__ » ne crée pas de clé). L'audit du 03/11/2026 l'a prouvé.
//
// La preuve ici : le MÊME jeu de transactions, une fois avec des noms
// ordinaires, une fois avec des noms piégés. Une fois les noms remis, les
// résultats doivent être identiques à l'octet.

import { describe, it, expect } from "vitest";
import { calculerSoldes } from "@/calculs/calculSoldes";
import { calculerKPIs } from "@/calculs/calculKPIs";
import { calculerInsights } from "@/calculs/calculInsights";
import { calculerEpargne } from "@/calculs/calculEpargne";
import { calculerDepenses } from "@/calculs/calculDepenses";
import { filtrerDonnees, type EtatFiltres } from "@/calculs/filtrerDonnees";
import { calculerPatrimoine } from "@/calculs/calculPatrimoine";
import type { ReleveSoldeLu } from "@/services/lectureClasseur";
import { reglesVides } from "@/calculs/regles";
import { makeTx } from "../helpers/factories";
import type { Transaction } from "@/types";

const R = reglesVides();
const PIEGES = ["constructor", "toString", "__proto__"];
const ORDINAIRES = ["NomUn", "NomDeux", "NomTrois"];

/** Le même jeu, avec les noms donnés pour catégories, enseignes, types et comptes. */
function jeu(noms: string[]): Transaction[] {
  const [a, b, c] = noms;
  const tx: Transaction[] = [];
  const mois = ["2026-01", "2026-02", "2026-03"];
  mois.forEach((mk, i) => {
    tx.push(makeTx({ date: `${mk}-05`, monthKey: mk, compte: a, type: b, cat2: a, cat3: b, cat4: c, montant: 100 + i, dc: "Débit" }));
    tx.push(makeTx({ date: `${mk}-10`, monthKey: mk, compte: b, type: c, cat2: b, cat3: c, cat4: a, montant: 40 + i, dc: "Débit" }));
    tx.push(makeTx({ date: `${mk}-15`, monthKey: mk, compte: c, type: a, cat2: c, cat3: a, cat4: b, montant: 7 + i, dc: "Débit" }));
    tx.push(makeTx({ date: `${mk}-20`, monthKey: mk, compte: a, type: "Salaire", cat1: "", cat2: "", montant: 2000, dc: "Crédit" }));
  });
  return tx;
}
const MOIS = ["2026-01", "2026-02", "2026-03"];
const FILTRES: EtatFiltres = {
  period: "all", cat1Filter: "all", showTransfers: false,
  selMonth: null, selCat2: null, selType: null, selOrg: null,
  selEnseignes: [], selEvenements: [],
};

/** Relevés de la feuille Patrimoine : comptes et banques aux noms donnés. */
function releves(noms: string[]): ReleveSoldeLu[] {
  const [a, b, c] = noms;
  const comptes: [string, string, ReleveSoldeLu["nature"], number][] = [
    [a, b, "Liquidité", 1000], [b, c, "Epargne", 5000], [c, a, "Epargne", 250],
  ];
  const r: ReleveSoldeLu[] = [];
  MOIS.forEach((mk, i) => comptes.forEach(([compte, banque, nature, base], j) => r.push({
    ordre: j + 1, compte, banque, nature, mk, date: `${mk}-28`, montant: base + 10 * i,
  })));
  return r;
}

/** Tous les calculs qui regroupent par nom, sur un jeu. */
function tout(noms: string[]) {
  const tx = jeu(noms);
  const [a, b, c] = noms;
  const depart = { [a]: 1000, [b]: 500, [c]: 50 };
  return {
    filtre: filtrerDonnees(tx, FILTRES, R),
    soldes: calculerSoldes(tx, MOIS, depart, R),
    kpis: calculerKPIs(tx, {}, [], "2026-03", "2026-02", R),
    insights: calculerInsights(tx, "2026-03", "2026-02", R),
    epargne: calculerEpargne({
      txSource: tx, baseTx: tx, allMonthsInRange: MOIS,
      currentMonth: "2026-03", prevMonth: "2026-02", selEpMonth: null,
    }, R),
    patrimoine: calculerPatrimoine(releves(noms), { inclureImmobilier: true, period: "all", transactions: tx }, R),
    depenses: calculerDepenses({
      baseTx: tx, filteredTx: tx, allMonthsInRange: MOIS,
      selCat2: null, selType: null, selOrg: null,
      selEnseignes: [], selEvenements: [], allTransactions: tx,
    }, R),
  };
}

/** Sérialise en remettant les noms ordinaires, clés comprises, dans un ordre stable. */
function normaliser(v: unknown, noms: string[]): string {
  // Les courbes nomment aussi la valeur du mois précédent « prev_<nom> ».
  const renomme = (s: string): string => {
    if (s.startsWith("prev_")) return "prev_" + renomme(s.slice(5));
    const i = noms.indexOf(s);
    return i >= 0 ? ORDINAIRES[i] : s;
  };
  const marche = (x: unknown): unknown => {
    if (typeof x === "string") return renomme(x);
    if (Array.isArray(x)) return x.map(marche);
    if (x && typeof x === "object") {
      const o: Record<string, unknown> = Object.create(null);
      for (const k of Object.keys(x).sort()) o[renomme(k)] = marche((x as Record<string, unknown>)[k]);
      return Object.keys(o).sort().map((k) => [k, o[k]]);
    }
    if (typeof x === "function") return "<fonction>";
    return x;
  };
  return JSON.stringify(marche(v));
}

describe("noms piégés : constructor, toString, __proto__ (DM-01 A8)", () => {
  const ordinaire = tout(ORDINAIRES);
  const piege = tout(PIEGES);
  for (const calcul of Object.keys(ordinaire) as (keyof typeof ordinaire)[]) {
    it(`${calcul} : mêmes résultats qu'avec des noms ordinaires`, () => {
      expect(normaliser(piege[calcul], PIEGES)).toBe(normaliser(ordinaire[calcul], ORDINAIRES));
    });
  }

  it("le prototype global reste intact", () => {
    tout(PIEGES);
    expect(({} as Record<string, unknown>).NomUn).toBeUndefined();
    expect(Object.prototype.toString.call([])).toBe("[object Array]");
  });
});
