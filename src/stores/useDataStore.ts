// ── Store Zustand pour les données chargées ──────────────────────────────
import { create } from "zustand";
import type { Transaction, SalaryData, Config, BudgetData, DataOrigin } from "@/types";

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
  setUploadData: (tx: Transaction[], sal: SalaryData, meta?: { fileName?: string; importedAt?: string }) => void;
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
  // Un import fait par la personne devient TOUJOURS l'origine active, meme
  // applique par-dessus un chargement serveur reussi.
  setUploadData: (tx, sal, meta) => set({
    transactions: tx, salary: sal,
    status: "success", error: null, origin: "upload",
    importedAt: meta?.importedAt ?? new Date().toISOString(),
    importFileName: meta?.fileName ?? null,
  }),
  setBudgets: (budgets) => set({ budgets }),
  setError: (msg) => set({ status: "error", error: msg }),
  reset: () => set({
    transactions: [], salary: null, config: null, budgets: null,
    status: "idle", error: null, origin: "inconnue",
    importedAt: null, importFileName: null,
  }),
}));
