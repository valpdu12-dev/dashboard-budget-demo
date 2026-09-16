// ── Chargement des données du dashboard ──────────────────────────────────
//
// MODE STATIQUE (lot A.4). Tout vient des fichiers du site : `/data/*.json`.
// Il n'y a plus un seul appel `/api`.
//
// UN JEU = UN TOUT (lot B.5). Le store ne reçoit plus des morceaux posés les
// uns après les autres, mais un JEU complet : transactions, paie,
// configuration, objectifs, couverture et origine. Un import ne peut donc plus
// laisser derrière lui la configuration du jeu précédent.

import { useDataStore } from "@/stores/useDataStore";
import { lireObjectifsLocaux } from "@/services/budgetsLocaux";
import { construireJeuStatique, lireJeuMemorise } from "@/services/jeuDonnees";
import type { BudgetTarget, Config, RawTransactionsJSON, SalaryData } from "@/types";

const SOURCES = [
  "/data/transactions.json",
  "/data/salary.json",
  "/data/config.json",
];

/**
 * Séries publiques (inflation INSEE, SMIC) — fichier à part, avec sa source
 * et sa date de consultation.
 *
 * Elles ne décrivent personne : les fondre dans `salary.json` rendrait
 * impossible de dire, en regardant un fichier, ce qui est public et ce qui
 * est personnel. Elles sont donc chargées séparément puis rattachées à
 * l'objet salaire, que les écrans consomment déjà ainsi.
 */
const REFERENCES_SOURCE = "/data/references.json";

/** Objectifs de budget livrés avec la démo. */
const BUDGETS_SOURCE = "/data/budgets.json";

async function lireJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.json();
}

async function chargerFichiers() {
  const [rawTx, sal, cfg] = await Promise.all(SOURCES.map(lireJSON));
  return {
    rawTx: rawTx as RawTransactionsJSON,
    sal: sal as SalaryData,
    cfg: cfg as Config,
  };
}

/** Best-effort : l'absence des références n'empêche pas le dashboard. */
async function attacherReferences(sal: SalaryData): Promise<SalaryData> {
  try {
    const ref = await lireJSON(REFERENCES_SOURCE);
    return {
      ...sal,
      inflation: ref.inflation ?? sal.inflation,
      smic: ref.smic ?? sal.smic,
      inflationByCategory: ref.inflationByCategory ?? sal.inflationByCategory,
    };
  } catch (err) {
    console.warn("[Budget] Références publiques indisponibles.", err);
    return sal;
  }
}

/**
 * Objectifs de budget : ceux livrés avec la démo, recouverts par ceux que la
 * personne a modifiés dans son navigateur.
 *
 * L'ordre importe. Les valeurs livrées donnent la liste des catégories et
 * leur état actif ; la mémoire locale ne porte que des montants changés à la
 * main. Un objectif modifié puis retiré du fichier livré disparaît donc
 * aussi — c'est voulu : le fichier fait foi sur ce qui existe.
 *
 * Best-effort : sans objectifs, le reste du dashboard fonctionne.
 */
async function chargerBudgets(): Promise<BudgetTarget[]> {
  try {
    const livres = (await lireJSON(BUDGETS_SOURCE)) as BudgetTarget[];
    if (!Array.isArray(livres)) return [];
    const locaux = lireObjectifsLocaux();
    return livres.map((b) => {
      const local = locaux[b.cat2];
      return local === undefined
        ? b
        : { ...b, target: local, active: true, updated_at: b.updated_at ?? null };
    });
  } catch (err) {
    console.warn("[Budget] Objectifs indisponibles.", err);
    return [];
  }
}

/**
 * Remplit le store depuis les fichiers du site. Idempotent — peut être rejoué
 * à tout moment (le bouton « Revenir aux données par défaut » s'en sert).
 *
 * Si un jeu a été mémorisé, il est posé PAR-DESSUS : au démarrage, le
 * dashboard affiche le dernier fichier importé. L'ordre importe — le jeu du
 * site est posé d'abord pour que les séries publiques (inflation, SMIC)
 * soient chargées ; `poserJeu` les conserve ensuite d'un jeu à l'autre.
 */
export async function loadDashboardData(): Promise<void> {
  const { setLoading, poserJeu, setError } = useDataStore.getState();
  // Lu une seule fois, avant les requêtes : le jeu mémorisé doit pouvoir
  // s'afficher même si les fichiers du site sont injoignables.
  const memorise = lireJeuMemorise();
  setLoading();
  try {
    const data = await chargerFichiers();
    const [sal, budgets] = await Promise.all([
      attacherReferences(data.sal),
      chargerBudgets(),
    ]);
    poserJeu(construireJeuStatique(data.rawTx, sal, data.cfg, budgets));
  } catch (err) {
    // Sans jeu mémorisé, il n'y a rien à montrer : on remonte l'erreur.
    // Avec, mieux vaut afficher les données de la personne qu'un écran vide.
    if (!memorise) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    console.warn("[Budget] Fichiers du site injoignables — jeu mémorisé affiché seul.", err);
  }

  if (memorise) poserJeu(memorise);
}
