import { describe, it, expect, afterEach, vi } from "vitest";
import * as XLSX from "xlsx";
import { lireClasseurPublic, type RapportImport } from "@/services/lectureClasseur";

/**
 * D-1 (plan 33) — la feuille `Patrimoine`, FACULTATIVE.
 *
 * Données fictives uniquement, noms génériques. « Aujourd'hui » est FIXÉ au
 * 28/10/2026 : la règle « date dépassée » dépend du jour, et un test qui
 * change de résultat avec le calendrier ne protège rien.
 *
 * Le jeu de base (en-tête en ligne 3, sous un titre et une ligne vide) :
 *
 *   ligne | compte              | nature     | date       | montant
 *   ------|---------------------|------------|------------|----------
 *     4   | Banque A - Courant  | Liquidité  | 31/08/2026 |  1 200,50
 *     5   | Banque A - Courant  | Liquidité  | 30/09/2026 |  1 350,00
 *     6   | Banque A - Courant  | Liquidité  | 31/10/2026 |  (vide)      ← pas encore saisi
 *     7   | Livret Banque B     | Epargne    | 31/07/2026 |  (vide)      ← oubli de saisie
 *     8   | Livret Banque B     | Epargne    | 31/08/2026 |  5 000,00
 *     9   | Livret Banque B     | Epargne    | 30/09/2026 |  5 100,00
 *    10   | Assurance-vie       | Epargne    | 30/09/2026 |  8 000,00    ← démarre tard
 *    11   | Résidence           | Immobilier | 31/08/2026 | 60 000,00
 *    12   | Résidence           | Immobilier | 30/09/2026 | 60 500,00
 *    13   | Prêt immobilier     | Immobilier | 30/09/2026 | 20 000,00
 *    14   | Prêt immobilier     | Immobilier | 31/10/2026 | 20 300,00    ← prérempli, futur
 *    15   | Prêt immobilier     | Immobilier | 30/11/2026 | 20 600,00    ← prérempli, futur
 *
 * Attendu : 12 lignes lues = 8 gardées + 2 futures + 2 non saisies + 0 ignorée.
 */

const AUJ = "2026-10-28";

const ENTETE = ["Ordre", "Transaction", "Epargne/Liquidité", "Banque", "Date", "Montant", "Date dépassée", "Annee", "mois"];

/** Série Excel d'une date AAAA-MM-JJ — ce que contient une vraie cellule date. */
function serie(iso: string): number {
  const [a, m, j] = iso.split("-").map(Number);
  return (Date.UTC(a, m - 1, j) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

type Ligne = [number | string | null, string, string, string, number | string | null, number | string | null];

/** Une ligne au format de la feuille ; les colonnes G, H, I portent des valeurs parasites. */
function ligne([ordre, compte, nature, banque, date, montant]: Ligne): unknown[] {
  const d = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? serie(date) : date;
  return [ordre, compte, nature, banque, d, montant, "x", 1999, 13];
}

const BASE: Ligne[] = [
  [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-08-31", 1200.5],
  [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-09-30", 1350],
  [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-10-31", null],
  [2, "Livret Banque B", "Epargne", "Banque B", "2026-07-31", null],
  [2, "Livret Banque B", "Epargne", "Banque B", "2026-08-31", 5000],
  [2, "Livret Banque B", "Epargne", "Banque B", "2026-09-30", 5100],
  [3, "Assurance-vie", "Epargne", "Assureur", "2026-09-30", 8000],
  [4, "Résidence", "Immobilier", "Immobilier", "2026-08-31", 60000],
  [4, "Résidence", "Immobilier", "Immobilier", "2026-09-30", 60500],
  [5, "Prêt immobilier", "Immobilier", "Banque A", "2026-09-30", 20000],
  [5, "Prêt immobilier", "Immobilier", "Banque A", "2026-10-31", 20300],
  [5, "Prêt immobilier", "Immobilier", "Banque A", "2026-11-30", 20600],
];

/** La feuille : un titre, une ligne vide, l'en-tête en ligne 3, puis les lignes. */
function feuillePatrimoine(lignes: Ligne[] = BASE, entete: unknown[] = ENTETE): unknown[][] {
  return [["Suivi des soldes (fictif)"], [], entete, ...lignes.map(ligne)];
}

/** Une transaction valide, sans anomalie : le lecteur exige au moins une ligne. */
const TRANSACTIONS: unknown[][] = [
  ["Date", "Compte", "Type", "Montant", "Sens"],
  ["03/01/2026", "Banque A - Courant", "Virement extérieur", 1000, "Crédit"],
];

/** Construit un classeur et le fait passer par écriture + lecture, comme un vrai fichier. */
function classeur(feuilles: Record<string, unknown[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [nom, aoa] of Object.entries(feuilles)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nom);
  }
  const octets = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return XLSX.read(octets, { type: "array", cellDates: false });
}

function lire(patrimoine?: unknown[][], nomFeuille = "Patrimoine"): RapportImport {
  const feuilles: Record<string, unknown[][]> = { Transactions: TRANSACTIONS };
  if (patrimoine) feuilles[nomFeuille] = patrimoine;
  return lireClasseurPublic(classeur(feuilles), { aujourdhui: AUJ });
}

const alertesPatrimoine = (r: RapportImport) =>
  r.anomalies.filter((a) => a.feuille.toLowerCase().includes("patrimoine"));

const resume = (r: RapportImport) =>
  r.patrimoine!.releves.map((x) => `${x.compte}|${x.mk}|${x.montant}`);

afterEach(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════
// Feuille absente : rien ne change
// ═══════════════════════════════════════════════════════════════════════

describe("feuille Patrimoine absente", () => {
  it("le rapport n'a pas de clé patrimoine, aucune anomalie", () => {
    const r = lire();
    expect("patrimoine" in r).toBe(false);
    expect(r.anomalies).toEqual([]);
    expect(r.compteurs).toEqual({ lignesLues: 1, acceptees: 1, rejetees: 0, ignorees: 0, avertissements: 0 });
  });

  it("une autre feuille inconnue ne crée pas de clé patrimoine", () => {
    const r = lireClasseurPublic(classeur({ Transactions: TRANSACTIONS, Notes: [["rien"]] }), { aujourdhui: AUJ });
    expect("patrimoine" in r).toBe(false);
  });

  it("avec la feuille, tout le reste du rapport est identique", () => {
    const sans = lire();
    const { patrimoine, ...avec } = lire(feuillePatrimoine());
    expect(patrimoine).toBeDefined();
    expect(avec).toEqual(sans);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Le jeu de base
// ═══════════════════════════════════════════════════════════════════════

describe("jeu de base", () => {
  const r = lire(feuillePatrimoine());
  const p = r.patrimoine!;

  it("garde 8 relevés, triés par mois puis par ordre", () => {
    expect(resume(r)).toEqual([
      "Banque A - Courant|2026-08|1200.5",
      "Livret Banque B|2026-08|5000",
      "Résidence|2026-08|60000",
      "Banque A - Courant|2026-09|1350",
      "Livret Banque B|2026-09|5100",
      "Assurance-vie|2026-09|8000",
      "Résidence|2026-09|60500",
      "Prêt immobilier|2026-09|20000",
    ]);
  });

  it("compte les lignes : 12 lues = 8 gardées + 2 futures + 2 non saisies", () => {
    expect(p.compteurs).toEqual({ lignesLues: 12, gardees: 8, futures: 2, nonSaisies: 2, ignorees: 0 });
    const c = p.compteurs;
    expect(c.gardees + c.futures + c.nonSaisies + c.ignorees).toBe(c.lignesLues);
  });

  it("5 comptes, dernier mois septembre 2026, aucune anomalie", () => {
    expect(p.nbComptes).toBe(5);
    expect(p.dernierMois).toBe("2026-09");
    expect(r.anomalies).toEqual([]);
  });

  it("chaque relevé porte ordre, nature, banque et date", () => {
    expect(p.releves[0]).toEqual({
      ordre: 1, compte: "Banque A - Courant", nature: "Liquidité", banque: "Banque A",
      mk: "2026-08", date: "2026-08-31", montant: 1200.5,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Ligne d'en-tête cherchée, colonnes par leur nom
// ═══════════════════════════════════════════════════════════════════════

describe("en-tête et colonnes", () => {
  it("l'en-tête est cherché : 10 lignes au-dessus ne gênent pas", () => {
    const aoa = [...Array.from({ length: 10 }, (_, i) => [`segment ${i + 1}`]), ...feuillePatrimoine().slice(2)];
    expect(resume(lire(aoa))).toEqual(resume(lire(feuillePatrimoine())));
  });

  it("les numéros de ligne cités sont ceux du tableur, même si la feuille commence en ligne 12", () => {
    const lignes: Ligne[] = [
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-08-31", 100],
      [1, "Banque A - Courant", "Bourse", "Banque A", "2026-09-30", 200],
    ];
    const aoa = [ENTETE, ...lignes.map(ligne)];
    // Classeur construit EN MÉMOIRE : après un aller-retour par un fichier,
    // SheetJS remet la plage en A1 (mesuré), et le décalage ne serait pas testé.
    // `sheet_add_aoa` part lui aussi de A1 : la plage est donc posée à la main,
    // comme la dimension d'un fichier dont le tableau commence en ligne 12.
    const ws: XLSX.WorkSheet = {};
    XLSX.utils.sheet_add_aoa(ws, aoa, { origin: "A12" });
    ws["!ref"] = "A12:I14";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(TRANSACTIONS), "Transactions");
    XLSX.utils.book_append_sheet(wb, ws, "Patrimoine");
    // Le test n'a de sens que si la plage commence vraiment en ligne 12.
    expect(XLSX.utils.decode_range(wb.Sheets.Patrimoine["!ref"]!).s.r).toBe(11);
    const r = lireClasseurPublic(wb, { aujourdhui: AUJ });
    expect(r.patrimoine!.releves).toHaveLength(1);
    expect(alertesPatrimoine(r)).toEqual([
      expect.objectContaining({ feuille: "Patrimoine", ligne: 14, colonne: "Epargne/Liquidité" }),
    ]);
  });

  it("colonnes déplacées, en majuscules et sans accents : même résultat", () => {
    // Ordre libre : Montant, Date, Banque, Transaction, EPARGNE/LIQUIDITE ; pas d'Ordre.
    const entete = ["MONTANT", "date", "Banque", "transaction", "EPARGNE/LIQUIDITE", "Date dépassée"];
    const aoa = [entete, ...BASE.map((l) => {
      const [, compte, nature, banque, date, montant] = ligne(l);
      return [montant, date, banque, compte, nature, "x"];
    })];
    const r = lire(aoa);
    expect([...resume(r)].sort()).toEqual([...resume(lire(feuillePatrimoine()))].sort());
    expect(r.patrimoine!.releves.every((x) => x.ordre === null)).toBe(true);
  });

  it("« Date dépassée » n'est pas prise pour la colonne Date", () => {
    // La colonne G porte « x » partout : si elle était lue comme date, tout serait illisible.
    expect(lire(feuillePatrimoine()).patrimoine!.compteurs.gardees).toBe(8);
  });

  it("en-tête introuvable → soldes vides et un avertissement, l'import passe", () => {
    const r = lire([["Compte", "Solde"], ["Banque A - Courant", 100]]);
    expect(r.patrimoine!.releves).toEqual([]);
    expect(r.transactions).toHaveLength(1);
    expect(alertesPatrimoine(r)).toEqual([
      expect.objectContaining({ gravite: "avertissement", message: expect.stringContaining("ligne d'en-tête introuvable") }),
    ]);
  });

  it("colonne obligatoire absente → soldes vides, l'avertissement la nomme", () => {
    const entete = ["Ordre", "Transaction", "Epargne/Liquidité", "Date", "Montant"];
    const r = lire([entete, [1, "Banque A - Courant", "Liquidité", serie("2026-09-30"), 100]]);
    expect(r.patrimoine!.releves).toEqual([]);
    expect(alertesPatrimoine(r)).toEqual([
      expect.objectContaining({ ligne: 1, message: expect.stringContaining("Banque") }),
    ]);
  });

  it("deux feuilles « Patrimoine » et « patrimoine » → avertissement, l'import passe (Q3)", () => {
    const wb = classeur({ Transactions: TRANSACTIONS, Patrimoine: feuillePatrimoine(), patrimoine: feuillePatrimoine() });
    const r = lireClasseurPublic(wb, { aujourdhui: AUJ });
    expect(r.transactions).toHaveLength(1);
    expect(r.patrimoine!.releves).toEqual([]);
    expect(alertesPatrimoine(r)).toHaveLength(1);
    expect(alertesPatrimoine(r)[0].message).toContain("à la casse près");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Les règles ligne par ligne
// ═══════════════════════════════════════════════════════════════════════

describe("nature", () => {
  it("Immobilier est lu (P6), casse et accents libres", () => {
    const r = lire(feuillePatrimoine([
      [1, "Résidence", "IMMOBILIER", "Immobilier", "2026-09-30", 60000],
      [2, "Livret Banque B", " épargne ", "Banque B", "2026-09-30", 5000],
      [3, "Banque A - Courant", "liquidite", "Banque A", "2026-09-30", 900],
    ]));
    expect(r.patrimoine!.releves.map((x) => x.nature)).toEqual(["Immobilier", "Epargne", "Liquidité"]);
    expect(r.anomalies).toEqual([]);
  });

  it("nature inconnue → ligne ignorée avec avertissement situé", () => {
    const r = lire(feuillePatrimoine([
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-09-30", 900],
      [2, "Compte titres", "Bourse", "Banque C", "2026-09-30", 3000],
    ]));
    expect(resume(r)).toEqual(["Banque A - Courant|2026-09|900"]);
    expect(r.patrimoine!.compteurs.ignorees).toBe(1);
    expect(alertesPatrimoine(r)).toEqual([{
      gravite: "avertissement", feuille: "Patrimoine", ligne: 5, colonne: "Epargne/Liquidité",
      message: "Nature inconnue : « Bourse ». Attendu Epargne, Liquidité ou Immobilier.",
    }]);
  });
});

describe("date dépassée (date < aujourd'hui)", () => {
  it("le relevé du jour même n'est pas pris ; celui de la veille l'est", () => {
    const r = lire(feuillePatrimoine([
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-10-27", 100],
      [2, "Livret Banque B", "Epargne", "Banque B", "2026-10-28", 200],
    ]));
    expect(resume(r)).toEqual(["Banque A - Courant|2026-10|100"]);
    expect(r.patrimoine!.compteurs.futures).toBe(1);
  });

  it("l'échéancier du prêt, prérempli jusqu'en 2042, est mis de côté sans message", () => {
    const futures: Ligne[] = Array.from({ length: 24 }, (_, i) => {
      const a = 2041 + Math.floor(i / 12);
      const m = String((i % 12) + 1).padStart(2, "0");
      return [5, "Prêt immobilier", "Immobilier", "Banque A", `${a}-${m}-28`, 1000 * (i + 1)];
    });
    const r = lire(feuillePatrimoine([...BASE, ...futures]));
    expect(r.patrimoine!.compteurs.futures).toBe(2 + 24);
    expect(r.patrimoine!.compteurs.gardees).toBe(8);
    expect(r.patrimoine!.dernierMois).toBe("2026-09");
    expect(r.anomalies).toEqual([]);
  });

  it("sans réglage, « aujourd'hui » est la date de l'horloge (Q1)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 28, 12, 0)); // 28/10/2026, midi, heure locale
    const r = lireClasseurPublic(classeur({ Transactions: TRANSACTIONS, Patrimoine: feuillePatrimoine() }));
    expect(r.patrimoine!.compteurs).toEqual({ lignesLues: 12, gardees: 8, futures: 2, nonSaisies: 2, ignorees: 0 });

    vi.setSystemTime(new Date(2026, 10, 1, 0, 30)); // 01/11/2026 : le relevé du 31/10 est pris
    const r2 = lireClasseurPublic(classeur({ Transactions: TRANSACTIONS, Patrimoine: feuillePatrimoine() }));
    expect(r2.patrimoine!.compteurs.futures).toBe(1);
    expect(r2.patrimoine!.dernierMois).toBe("2026-10");
  });
});

describe("montant", () => {
  it("montant vide = pas encore saisi : ni 0, ni message", () => {
    const r = lire(feuillePatrimoine([
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-08-31", 1000],
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-09-30", null],
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-10-31", "  "],
    ]));
    expect(resume(r)).toEqual(["Banque A - Courant|2026-08|1000"]);
    expect(r.patrimoine!.releves.some((x) => x.montant === 0)).toBe(false);
    expect(r.patrimoine!.compteurs.nonSaisies).toBe(2);
    expect(r.anomalies).toEqual([]);
  });

  it("montant en texte lisible (« 1 234,56 ») → lu, comme une transaction (Q2)", () => {
    const r = lire(feuillePatrimoine([
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-09-30", "1 234,56"],
    ]));
    expect(resume(r)).toEqual(["Banque A - Courant|2026-09|1234.56"]);
    expect(r.anomalies).toEqual([]);
  });

  it("montant en texte illisible → ligne ignorée AVEC avertissement, jamais 0", () => {
    const r = lire(feuillePatrimoine([
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-08-31", 1000],
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-09-30", "mille"],
    ]));
    expect(resume(r)).toEqual(["Banque A - Courant|2026-08|1000"]);
    expect(r.patrimoine!.compteurs.ignorees).toBe(1);
    expect(alertesPatrimoine(r)).toEqual([expect.objectContaining({
      gravite: "avertissement", feuille: "Patrimoine", ligne: 5, colonne: "Montant",
      message: expect.stringContaining("Montant illisible : « mille »"),
    })]);
  });

  it("un solde négatif (découvert) est gardé", () => {
    const r = lire(feuillePatrimoine([[1, "Banque A - Courant", "Liquidité", "Banque A", "2026-09-30", -85.4]]));
    expect(resume(r)).toEqual(["Banque A - Courant|2026-09|-85.4"]);
  });
});

describe("date", () => {
  it("date tapée en texte JJ/MM/AAAA ou AAAA-MM-JJ → lue", () => {
    const r = lire([ENTETE,
      [1, "Banque A - Courant", "Liquidité", "Banque A", "30/09/2026", 100],
      [2, "Livret Banque B", "Epargne", "Banque B", "2026-08-31", 200],
    ]);
    expect(resume(r)).toEqual(["Livret Banque B|2026-08|200", "Banque A - Courant|2026-09|100"]);
  });

  it("date en texte illisible → ligne ignorée avec avertissement", () => {
    const r = lire(feuillePatrimoine([[1, "Banque A - Courant", "Liquidité", "Banque A", "sept. 2026", 100]]));
    expect(r.patrimoine!.releves).toEqual([]);
    expect(alertesPatrimoine(r)).toEqual([expect.objectContaining({
      ligne: 4, colonne: "Date", message: expect.stringContaining("Date illisible : « sept. 2026 »"),
    })]);
  });

  it("le mois est l'année-mois de la date : 01/06/2025 = juin 2025", () => {
    const r = lire(feuillePatrimoine([[1, "Banque A - Courant", "Liquidité", "Banque A", "2025-06-01", 100]]));
    expect(r.patrimoine!.releves[0]).toMatchObject({ mk: "2025-06", date: "2025-06-01" });
  });
});

describe("doublon même compte / même mois", () => {
  it("le plus récent est gardé, quel que soit l'ordre des lignes, avec avertissement", () => {
    const r = lire(feuillePatrimoine([
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-09-30", 1350],
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-09-15", 1100],
    ]));
    expect(resume(r)).toEqual(["Banque A - Courant|2026-09|1350"]);
    expect(r.patrimoine!.compteurs).toMatchObject({ lignesLues: 2, gardees: 1, ignorees: 1 });
    expect(alertesPatrimoine(r)).toEqual([expect.objectContaining({
      ligne: 5,
      message: "Deux soldes pour « Banque A - Courant » en 2026-09 (lignes 4 et 5). Seul le plus récent est gardé : ligne 4.",
    })]);
  });

  it("deux comptes différents le même mois ne sont pas des doublons", () => {
    const r = lire(feuillePatrimoine([
      [1, "Banque A - Courant", "Liquidité", "Banque A", "2026-09-30", 100],
      [2, "Banque B - Courant", "Liquidité", "Banque B", "2026-09-30", 200],
    ]));
    expect(r.patrimoine!.releves).toHaveLength(2);
    expect(r.anomalies).toEqual([]);
  });
});

describe("ordre et place dans le rapport", () => {
  it("« Ordre » décimal, en nombre ou en texte (4,1), range le compte entre 4 et 5", () => {
    const r = lire(feuillePatrimoine([
      [5, "Retraite", "Epargne", "Assureur", "2026-09-30", 300],
      ["4,1", "Livret Banque B", "Epargne", "Banque B", "2026-09-30", 200],
      [4, "Assurance-vie", "Epargne", "Assureur", "2026-09-30", 100],
    ]));
    expect(r.patrimoine!.releves.map((x) => [x.ordre, x.compte])).toEqual([
      [4, "Assurance-vie"], [4.1, "Livret Banque B"], [5, "Retraite"],
    ]);
  });

  it("les avertissements Patrimoine viennent APRÈS ceux des transactions et sont comptés", () => {
    const tx = [["Date", "Compte", "Type", "Montant", "Sens"], ["03/01/2026", "Banque A - Courant", "courses", 42, "Débit"]];
    const wb = classeur({
      Transactions: tx,
      Patrimoine: feuillePatrimoine([[1, "Compte titres", "Bourse", "Banque C", "2026-09-30", 3000]]),
    });
    const r = lireClasseurPublic(wb, { aujourdhui: AUJ });
    expect(r.anomalies.map((a) => a.feuille)).toEqual(["Transactions", "Patrimoine"]);
    expect(r.compteurs.avertissements).toBe(2);
    // Les compteurs des transactions ne comptent pas les lignes de la feuille Patrimoine.
    expect(r.compteurs).toMatchObject({ lignesLues: 1, acceptees: 1, rejetees: 0, ignorees: 0 });
  });
});
