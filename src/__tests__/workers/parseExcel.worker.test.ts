import { describe, it, expect, beforeAll, vi } from "vitest";
import * as XLSX from "xlsx";

/**
 * Tests de non-régression du worker d'import Excel.
 *
 * Ils couvrent les deux défauts trouvés le 11/08/2026 en confrontant la sortie
 * du worker à `public/data/transactions.json`, produit par le parseur Python du
 * skill `l'outil de mise à jour des données` — la référence du projet :
 *
 *   A. `cleanStr` supprimait TOUS les espaces (et non les seuls insécables).
 *      Les tables CREDIT_TYPES / HALF_COMPTES / CAT1_EXCLUDE, qui portent des
 *      libellés avec espaces, ne correspondaient plus à rien : 116 crédits
 *      classés en débit, division par deux jamais appliquée.
 *
 *   B. `XLSX.read(cellDates: true)` rendait des `Date` construits en heure
 *      locale, à 21 secondes de minuit : la veille sur 100 % des lignes en
 *      Europe/Paris — et correct sous UTC, d'où l'invisibilité en intégration.
 *
 * ⚠️ Le test B ne prouve le défaut que dans un fuseau à décalage positif.
 * Sous TZ=UTC il passerait même avec `cellDates: true`.
 */

// ── Construction d'un classeur minimal conforme au format attendu ───────────

const HEADER_TX = ["Transaction", "Compte", "Type Dépense", "Date"];

/**
 * Série Excel d'une date (jours depuis le 30/12/1899).
 *
 * ⚠️ Les dates du classeur DOIVENT être écrites en série numérique, et non en
 * objet `Date`. Une cellule écrite depuis un `Date` traverse deux conversions
 * symétriques (écriture puis lecture, toutes deux en heure locale) qui
 * s'annulent : le défaut B ne s'y reproduit pas, et un test bâti ainsi passe
 * même avec `cellDates: true`. Mesuré le 11/08/2026 — le premier jeu de tests
 * écrit pour ce correctif est tombé dans ce piège.
 */
function serial(y: number, m: number, d: number): number {
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** Marque une cellule comme date formatée, pour que SheetJS la traite en date. */
function asDateCell(ws: XLSX.WorkSheet, col: number, row: number): void {
  const ref = XLSX.utils.encode_cell({ c: col, r: row });
  const cell = ws[ref] as XLSX.CellObject | undefined;
  if (cell) { cell.t = "n"; cell.z = "dd/mm/yyyy"; }
}

/** Feuille "Transactions AAAA" : en-tête ligne 18, données à partir de la 19. */
function makeTxSheet(rows: unknown[][]): XLSX.WorkSheet {
  const aoa: unknown[][] = [];
  for (let i = 0; i < 17; i++) aoa.push([]);
  aoa.push(HEADER_TX);
  rows.forEach((r) => aoa.push(r));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  rows.forEach((_, i) => asDateCell(ws, 3, 18 + i));
  return ws;
}

/** Feuille "Fiche de Paie" : en-tête ligne 12, données à partir de la 13. */
function makeSalarySheet(): XLSX.WorkSheet {
  const aoa: unknown[][] = [];
  for (let i = 0; i < 11; i++) aoa.push([]);
  aoa.push(["Mois", "Entreprise", "Brut", "Net", "Net imposable", "Cotisations", "Date"]);
  aoa.push(["janv.", "Employeur E", 4000, 3000, 3100, 900, serial(2026, 1, 31)]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  asDateCell(ws, 6, 12);
  return ws;
}

/**
 * Ligne de transaction, aux positions attendues par le lecteur
 * (en-têtes ligne 18) :
 *
 *   0 A Transaction · 1 B Compte · 2 C Type Dépense · 3 D Date
 *   4 E Montant · 5 F Montant réel · 6 G Catégorie 1 · 7 H Catégorie 2
 *   8 I Catégorie 3 · 9 J Catégorie 4 · 10 K Prévisionnel
 *   11 L Categorie 4 abandonnée · 12 M Pays · 13 N Ville
 *   14 O Annee · 15 P Mois · 16 Q Annee_Mois · 17 R Mois_Année
 *   18 S Débit/Crédit · 19 T Dépassé Date
 *
 * ⚠️ Le parser lisait auparavant la Ville en 11 (L) et le Débit/Crédit en
 * 13 (N). Ce helper reproduisait la MÊME erreur, si bien que le décalage
 * restait invisible : les tests passaient pour une mauvaise raison.
 */
function txRow(o: {
  label: string; compte: string; type: string; date: number;
  brut?: number; reel?: number | null; dc?: string | null;
  pays?: string | null; ville?: string | null; previsionnel?: string | null;
}): unknown[] {
  const r: unknown[] = new Array(20).fill(null);
  r[0] = o.label; r[1] = o.compte; r[2] = o.type; r[3] = o.date;
  r[4] = o.brut ?? null; r[5] = o.reel ?? null;
  r[10] = o.previsionnel ?? null;
  r[12] = o.pays ?? null; r[13] = o.ville ?? null; r[18] = o.dc ?? null;
  return r;
}

function buildWorkbook(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSalarySheet(), "Fiche de Paie");
  XLSX.utils.book_append_sheet(wb, makeTxSheet(rows), "Transactions 2025");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}

// ── Exécution du worker hors navigateur ─────────────────────────────────────

type WorkerMsg = { type: string; [k: string]: unknown };

let onmessage: ((ev: { data: unknown }) => void) | null = null;
const sent: WorkerMsg[] = [];

beforeAll(async () => {
  vi.stubGlobal("self", {
    get onmessage() { return onmessage; },
    set onmessage(fn: typeof onmessage) { onmessage = fn; },
    postMessage: (m: WorkerMsg) => { sent.push(m); },
  });
  await import("@/components/upload/parseExcel.worker");
});

/** Envoie un classeur au worker et rend la réponse finale (result ou error). */
function run(rows: unknown[][]) {
  sent.length = 0;
  onmessage!({ data: { type: "parse", buffer: buildWorkbook(rows) } });
  const last = sent.filter((m) => m.type !== "progress").pop();
  if (!last) throw new Error("Le worker n'a produit aucun message final.");
  if (last.type === "error") throw new Error(String(last.message));
  return last as unknown as { transactions: { s: string[]; t: unknown[][]; fields: string[] } };
}

/** Décode la n-ième transaction encodée en dictionnaire. */
function decode(res: ReturnType<typeof run>, i = 0): Record<string, unknown> {
  const { s, t, fields } = res.transactions;
  const row = t[i] as unknown[];
  const o: Record<string, unknown> = {};
  fields.forEach((f, k) => {
    const v = row[k];
    o[f] = f === "montant" || f === "date"
      ? v
      : typeof v === "number" ? (v < 0 ? null : s[v]) : v;
  });
  return o;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("parseExcel.worker — défaut A : normalisation des chaînes", () => {
  it("conserve les espaces ordinaires des libellés", () => {
    const res = run([txRow({
      label: "Transfert Banque A vers Banque C Octobre 24",
      compte: "Banque C - Compte joint", type: "Transfert Banque A vers Banque C",
      date: serial(2025, 10, 1), reel: 250,
    })]);
    const tx = decode(res);
    expect(tx.label).toBe("Transfert Banque A vers Banque C Octobre 24");
    expect(tx.compte).toBe("Banque C - Compte joint");
    expect(tx.type).toBe("Transfert Banque A vers Banque C");
  });

  it("retire les espaces insécables, comme la référence Python", () => {
    // U+00A0 écrit en échappement : un espace insécable littéral serait
    // invisible dans le source, et la réussite du test indémontrable à la
    // relecture. Le premier jet de ce fichier en contenait un — il passait
    // pour de mauvaises raisons.
    const res = run([txRow({
      label: "Courses\u00A0Supermarché Centre", compte: "Banque A - Courant", type: "Courses",
      date: serial(2025, 10, 1), reel: 42,
    })]);
    expect(decode(res).label).toBe("CoursesSupermarché Centre");
  });

  it("ne fusionne pas deux mots séparés par un espace ordinaire", () => {
    // Contre-épreuve : c'est cette assertion, et elle seule, qui tombe si
    // `.replace(/ /g, "")` revient dans `cleanStr`.
    const res = run([txRow({
      label: "Courses Supermarché Centre", compte: "Banque A - Courant", type: "Courses",
      date: serial(2025, 10, 1), reel: 42,
    })]);
    expect(decode(res).label).toBe("Courses Supermarché Centre");
  });

  it("classe en Crédit un type de CREDIT_TYPES quand la formule n'est pas en cache", () => {
    // Régression directe du défaut A : "Ticket Restaurant" amputé de son espace
    // ne correspondait plus à CREDIT_TYPES, et retombait en "Débit".
    const res = run([txRow({
      label: "Titres-restaurant Mars", compte: "Titres-restaurant", type: "Ticket Restaurant",
      date: serial(2025, 10, 1), reel: 180, dc: null,
    })]);
    expect(decode(res).dc).toBe("Crédit");
  });

  it("ignore les lignes marquées Prévisionnel en colonne K", () => {
    // Le classeur marque « x » en colonne K les échéances à venir (prêt,
    // réservations). Elles ne sont pas des mouvements constatés : les importer
    // fait dériver le solde affiché, car le mois courant du dashboard est le
    // dernier mois présent dans les données. Constaté sur un classeur réel :
    // le solde total basculait du positif au négatif.
    const res = run([
      txRow({
        label: "Courses réelles", compte: "Banque A - Courant",
        type: "Courses", date: serial(2025, 10, 1), reel: 30,
      }),
      txRow({
        label: "Prêt Août 27", compte: "Banque C - Compte joint",
        type: "Crédit Immobilier", date: serial(2027, 8, 15), reel: 586.48,
        previsionnel: "x",
      }),
    ]);
    const tx = decode(res);
    expect(tx.label).toBe("Courses réelles");
    expect(res.transactions.t).toHaveLength(1);
  });

  it("accepte un X majuscule en colonne K", () => {
    const res = run([
      txRow({
        label: "Réel", compte: "Banque A - Courant", type: "Courses",
        date: serial(2025, 10, 1), reel: 30,
      }),
      txRow({
        label: "Prévision", compte: "Banque A - Courant", type: "Courses",
        date: serial(2025, 11, 1), reel: 99, previsionnel: "X",
      }),
    ]);
    expect(res.transactions.t).toHaveLength(1);
  });

  it("n'exclut pas une ligne dont la colonne K est vide", () => {
    // Contre-épreuve : c'est cette assertion qui tombe si le test de la
    // colonne K est écrit trop large (par exemple sur une chaîne non vide).
    const res = run([
      txRow({
        label: "Courses", compte: "Banque A - Courant", type: "Courses",
        date: serial(2025, 10, 1), reel: 30, previsionnel: null,
      }),
    ]);
    expect(res.transactions.t).toHaveLength(1);
  });

  it("lit la Ville en colonne N et le Débit/Crédit en colonne S", () => {
    // Régression du décalage de colonnes (plan de renommage, B4). Ce test est
    // le seul garde-fou : si le parser revient à L (11) et N (13), `ville`
    // redevient vide et `dc` est recalculé depuis le Type — silencieusement.
    // Piège : "Virement extérieur" est un CREDIT_TYPE, donc le repli
    // donnerait "Crédit". Seule une vraie lecture de la colonne S rend "Débit".
    const res = run([txRow({
      label: "Retrait DAB", compte: "Banque A - Courant",
      type: "Virement extérieur", date: serial(2025, 10, 1), reel: 60,
      pays: "France", ville: "Villebourg-sur-Rive", dc: "Débit",
    })]);
    const tx = decode(res);
    expect(tx.ville).toBe("Villebourg-sur-Rive");
    expect(tx.dc).toBe("Débit");
  });

  it("applique la division par deux aux comptes de HALF_COMPTES", () => {
    // "Banque A - Part commune" devenait "CAVal/Gae" : la règle ne s'appliquait jamais.
    const res = run([txRow({
      label: "Restaurant partagé", compte: "Banque A - Part commune", type: "Restaurant",
      date: serial(2025, 10, 1), brut: 100, reel: null,
    })]);
    expect(decode(res).montant).toBe(50);
  });
});

describe("parseExcel.worker — défaut B : lecture des dates", () => {
  it("rend la date du classeur sans décalage d'un jour", () => {
    const res = run([txRow({
      label: "Courses\u00A0Supermarché Centre", compte: "Banque A - Courant", type: "Courses",
      date: serial(2025, 10, 1), reel: 42,
    })]);
    expect(decode(res).date).toBe("2025-10-01");
  });

  it("ne décale pas non plus une date de fin de mois", () => {
    const res = run([txRow({
      label: "Loyer", compte: "Banque A - Courant", type: "Logement",
      date: serial(2025, 12, 31), reel: 900,
    })]);
    expect(decode(res).date).toBe("2025-12-31");
  });

  it("n'attribue pas au mois précédent une paie datée du 1er", () => {
    // `mk = date.slice(0, 7)` : un décalage J-1 sur un 1er du mois faisait
    // basculer toute la fiche de paie sur le mois antérieur.
    const res = run([txRow({
      label: "Salaire janvier", compte: "Banque A - Courant", type: "Salaire",
      date: serial(2026, 2, 1), reel: 3000,
    })]);
    expect(String(decode(res).date).slice(0, 7)).toBe("2026-02");
  });
});

// ── Défauts trouvés le 16/09/2026 sur le classeur RÉEL ───────────────────
//
// Les deux tuyaux de lecture du projet — ce worker et le parseur Python —
// divergeaient sur 88 lignes de 1 933, soit 4,6 %. Mesuré par
// `scripts/check-import-equivalence.mjs`, l'instrument écrit pour ça.

describe("parseExcel.worker — alignement sur le parseur de référence", () => {
  it("réduit une suite d'espaces à une seule, comme la référence", () => {
    // Une cellule de type du classeur réel portait « Jeux Vidéo /  … » avec
    // DEUX espaces. Le worker les gardait, le parseur Python les réduisait :
    // les deux applications affichaient DEUX types là où il n'y en a qu'un.
    const res = run([txRow({
      label: "Achat", compte: "Banque A - Courant", type: "Loisirs /  Jeux",
      date: serial(2025, 10, 1), reel: 30,
    })]);
    expect(decode(res).type).toBe("Loisirs / Jeux");
  });

  it("n'invente PAS de classe pour un type inconnu", () => {
    // Les tables FIXED_TYPES / CURRENT_TYPES / CAT1_EXCLUDE portent le
    // vocabulaire de la démonstration. Tout type d'un classeur tiers tombait
    // donc sur « Dépense Occasionnelle » — une classification inventée.
    // Mesuré : 39 lignes d'épargne comptées comme dépenses occasionnelles.
    const res = run([txRow({
      label: "Virement épargne", compte: "Banque A - Courant",
      type: "Epargne chez un organisme inconnu", date: serial(2025, 10, 1), reel: 500,
    })]);
    expect(decode(res).cat1).toBe("");
  });

  it("classe toujours correctement un type qu'il connaît", () => {
    // Contre-épreuve : la correction ci-dessus ne doit pas désarmer le repli
    // là où il a un sens.
    const res = run([txRow({
      label: "Plein", compte: "Banque A - Courant", type: "Essence",
      date: serial(2025, 10, 1), reel: 60,
    })]);
    expect(decode(res).cat1).toBe("Dépense Courante");
  });
});
