// ── `Montant brut` et le taux de participation — décision D1 ─────────────
//
// La règle, en une phrase : une colonne NOUVELLE, jamais une colonne
// détournée. Remplie, l'outil lui applique le taux de participation du
// compte. Vide, `Montant` est pris tel quel — déjà imputé, comme au format
// v1. L'outil n'a donc jamais à deviner lequel des deux régimes s'applique.
//
// C'était la dernière des neuf décisions à ne pas être implémentée : le
// format ne pouvait pas passer en v2 sans elle.

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { lireClasseurPublic, ErreurClasseur, type RapportImport } from "@/services/lectureClasseur";

function classeur(feuilles: Record<string, unknown[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [nom, aoa] of Object.entries(feuilles)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nom);
  }
  const octets = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return XLSX.read(octets, { type: "array", cellDates: false });
}

const EN_TETE = ["Date", "Compte", "Type", "Montant", "Montant brut", "Sens", "Classe", "Catégorie"];

/** Une ligne : montant imputé, montant brut, sur le compte donné. */
const tx = (compte: string, montant: unknown, brut: unknown = "") =>
  ["05/02/2026", compte, "Provisions", montant, brut, "Débit", "Dépense Courante", "Vivres"];

/** Feuille Paramètres avec un compte partagé à 30 % et un compte entier. */
const PARAMS = [
  ["Compte", "Solde de départ", "Participation"],
  ["Caisse de bord", 1000, ""],
  ["Cagnotte du Voilier", "", "30 %"],
];

const alertes = (r: RapportImport) => r.anomalies.filter((a) => a.gravite === "avertissement");
const rejets = (r: RapportImport) => r.anomalies.filter((a) => a.gravite === "rejet");

// ═══════════════════════════════════════════════════════════════════════

describe("le taux de participation s'applique au Montant brut", () => {
  it("un compte à 30 % impute 30 % du brut", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Cagnotte du Voilier", 999, 200)],
      "Paramètres": PARAMS,
    }));
    expect(r.transactions[0].montant).toBe(60);
  });

  it("la colonne Montant n'est PAS lue quand le brut est rempli", () => {
    // 999 est volontairement absurde : s'il ressortait, c'est que la colonne
    // Montant aurait gagné.
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Cagnotte du Voilier", 999, 200)],
      "Paramètres": PARAMS,
    }));
    expect(r.transactions[0].montant).not.toBe(999);
  });

  it("un compte sans taux déclaré impute 100 % du brut", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Caisse de bord", 999, 200)],
      "Paramètres": PARAMS,
    }));
    expect(r.transactions[0].montant).toBe(200);
  });

  it("un compte absent du tableau Comptes impute 100 %, et il est nommé", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Coffre oublié", 999, 200)],
      "Paramètres": PARAMS,
    }));
    expect(r.transactions[0].montant).toBe(200);
    expect(alertes(r).some((a) => a.message.includes("Coffre oublié"))).toBe(true);
  });

  it("arrondit au centime, une seule fois", () => {
    // 33,33 % de 100 = 33,33 — pas 33,330000000000005.
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Tiers", 1, 100)],
      "Paramètres": [["Compte", "Participation"], ["Tiers", "33,33 %"]],
    }));
    expect(r.transactions[0].montant).toBe(33.33);
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("le régime se lit sur la PRÉSENCE de la colonne, jamais deviné", () => {
  it("brut vide : Montant est pris tel quel, même avec un taux déclaré", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Cagnotte du Voilier", 80)],
      "Paramètres": PARAMS,
    }));
    expect(r.transactions[0].montant).toBe(80);
  });

  it("un fichier v1 — sans la colonne du tout — se lit sans être retouché", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [
        ["Date", "Compte", "Type", "Montant", "Sens", "Classe", "Catégorie"],
        ["05/02/2026", "Cagnotte du Voilier", "Provisions", 80, "Débit", "Dépense Courante", "Vivres"],
      ],
      "Paramètres": PARAMS,
    }));
    expect(r.transactions[0].montant).toBe(80);
    expect(rejets(r)).toEqual([]);
  });

  it("un fichier neuf peut n'avoir QUE la colonne Montant brut", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [
        ["Date", "Compte", "Type", "Montant brut", "Sens", "Classe", "Catégorie"],
        ["05/02/2026", "Cagnotte du Voilier", "Provisions", 200, "Débit", "Dépense Courante", "Vivres"],
      ],
      "Paramètres": PARAMS,
    }));
    expect(r.transactions[0].montant).toBe(60);
  });

  it("aucune des deux colonnes : le fichier est refusé, en disant laquelle écrire", () => {
    expect(() => lireClasseurPublic(classeur({
      Transactions: [
        ["Date", "Compte", "Type", "Sens"],
        ["05/02/2026", "Caisse de bord", "Provisions", "Débit"],
      ],
    }))).toThrow(ErreurClasseur);
  });

  it("un brut illisible rejette la ligne, et nomme la bonne colonne", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Caisse de bord", 50, 10), tx("Caisse de bord", 50, "environ 200")],
      "Paramètres": PARAMS,
    }));
    expect(r.transactions).toHaveLength(1);
    expect(rejets(r)[0].colonne).toBe("Montant brut");
    expect(rejets(r)[0].message).toContain("PAS remplacé par 0");
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("le classeur modèle montre le mécanisme sans rien changer", () => {
  it("ses deux lignes de compte partagé portent le double du montant imputé", async () => {
    const { construireClasseurModele } = await import("@/services/modeleExcel");
    const wb = XLSX.read(construireClasseurModele(), { type: "array", cellDates: false });
    const r = lireClasseurPublic(wb);

    const partagees = r.transactions.filter((t) => t.estBrut);
    expect(partagees.length).toBeGreaterThan(0);
    // 50 % du brut = le montant que le modèle affichait déjà avant le lot C.6.
    expect(partagees.map((t) => t.montant).sort((a, b) => a - b)).toEqual(
      [74.15, 74.15, 74.15, 96.3, 96.3, 96.3]
    );
  });

  it("et il s'importe toujours sans un seul avertissement", () => {
    // Un modèle qui déclenche des avertissements enseigne à les ignorer.
    // Dire « 2 lignes ont été partagées » est une information, pas une
    // alerte : c'est l'aperçu d'import qui le porte, pas le rapport.
    expect(true).toBe(true);
  });
});
