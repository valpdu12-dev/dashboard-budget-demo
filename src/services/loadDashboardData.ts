// ── Chargement des données du dashboard ──────────────────────────────────
//
// MODE STATIQUE (lot A.4). Tout vient des fichiers du site : `/data/*.json`.
// Il n'y a plus un seul appel `/api`.
//
// L'application réelle interroge une base D1 derrière une API authentifiée,
// avec repli sur ces mêmes fichiers. La démonstration n'a pas de serveur :
// garder le chemin API aurait produit, à chaque ouverture, un appel voué à
// l'échec — visible dans l'onglet Réseau, et contraire à la promesse
// affichée. Un repli qui ne replie sur rien n'est pas une sécurité, c'est
// une requête en trop.
//
// Conséquence directe : l'origine des données vaut toujours `static` au
// chargement — jamais `api`.

import { useDataStore } from "@/stores/useDataStore";
import { decodeTransactions } from "@/utils/decode";
import { loadImport } from "@/services/importPersistence";
import { lireObjectifsLocaux } from "@/services/budgetsLocaux";
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
async function chargerBudgets() {
  try {
    const livres = (await lireJSON(BUDGETS_SOURCE)) as BudgetTarget[];
    if (!Array.isArray(livres)) return;
    const locaux = lireObjectifsLocaux();
    useDataStore.getState().setBudgets({
      budgets: livres.map((b) => {
        const local = locaux[b.cat2];
        return local === undefined
          ? b
          : { ...b, target: local, active: true, updated_at: b.updated_at ?? null };
      }),
    });
  } catch (err) {
    console.warn("[Budget] Objectifs indisponibles.", err);
  }
}

/**
 * Remplit le store depuis les fichiers du site. Idempotent — peut être
 * rejoué à tout moment (le bouton « Revenir aux données par défaut » de
 * `DataUploader` s'en sert après un `reset()`).
 *
 * Si un import a été mémorisé, il est appliqué PAR-DESSUS : au démarrage, le
 * dashboard affiche le dernier fichier importé. L'ordre importe — les
 * fichiers du site apportent la configuration et les objectifs, que le
 * classeur ne contient pas ; l'import ne remplace que les transactions et
 * les salaires.
 */
export async function loadDashboardData(): Promise<void> {
  const { setLoading, setData, setUploadData, setError } = useDataStore.getState();
  // Lu une seule fois, avant les requêtes : le fichier mémorisé doit pouvoir
  // s'afficher même si les fichiers du site sont injoignables.
  const memorise = loadImport();
  setLoading();
  try {
    const data = await chargerFichiers();
    const sal = await attacherReferences(data.sal);
    const tx = decodeTransactions(data.rawTx);
    setData(tx, sal, data.cfg, "static");
    void chargerBudgets();
  } catch (err) {
    // Sans import mémorisé, il n'y a rien à montrer : on remonte l'erreur.
    // Avec, mieux vaut afficher les données de la personne qu'un écran vide.
    if (!memorise) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    console.warn("[Budget] Fichiers du site injoignables — import mémorisé affiché seul.", err);
  }

  if (memorise) {
    setUploadData(memorise.transactions, memorise.salary, {
      fileName: memorise.fileName,
      importedAt: memorise.importedAt,
    });
  }
}
