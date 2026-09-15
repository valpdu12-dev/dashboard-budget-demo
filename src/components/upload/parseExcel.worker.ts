// ── Web Worker pour le parsing Excel ─────────────────────────────────────
// Migré depuis V1 parseExcel.js → V2 TypeScript + Web Worker
// FIX V1 : parsing sur le main thread → maintenant dans un thread séparé
// FIX V1 : nom de feuille "Transactions 2025" hardcodé → regex dynamique
//
// Protocole de messages :
//   IN  : { type: "parse", buffer: ArrayBuffer }
//   OUT : { type: "progress", step: string, pct: number }
//         { type: "result", transactions: RawEncoded, salary: SalaryParsed, validation: Validation }
//         { type: "error", message: string }

// Typage Web Worker : le tsconfig principal inclut "DOM" mais pas "WebWorker",
// on declare manuellement l'interface minimale necessaire.
interface WorkerSelf {
  onmessage: ((ev: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
}
declare const self: WorkerSelf;
export {}; // Force le fichier en module ES (requis pour import XLSX)

import * as XLSX from "xlsx";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES INTERNES AU WORKER
// ─────────────────────────────────────────────────────────────────────────────

/** Transaction brute avant encodage dictionnaire */
interface RawTransaction {
  label: string;
  compte: string;
  type: string;
  date: string;
  montant: number;
  cat1: string;
  cat2: string;
  cat3: string;
  cat4: string;
  ville: string;
  dc: string;
}

/** Format encodé par dictionnaire (identique à transactions.json) */
interface EncodedTransactions {
  s: string[];
  t: (number | string)[][];
  fields: string[];
}

/** Mois de salaire parsé */
interface SalaryMonthParsed {
  mk: string;
  entreprise: string;
  brut: number;
  net: number;
  cotSal: number;
  indem: number;
  retenues: number;
}

/** Données salaire parsées */
interface SalaryParsed {
  months: SalaryMonthParsed[];
  cotLast: [string, number][];
  patronLast: [string, number][];
  lastMonth: string;
}

/** Collecteur interne par mois (avant agrégation finale) */
interface MonthBucket {
  mk: string;
  entreprise: string;
  brut: number;
  cotSal: number;
  indem: number;
  retenues: number;
  cotDetails: [string, number][];
  patronDetails: [string, number][];
}

/** Rapport de validation */
interface Validation {
  ok: boolean;
  nbTransactions: number;
  dateMin: string;
  dateMax: string;
  nbMois: number;
  comptes: string[];
  totalDebits: number;
  totalCredits: number;
  net: number;
  nbSalaryMonths: number;
  lastSalaryMonth: string;
  lastNetSalary: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES — LOGIQUE MÉTIER (fallback si valeurs mises en cache absentes)
// ─────────────────────────────────────────────────────────────────────────────

/** Types classés "Dépense Fixe" dans la formule Excel cat1 */
const FIXED_TYPES = new Set([
  "Impôt sur Revenu", "Autres (Amendes, …)", "Assurance prêt",
  "Assurance habitation", "Assurance auto", "Frais de Copropriété",
  "Electricité", "Internet et Forfait téléphone", "Frais Bancaires",
  "Intérêt du prêt", "Abonnement transport",
]);

/** Types classés "Dépense Courante" dans la formule Excel cat1 */
const CURRENT_TYPES = new Set([
  "courses", "cantine", "Essence", "Médecin", "Pharmacie", "Vêtement courant",
]);

/** Types générant un Crédit dans la formule Excel dc (XLOOKUP) */
const CREDIT_TYPES = new Set([
  "Salaire", "Ticket Restaurant", "Dépense Budget", "Virement extérieur",
  "Transfert Banque A vers Banque C", "Transfert Banque A vers Banque B",
]);

/** Types exclus de cat1 (pas de classification Fixe/Occasionnel/Courant) */
const CAT1_EXCLUDE = new Set(["", "Salaire", "Épargne Banque A", "Virement extérieur"]);

/** Comptes dont le montant est divisé par 2 (formule ROUND/IF col F) */
// ⚠️ « Banque B - Courant » n'y figure PAS : son montant n'est pas divisé.
const HALF_COMPTES = new Set([
  "Banque A - Part commune",
  "Appli partagée - Part commune",
  "Banque B - Compte joint",
]);

// ─────────────────────────────────────────────────────────────────────────────
// FONCTIONS FALLBACK — réimplémentation des formules Excel
// ─────────────────────────────────────────────────────────────────────────────

function computeCat1Fallback(type: string, label: string): string {
  if (!label || CAT1_EXCLUDE.has(type)) return "";
  if (CURRENT_TYPES.has(type)) return "Dépense Courante";
  if (FIXED_TYPES.has(type)) return "Dépense Fixe";
  return "Dépense Occasionnelle";
}

function computeDCFallback(type: string): string {
  return CREDIT_TYPES.has(type) ? "Crédit" : "Débit";
}

function computeMontantReelFallback(compte: string, montant: number): number {
  const v = HALF_COMPTES.has(compte) ? montant / 2 : montant;
  return Math.round(v * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────

function xlDateToISO(raw: Date | number | string | null): string | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    // Chemin défensif : avec `cellDates: false` (voir XLSX.read plus bas) les
    // cellules de date arrivent en série numérique et passent par la branche
    // `parse_date_code`, qui est exacte. Si un `Date` parvient malgré tout ici,
    // il faut compenser deux choses avant de lire ses composantes :
    //   ① SheetJS construit l'objet dans le fuseau LOCAL — lire `getFullYear()`
    //      renvoie la veille dès que le décalage est positif (Europe/Paris) ;
    //   ② sa conversion laisse un résidu de quelques secondes (observé :
    //      23:59:39 au lieu de 00:00:00), qu'un arrondi à la minute absorbe.
    const shifted = raw.getTime() - raw.getTimezoneOffset() * 60_000;
    const r = new Date(Math.round(shifted / 60_000) * 60_000);
    const y = r.getUTCFullYear();
    const m = String(r.getUTCMonth() + 1).padStart(2, "0");
    const d = String(r.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof raw === "string" && raw.length >= 10) {
    return raw.slice(0, 10);
  }
  return null;
}

/**
 * Normalisation d'une chaîne lue dans le classeur.
 *
 * ⚠️ Ne retire QUE les espaces insécables (U+00A0), jamais les espaces
 * ordinaires. La référence de ce projet est le parseur Python du skill
 * `l'outil de mise à jour des données` (`parse_budget.py:57`) :
 *     str(v).strip().replace('\xa0', '')
 * Les deux tuyaux doivent produire des chaînes identiques, faute de quoi les
 * tables de correspondance ci-dessus (CREDIT_TYPES, HALF_COMPTES,
 * CAT1_EXCLUDE), qui portent des libellés AVEC espaces, ne correspondent plus
 * à rien : débit/crédit, division par deux et cat1 partent alors en silence.
 */
function cleanStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim().replace(/\xa0/g, "");
}

/** Envoie un message de progression au thread principal */
function progress(step: string, pct: number): void {
  self.postMessage({ type: "progress", step, pct });
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX V1 : Recherche dynamique de la feuille Transactions (regex)
// ─────────────────────────────────────────────────────────────────────────────

const TX_SHEET_REGEX = /^Transactions \d{4}$/;

function findTransactionsSheet(wb: XLSX.WorkBook): { name: string; ws: XLSX.WorkSheet } {
  const match = wb.SheetNames.find((n) => TX_SHEET_REGEX.test(n));
  if (!match) {
    throw new Error(
      `Aucune feuille "Transactions XXXX" trouvée. ` +
      `Feuilles disponibles : ${wb.SheetNames.join(", ")}. ` +
      `Le nom doit correspondre au format "Transactions 2025", "Transactions 2026", etc.`
    );
  }
  return { name: match, ws: wb.Sheets[match] };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

function parseTransactionsSheet(wb: XLSX.WorkBook): RawTransaction[] {
  const { name, ws } = findTransactionsSheet(wb);

  // En-tête ligne 18 (index 0-basé = 17), données à partir de la ligne 19
  // cellDates est géré au niveau XLSX.read(), pas besoin ici
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    range: 17,
    raw: true,
    defval: null,
  });

  if (!rows.length) {
    throw new Error(`La feuille "${name}" est vide à partir de la ligne 18.`);
  }

  // Vérification du header (ligne 18 = rows[0])
  const header = rows[0] as unknown[];
  const expectedHeaders = ["Transaction", "Compte", "Type Dépense", "Date"];
  const missingHeaders = expectedHeaders.filter(
    (h, i) => !header[i] || !String(header[i]).includes(h.split(" ")[0])
  );
  if (missingHeaders.length) {
    throw new Error(
      `En-tête inattendu dans "${name}" (ligne 18). ` +
      `Colonnes manquantes ou déplacées : ${missingHeaders.join(", ")}. ` +
      `Vérifiez que la table commence bien en ligne 18.`
    );
  }

  const data: RawTransaction[] = [];
  let previsionnelles = 0;
  const totalRows = rows.length - 1;

  for (let i = 1; i < rows.length; i++) {
    // Progression toutes les 500 lignes
    if (i % 500 === 0) {
      progress("Lecture des transactions…", Math.round((i / totalRows) * 40));
    }

    const r = rows[i] as unknown[];
    if (!r || r.length === 0) continue;

    const label = cleanStr(r[0]);
    if (!label) continue;

    const compte = cleanStr(r[1]);
    if (!compte) continue;

    // Col K (10) : Prévisionnel. Le classeur y marque « x » les lignes qui sont
    // des PRÉVISIONS et non des mouvements constatés — échéances de prêt à
    // venir, réservations pas encore débitées. Les importer fausse les soldes
    // sans rien casser de visible : le mois courant du dashboard est le dernier
    // mois présent dans les données, donc une échéance datée d'août 2027 devient
    // le solde « actuel » affiché. Constaté sur un classeur réel : quelques
    // dizaines de lignes prévisionnelles suffisaient à faire basculer le solde
    // total affiché du positif au négatif.
    if (cleanStr(r[10]).toLowerCase() === "x") { previsionnelles++; continue; }

    const type = cleanStr(r[2]);

    const date = xlDateToISO(r[3] as Date | number | string | null);
    if (!date) continue;

    // Col F (5) : montant réel (valeur mise en cache de la formule)
    // Fallback sur col E (4) si absente
    let montant = 0;
    const cachedMR = r[5];
    if (typeof cachedMR === "number" && !isNaN(cachedMR)) {
      montant = Math.round(cachedMR * 100) / 100;
    } else {
      const rawM = r[4];
      if (typeof rawM === "number" && !isNaN(rawM)) {
        montant = computeMontantReelFallback(compte, rawM);
      }
    }

    // Col G (6) : cat1 (valeur mise en cache de la formule IF/OR)
    const cachedCat1 = cleanStr(r[6]);
    const cat1 = (cachedCat1 && cachedCat1 !== "x") ? cachedCat1 : computeCat1Fallback(type, label);

    // Col H (7) : cat2
    let cat2 = cleanStr(r[7]);
    if (cat2 === "x") cat2 = "";

    // Col I (8) : cat3
    let cat3 = cleanStr(r[8]);
    if (cat3 === "x") cat3 = "";

    // Col J (9) : cat4
    let cat4 = cleanStr(r[9]);
    if (cat4 === "x") cat4 = "";

    // Col N (13) : ville. Le classeur place Pays en M (12) et Ville en N (13) ;
    // le code lisait auparavant L (11), qui est « Categorie 4 abandonnée ».
    let ville = cleanStr(r[13]);
    if (ville === "x") ville = "";

    // Col S (18) : dc (valeur mise en cache du XLOOKUP). Le code lisait
    // auparavant N (13), qui est la Ville.
    const cachedDC = cleanStr(r[18]);
    const dc = (cachedDC === "Débit" || cachedDC === "Crédit") ? cachedDC : computeDCFallback(type);

    data.push({ label, compte, type, date, montant, cat1, cat2, cat3, cat4, ville, dc });
  }

  if (!data.length) {
    throw new Error(
      `Aucune transaction valide trouvée dans "${name}". ` +
      `Vérifiez que la colonne "Transaction" (A) est remplie à partir de la ligne 19.`
    );
  }

  if (previsionnelles) {
    progress(`${previsionnelles} ligne(s) prévisionnelle(s) ignorée(s)`, 40);
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENCODAGE DICTIONNAIRE (format identique à transactions.json)
// ─────────────────────────────────────────────────────────────────────────────

function encodeTransactions(data: RawTransaction[]): EncodedTransactions {
  const strMap = new Map<string, number>();
  let nextIdx = 0;

  function intern(str: string): number {
    if (!strMap.has(str)) strMap.set(str, nextIdx++);
    return strMap.get(str)!;
  }

  const t = data.map((r) => [
    intern(r.compte),                        // 0 : compte
    intern(r.type),                          // 1 : type
    r.date,                                  // 2 : date ISO
    r.montant,                               // 3 : montant réel
    intern(r.cat1),                          // 4 : cat1
    r.cat2  ? intern(r.cat2)  : -1,          // 5 : cat2
    r.cat3  ? intern(r.cat3)  : -1,          // 6 : cat3
    r.cat4  ? intern(r.cat4)  : -1,          // 7 : cat4
    r.ville ? intern(r.ville) : -1,          // 8 : ville
    intern(r.dc),                            // 9 : dc
    r.label ? intern(r.label) : -1,          // 10 : label
  ]);

  return {
    s: Array.from(strMap.keys()),
    t,
    fields: ["compte", "type", "date", "montant", "cat1", "cat2", "cat3", "cat4", "ville", "dc", "label"],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING FICHE DE PAIE
// ─────────────────────────────────────────────────────────────────────────────

function parseSalarySheet(wb: XLSX.WorkBook): SalaryParsed {
  const SHEET_NAME = "Fiche de Paie";
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    throw new Error(
      `Feuille "${SHEET_NAME}" introuvable. ` +
      `Feuilles disponibles : ${wb.SheetNames.join(", ")}.`
    );
  }

  // En-tête ligne 12 (index 0-basé = 11), données à partir de la ligne 13
  // cellDates est géré au niveau XLSX.read(), pas besoin ici
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    range: 11,
    raw: true,
    defval: null,
  });

  if (!rows.length) {
    throw new Error(`La feuille "${SHEET_NAME}" est vide à partir de la ligne 12.`);
  }

  const byMonth = new Map<string, MonthBucket>();
  const totalRows = rows.length - 1;

  for (let i = 1; i < rows.length; i++) {
    if (i % 200 === 0) {
      progress("Lecture des fiches de paie…", 50 + Math.round((i / totalRows) * 20));
    }

    const r = rows[i] as unknown[];
    if (!r || !r[1] || !r[6]) continue;

    const entreprise  = cleanStr(r[1]);
    const detail      = cleanStr(r[2]);
    const qui         = cleanStr(r[3]);
    const categorie   = cleanStr(r[4]).toUpperCase();
    const designation = cleanStr(r[5]);

    const date = xlDateToISO(r[6] as Date | number | string | null);
    if (!date) continue;

    const mk = date.slice(0, 7);
    const montant = typeof r[7] === "number" ? Math.round(r[7] * 100) / 100 : 0;

    if (!byMonth.has(mk)) {
      byMonth.set(mk, {
        mk,
        entreprise,
        brut: 0,
        cotSal: 0,
        indem: 0,
        retenues: 0,
        cotDetails: [],
        patronDetails: [],
      });
    }

    const m = byMonth.get(mk)!;
    m.entreprise = entreprise;

    // Salaire brut
    if (categorie.startsWith("SALAIRE") && detail === "Salaire") {
      m.brut += montant;
    }
    // Cotisations salariales — Somme pour le total
    else if (categorie.startsWith("*COTISAT.SALARIALES") && detail === "Somme" && qui === "Salarié") {
      m.cotSal += Math.abs(montant);
    }
    // Cotisations salariales — Détail pour cotLast
    else if (categorie.startsWith("*COTISAT.SALARIALES") && detail === "Détail" && qui === "Salarié") {
      m.cotDetails.push([designation, Math.abs(montant)]);
    }
    // Indemnités non soumises — Somme
    else if (categorie.startsWith("*INDEM") && detail === "Somme" && qui === "Salarié") {
      m.indem += montant;
    }
    // Autres retenues — Somme
    else if (categorie.startsWith("*AUTRES RETENUES") && detail === "Somme" && qui === "Salarié") {
      m.retenues += Math.abs(montant);
    }
    // Cotisations patronales — Détail pour patronLast
    else if (categorie.startsWith("*COTISAT.PATRONALES") && detail === "Détail" && qui === "Employeur") {
      m.patronDetails.push([designation, Math.abs(montant)]);
    }
  }

  if (!byMonth.size) {
    throw new Error(
      `Aucune donnée de salaire trouvée dans "${SHEET_NAME}". ` +
      `Vérifiez que la table commence bien en ligne 12 avec une colonne "Entreprise" (B) et une colonne "Date" (G).`
    );
  }

  const months: SalaryMonthParsed[] = Array.from(byMonth.values())
    .sort((a, b) => a.mk.localeCompare(b.mk))
    .map((m) => {
      const brut     = Math.round(m.brut     * 100) / 100;
      const cotSal   = Math.round(m.cotSal   * 100) / 100;
      const indem    = Math.round(m.indem    * 100) / 100;
      const retenues = Math.round(m.retenues * 100) / 100;
      const net      = Math.round((brut - cotSal + indem - retenues) * 100) / 100;
      return { mk: m.mk, net, brut, cotSal, indem, retenues, entreprise: m.entreprise };
    });

  const lastMk = months[months.length - 1]?.mk || "";
  const lastMonthData = byMonth.get(lastMk);

  return {
    months,
    cotLast:    lastMonthData?.cotDetails    || [],
    patronLast: lastMonthData?.patronDetails || [],
    lastMonth: lastMk,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT DE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function buildValidation(rawData: RawTransaction[], salary: SalaryParsed): Validation {
  const sortedDates = rawData.map((t) => t.date).sort();
  const debits  = rawData.filter((t) => t.dc === "Débit");
  const credits = rawData.filter((t) => t.dc === "Crédit");
  const monthSet = new Set(rawData.map((t) => t.date.slice(0, 7)));

  const totalDebits  = debits.reduce((s, t) => s + t.montant, 0);
  const totalCredits = credits.reduce((s, t) => s + t.montant, 0);
  const comptes = [...new Set(rawData.map((t) => t.compte))].sort();

  return {
    ok: true,
    nbTransactions: rawData.length,
    dateMin: sortedDates[0] || "—",
    dateMax: sortedDates[sortedDates.length - 1] || "—",
    nbMois: monthSet.size,
    comptes,
    totalDebits:     Math.round(totalDebits  * 100) / 100,
    totalCredits:    Math.round(totalCredits * 100) / 100,
    net:             Math.round((totalCredits - totalDebits) * 100) / 100,
    nbSalaryMonths:  salary.months.length,
    lastSalaryMonth: salary.lastMonth,
    lastNetSalary:   salary.months[salary.months.length - 1]?.net || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POINT D'ENTRÉE WEB WORKER
// ─────────────────────────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent) => {
  const { type, buffer } = event.data;

  if (type !== "parse") return;

  try {
    // ─── 1. Lecture du workbook ───────────────────────────────────────────
    progress("Ouverture du fichier…", 5);

    let wb: XLSX.WorkBook;
    try {
      // `cellDates: false` : les dates restent des séries Excel et sont
      // converties par `XLSX.SSF.parse_date_code` dans `xlDateToISO`, seule
      // voie exacte. Avec `cellDates: true`, SheetJS rendait des `Date`
      // construits dans le fuseau local, à 21 secondes de minuit — soit la
      // veille sur l'ensemble des lignes en Europe/Paris, et un mois de paie
      // décalé pour toute date tombant un 1er.
      wb = XLSX.read(buffer, {
        type: "array",
        cellDates: false,
        cellNF: false,
        cellFormula: false,
        sheetStubs: false,
      });
    } catch (e) {
      throw new Error(
        `Impossible de lire le fichier. Vérifiez qu'il s'agit d'un fichier .xlsx valide. ` +
        `Détail : ${(e as Error).message}`
      );
    }

    // ─── 2. Vérification des feuilles requises ──────────────────────────
    progress("Vérification des feuilles…", 10);

    // Vérifier la feuille "Fiche de Paie" (la feuille Transactions est vérifiée dynamiquement)
    if (!wb.SheetNames.includes("Fiche de Paie")) {
      throw new Error(
        `Feuille "Fiche de Paie" absente. ` +
        `Feuilles trouvées : ${wb.SheetNames.join(", ")}. ` +
        `Assurez-vous d'uploader le fichier "Budget_XXXX.xlsx" complet.`
      );
    }

    // ─── 3. Parse transactions ──────────────────────────────────────────
    progress("Parsing des transactions…", 15);
    const rawData = parseTransactionsSheet(wb);

    // ─── 4. Encode avec dictionnaire ────────────────────────────────────
    progress("Encodage des données…", 45);
    const transactions = encodeTransactions(rawData);

    // ─── 5. Parse salaires ──────────────────────────────────────────────
    progress("Parsing des fiches de paie…", 50);
    const salary = parseSalarySheet(wb);

    // ─── 6. Rapport de validation ───────────────────────────────────────
    progress("Validation des données…", 80);
    const validation = buildValidation(rawData, salary);

    // --- 7. Resultat final ---
    progress("Termine", 100);
    self.postMessage({ type: "result", transactions, salary, validation });

  } catch (err) {
    self.postMessage({ type: "error", message: (err as Error).message });
  }
};
