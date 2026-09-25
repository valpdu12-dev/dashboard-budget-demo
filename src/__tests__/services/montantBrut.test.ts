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
import { octetsModele } from "../helpers/modelePublie";

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

describe("le classeur modèle publié montre le mécanisme (lot F.5)", () => {
  const r = lireClasseurPublic(XLSX.read(octetsModele(), { type: "array", cellDates: false }));

  it("chaque ligne porte un Montant brut, et le taux est appliqué par l'outil", () => {
    expect(r.transactions.length).toBe(1053);
    expect(r.transactions.every((t) => t.estBrut)).toBe(true);
  });

  it("un compte à 50 % : le montant lu est la moitié du brut saisi", () => {
    const wb = XLSX.read(octetsModele(), { type: "array", cellDates: false });
    const lignes = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Transactions"]);
    const brut = lignes.find((l) => l.Compte === "Banque A - Part commune");
    expect(brut).toBeDefined();
    expect(brut!.Montant).toBeCloseTo(Number(brut!["Montant brut"]) / 2, 2);
  });

  it("et il s'importe sans un seul avertissement", () => {
    // Un modèle qui déclenche des avertissements enseigne à les ignorer.
    // F.2bis — ce test était `expect(true).toBe(true)` : vert en ne mesurant
    // rien. Il lit maintenant le modèle publié.
    expect(alertes(r)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// F10 (lot F.2bis) — ce qui cloche se dit
// ═══════════════════════════════════════════════════════════════════════

describe("F10 — le Montant du fichier est contrôlé contre le calcul de l'outil", () => {
  it("les deux concordent (60 = 200 × 30 %) → aucun avertissement", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Cagnotte du Voilier", 60, 200), tx("Caisse de bord", 50, 50)],
      "Paramètres": PARAMS,
    }));
    expect(alertes(r)).toEqual([]);
  });

  it("ils divergent → UN avertissement par compte, chiffré, l'outil garde son calcul", () => {
    // Le fichier a calculé 100 (un taux de 50 % d'avant ?), l'outil trouve 60.
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Cagnotte du Voilier", 100, 200), tx("Cagnotte du Voilier", 50, 100)],
      "Paramètres": PARAMS,
    }));
    const a = alertes(r).filter((x) => x.message.includes("ne correspond pas"));
    expect(a).toHaveLength(1);
    expect(a[0].message).toContain("sur 2 ligne(s)");
    expect(a[0].message).toContain("100,00 €");
    expect(a[0].message).toContain("60,00 €");
    expect(a[0].ligne).toBe(2);
    expect(r.transactions.map((t) => t.montant)).toEqual([60, 30]);
  });

  it("les champs de travail ne sortent pas du lecteur", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Cagnotte du Voilier", 100, 200)],
      "Paramètres": PARAMS,
    }));
    expect(r.transactions[0]).not.toHaveProperty("montantFichier");
    expect(r.transactions[0]).not.toHaveProperty("origine");
  });
});

describe("F10 — un taux déclaré qui ne s'appliquera jamais", () => {
  it("compte à 30 % sans aucun Montant brut → avertissement nommé", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Cagnotte du Voilier", 80), tx("Cagnotte du Voilier", 20)],
      "Paramètres": PARAMS,
    }));
    const a = alertes(r).filter((x) => x.message.includes("Le taux ne s'applique pas"));
    expect(a).toHaveLength(1);
    expect(a[0].message).toContain("Cagnotte du Voilier");
    expect(a[0].message).toContain("30 %");
    expect(a[0].message).toContain("2 ligne(s)");
  });

  it("une seule ligne en Montant brut suffit : pas d'avertissement", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Cagnotte du Voilier", 80), tx("Cagnotte du Voilier", 60, 200)],
      "Paramètres": PARAMS,
    }));
    expect(alertes(r).filter((x) => x.message.includes("Le taux ne s'applique pas"))).toEqual([]);
  });

  it("un compte à 100 % n'est jamais concerné", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, tx("Caisse de bord", 80)],
      "Paramètres": PARAMS,
    }));
    expect(alertes(r)).toEqual([]);
  });
});
