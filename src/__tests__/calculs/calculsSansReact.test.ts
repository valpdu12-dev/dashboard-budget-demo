// ── Les calculs tournent sans React — lot C.3 ────────────────────────────
//
// C'est le but de l'étape, et sa preuve. Chaque fonction ci-dessous est
// appelée DIRECTEMENT : pas de `renderHook`, pas de store, pas de contexte.
//
// Pourquoi cela compte pour la suite : au C.4, le second jeu de test doit
// rejouer les mêmes calculs sur une configuration qui n'existe nulle part
// dans la démonstration. Un calcul qui va chercher son contexte lui-même ne
// peut pas être joué deux fois sur deux configurations différentes.

import { describe, it, expect } from "vitest";
import { calculerSoldes } from "@/calculs/calculSoldes";
import { calculerKPIs } from "@/calculs/calculKPIs";
import { calculerInsights } from "@/calculs/calculInsights";
import { calculerEpargne } from "@/calculs/calculEpargne";
import { calculerDepenses } from "@/calculs/calculDepenses";
import { calculerPret } from "@/calculs/calculPret";
import { filtrerDonnees } from "@/calculs/filtrerDonnees";
import { makeTx } from "../helpers/factories";
import { reglesVides } from "@/calculs/regles";
import type { EtatFiltres } from "@/calculs/filtrerDonnees";

/**
 * ⚠️ Lot C.4 — ces appels passent des règles VIDES, et c'est le cas qui
 * compte : une source qui ne déclare rien. Aucun type n'est alors un
 * transfert interne, aucun n'est de l'épargne, aucun compte n'a de compte
 * lié. L'outil ne remplace pas le silence par les règles de l'auteur.
 */
const R = reglesVides();

const TX = [
  makeTx({ date: "2026-01-05", monthKey: "2026-01", compte: "Banque A - Courant", montant: 100, dc: "Débit", cat1: "Dépense Courante", cat2: "Alimentation" }),
  makeTx({ date: "2026-02-05", monthKey: "2026-02", compte: "Banque A - Courant", montant: 2000, dc: "Crédit", type: "Salaire", cat1: "" }),
  makeTx({ date: "2026-02-10", monthKey: "2026-02", compte: "Banque A - Courant", montant: 300, dc: "Débit", cat1: "Dépense Fixe", cat2: "Logement" }),
];
const MOIS = ["2026-01", "2026-02"];

const FILTRES: EtatFiltres = {
  period: "all", cat1Filter: "all", showTransfers: false,
  selMonth: null, selCat2: null, selType: null, selOrg: null,
};

describe("les calculs s'appellent sans React", () => {
  it("filtrerDonnees rend les mois et les transactions de la période", () => {
    const d = filtrerDonnees(TX, FILTRES, R);
    expect(d.allMonths).toEqual(MOIS);
    expect(d.currentMonth).toBe("2026-02");
    expect(d.prevMonth).toBe("2026-01");
    expect(d.baseTx).toHaveLength(3);
  });

  it("calculerSoldes rend un solde depuis un point de départ déclaré", () => {
    const s = calculerSoldes(TX, MOIS, { "Banque A - Courant": 1000 }, R);
    expect(s.currentBalances["Banque A - Courant"]).toBe(2600);
    expect(s.aucunSoldeConnu).toBe(false);
    expect(s.comptesPresents).toEqual(["Banque A - Courant"]);
  });

  it("calculerSoldes laisse « non initialisé » ce qui n'est pas déclaré", () => {
    const s = calculerSoldes(TX, MOIS, {}, R);
    expect(s.aucunSoldeConnu).toBe(true);
    expect(s.comptesNonInitialises.length).toBeGreaterThan(0);
    expect(s.currentBalances.Total).toBeUndefined();
  });

  it("calculerKPIs rend les dépenses et recettes du mois", () => {
    const k = calculerKPIs(TX, {}, [], "2026-02", "2026-01", R);
    expect(k.depCur).toBe(300);
    expect(k.recCur).toBe(2000);
    expect(k.netMonth).toBe(1700);
    // `null`, jamais 0 : sans paie, le taux d'épargne n'est pas calculable.
    expect(k.tauxEpargne).toBeNull();
  });

  it("calculerInsights compare deux mois sans contexte React", () => {
    const i = calculerInsights(TX, "2026-02", "2026-01", R);
    expect(i.hausse.length + i.baisse.length).toBeGreaterThan(0);
  });

  it("calculerEpargne rend des totaux même sans ligne d'épargne", () => {
    const e = calculerEpargne({
      txSource: TX, baseTx: TX, allMonthsInRange: MOIS,
      currentMonth: "2026-02", prevMonth: "2026-01", selEpMonth: null,
    }, R);
    expect(e.kpis.totalEntrees).toBe(0);
    expect(e.kpis.totalRec).toBe(2000);
    expect(e.chartData).toHaveLength(2);
  });

  it("calculerDepenses rend ses tableaux depuis les seules données reçues", () => {
    const d = calculerDepenses({
      baseTx: TX, filteredTx: TX, allMonthsInRange: MOIS,
      selCat2: null, selType: null, selOrg: null, allTransactions: TX,
    }, R);
    expect(d.detailTotal).toBe(400);
    expect(d.expByCat2.map((c) => c.name).sort()).toEqual(["Alimentation", "Logement"]);
  });

  it("calculerPret n'a rien à montrer sans prêt déclaré ni échéance", () => {
    const p = calculerPret(TX, null, R);
    expect(p.hasData).toBe(false);
    // Sans bloc Prêt déclaré (E.3), plus de repli : aucun KPI inventé.
    expect(p.pretDeclare).toBe(false);
    expect(p.kpis).toBeNull();
  });
});
