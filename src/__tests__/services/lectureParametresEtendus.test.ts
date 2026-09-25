// ── La feuille `Paramètres` étendue, lue pour de vrai ────────────────────
//
// Critère de sortie du C.2 : un classeur avec trois comptes inventés, deux
// types inventés et aucune couleur s'importe, et l'aperçu nomme ce qu'il a lu
// ET ce qu'il n'a pas trouvé.
//
// Rien ici ne ressemble au jeu de démonstration : c'est le but. Un test écrit
// avec les comptes de l'auteur ne prouverait pas que l'outil est sorti de son
// vocabulaire.

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { lireClasseurPublic, type RapportImport } from "@/services/lectureClasseur";
import { tableauColonnes, COLONNES_COMPTES } from "@/services/lectureParametres";

const EN_TETE = ["Date", "Compte", "Type", "Montant", "Sens", "Classe", "Catégorie", "Libellé"];

function classeur(feuilles: Record<string, unknown[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [nom, aoa] of Object.entries(feuilles)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nom);
  }
  const octets = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return XLSX.read(octets, { type: "array", cellDates: false });
}

function tx(compte: string, type = "Provisions", montant = 30, sens = "Débit"): unknown[] {
  return ["05/02/2026", compte, type, montant, sens, sens === "Débit" ? "Dépense Courante" : "", "Vivres", ""];
}

const alertes = (r: RapportImport) => r.anomalies.filter((a) => a.gravite === "avertissement");
const rejets = (r: RapportImport) => r.anomalies.filter((a) => a.gravite === "rejet");

// ═══════════════════════════════════════════════════════════════════════
// Le critère de sortie : trois comptes inventés, deux types inventés
// ═══════════════════════════════════════════════════════════════════════

describe("un classeur qui ne ressemble en rien à la démonstration", () => {
  const wb = classeur({
    Transactions: [
      EN_TETE,
      tx("Livret du Port"),
      tx("Cagnotte du Voilier"),
      tx("Caisse de bord"),
      tx("Caisse de bord", "Mise de côté", 200),
    ],
    "Paramètres": [
      ["Paramètre", "Valeur", "", "Compte", "Solde de départ", "Organisme", "Participation", "Compte lié", "Sens répercuté", "Porte un solde"],
      ["Version du format", 1, "", "Caisse de bord", 800, "Coopérative du Port", "", "", "", "oui"],
      ["Compte crédité par les sorties d'épargne", "Caisse de bord", "", "Livret du Port", 4200, "Coopérative du Port", "", "", "", "oui"],
      ["", "", "", "Cagnotte du Voilier", "", "Association", "30 %", "Caisse de bord", "Débit", "non"],
    ],
  });

  // Les quatre tableaux vivent sur la feuille `Paramètres`, chacun dans SA
  // colonne : c'est là que le lecteur les cherche.
  const wbSurUneFeuille = classeur({
    Transactions: [EN_TETE, tx("Caisse de bord"), tx("Caisse de bord", "Mise de côté", 200)],
    "Paramètres": [
      ["Paramètre", "Valeur", "", "Compte", "Solde de départ", "", "Type", "Nature", "", "Catégorie", "", "Employeur"],
      ["Compte crédité par les sorties d'épargne", "Caisse de bord", "", "Caisse de bord", 800, "", "Mise de côté", "epargne", "", "Vivres", "", "Coopérative du Port"],
      ["", "", "", "", "", "", "Provisions", "", "", "", "", ""],
    ],
  });

  const r = lireClasseurPublic(wbSurUneFeuille);

  it("s'importe sans un seul rejet", () => {
    expect(rejets(r)).toEqual([]);
  });

  it("lit les comptes déclarés, et eux seuls", () => {
    expect(r.parametres.config.estVide).toBe(false);
    expect(r.parametres.config.comptes.map((c) => c.libelle)).toEqual(["Caisse de bord"]);
    expect(r.parametres.soldes).toEqual({ "Caisse de bord": 800 });
  });

  it("lit les types et leurs natures", () => {
    expect(r.parametres.config.types.map((t) => t.libelle)).toEqual(["Mise de côté", "Provisions"]);
    expect(r.parametres.config.types[0].natures).toEqual(["epargne"]);
    expect(r.parametres.config.types[1].natures).toEqual([]);
  });

  it("lit les catégories et les employeurs", () => {
    expect(r.parametres.config.categories.map((c) => c.libelle)).toEqual(["Vivres"]);
    expect(r.parametres.config.employeurs).toEqual(["Coopérative du Port"]);
  });

  it("lit le compte crédité par les sorties d'épargne", () => {
    expect(r.parametres.config.compteCreditSortiesEpargne).toBe("caisse de bord");
  });

  it("donne une couleur à chaque compte, même sans colonne Couleur", () => {
    for (const c of r.parametres.config.comptes) {
      expect(c.couleur).toMatch(/^#[0-9a-f]{3,6}$/i);
    }
  });

  // ── Le classeur complet, à huit colonnes ──────────────────────────────

  const complet = lireClasseurPublic(wb);

  it("lit les huit colonnes du tableau des comptes", () => {
    const c = complet.parametres.config.comptes;
    expect(c.map((x) => x.libelle)).toEqual([
      "Caisse de bord", "Livret du Port", "Cagnotte du Voilier",
    ]);

    const cagnotte = c[2];
    expect(cagnotte.organisme).toBe("Association");
    expect(cagnotte.participation).toBe(0.3);
    expect(cagnotte.compteLie).toBe("caisse de bord");
    expect(cagnotte.sensRepercute).toBe("Débit");
    expect(cagnotte.porteUnSolde).toBe(false);
    expect(cagnotte.soldeDepart).toBeNull();
  });

  it("ne rejette rien et ne nomme aucun compte de la démonstration", () => {
    expect(rejets(complet)).toEqual([]);
    const tout = complet.anomalies.map((a) => a.message).join(" ");
    expect(tout).not.toMatch(/Banque [ABC]/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Ce que l'outil N'A PAS trouvé, il le dit
// ═══════════════════════════════════════════════════════════════════════

describe("ce qui manque est nommé, jamais comblé", () => {
  it("nomme un compte qui porte des transactions sans être déclaré, chiffré", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Caisse de bord"), tx("Coffre oublié", "Provisions", 12.5), tx("Coffre oublié", "Provisions", 7.5)],
      "Paramètres": [["Compte", "Solde de départ"], ["Caisse de bord", 800]],
    }));

    const a = alertes(r).find((x) => x.message.includes("Coffre oublié"))!;
    expect(a).toBeDefined();
    expect(a.message).toContain("2 lignes");
    expect(a.message).toContain("20.00 €");
    expect(a.message).toContain("tableau Comptes");
  });

  it("n'émet QU'UN avertissement par compte, pas un par ligne", () => {
    const lignes = Array.from({ length: 30 }, () => tx("Coffre oublié"));
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Caisse de bord"), ...lignes],
      "Paramètres": [["Compte", "Solde de départ"], ["Caisse de bord", 800]],
    }));

    expect(alertes(r).filter((a) => a.message.includes("Coffre oublié"))).toHaveLength(1);
  });

  it("dit qu'un tableau Comptes sans colonne « Solde de départ » laisse tout non initialisé", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Caisse de bord")],
      "Paramètres": [["Compte", "Solde"], ["Caisse de bord", 800]],
    }));

    expect(r.parametres.soldes).toEqual({});
    const a = alertes(r).find((x) => x.message.includes("Solde de départ"))!;
    expect(a.message).toContain("Colonnes lues : Compte, Solde");
    expect(a.message).toContain("jamais 0");
  });

  it("remonte les rejets de la validation, situés sur la feuille Paramètres", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Caisse de bord")],
      "Paramètres": [
        ["Compte", "Solde de départ", "Compte lié"],
        ["Caisse de bord", 800, ""],
        ["Cagnotte", "", "Caisse de bord"],
      ],
    }));

    const rej = rejets(r);
    expect(rej).toHaveLength(1);
    expect(rej[0].feuille).toBe("Paramètres");
    expect(rej[0].ligne).toBe(3);
    expect(rej[0].message).toContain("sans dire quel sens s'y répercute");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Non-régression : le format v1 n'a pas bougé
// ═══════════════════════════════════════════════════════════════════════

describe("un fichier au format v1 se lit sans être retouché", () => {
  it("le tableau à deux colonnes est le tableau des comptes, en plus étroit", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Caisse de bord")],
      "Paramètres": [
        ["Paramètre", "Valeur", "", "Compte", "Solde de départ"],
        ["Version du format", 1, "", "Caisse de bord", 800],
      ],
    }));

    expect(r.parametres.versionFormat).toBe(1);
    expect(r.parametres.soldes).toEqual({ "Caisse de bord": 800 });
    expect(r.parametres.config.comptes[0].participation).toBe(1);
    expect(r.parametres.config.comptes[0].compteLie).toBeNull();
    expect(alertes(r)).toEqual([]);
  });

  it("sans feuille Paramètres, la configuration est VIDE — et le dit", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Caisse de bord")],
    }));

    expect(r.parametres.config.estVide).toBe(true);
    // Lot C.4 : plus d'avertissement par compte quand rien n'est déclaré. Il
    // n'y a pas de référence à laquelle comparer — et l'aperçu d'import dit
    // déjà, une fois, que le fichier ne déclare aucune configuration.
    expect(alertes(r)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Le lecteur de tableau, et le piège qui l'a dicté
// ═══════════════════════════════════════════════════════════════════════

describe("tableauColonnes", () => {
  it("s'arrête à la première cellule vide de la ligne d'en-tête", () => {
    // Sans cette règle, le tableau des comptes avalerait le tableau voisin.
    const grille: unknown[][] = [
      ["Compte", "Solde de départ", "", "Autre chose", "Encore"],
      ["Caisse", 10, "", "x", "y"],
    ];
    const t = tableauColonnes(grille, "Compte", COLONNES_COMPTES)!;
    expect(t.enTetes).toEqual(["Compte", "Solde de départ"]);
    expect(t.lignes[0].valeurs.soldeDepart).toBe(10);
  });

  it("saute les lignes dont la cellule de clé est vide", () => {
    const grille: unknown[][] = [
      ["Compte", "Solde de départ"],
      ["Caisse", 10],
      ["", 99],
      ["Livret", 20],
    ];
    const t = tableauColonnes(grille, "Compte", COLONNES_COMPTES)!;
    expect(t.lignes.map((l) => l.valeurs.compte)).toEqual(["Caisse", "Livret"]);
    expect(t.lignes.map((l) => l.ligne)).toEqual([2, 4]);
  });

  it("rend null quand l'en-tête n'est pas sur la feuille", () => {
    expect(tableauColonnes([["Paramètre", "Valeur"]], "Compte", COLONNES_COMPTES)).toBeNull();
  });

  it("retrouve les colonnes sans casse ni accents, dans n'importe quel ordre", () => {
    const grille: unknown[][] = [
      ["COMPTE", "participation", "SOLDE DE DEPART"],
      ["Caisse", "30 %", 10],
    ];
    const t = tableauColonnes(grille, "Compte", COLONNES_COMPTES)!;
    expect(t.lignes[0].valeurs.participation).toBe("30 %");
    expect(t.lignes[0].valeurs.soldeDepart).toBe(10);
  });
});
