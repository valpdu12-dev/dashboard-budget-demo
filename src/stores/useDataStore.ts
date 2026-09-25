// ── Store Zustand pour les données chargées ──────────────────────────────
import { create } from "zustand";
import { decodeTransactions } from "@/utils/decode";
import type { Transaction, SalaryData, Config, BudgetData, DataOrigin } from "@/types";
import type { JeuDonnees } from "@/services/jeuDonnees";

type Status = "idle" | "loading" | "success" | "error";

interface DataState {
  transactions: Transaction[];
  salary: SalaryData | null;
  config: Config | null;
  budgets: BudgetData | null;
  status: Status;
  error: string | null;
  /**
   * Origine du jeu de donnees affiche. Remplace l'ancien booleen
   * `isFromUpload`, qui ne distinguait pas l'API des fichiers statiques :
   * les deux se presentaient comme « donnees du serveur ». Un seul champ,
   * pour qu'aucun etat ne puisse en contredire un autre.
   */
  origin: DataOrigin;
  /** Date de l'import affiché (ISO), ou null si les données viennent du serveur. */
  importedAt: string | null;
  /** Nom du classeur importé, pour l'affichage du bandeau. */
  importFileName: string | null;

  // Actions
  setLoading: () => void;
  /**
   * Pose un jeu de donnees venu du serveur. L'origine est explicite et sans
   * valeur par defaut implicite : un appelant qui ne la donne pas obtient
   * `inconnue`, jamais une origine supposee.
   */
  setData: (tx: Transaction[], sal: SalaryData, cfg: Config, origin?: DataOrigin) => void;
  /**
   * Pose un JEU ENTIER — lot B.5.
   *
   * Transactions, paie, configuration, objectifs, couverture et origine
   * changent d'un seul coup. C'est la seule voie pour un import : remplacer
   * les transactions en gardant la configuration de la source précédente
   * mélangeait deux jeux en un, sans que rien ne le dise.
   */
  poserJeu: (jeu: JeuDonnees) => void;
  setBudgets: (budgets: BudgetData) => void;
  setError: (msg: string) => void;
  reset: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  transactions: [],
  salary: null,
  config: null,
  budgets: null,
  status: "idle",
  error: null,
  origin: "inconnue",
  importedAt: null,
  importFileName: null,

  setLoading: () => set({ status: "loading", error: null }),
  // `setData` remet importedAt/importFileName à null : un chargement serveur
  // efface la trace de l'import précédent, sans quoi le bandeau annoncerait
  // une origine que les données affichées n'ont plus.
  setData: (tx, sal, cfg, origin = "inconnue") => set({
    transactions: tx, salary: sal, config: cfg,
    status: "success", error: null, origin,
    importedAt: null, importFileName: null,
  }),
  poserJeu: (jeu) => set((etat) => ({
    transactions: decodeTransactions(jeu.transactions),
    // Les séries publiques (inflation INSEE, SMIC) ne décrivent personne :
    // elles appartiennent à l'application, pas au jeu de la personne. Les
    // laisser disparaître à chaque import était un défaut connu — la page
    // « Salaire vs inflation » se vidait sans explication.
    salary: {
      ...jeu.salary,
      inflation: jeu.salary.inflation ?? etat.salary?.inflation,
      smic: jeu.salary.smic ?? etat.salary?.smic,
      inflationByCategory: jeu.salary.inflationByCategory ?? etat.salary?.inflationByCategory,
    },
    config: jeu.config,
    budgets: { budgets: jeu.budgets },
    status: "success",
    error: null,
    origin: jeu.origine,
    importedAt: jeu.importedAt,
    importFileName: jeu.fileName,
  })),
  setBudgets: (budgets) => set({ budgets }),
  setError: (msg) => set({ status: "error", error: msg }),
  reset: () => set({
    transactions: [], salary: null, config: null, budgets: null,
    status: "idle", error: null, origin: "inconnue",
    importedAt: null, importFileName: null,
  }),
}));
