// ── Le second jeu — la parade au piège du C.4 ────────────────────────────
//
// LE PIÈGE, écrit au plan d'action avant la première ligne de code :
//
//   « Le rapprochement à zéro peut être obtenu en recopiant les anciennes
//     règles dans la config de démonstration — vert, et sans rien avoir
//     généralisé. »
//
// C'est exactement ce qui vient d'être fait : la configuration du jeu de
// démonstration reproduit à l'identique les règles que le code portait en
// dur. Le rapprochement est donc vert, et il ne prouve rien à lui seul.
//
// CE FICHIER EST LA PREUVE. Rien de ce qu'il contient n'existe dans la
// démonstration :
//
//   - un seul compte qui porte un solde, là où la démonstration en a cinq ;
//   - un taux de participation à 30 %, là où le code ne connaissait que 50 % ;
//   - un compte lié entre deux comptes dont les noms n'apparaissent nulle
//     part dans `src/` ;
//   - des natures posées sur des types inventés.
//
// Si une seule règle était restée écrite en dur, ces tests échoueraient.

import { describe, it, expect } from "vitest";
import { calculerSoldes } from "@/calculs/calculSoldes";
import { calculerKPIs } from "@/calculs/calculKPIs";
import { calculerEpargne } from "@/calculs/calculEpargne";
import { calculerPret } from "@/calculs/calculPret";
import { filtrerDonnees, type EtatFiltres } from "@/calculs/filtrerDonnees";
import { construireRegles } from "@/calculs/regles";
import { normaliserCle } from "@/services/lectureValeurs";
import { rubriquesDisponibles } from "@/hooks/useRubriques";
import type { BudgetConfig } from "@/types/budgetConfig";
import type { Transaction } from "@/types";

// ─────────────────────────────────────────────────────────────────────────
// UNE CONFIGURATION QUI NE RESSEMBLE À RIEN DE CONNU
// ─────────────────────────────────────────────────────────────────────────

type Nature = BudgetConfig["types"][number]["natures"][number];
type Classe = BudgetConfig["types"][number]["classeParDefaut"];

const typeDe = (libelle: string, natures: Nature[], classeParDefaut: Classe = null) => ({
  libelle, cle: normaliserCle(libelle), natures, classeParDefaut,
});

const CONFIG: BudgetConfig = {
  estVide: false,
  comptes: [
    {
      id: "caisse de bord", libelle: "Caisse de bord", organisme: "Coopérative du Port",
      participation: 1, compteLie: null, sensRepercute: null, porteUnSolde: true,
      couleur: "#123456", soldeDepart: 1000,
    },
    {
      // 30 % : un taux que le code n'a jamais connu. Il ne connaissait que 50 %,
      // écrit compte par compte dans `HALF_COMPTES`.
      id: "cagnotte du voilier", libelle: "Cagnotte du Voilier", organisme: "Association",
      participation: 0.3, compteLie: "caisse de bord", sensRepercute: "Débit",
      porteUnSolde: false, couleur: "#654321", soldeDepart: null,
    },
    {
      id: "coffre du quai", libelle: "Coffre du quai", organisme: "Coopérative du Port",
      participation: 1, compteLie: "caisse de bord", sensRepercute: "Crédit",
      porteUnSolde: true, couleur: "#abcdef", soldeDepart: 500,
    },
  ],
  // ⚠️ `cle` est le libellé NORMALISÉ — sans casse ni accents. La première
  // version de ce fichier écrivait « mise de côté » avec son accent : le type
  // ne se retrouvait plus, et l'épargne valait 0. Le test a attrapé une
  // erreur de fixture, pas de code, mais il l'a attrapée.
  types: [
    typeDe("Mise de côté", ["epargne"]),
    typeDe("Reprise de mise", ["sortie-epargne"]),
    typeDe("Renflouement", ["transfert-interne"]),
    typeDe("Don du port", ["apport-exterieur"]),
    typeDe("Part de coque", ["pret-capital"]),
    typeDe("Loyer de coque", ["pret-interets"]),
    typeDe("Provisions", [], "Dépense Courante"),
  ],
  categories: [],
  employeurs: [],
  compteCreditSortiesEpargne: "coffre du quai",
};

const R = construireRegles(CONFIG);

function tx(o: Partial<Transaction>): Transaction {
  return {
    compte: "Caisse de bord", type: "Provisions", date: "2026-02-05",
    montant: 100, cat1: "Dépense Courante", cat2: "Vivres", cat3: "", cat4: "",
    ville: "", dc: "Débit", label: "", monthKey: "2026-02", ...o,
  };
}

const MOIS = ["2026-01", "2026-02"];
const FILTRES: EtatFiltres = {
  period: "all", cat1Filter: "all", showTransfers: false,
  selMonth: null, selCat2: null, selType: null, selOrg: null,
};

// ═══════════════════════════════════════════════════════════════════════
// LE COMPTE LIÉ, SUR DES COMPTES QUI N'EXISTENT NULLE PART
// ═══════════════════════════════════════════════════════════════════════

describe("le compte lié vient de la déclaration, pas d'une liste de noms", () => {
  it("un débit sur le compte lié en sens Débit retire du compte de contrepartie", () => {
    const s = calculerSoldes(
      [tx({ compte: "Cagnotte du Voilier", dc: "Débit", montant: 60, monthKey: "2026-01" })],
      MOIS, { "Caisse de bord": 1000, "Coffre du quai": 500 }, R
    );
    expect(s.currentBalances["Caisse de bord"]).toBe(940);
  });

  it("le sens NON déclaré ne se répercute pas — « Les deux » n'est pas un défaut", () => {
    // La Cagnotte ne répercute que ses débits. Un crédit ne touche donc pas
    // la Caisse. C'est la règle qui vaut 36 016,02 € sur le jeu de l'auteur.
    // F11 (24/09/2026) : ce crédit était écrit sur « Provisions », un type de
    // DÉPENSE — il serait désormais un remboursement. Le test vise un crédit
    // ordinaire : il prend un type sans classe.
    const s = calculerSoldes(
      [tx({ compte: "Cagnotte du Voilier", type: "Renflouement", dc: "Crédit", montant: 60, monthKey: "2026-01" })],
      MOIS, { "Caisse de bord": 1000, "Coffre du quai": 500 }, R
    );
    expect(s.currentBalances["Caisse de bord"]).toBe(1000);
  });

  it("l'autre compte lié, déclaré en sens Crédit, se comporte à l'inverse", () => {
    // F11 (24/09/2026) : ce crédit était écrit sur « Provisions », un type de
    // DÉPENSE — il serait désormais un remboursement. Le test vise un crédit
    // ordinaire : il prend un type sans classe.
    const s = calculerSoldes(
      [tx({ compte: "Coffre du quai", type: "Renflouement", dc: "Crédit", montant: 200, monthKey: "2026-01" })],
      MOIS, { "Caisse de bord": 1000, "Coffre du quai": 500 }, R
    );
    // Le Coffre porte un solde propre : +200 pour lui, −200 pour la Caisse.
    expect(s.currentBalances["Coffre du quai"]).toBe(700);
    expect(s.currentBalances["Caisse de bord"]).toBe(800);
  });

  it("un type de nature apport-exterieur NEUTRALISE le compte lié", () => {
    const s = calculerSoldes(
      [tx({ compte: "Coffre du quai", type: "Don du port", dc: "Crédit", montant: 200, monthKey: "2026-01" })],
      MOIS, { "Caisse de bord": 1000, "Coffre du quai": 500 }, R
    );
    expect(s.currentBalances["Coffre du quai"]).toBe(700);
    expect(s.currentBalances["Caisse de bord"]).toBe(1000);
  });

  it("un compte déclaré « ne porte pas de solde » n'apparaît dans aucun solde", () => {
    const s = calculerSoldes([], MOIS, { "Caisse de bord": 1000, "Coffre du quai": 500 }, R);
    expect(s.comptesAvecSolde).toEqual(["Caisse de bord", "Coffre du quai"]);
    expect(s.currentBalances["Cagnotte du Voilier"]).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LA COURBE SE CONSTRUIT DEPUIS LES COMPTES, PAS DEPUIS CINQ NOMS
// ═══════════════════════════════════════════════════════════════════════

describe("la courbe des soldes n'a plus de séries écrites à la main", () => {
  it("porte une série par compte déclaré, et rien d'autre", () => {
    const s = calculerSoldes([], MOIS, { "Caisse de bord": 1000, "Coffre du quai": 500 }, R);
    const point = s.balanceChartData(["2026-02"])[0];
    expect(Object.keys(point).sort()).toEqual(
      ["Caisse de bord", "Coffre du quai", "Total", "monthKey"]
    );
    expect(point["Caisse de bord"]).toBe(1000);
    expect(point.Total).toBe(1500);
  });

  it("un seul compte déclaré donne une courbe à une seule série", () => {
    const seul = construireRegles({
      ...CONFIG,
      comptes: [CONFIG.comptes[0]],
      compteCreditSortiesEpargne: null,
    });
    const s = calculerSoldes([], MOIS, { "Caisse de bord": 1000 }, seul);
    const point = s.balanceChartData(["2026-02"])[0];
    expect(Object.keys(point).sort()).toEqual(["Caisse de bord", "Total", "monthKey"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LES NATURES, SUR DES TYPES INVENTÉS
// ═══════════════════════════════════════════════════════════════════════

describe("les natures décident, pas les libellés de l'auteur", () => {
  it("une sortie d'épargne crédite le compte DÉCLARÉ pour la recevoir", () => {
    const s = calculerSoldes(
      [tx({ compte: "Caisse de bord", type: "Reprise de mise", dc: "Crédit", montant: 80, monthKey: "2026-01" })],
      MOIS, { "Caisse de bord": 1000, "Coffre du quai": 500 }, R
    );
    // La Caisse reçoit son propre crédit (+80), le Coffre reçoit la sortie
    // d'épargne (+80) — ce sont deux calculs distincts sur le même mouvement.
    expect(s.currentBalances["Caisse de bord"]).toBe(1080);
    expect(s.currentBalances["Coffre du quai"]).toBe(580);
  });

  it("un transfert interne sort des recettes et des dépenses", () => {
    const d = filtrerDonnees(
      [tx({ type: "Renflouement", montant: 300 }), tx({ type: "Provisions", montant: 100 })],
      FILTRES, R
    );
    expect(d.baseTx).toHaveLength(1);
    expect(d.baseTx[0].type).toBe("Provisions");
  });

  it("les KPIs excluent le transfert interne, sans connaître son libellé", () => {
    const transactions = [
      tx({ type: "Provisions", montant: 100, dc: "Débit" }),
      tx({ type: "Renflouement", montant: 300, dc: "Débit" }),
    ];
    const k = calculerKPIs(transactions, {}, [], "2026-02", "2026-01", R);
    expect(k.depCur).toBe(100);
  });

  it("l'épargne se reconnaît à la nature du type", () => {
    const transactions = [
      tx({ type: "Mise de côté", montant: 250, dc: "Débit" }),
      tx({ type: "Reprise de mise", montant: 50, dc: "Crédit" }),
      tx({ type: "Provisions", montant: 100, dc: "Débit" }),
    ];
    const e = calculerEpargne({
      txSource: transactions, baseTx: transactions, allMonthsInRange: MOIS,
      currentMonth: "2026-02", prevMonth: "2026-01", selEpMonth: null,
    }, R);
    expect(e.kpis.totalEntrees).toBe(250);
    expect(e.kpis.totalSorties).toBe(50);
    expect(e.kpis.totalEp).toBe(200);
    expect(e.donutData).toEqual([{ name: "Mise de côté", value: 250 }]);
  });

  it("le prêt se reconnaît aux natures pret-capital et pret-interets", () => {
    const transactions = [
      tx({ type: "Part de coque", montant: 640, dc: "Débit", monthKey: "2026-01", date: "2026-01-05" }),
      tx({ type: "Loyer de coque", montant: 253, dc: "Débit", monthKey: "2026-01", date: "2026-01-05" }),
      tx({ type: "Part de coque", montant: 641, dc: "Débit", monthKey: "2026-02", date: "2026-02-05" }),
      tx({ type: "Loyer de coque", montant: 252, dc: "Débit", monthKey: "2026-02", date: "2026-02-05" }),
    ];
    const p = calculerPret(transactions, {
      init: {},
      pret: { montant: 180000, mensualite: 893, echeances: 240 },
    }, R);
    expect(p.hasData).toBe(true);
    expect(p.historyData).toHaveLength(2);
    expect(p.historyData[0].capital).toBe(640);
    expect(p.historyData[0].interets).toBe(253);
  });

  it("des échéances sur des types inventés font exister l'onglet Prêt", () => {
    const r = rubriquesDisponibles(
      [tx({ type: "Part de coque" })], null, { init: {} }, R
    );
    expect(r.pret).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CE QUE L'OUTIL FAIT QUAND LA SOURCE NE DÉCLARE RIEN
// ═══════════════════════════════════════════════════════════════════════

describe("sans déclaration, l'outil n'invente pas les règles de l'auteur", () => {
  const RIEN = construireRegles(null);

  it("aucun type n'est un transfert interne : rien n'est exclu", () => {
    const d = filtrerDonnees(
      [tx({ type: "Renflouement", montant: 300 }), tx({ type: "Provisions", montant: 100 })],
      FILTRES, RIEN
    );
    expect(d.baseTx).toHaveLength(2);
  });

  it("aucun compte n'a de compte lié : rien n'est retiré nulle part", () => {
    const s = calculerSoldes(
      [tx({ compte: "Cagnotte du Voilier", dc: "Débit", montant: 60, monthKey: "2026-01" })],
      MOIS, { "Caisse de bord": 1000 }, RIEN
    );
    expect(s.currentBalances["Caisse de bord"]).toBe(1000);
  });

  it("les comptes viennent alors des DONNÉES et des soldes déclarés", () => {
    const s = calculerSoldes(
      [tx({ compte: "Cagnotte du Voilier", montant: 60, monthKey: "2026-01" })],
      MOIS, { "Caisse de bord": 1000 }, RIEN
    );
    // La Cagnotte bouge sans solde de départ ; la Caisse a un solde sans
    // avoir bougé. Les deux existent, et l'écran doit nommer la première
    // comme « non initialisée ».
    expect(s.comptesAvecSolde.sort()).toEqual(["Caisse de bord", "Cagnotte du Voilier"].sort());
    expect(s.comptesNonInitialises).toEqual(["Cagnotte du Voilier"]);
  });

  it("une sortie d'épargne non reconnue ne crédite rien, et n'est pas comptée à tort", () => {
    const s = calculerSoldes(
      [tx({ type: "Reprise de mise", dc: "Crédit", montant: 80, monthKey: "2026-01" })],
      MOIS, { "Caisse de bord": 1000 }, RIEN
    );
    expect(s.sortiesNonCreditees).toEqual({ lignes: 0, montant: 0 });
  });

  it("une sortie RECONNUE mais sans compte déclaré est comptée et chiffrée", () => {
    const sansCompte = construireRegles({ ...CONFIG, compteCreditSortiesEpargne: null });
    const s = calculerSoldes(
      [tx({ type: "Reprise de mise", dc: "Crédit", montant: 80, monthKey: "2026-01" })],
      MOIS, { "Caisse de bord": 1000, "Coffre du quai": 500 }, sansCompte
    );
    expect(s.sortiesNonCreditees).toEqual({ lignes: 1, montant: 80 });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AUCUN NOM DE LA DÉMONSTRATION DANS CE FICHIER
// ═══════════════════════════════════════════════════════════════════════

describe("ce jeu ne partage rien avec la démonstration", () => {
  it("aucun compte ni type de la démonstration n'y figure", () => {
    const tout = JSON.stringify(CONFIG);
    for (const mot of [
      "Banque A", "Banque B", "Banque C", "Titres-restaurant", "Appli partagée",
      "Sortie Epargne", "Virement extérieur", "Crédit Immobilier", "Intérêt du prêt",
      "Épargne Banque",
    ]) {
      expect(tout, `« ${mot} » ne doit pas apparaître ici`).not.toContain(mot);
    }
  });
});
