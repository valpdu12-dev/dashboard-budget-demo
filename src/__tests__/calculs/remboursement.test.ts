// ── La nature « remboursement » — C.7 ────────────────────────────────────
//
// Un remboursement est un CRÉDIT (montant positif) dont le type porte la
// nature `remboursement`. Il doit RÉDUIRE les dépenses (comme le débit négatif
// de l'ancien tableur) et NE PAS compter dans les recettes. Ce fichier
// verrouille cette règle : le helper, puis son effet dans les calculs.

import { describe, it, expect } from "vitest";
import { construireRegles } from "@/calculs/regles";
import { normaliserCle } from "@/services/lectureValeurs";
import {
  estRemboursement,
  estRecette,
  toucheDepenses,
  montantDepense,
} from "@/calculs/mouvements";
import { calculerKPIs } from "@/calculs/calculKPIs";
import { calculerEpargne } from "@/calculs/calculEpargne";
import { calculerSoldes } from "@/calculs/calculSoldes";
import type { BudgetConfig } from "@/types/budgetConfig";
import type { Transaction } from "@/types";

type Nature = BudgetConfig["types"][number]["natures"][number];
type Classe = BudgetConfig["types"][number]["classeParDefaut"];
const typeDe = (libelle: string, natures: Nature[], classeParDefaut: Classe = null) => ({
  libelle, cle: normaliserCle(libelle), natures, classeParDefaut,
});

const CONFIG: BudgetConfig = {
  estVide: false,
  comptes: [
    {
      id: "compte", libelle: "Compte", organisme: "Org", participation: 1,
      compteLie: null, sensRepercute: null, porteUnSolde: true, couleur: "#112233", soldeDepart: 0,
    },
    {
      id: "joint", libelle: "Compte joint", organisme: "Org", participation: 1,
      compteLie: "compte", sensRepercute: "Débit", porteUnSolde: false, couleur: "#445566", soldeDepart: null,
    },
  ],
  types: [
    typeDe("Courses", [], "Dépense Courante"),
    typeDe("Salaire", []),
    typeDe("Remboursement", ["remboursement"]),
  ],
  categories: [],
  employeurs: [],
  compteCreditSortiesEpargne: null,
};
const R = construireRegles(CONFIG);

function tx(o: Partial<Transaction>): Transaction {
  return {
    compte: "Compte", type: "Courses", date: "2026-02-05", montant: 100,
    cat1: "", cat2: "Alimentation", cat3: "", cat4: "", ville: "",
    dc: "Débit", label: "", monthKey: "2026-02", ...o,
  };
}

describe("nature remboursement — le helper", () => {
  const remb = tx({ type: "Remboursement", dc: "Crédit", montant: 30 });
  const dep = tx({ type: "Courses", dc: "Débit", montant: 100 });
  const sal = tx({ type: "Salaire", dc: "Crédit", montant: 2000 });

  it("estRemboursement : seulement un crédit de nature remboursement", () => {
    expect(estRemboursement(remb, R)).toBe(true);
    expect(estRemboursement(dep, R)).toBe(false);
    expect(estRemboursement(sal, R)).toBe(false);
  });
  it("estRecette : exclut le remboursement, garde le vrai crédit", () => {
    expect(estRecette(sal, R)).toBe(true);
    expect(estRecette(remb, R)).toBe(false);
    expect(estRecette(dep, R)).toBe(false);
  });
  it("montantDepense : +débit, −remboursement, 0 pour une recette", () => {
    expect(montantDepense(dep, R)).toBe(100);
    expect(montantDepense(remb, R)).toBe(-30);
    expect(montantDepense(sal, R)).toBe(0);
  });
  it("toucheDepenses : un débit ou un remboursement", () => {
    expect(toucheDepenses(dep, R)).toBe(true);
    expect(toucheDepenses(remb, R)).toBe(true);
    expect(toucheDepenses(sal, R)).toBe(false);
  });
});

describe("nature remboursement — dans les calculs", () => {
  const TX = [
    tx({ date: "2026-02-05", monthKey: "2026-02", type: "Courses", dc: "Débit", montant: 100, cat2: "Alimentation" }),
    tx({ date: "2026-02-06", monthKey: "2026-02", type: "Remboursement", dc: "Crédit", montant: 30, cat2: "Alimentation" }),
    tx({ date: "2026-02-07", monthKey: "2026-02", type: "Salaire", dc: "Crédit", montant: 2000, cat2: "" }),
  ];

  it("calculerKPIs : le remboursement réduit les dépenses, hors recettes", () => {
    const k = calculerKPIs(TX, {}, [], "2026-02", null, R);
    expect(k.depCur).toBe(70);   // 100 − 30
    expect(k.recCur).toBe(2000); // le salaire seul
  });

  it("calculerEpargne : le total des recettes exclut le remboursement", () => {
    const e = calculerEpargne(
      { txSource: TX, baseTx: TX, allMonthsInRange: ["2026-02"], currentMonth: "2026-02", prevMonth: null, selEpMonth: null },
      R
    );
    expect(e.kpis.totalRec).toBe(2000);
  });
});

describe("nature remboursement — soldes et compte lié", () => {
  it("un remboursement sur un compte joint revient sur le compte lié", () => {
    // Dépense 100 sur le joint → −100 sur le compte principal (répercussion Débit).
    // Remboursement 30 sur le joint → +30 (il annule une part de cette dépense).
    const TX = [
      tx({ compte: "Compte joint", type: "Courses", dc: "Débit", montant: 100, monthKey: "2026-01" }),
      tx({ compte: "Compte joint", type: "Remboursement", dc: "Crédit", montant: 30, monthKey: "2026-01" }),
    ];
    const s = calculerSoldes(TX, ["2026-01"], { Compte: 1000 }, R);
    expect(s.currentBalances.Compte).toBe(930);
  });

  it("un remboursement sur un compte qui porte un solde le crédite", () => {
    const TX = [tx({ compte: "Compte", type: "Remboursement", dc: "Crédit", montant: 30, monthKey: "2026-01" })];
    const s = calculerSoldes(TX, ["2026-01"], { Compte: 1000 }, R);
    expect(s.currentBalances.Compte).toBe(1030);
  });
});


// ═══════════════════════════════════════════════════════════════════════
// F11, amendé le 24/09/2026 — le remboursement garde son type d'origine
// ═══════════════════════════════════════════════════════════════════════
//
// L'exemple de l'auteur : 40 € de courses, 15 € remboursés. Son tableur
// compte 25 € d'Alimentation. Le remboursement s'écrit « Courses » + Crédit.

describe("F11 — un crédit sur un type de dépense est un remboursement", () => {
  const TX = [
    tx({ date: "2026-02-05", type: "Courses", dc: "Débit", montant: 40, cat2: "Alimentation" }),
    tx({ date: "2026-02-06", type: "Courses", dc: "Crédit", montant: 15, cat2: "Alimentation" }),
    tx({ date: "2026-02-07", type: "Salaire", dc: "Crédit", montant: 2000, cat2: "" }),
  ];

  it("helper : Courses + Crédit est un remboursement ; Salaire + Crédit reste une recette", () => {
    expect(estRemboursement(TX[1], R)).toBe(true);
    expect(estRecette(TX[1], R)).toBe(false);
    expect(estRemboursement(TX[2], R)).toBe(false);
    expect(estRecette(TX[2], R)).toBe(true);
  });

  it("dépenses 25 €, recettes 2 000 € — comme le tableur de l'auteur", () => {
    const k = calculerKPIs(TX, {}, [], "2026-02", null, R);
    expect(k.depCur).toBe(25);
    expect(k.recCur).toBe(2000);
  });

  it("sur un compte joint lié en Débit, le remboursement revient au compte principal", () => {
    const J = [
      tx({ compte: "Compte joint", type: "Courses", dc: "Débit", montant: 40, monthKey: "2026-01" }),
      tx({ compte: "Compte joint", type: "Courses", dc: "Crédit", montant: 15, monthKey: "2026-01" }),
    ];
    const s = calculerSoldes(J, ["2026-01"], { Compte: 1000 }, R);
    expect(s.currentBalances.Compte).toBe(975);
  });

  it("la preuve qui sait échouer : sans classe déclarée, le même crédit redevient une recette", () => {
    const SANS: BudgetConfig = {
      ...CONFIG,
      types: CONFIG.types.map((t) => (t.libelle === "Courses" ? { ...t, classeParDefaut: null } : t)),
    };
    const R2 = construireRegles(SANS);
    expect(estRemboursement(TX[1], R2)).toBe(false);
    expect(calculerKPIs(TX, {}, [], "2026-02", null, R2).depCur).toBe(40);
  });
});
