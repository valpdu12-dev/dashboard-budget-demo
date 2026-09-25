// ── Factories de données de test ──────────────────────────────────────────
import type { Transaction, SalaryMonth, SalaryData, Config, InflationData, SmicData } from "@/types";
import { PARAMETRAGE_DEMO } from "./parametrageDemo";

/** Crée une transaction avec des valeurs par défaut */
export function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  const date = overrides.date ?? "2025-03-15";
  return {
    compte: "Banque A - Courant",
    type: "CB",
    date,
    montant: 50,
    cat1: "Dépense Courante",
    cat2: "Alimentation",
    cat3: "Supermarché",
    cat4: "",
    ville: "Paris",
    dc: "Débit",
    label: "Employeur B",
    monthKey: date.slice(0, 7),
    ...overrides,
  };
}

/** Crée un ensemble standard de transactions pour les tests */
export function makeTransactions(): Transaction[] {
  return [
    // Janvier 2025
    makeTx({ date: "2025-01-10", montant: 800, cat1: "Dépense Fixe", cat2: "Logement", cat3: "Loyer", dc: "Débit", monthKey: "2025-01" }),
    makeTx({ date: "2025-01-15", montant: 200, cat1: "Dépense Courante", cat2: "Alimentation", cat3: "Supermarché", dc: "Débit", monthKey: "2025-01" }),
    makeTx({ date: "2025-01-20", montant: 2500, cat1: "", cat2: "", cat3: "Salaire", dc: "Crédit", type: "Virement", monthKey: "2025-01" }),
    // Février 2025
    makeTx({ date: "2025-02-10", montant: 800, cat1: "Dépense Fixe", cat2: "Logement", cat3: "Loyer", dc: "Débit", monthKey: "2025-02" }),
    makeTx({ date: "2025-02-15", montant: 300, cat1: "Dépense Courante", cat2: "Alimentation", cat3: "Supermarché", dc: "Débit", monthKey: "2025-02" }),
    makeTx({ date: "2025-02-28", montant: 2500, cat1: "", cat2: "", cat3: "Salaire", dc: "Crédit", type: "Virement", monthKey: "2025-02" }),
    // Mars 2025
    makeTx({ date: "2025-03-10", montant: 800, cat1: "Dépense Fixe", cat2: "Logement", cat3: "Loyer", dc: "Débit", monthKey: "2025-03" }),
    makeTx({ date: "2025-03-15", montant: 150, cat1: "Dépense Courante", cat2: "Alimentation", cat3: "Supermarché", dc: "Débit", monthKey: "2025-03" }),
    makeTx({ date: "2025-03-20", montant: 100, cat1: "Dépense Occasionnelle", cat2: "Loisirs", cat3: "Cinéma", dc: "Débit", monthKey: "2025-03" }),
    makeTx({ date: "2025-03-25", montant: 2500, cat1: "", cat2: "", cat3: "Salaire", dc: "Crédit", type: "Virement", monthKey: "2025-03" }),
  ];
}

/** Crée un mois de salaire */
export function makeSalaryMonth(overrides: Partial<SalaryMonth> = {}): SalaryMonth {
  return {
    mk: "2025-03",
    entreprise: "Employeur E",
    brut: 3500,
    net: 2800,
    cotSal: 700,
    indem: 0,
    retenues: 0,
    ...overrides,
  };
}

/** Crée une ligne d'inflation INSEE (sectorielle optionnelle) */
export function makeInflation(overrides: Partial<InflationData> = {}): InflationData {
  return {
    year: "2024",
    rate_annual: 2.0,
    rate_alimentation: null,
    rate_services: null,
    rate_energie: null,
    rate_transports: null,
    rate_produits_manufactures: null,
    ...overrides,
  };
}

/** Crée une ligne SMIC net mensuel */
export function makeSmic(overrides: Partial<SmicData> = {}): SmicData {
  return {
    year: "2024",
    net_monthly: 1400,
    date_effective: "01/01/2024",
    ...overrides,
  };
}

interface SalaryExtras {
  inflation?: InflationData[];
  smic?: SmicData[];
  inflationByCategory?: InflationData[];
}

/** Crée des données salaire complètes (avec inflation/SMIC optionnels) */
export function makeSalaryData(months?: SalaryMonth[], extras: SalaryExtras = {}): SalaryData {
  const defaultMonths = [
    makeSalaryMonth({ mk: "2025-01", brut: 3500, net: 2800 }),
    makeSalaryMonth({ mk: "2025-02", brut: 3500, net: 2800 }),
    makeSalaryMonth({ mk: "2025-03", brut: 3600, net: 2900 }),
  ];
  return {
    months: months ?? defaultMonths,
    cotLast: [["Assurance maladie", 225], ["Retraite", 350]],
    patronLast: [["Patronal 1", 500]],
    lastMonth: "2025-03",
    ...(extras.inflation ? { inflation: extras.inflation } : {}),
    ...(extras.smic ? { smic: extras.smic } : {}),
    ...(extras.inflationByCategory ? { inflationByCategory: extras.inflationByCategory } : {}),
  };
}

/**
 * Crée une config par défaut.
 *
 * ⚠️ Lot C.4 — elle porte désormais `parametrage`, la configuration que le
 * jeu de démonstration déclare. Sans elle, les calculs ne connaîtraient ni
 * transfert interne, ni épargne, ni compte lié : les tests qui vérifient ces
 * règles doivent les déclarer, comme le ferait un vrai fichier.
 *
 * Un test qui veut le cas « la source ne déclare rien » passe
 * `{ parametrage: undefined }`.
 */
export function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    parametrage: PARAMETRAGE_DEMO,
    init: {
      "Banque A - Courant": 5000,
      "Banque B - Compte joint": 2000,
      "Banque C - Compte joint": 1500,
      "Titres-restaurant": 100,
    },
    ...overrides,
  };
}

/** Crée des transactions avec types de transfert */
export function makeTransferTx(overrides: Partial<Transaction> = {}): Transaction {
  return makeTx({
    type: "Transfert Banque A vers Banque C",
    cat1: "",
    cat2: "",
    montant: 500,
    ...overrides,
  });
}

/** Crée des transactions d'épargne */
export function makeEpargneTx(overrides: Partial<Transaction> = {}): Transaction {
  return makeTx({
    type: "Epargne Banque A",
    cat1: "",
    cat2: "Épargne",
    cat3: "PEL",
    dc: "Débit",
    montant: 300,
    ...overrides,
  });
}
