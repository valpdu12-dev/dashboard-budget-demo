import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  lireClasseurPublic,
  detecterFormat,
  ErreurClasseur,
  type RapportImport,
} from "@/services/lectureClasseur";
import { construireClasseurModele } from "@/services/modeleExcel";

/**
 * Le lecteur du format public, et surtout sa VALIDATION.
 *
 * La règle que ces tests défendent tient en une phrase : rien n'est deviné,
 * rien n'est ignoré en silence. Le lecteur de l'ancien format transformait un
 * montant illisible en 0 — une dépense disparaissait d'un budget sans laisser
 * de trace. C'est ce défaut-là qui est verrouillé ici.
 */

const EN_TETE = ["Date", "Compte", "Type", "Montant", "Sens", "Classe", "Catégorie", "Libellé", "Prévisionnel"];

/** Construit un classeur et le fait passer par écriture + lecture, comme un vrai fichier. */
function classeur(feuilles: Record<string, unknown[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [nom, aoa] of Object.entries(feuilles)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nom);
  }
  const octets = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return XLSX.read(octets, { type: "array", cellDates: false });
}

/** Une ligne valide, que chaque test déforme sur un seul point. */
function ligneOK(over: Partial<Record<string, unknown>> = {}): unknown[] {
  const base = {
    Date: "03/01/2026", Compte: "Banque A - Courant", Type: "courses",
    Montant: 42.15, Sens: "Débit", Classe: "Dépense Courante",
    "Catégorie": "Alimentation", "Libellé": "Courses", "Prévisionnel": "",
  } as Record<string, unknown>;
  const l = { ...base, ...over };
  return EN_TETE.map((c) => l[c]);
}

const rejets = (r: RapportImport) => r.anomalies.filter((a) => a.gravite === "rejet");
const alertes = (r: RapportImport) => r.anomalies.filter((a) => a.gravite === "avertissement");

// ═══════════════════════════════════════════════════════════════════════
// Le critère reporté du lot B.1
// ═══════════════════════════════════════════════════════════════════════

describe("le classeur modèle", () => {
  const wb = XLSX.read(construireClasseurModele(), { type: "array", cellDates: false });
  const rapport = lireClasseurPublic(wb);

  it("est reconnu comme du format public", () => {
    expect(detecterFormat(wb)).toBe("public");
  });

  it("s'importe sans un seul rejet", () => {
    expect(rejets(rapport)).toEqual([]);
  });

  it("s'importe sans un seul avertissement", () => {
    // Un modèle qui déclencherait des avertissements enseignerait à les ignorer.
    expect(alertes(rapport)).toEqual([]);
  });

  it("rend ses 51 transactions constatées, la prévisionnelle mise de côté", () => {
    expect(rapport.transactions).toHaveLength(51);
    expect(rapport.compteurs.ignorees).toBe(1);
  });

  it("rend ses trois bulletins, avec le net recalculé", () => {
    expect(rapport.paie.map((p) => p.mk)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(rapport.paie[0].net).toBeCloseTo(2538, 2);
  });

  it("rend ses bornes de relevé déclarées", () => {
    expect(rapport.parametres.couverture).toEqual({ debut: "2026-01-01", fin: "2026-03-31" });
  });

  it("rend son bloc prêt complet et ses cinq soldes de départ", () => {
    expect(rapport.parametres.pret).toMatchObject({ montant: 180000, mensualite: 893.6, echeances: 240 });
    expect(Object.keys(rapport.parametres.soldes)).toHaveLength(5);
    expect(rapport.parametres.soldes["Banque A - Courant"]).toBe(3200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Les cinq fichiers piégés — critère de sortie de l'étape B.3
// ═══════════════════════════════════════════════════════════════════════

describe("cinq fichiers piégés, cinq messages clairs", () => {
  it("piège 1 — montant illisible : la ligne est rejetée, JAMAIS mise à 0", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK(), ligneOK({ Montant: "douze euros" })],
    }));
    expect(r.transactions).toHaveLength(1);
    expect(r.transactions.some((t) => t.montant === 0)).toBe(false);
    const [rejet] = rejets(r);
    expect(rejet.ligne).toBe(3);
    expect(rejet.colonne).toBe("Montant");
    expect(rejet.message).toContain("douze euros");
    expect(rejet.message).toContain("PAS remplacé par 0");
  });

  it("piège 2 — date impossible : rejet situé, avec ce qui était attendu", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK(), ligneOK({ Date: "32/13/2026" })],
    }));
    const [rejet] = rejets(r);
    expect(rejet).toMatchObject({ feuille: "Transactions", ligne: 3, colonne: "Date" });
    expect(rejet.message).toContain("JJ/MM/AAAA");
  });

  it("piège 3 — sens abrégé « D » : refusé, en disant quoi écrire", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK(), ligneOK({ Sens: "D" })],
    }));
    const [rejet] = rejets(r);
    expect(rejet.colonne).toBe("Sens");
    expect(rejet.message).toContain("Débit");
    expect(rejet.message).toContain("Crédit");
  });

  it("piège 4 — doublon strict : rejeté, avec l'emplacement de l'autre", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK(), ligneOK()],
    }));
    expect(r.transactions).toHaveLength(1);
    const [rejet] = rejets(r);
    expect(rejet.ligne).toBe(3);
    expect(rejet.message).toContain("ligne 2");
  });

  it("piège 5 — colonne obligatoire absente : le fichier entier est refusé, en la nommant", () => {
    const sansSens = EN_TETE.filter((c) => c !== "Sens");
    expect(() =>
      lireClasseurPublic(classeur({
        Transactions: [sansSens, sansSens.map(() => "x")],
      }))
    ).toThrow(/Sens/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Reconnaissance du format
// ═══════════════════════════════════════════════════════════════════════

describe("reconnaissance du format", () => {
  it("reconnaît l'ancien format à sa feuille annuelle sans en-tête en ligne 1", () => {
    const wb = classeur({ "Transactions 2025": [["Budget"], [], ["Transaction", "Compte"]] });
    expect(detecterFormat(wb)).toBe("ancien");
  });

  it("refuse un classeur sans feuille reconnue, en listant ce qu'il a trouvé", () => {
    const wb = classeur({ Feuil1: [["a"]], Notes: [["b"]] });
    expect(() => detecterFormat(wb)).toThrow(/Feuil1, Notes/);
  });

  it("refuse deux feuilles qui ne diffèrent que par la casse", () => {
    // Excel l'interdit ; un fichier produit par un script, non. Mesuré.
    const wb = classeur({
      Transactions: [EN_TETE, ligneOK()],
      transactions: [EN_TETE, ligneOK()],
    });
    expect(() => lireClasseurPublic(wb)).toThrow(ErreurClasseur);
  });

  it("ignore une feuille dont le nom n'est pas reconnu", () => {
    const r = lireClasseurPublic(classeur({
      "Lisez-moi": [["Mode d'emploi"]],
      Transactions: [EN_TETE, ligneOK()],
    }));
    expect(r.transactions).toHaveLength(1);
    expect(r.anomalies).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Plusieurs feuilles annuelles
// ═══════════════════════════════════════════════════════════════════════

describe("feuilles annuelles", () => {
  it("agrège Transactions 2025 et Transactions 2026, dans l'ordre des dates", () => {
    const r = lireClasseurPublic(classeur({
      "Transactions 2026": [EN_TETE, ligneOK({ Date: "04/02/2026", "Libellé": "B" })],
      "Transactions 2025": [EN_TETE, ligneOK({ Date: "07/11/2025", "Libellé": "A" })],
    }));
    expect(r.transactions.map((t) => t.date)).toEqual(["2025-11-07", "2026-02-04"]);
    expect(r.feuillesLues).toEqual(["Transactions 2025", "Transactions 2026"]);
  });

  it("refuse un doublon à cheval sur deux feuilles, au lieu de l'additionner", () => {
    const r = lireClasseurPublic(classeur({
      "Transactions 2025": [EN_TETE, ligneOK({ Date: "07/11/2025" })],
      "Transactions 2026": [EN_TETE, ligneOK({ Date: "07/11/2025" })],
    }));
    expect(r.transactions).toHaveLength(1);
    expect(rejets(r)[0].message).toContain("Transactions 2025");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Ce qui est accepté, mais dit
// ═══════════════════════════════════════════════════════════════════════

describe("avertissements — accepté, mais dit", () => {
  it("ignore la classe d'une recette, et le signale", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK({ Sens: "Crédit", Classe: "Dépense Fixe", Type: "Salaire" })],
    }));
    expect(r.transactions[0].cat1).toBe("");
    expect(alertes(r)[0].message).toContain("recette");
  });

  it("accepte une dépense sans catégorie, en nommant la conséquence", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK({ "Catégorie": "" })],
    }));
    expect(r.transactions).toHaveLength(1);
    expect(alertes(r)[0].message).toContain("Budget mensuel");
  });

  it("accepte un compte inconnu, en disant qu'il n'aura pas de solde", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK({ Compte: "Ma banque à moi" })],
    }));
    expect(r.transactions).toHaveLength(1);
    const a = alertes(r)[0];
    expect(a.colonne).toBe("Compte");
    expect(a.message).toContain("Ma banque à moi");
    expect(a.message).toContain("PAS de solde");
  });

  it("met de côté une ligne prévisionnelle sans la compter comme un rejet", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK(), ligneOK({ "Prévisionnel": "x", "Libellé": "à venir" })],
    }));
    expect(r.transactions).toHaveLength(1);
    expect(r.compteurs.ignorees).toBe(1);
    expect(r.compteurs.rejetees).toBe(0);
  });

  it("compte une ligne vide comme ignorée, pas comme lue", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK(), [], ligneOK({ "Libellé": "autre" })],
    }));
    expect(r.compteurs.acceptees).toBe(2);
    expect(r.compteurs.lignesLues).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feuille Paie
// ═══════════════════════════════════════════════════════════════════════

const EN_TETE_PAIE = ["Mois", "Employeur", "Brut", "Cotisations salariales", "Indemnités", "Autres retenues", "Net"];

describe("feuille Paie", () => {
  it("est facultative", () => {
    const r = lireClasseurPublic(classeur({ Transactions: [EN_TETE, ligneOK()] }));
    expect(r.paie).toEqual([]);
  });

  it("recalcule le net plutôt que de recopier la colonne", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK()],
      Paie: [EN_TETE_PAIE, ["2026-01", "Employeur A", 3100, 682, 120, 0, 9999]],
    }));
    expect(r.paie[0].net).toBeCloseTo(2538, 2);
    expect(alertes(r)[0].message).toContain("calcul qui fait foi");
  });

  it("écarte les DEUX lignes quand un mois apparaît deux fois", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK()],
      Paie: [
        EN_TETE_PAIE,
        ["2026-01", "Employeur A", 3100, 682, 0, 0, ""],
        ["2026-01", "Employeur A", 3100, 682, 0, 0, ""],
      ],
    }));
    expect(r.paie).toEqual([]);
    expect(rejets(r)[0].message).toContain("doublerait le salaire");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feuille Paramètres
// ═══════════════════════════════════════════════════════════════════════

describe("feuille Paramètres", () => {
  const avecParams = (lignes: unknown[][]) =>
    lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK()],
      "Paramètres": [["Paramètre", "Valeur"], ...lignes],
    }));

  it("ignore des bornes incomplètes, en disant ce que ça coûte", () => {
    const r = avecParams([["Début de relevé", "01/01/2026"]]);
    expect(r.parametres.couverture).toBeNull();
    expect(alertes(r)[0].message).toContain("premier et le dernier mois");
  });

  it("ignore des bornes inversées", () => {
    const r = avecParams([["Début de relevé", "01/03/2026"], ["Fin de relevé", "31/01/2026"]]);
    expect(r.parametres.couverture).toBeNull();
  });

  it("ignore le bloc prêt EN ENTIER s'il est incomplet", () => {
    const r = avecParams([["Prêt — montant", 180000], ["Prêt — mensualité", 893.6]]);
    expect(r.parametres.pret).toBeNull();
    expect(alertes(r)[0].message).toContain("ignoré");
  });

  it("lit les soldes de départ depuis leur propre tableau", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK()],
      "Paramètres": [
        ["Paramètre", "Valeur", "", "Compte", "Solde de départ"],
        ["Version du format", 1, "", "Banque A - Courant", 3200],
      ],
    }));
    expect(r.parametres.versionFormat).toBe(1);
    expect(r.parametres.soldes).toEqual({ "Banque A - Courant": 3200 });
  });

  it("laisse « non initialisé » un solde illisible, au lieu de le mettre à 0", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK()],
      "Paramètres": [["Compte", "Solde de départ"], ["Banque A - Courant", "environ 3000"]],
    }));
    expect(r.parametres.soldes).toEqual({});
    expect(alertes(r)[0].message).toContain("jamais 0");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Rien d'exploitable
// ═══════════════════════════════════════════════════════════════════════

describe("fichier sans rien d'exploitable", () => {
  it("refuse, en chiffrant ce qui a été rejeté", () => {
    expect(() =>
      lireClasseurPublic(classeur({
        Transactions: [EN_TETE, ligneOK({ Montant: "?" }), ligneOK({ Montant: "??" })],
      }))
    ).toThrow(/2 ligne\(s\) rejetée\(s\)/);
  });
});
