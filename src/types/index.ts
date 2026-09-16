// ── Types principaux du Dashboard Budget — Démo ─────────────────────────

/**
 * D'ou vient le jeu de donnees actuellement affiche.
 *
 * - `api`       : API D1 (chemins /api/*). Source normale de l'application
 *                 réelle. **Jamais produite par cette démonstration**, qui
 *                 n'appelle aucun serveur. La valeur reste au type pour que
 *                 le code soit reportable tel quel côté privé.
 * - `static`    : fichiers JSON du site (/data/*.json). C'est l'origine de
 *                 tout chargement dans la démonstration.
 * - `upload`    : classeur importe par la personne. Prend toujours le dessus.
 * - `inconnue`  : aucune donnee chargee, ou donnees posees sans origine
 *                 declaree (jeux de test). Jamais devine : mieux vaut dire
 *                 qu'on ne sait pas que d'afficher une origine fausse.
 */
export type DataOrigin = "api" | "static" | "upload" | "inconnue";

/** Libelle francais d'une origine, pour l'affichage. */
export const LIBELLE_ORIGINE: Record<DataOrigin, string> = {
  api: "Serveur",
  static: "Fichiers du site",
  upload: "Fichier importe",
  inconnue: "Origine inconnue",
};

/** Transaction décodée (après decodeTransactions) */
export interface Transaction {
  compte: string;         // "Banque A - Courant", "Banque B - Compte joint", etc.
  type: string;           // "CB", "Virement", "Prélèvement", etc.
  date: string;           // "2025-01-15"
  montant: number;        // Montant positif (valeur absolue)
  cat1: string;           // "Dépense Fixe", "Dépense Courante", "Dépense Occasionnelle"
  cat2: string;           // Sous-catégorie niveau 2 (ou "")
  cat3: string;           // Libellé détaillé / niveau 3 (ou "")
  cat4: string;           // Niveau 4 (ou "")
  ville: string;          // Ville (ou "")
  dc: string;             // "Débit" | "Crédit"
  label: string;          // Libellé bancaire brut (ou "")
  monthKey: string;       // Dérivé de date : "2025-01"
}

/** Données JSON brutes (encodage dictionnaire) */
export interface RawTransactionsJSON {
  s: string[];                    // String table
  t: (number | string)[][];       // Transactions encodées (mix indices + valeurs directes)
  fields?: string[];              // Noms des champs (optionnel)
}

/** Mois de salaire (format JSON réel) */
export interface SalaryMonth {
  mk: string;             // "2025-01"
  entreprise: string;
  brut: number;
  net: number;
  cotSal: number;         // Cotisations salariales
  indem: number;          // Indemnités
  retenues: number;
}

/** Donnée inflation INSEE pour une année */
export interface InflationData {
  year: string;                          // "2024"
  rate_annual: number | null;            // Taux global (%)
  rate_alimentation: number | null;      // Renseigné uniquement 2024-2025
  rate_services: number | null;
  rate_energie: number | null;
  rate_transports: number | null;
  rate_produits_manufactures: number | null;
}

/** Donnée SMIC net mensuel pour une année */
export interface SmicData {
  year: string;                          // "2024"
  net_monthly: number | null;
  date_effective: string | null;         // "01/01/2024"
}

/** Budget cible pour une sous-catégorie (cat2) */
export interface BudgetTarget {
  cat2: string;
  target: number | null;
  active: boolean;
  updated_at: string | null;
}

/** Ensemble des budgets cibles */
export interface BudgetData {
  budgets: BudgetTarget[];
}

/** Données salaire complètes */
export interface SalaryData {
  months: SalaryMonth[];
  cotLast: [string, number][];      // Tuples [label, montant]
  patronLast: [string, number][];   // Tuples [label, montant]
  lastMonth?: string;               // Dernier mois disponible
  inflation?: InflationData[];          // Historique inflation 2013-2025
  smic?: SmicData[];                    // Historique SMIC 2013-2026
  inflationByCategory?: InflationData[]; // Détail sectoriel (2024-2025 uniquement)
}

/** Configuration initiale (soldes de départ + métadonnées) */
export interface Config {
  init: Record<string, number>;
  transfers?: string[];
  comptes?: string[];
  comptesLiesPrincipal?: string[];
  colors?: {
    cat2?: Record<string, string>;
    comptes?: Record<string, string>;
    entreprises?: Record<string, string>;
  };
  /**
   * Paramètres du prêt immobilier. Absent = pas de prêt déclaré par la
   * source ; `useMortgageData` retombe alors sur ses constantes.
   */
  pret?: {
    montant: number;
    mensualite: number;
    echeances: number;
    premiere_echeance?: string;
  };
  /**
   * Bornes DÉCLARÉES de la période couverte par la source.
   * ⚠️ Inerte aujourd'hui : l'application infère encore ses bornes
   * (régime 2 de docs/CONTRAT_COUVERTURE.md). Le régime 1, qui lira ce
   * champ, est branché au lot B.
   */
  couverture?: { debut: string; fin: string };
  /** Vrai pour le jeu de démonstration. */
  demo?: boolean;
}

/** KPIs calculés */
export interface KPIs {
  curBal: Record<string, number>;
  prevBal: Record<string, number>;
  depCur: number;
  depPrev: number;
  recCur: number;
  recPrev: number;
  netMonth: number;
  lastSal: SalaryMonth | null;
  prevSal: SalaryMonth | null;
  fixe: number;
  occ: number;
  /**
   * Épargne du mois rapportée au salaire net. `null` quand il n'y a pas de
   * paie : sans revenu connu, le taux n'est pas calculable — et 0 % voudrait
   * dire « vous n'épargnez rien », ce qui est une affirmation, pas une absence.
   */
  tauxEpargne: number | null;
}

/** Insight (hausse/baisse) */
export interface Insight {
  cat: string;
  cur: number;
  prev: number;
  diff: number;
  pct: number;
}

/** Récurrent détecté */
export interface Recurring {
  name: string;
  montant: number;
  freq: string;
  last: string;
}

/**
 * Organisme bancaire.
 *
 * C'était une liste figée de quatre valeurs — celles du jeu de données de
 * l'auteur. Un cinquième organisme ne compilait pas. Le libellé est désormais
 * libre : la liste effectivement affichée vient de `config/accounts.ts`, et
 * demain du fichier source (lot C).
 */
export type Organisme = string;

/** Période de filtre */
export type PeriodKey = "1M" | "3M" | "6M" | "YTD" | "12M" | "all";

/** Catégorie niveau 1 */
export type Cat1Filter = "all" | "Dépense Fixe" | "Dépense Occasionnelle" | "Dépense Courante";
