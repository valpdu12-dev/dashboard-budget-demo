import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  construireClasseurModele,
  TRANSACTIONS_MODELE,
  PAIE_MODELE,
  SOLDES_MODELE,
  BORNES_MODELE,
  PRET_MODELE,
} from "@/services/modeleExcel";
import { COMPTE_LIBELLES, COMPTES_AVEC_SOLDE } from "@/config/accounts";

/**
 * Le modèle est le premier fichier que verra quelqu'un d'autre que l'auteur.
 * S'il ne respecte pas le contrat écrit dans `docs/FORMAT_FICHIER_SOURCE.md`,
 * le document ne vaut rien.
 *
 * Ces tests relisent donc le classeur PRODUIT — pas les tableaux qui ont servi
 * à le produire. Un test qui vérifie ses propres données d'entrée ne teste
 * rien : c'est la leçon du lot A (`DataTable.test.tsx`).
 */

const octets = construireClasseurModele();
const wb = XLSX.read(octets, { type: "array", cellDates: false });

function feuille(nom: string): unknown[][] {
  const ws = wb.Sheets[nom];
  expect(ws, `feuille « ${nom} » absente`).toBeDefined();
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
}

const EN_TETE_TX = [
  "Date", "Compte", "Type", "Montant", "Sens", "Classe",
  "Catégorie", "Sous-catégorie", "Détail", "Libellé", "Ville", "Prévisionnel",
];
const CLASSES_VALIDES = ["Dépense Fixe", "Dépense Courante", "Dépense Occasionnelle", ""];

describe("modèle Excel — structure du classeur", () => {
  it("porte les trois feuilles du format, plus le mode d'emploi", () => {
    expect(wb.SheetNames).toEqual(["Lisez-moi", "Transactions", "Paie", "Paramètres"]);
  });

  it("met l'en-tête des transactions en ligne 1, aux noms exacts du format", () => {
    expect(feuille("Transactions")[0]).toEqual(EN_TETE_TX);
  });

  it("met l'en-tête de la paie en ligne 1, aux noms exacts du format", () => {
    expect(feuille("Paie")[0]).toEqual([
      "Mois", "Employeur", "Brut", "Cotisations salariales",
      "Indemnités", "Autres retenues", "Net",
    ]);
  });
});

describe("modèle Excel — feuille Transactions", () => {
  const lignes = feuille("Transactions").slice(1);

  it("contient autant de lignes que de transactions déclarées", () => {
    expect(lignes).toHaveLength(TRANSACTIONS_MODELE.length);
    expect(lignes.length).toBeGreaterThan(50);
  });

  it("n'écrit que des montants numériques strictement positifs", () => {
    for (const [i, l] of lignes.entries()) {
      const montant = l[3];
      expect(typeof montant, `ligne ${i + 2} : montant non numérique`).toBe("number");
      expect(montant as number, `ligne ${i + 2}`).toBeGreaterThan(0);
    }
  });

  it("n'écrit que « Débit » ou « Crédit » dans la colonne Sens", () => {
    for (const [i, l] of lignes.entries()) {
      expect(["Débit", "Crédit"], `ligne ${i + 2}`).toContain(l[4]);
    }
  });

  it("n'écrit que des classes valides, ou rien", () => {
    for (const [i, l] of lignes.entries()) {
      expect(CLASSES_VALIDES, `ligne ${i + 2}`).toContain(l[5]);
    }
  });

  it("laisse la classe vide sur toutes les recettes", () => {
    const credits = lignes.filter((l) => l[4] === "Crédit");
    expect(credits.length).toBeGreaterThan(0);
    for (const l of credits) expect(l[5]).toBe("");
  });

  it("écrit toutes les dates en JJ/MM/AAAA", () => {
    for (const [i, l] of lignes.entries()) {
      expect(String(l[0]), `ligne ${i + 2}`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
  });

  it("n'utilise que des comptes connus de l'application", () => {
    // Tant que `useBalances` applique des règles compte par compte, un compte
    // inconnu n'a pas de solde. Le modèle ne doit pas être le premier à
    // tomber dans ce trou. Voir docs/LIMITES_PARAMETRAGE.md.
    for (const [i, l] of lignes.entries()) {
      expect(COMPTE_LIBELLES, `ligne ${i + 2}`).toContain(l[1]);
    }
  });

  it("marque une seule ligne prévisionnelle, et elle est hors des bornes", () => {
    const prev = lignes.filter((l) => String(l[11]).toLowerCase() === "x");
    expect(prev).toHaveLength(1);
    expect(prev[0][0]).toBe("05/04/2026");
  });

  it("garde toutes les autres lignes à l'intérieur des bornes déclarées", () => {
    const enISO = (fr: string) => fr.split("/").reverse().join("-");
    const debut = enISO(BORNES_MODELE.debut);
    const fin = enISO(BORNES_MODELE.fin);
    for (const l of lignes.filter((x) => String(x[11]).toLowerCase() !== "x")) {
      const d = enISO(String(l[0]));
      expect(d >= debut && d <= fin, `date ${l[0]} hors bornes`).toBe(true);
    }
  });

  it("couvre les trois mois du relevé, sans trou", () => {
    const mois = new Set(
      lignes
        .filter((l) => String(l[11]).toLowerCase() !== "x")
        .map((l) => String(l[0]).slice(3))
    );
    expect([...mois].sort()).toEqual(["01/2026", "02/2026", "03/2026"]);
  });
});

describe("modèle Excel — feuille Paie", () => {
  const lignes = feuille("Paie").slice(1);

  it("donne un bulletin par mois du relevé", () => {
    expect(lignes.map((l) => l[0])).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("écrit un net conforme à la formule de l'application", () => {
    // net = brut − cotisations + indemnités − autres retenues
    for (const [i, l] of lignes.entries()) {
      const [, , brut, cot, indem, ret, net] = l as number[];
      expect(net, `ligne ${i + 2}`).toBeCloseTo(brut - cot + indem - ret, 2);
    }
  });

  it("verse exactement le net du mois sur le compte courant", () => {
    // Un modèle incohérent enseignerait l'incohérence : le salaire crédité
    // doit être celui du bulletin.
    for (const p of PAIE_MODELE) {
      const mois = p.mois.slice(5) + "/" + p.mois.slice(0, 4);
      const versement = TRANSACTIONS_MODELE.find(
        (t) => t.type === "Salaire" && t.date.slice(3) === mois
      );
      expect(versement, `versement de ${p.mois} introuvable`).toBeDefined();
      expect(versement!.montant).toBeCloseTo(p.net, 2);
    }
  });
});

describe("modèle Excel — feuille Paramètres", () => {
  const grille = feuille("Paramètres");

  /** Retrouve un tableau par sa cellule d'en-tête, où qu'elle soit. */
  function tableau(enTete: string): [string, unknown][] {
    for (let r = 0; r < grille.length; r++) {
      const c = grille[r].findIndex((v) => String(v).trim() === enTete);
      if (c === -1) continue;
      const out: [string, unknown][] = [];
      for (let i = r + 1; i < grille.length; i++) {
        const cle = String(grille[i][c] ?? "").trim();
        if (cle) out.push([cle, grille[i][c + 1]]);
      }
      return out;
    }
    throw new Error(`en-tête « ${enTete} » introuvable`);
  }

  it("déclare ses bornes de relevé, début ET fin", () => {
    const p = Object.fromEntries(tableau("Paramètre"));
    expect(p["Début de relevé"]).toBe(BORNES_MODELE.debut);
    expect(p["Fin de relevé"]).toBe(BORNES_MODELE.fin);
  });

  it("déclare un bloc prêt complet — le trio est tout ou rien", () => {
    const p = Object.fromEntries(tableau("Paramètre"));
    expect(p["Prêt — montant"]).toBe(PRET_MODELE.montant);
    expect(p["Prêt — mensualité"]).toBe(PRET_MODELE.mensualite);
    expect(p["Prêt — nombre d'échéances"]).toBe(PRET_MODELE.echeances);
    expect(p["Prêt — première échéance"]).toBe(PRET_MODELE.premiereEcheance);
  });

  it("déclare un solde de départ pour chaque compte qui en porte un", () => {
    const soldes = tableau("Compte");
    expect(soldes.map(([c]) => c).sort()).toEqual([...COMPTES_AVEC_SOLDE].sort());
    expect(soldes.map(([, v]) => v)).toEqual(SOLDES_MODELE.map(([, v]) => v));
    for (const [, v] of soldes) expect(typeof v).toBe("number");
  });
});

describe("modèle Excel — reproductibilité", () => {
  it("produit deux fois le même fichier, octet pour octet", () => {
    // Sans propriétés figées, SheetJS écrit la date du jour dans docProps :
    // deux exécutions divergeraient, et tout écart deviendrait ininterprétable.
    const a = construireClasseurModele();
    const b = construireClasseurModele();
    // `length` sur un ArrayBuffer vaut `undefined` : la première version de ce
    // test comparait deux `undefined` et passait sans rien vérifier. On exige
    // donc d'abord un vrai Uint8Array non vide.
    expect(a).toBeInstanceOf(Uint8Array);
    expect(a.length).toBeGreaterThan(1000);
    expect(a.length).toBe(b.length);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});

describe("modèle Excel — mensualité du prêt", () => {
  it("découpe chaque échéance en capital et intérêts qui font la mensualité", () => {
    const parMois = new Map<string, number>();
    for (const t of TRANSACTIONS_MODELE) {
      if (t.previsionnel === "x") continue;
      if (t.type !== "Crédit Immobilier" && t.type !== "Intérêt du prêt") continue;
      const mk = t.date.slice(3);
      parMois.set(mk, (parMois.get(mk) ?? 0) + t.montant);
    }
    expect(parMois.size).toBe(3);
    for (const [mk, total] of parMois) {
      expect(total, `mensualité de ${mk}`).toBeCloseTo(PRET_MODELE.mensualite, 2);
    }
  });
});
