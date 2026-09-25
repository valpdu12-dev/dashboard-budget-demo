import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  lireClasseurPublic,
  detecterFormat,
  ErreurClasseur,
  type RapportImport,
} from "@/services/lectureClasseur";
import { octetsModele } from "../helpers/modelePublie";

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

describe("le classeur modèle PUBLIÉ (lot F.5)", () => {
  const wb = XLSX.read(octetsModele(), { type: "array", cellDates: false });
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

  it("F.2 — sa date de prêt décalée d'un an, l'aperçu d'import le dit et propose la bonne", () => {
    // La preuve qui sait échouer, par le vrai lecteur : on reprend le modèle,
    // on décale la date de début, et l'avertissement doit venir.
    const wb2 = XLSX.read(octetsModele(), { type: "array", cellDates: false });
    const ws = wb2.Sheets["Paramètres"];
    const plage = XLSX.utils.decode_range(ws["!ref"]!);
    let trouvee = false;
    for (let r = plage.s.r; r <= plage.e.r; r++) {
      const a = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      if (a && String(a.v).includes("date de début")) {
        ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: "s", v: "2023-10" };
        trouvee = true;
      }
    }
    expect(trouvee).toBe(true);
    const r2 = lireClasseurPublic(wb2);
    const pret = alertes(r2).filter((x) => x.message.includes("ne concordent pas"));
    expect(pret).toHaveLength(1);
    expect(pret[0].message).toContain("oct. 22");
  });

  it("rend les 1 053 transactions de la démonstration ; les lignes préparées vides sont ignorées", () => {
    expect(rapport.transactions).toHaveLength(1053);
    // 4 999 lignes de formules préparées (jusqu'à la ligne 5000), dont 3 946
    // vides. Aucune n'est rejetée : une ligne vide n'est pas une erreur.
    expect(rapport.compteurs.ignorees).toBe(3946);
  });

  it("rend ses 60 bulletins, avec le net recalculé", () => {
    expect(rapport.paie).toHaveLength(60);
    expect(rapport.paie[0].mk).toBe("2021-09");
    expect(rapport.paie[0].net).toBeCloseTo(2709.28 - 516.89 - 4.78, 2);
  });

  it("rend ses bornes de relevé déclarées", () => {
    expect(rapport.parametres.couverture).toEqual({ debut: "2024-09-01", fin: "2026-09-15" });
  });

  it("rend son prêt en forme « taux » (O6) et ses cinq soldes de départ", () => {
    expect(rapport.parametres.pret).toMatchObject({
      montant: 180000, mensualite: 893.64, echeances: 240, tauxAnnuel: 0.018, dateDebut: "2022-10",
    });
    expect(Object.keys(rapport.parametres.soldes)).toHaveLength(5);
    expect(rapport.parametres.soldes["Banque A - Courant"]).toBe(4200);
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

  it("piège 4 — doublon strict : conservé, avec un avertissement citant l'autre", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK(), ligneOK()],
    }));
    expect(r.transactions).toHaveLength(2);
    expect(rejets(r)).toHaveLength(0);
    const [alerte] = alertes(r);
    expect(alerte.ligne).toBe(3);
    expect(alerte.message).toContain("ligne 2");
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

  it("conserve un doublon à cheval sur deux feuilles, en le signalant", () => {
    const r = lireClasseurPublic(classeur({
      "Transactions 2025": [EN_TETE, ligneOK({ Date: "07/11/2025" })],
      "Transactions 2026": [EN_TETE, ligneOK({ Date: "07/11/2025" })],
    }));
    expect(r.transactions).toHaveLength(2);
    expect(rejets(r)).toHaveLength(0);
    expect(alertes(r)[0].message).toContain("Transactions 2025");
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

  // ⚠️ Lot C.4 — cet avertissement a changé de sens, puis de portée.
  //
  // Au lot B, il disait qu'un compte hors de la liste écrite dans le code
  // n'aurait PAS de solde. C'était vrai tant que `useBalances` appliquait des
  // règles nommées compte par compte. Ça ne l'est plus : un compte non
  // déclaré a un solde, calculé sur ses propres mouvements.
  //
  // Il ne reste donc qu'une seule référence — le tableau `Comptes` — et, sans
  // tableau, plus d'avertissement par compte : l'aperçu d'import dit une fois
  // que le fichier ne déclare aucune configuration.
  it("ne dit plus rien par compte quand le fichier ne déclare aucun compte", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK({ Compte: "Ma banque à moi" })],
    }));
    expect(r.transactions).toHaveLength(1);
    expect(alertes(r)).toEqual([]);
  });

  it("nomme un compte absent du tableau Comptes, quand ce tableau existe", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [EN_TETE, ligneOK({ Compte: "Ma banque à moi" })],
      "Paramètres": [["Compte", "Solde de départ"], ["Banque A - Courant", 100]],
    }));
    const a = alertes(r)[0];
    expect(a.colonne).toBe("Compte");
    expect(a.message).toContain("Ma banque à moi");
    expect(a.message).toContain("tableau Comptes");
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

  it("lit un bloc Prêt en forme « taux » et calcule la mensualité", () => {
    const r = avecParams([
      ["Prêt — montant", 200000],
      ["Prêt — taux annuel", "3 %"],
      ["Prêt — durée (mois)", 360],
      ["Prêt — date de début", "2022-01"],
    ]);
    expect(r.parametres.pret).toMatchObject({
      montant: 200000, echeances: 360, tauxAnnuel: 0.03, dateDebut: "2022-01",
    });
    expect(r.parametres.pret!.mensualite).toBeCloseTo(843.21, 2);
  });

  it("accepte les deux formes du bloc Prêt quand elles concordent à 1 € près", () => {
    const r = avecParams([
      ["Prêt — montant", 200000],
      ["Prêt — taux annuel", "3 %"],
      ["Prêt — durée (mois)", 360],
      ["Prêt — mensualité", 843],
      ["Prêt — nombre d'échéances", 360],
      ["Prêt — date de début", "2022-01"],
    ]);
    expect(r.parametres.pret).toMatchObject({ montant: 200000, echeances: 360, tauxAnnuel: 0.03 });
    expect(r.parametres.pret!.mensualite).toBeCloseTo(843.21, 2);
  });

  it("refuse le bloc Prêt EN ENTIER si les deux formes divergent de plus d'1 €", () => {
    const r = avecParams([
      ["Prêt — montant", 200000],
      ["Prêt — taux annuel", "3 %"],
      ["Prêt — durée (mois)", 360],
      ["Prêt — mensualité", 900],
      ["Prêt — nombre d'échéances", 360],
      ["Prêt — date de début", "2022-01"],
    ]);
    expect(r.parametres.pret).toBeNull();
    expect(alertes(r)[0].message).toContain("incohérent");
  });

  // ── F12 (lot F.2bis) : la ligne prévisionnelle échue compte ──────────
  const BORNES = [["Paramètre", "Valeur"], ["Début de relevé", "01/01/2026"], ["Fin de relevé", "15/01/2026"]];
  const avecPrev = (params: unknown[][] | null) =>
    lireClasseurPublic(classeur({
      Transactions: [
        EN_TETE,
        ligneOK(),
        ligneOK({ Date: "15/01/2026", Montant: 579.54, "Libellé": "Échue", "Prévisionnel": "x" }),
        ligneOK({ Date: "16/01/2026", Montant: 580.16, "Libellé": "À venir", "Prévisionnel": "x" }),
      ],
      ...(params ? { "Paramètres": params } : {}),
    }));

  it("F12 — datée au plus tard à la Fin de relevé : comptée ; après : écartée", () => {
    const r = avecPrev(BORNES);
    expect(r.transactions.map((t) => t.label)).toEqual(["Courses", "Échue"]);
    expect(r.compteurs.ignorees).toBe(1);
    expect(alertes(r).filter((a) => a.message.includes("prévisionnelle"))).toEqual([]);
  });

  it("F12 — la preuve qui sait échouer : Fin de relevé la veille → plus rien n'est compté", () => {
    const r = avecPrev([["Paramètre", "Valeur"], ["Début de relevé", "01/01/2026"], ["Fin de relevé", "14/01/2026"]]);
    expect(r.transactions.map((t) => t.label)).toEqual(["Courses"]);
    expect(r.compteurs.ignorees).toBe(2);
  });

  it("F12 — sans Fin de relevé : les deux écartées, et le dit chiffré", () => {
    const r = avecPrev(null);
    expect(r.transactions.map((t) => t.label)).toEqual(["Courses"]);
    const a = alertes(r).filter((x) => x.message.includes("prévisionnelle"));
    expect(a).toHaveLength(1);
    expect(a[0].message).toContain("2 ligne(s)");
    expect(a[0].message).toContain("1159,70 €");
  });

  it("F12 — une ligne échue est contrôlée comme une ligne constatée", () => {
    const r = lireClasseurPublic(classeur({
      Transactions: [
        EN_TETE, ligneOK(),
        ligneOK({ Date: "10/01/2026", Montant: "à voir", "Prévisionnel": "x" }),
      ],
      "Paramètres": BORNES,
    }));
    expect(rejets(r)).toHaveLength(1);
    expect(rejets(r)[0].message).toContain("Montant illisible");
  });

  // ── O5 (lot F.1) : la date du prêt ───────────────────────────────────
  const FORME_TAUX = [
    ["Prêt — montant", 200000],
    ["Prêt — taux annuel", "3 %"],
    ["Prêt — durée (mois)", 360],
  ];

  it("O5 — refuse la forme « taux » SANS date de début, et le dit", () => {
    const r = avecParams(FORME_TAUX);
    expect(r.parametres.pret).toBeNull();
    expect(alertes(r)[0].message).toContain("date de début");
  });

  it("O5 — lit « première échéance » comme synonyme de « date de début »", () => {
    const r = avecParams([...FORME_TAUX, ["Prêt — première échéance", "2022-10"]]);
    expect(r.parametres.pret).toMatchObject({ dateDebut: "2022-10", premiereEcheance: "2022-10" });
  });

  it("O5 — ramène une date complète à son mois", () => {
    const r = avecParams([...FORME_TAUX, ["Prêt — date de début", "15/03/2023"]]);
    expect(r.parametres.pret).toMatchObject({ dateDebut: "2023-03" });
  });

  it("O5 — refuse deux dates qui se contredisent, en affichant les deux", () => {
    const r = avecParams([
      ...FORME_TAUX,
      ["Prêt — date de début", "2022-01"],
      ["Prêt — première échéance", "2022-02"],
    ]);
    expect(r.parametres.pret).toBeNull();
    const m = alertes(r)[0].message;
    expect(m).toContain("2022-01");
    expect(m).toContain("2022-02");
  });

  it("O5 — refuse une date illisible au lieu de la deviner", () => {
    const r = avecParams([...FORME_TAUX, ["Prêt — date de début", "début 2022"]]);
    expect(r.parametres.pret).toBeNull();
    expect(alertes(r)[0].message).toContain("illisible");
  });

  it("F1 — la forme « mensualité » garde sa date quand elle en a une", () => {
    const r = avecParams([
      ["Prêt — montant", 180000],
      ["Prêt — mensualité", 893.6],
      ["Prêt — nombre d'échéances", 240],
      ["Prêt — première échéance", "2022-10"],
    ]);
    expect(r.parametres.pret).toMatchObject({ dateDebut: "2022-10", mensualite: 893.6 });
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
