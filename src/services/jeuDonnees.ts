// ── Un jeu de données = un tout ──────────────────────────────────────────
//
// Lot B.5. Avant, un import ne remplaçait QUE les transactions et les
// salaires : la configuration, les objectifs de budget et la couverture
// restaient ceux de la source précédente. Le tableau de bord affichait donc,
// sans un mot, les soldes de départ de la démonstration à côté des
// transactions de la personne. Deux jeux mélangés se présentaient comme un.
//
// Un jeu est désormais une valeur unique : transactions, paie, configuration,
// objectifs, couverture et origine. Il se pose d'un bloc, il se mémorise d'un
// bloc, et il porte une VERSION DE SCHÉMA — sans elle, un contenu écrit par
// une version antérieure se relit à moitié, ce qui est pire que de ne pas le
// relire du tout.

import { encodeTransactions } from "@/utils/decode";
import type {
  BudgetTarget,
  Config,
  DataOrigin,
  RawTransactionsJSON,
  SalaryData,
  Transaction,
} from "@/types";
import type { RapportImport } from "@/services/lectureClasseur";

/**
 * Version du schéma mémorisé.
 *
 * 1 — `budget.import.v1` : transactions DÉCODÉES + salaires, sans config.
 * 2 — `budget.jeu.v2`    : le jeu entier, transactions ENCODÉES.
 */
export const VERSION_SCHEMA = 2;

const CLE = "budget.jeu.v2";
const CLE_V1 = "budget.import.v1";

/** Un jeu complet, tel qu'il est posé dans le store et mémorisé. */
export interface JeuDonnees {
  version: number;
  origine: DataOrigin;
  /** Date de l'import (ISO), `null` pour un jeu qui ne vient pas d'un fichier. */
  importedAt: string | null;
  /** Nom du classeur choisi par la personne, pour l'affichage. */
  fileName: string | null;
  transactions: RawTransactionsJSON;
  salary: SalaryData;
  config: Config;
  budgets: BudgetTarget[];
}

/**
 * Construit un jeu depuis un rapport de lecture du format public.
 *
 * ⚠️ La configuration est bâtie UNIQUEMENT à partir de ce que le fichier
 * déclare. Rien n'est hérité du jeu précédent : c'est tout l'objet de cette
 * étape. Un fichier sans feuille `Paramètres` donne donc une config vide —
 * et des soldes « non initialisés », jamais 0.
 */
export function construireJeuDepuisRapport(
  rapport: RapportImport,
  fileName: string,
  maintenant: string = new Date().toISOString()
): JeuDonnees {
  const config: Config = {
    init: rapport.parametres.soldes,
    demo: false,
    ...(rapport.parametres.couverture ? { couverture: rapport.parametres.couverture } : {}),
    ...(rapport.parametres.pret
      ? {
          pret: {
            montant: rapport.parametres.pret.montant,
            mensualite: rapport.parametres.pret.mensualite,
            echeances: rapport.parametres.pret.echeances,
            ...(rapport.parametres.pret.premiereEcheance
              ? { premiere_echeance: rapport.parametres.pret.premiereEcheance }
              : {}),
          },
        }
      : {}),
  };

  return {
    version: VERSION_SCHEMA,
    origine: "upload",
    importedAt: maintenant,
    fileName,
    transactions: encodeTransactions(rapport.transactions),
    salary: {
      months: rapport.paie,
      cotLast: [],
      patronLast: [],
      lastMonth: rapport.paie[rapport.paie.length - 1]?.mk ?? "",
    },
    config,
    // Le format public v1 ne porte pas d'objectifs de budget. Hériter de ceux
    // de la démonstration afficherait les plafonds de quelqu'un d'autre.
    budgets: [],
  };
}

/**
 * Construit un jeu depuis l'ANCIEN format — le classeur de l'auteur.
 *
 * Ce format ne déclare ni soldes de départ, ni bornes de relevé, ni prêt : il
 * n'a jamais porté ces informations. La configuration est donc VIDE, et les
 * soldes s'affichent « non initialisés ».
 *
 * C'est un changement visible par rapport au comportement d'avant, et il est
 * volontaire : le tableau de bord réutilisait alors les soldes de départ du
 * jeu précédent — ceux de la démonstration — en face des transactions de la
 * personne. Des chiffres faux, sans un mot.
 */
export function construireJeuAncienFormat(
  transactions: RawTransactionsJSON,
  salary: SalaryData,
  fileName: string,
  maintenant: string = new Date().toISOString()
): JeuDonnees {
  return {
    version: VERSION_SCHEMA,
    origine: "upload",
    importedAt: maintenant,
    fileName,
    transactions,
    salary,
    config: { init: {}, demo: false },
    budgets: [],
  };
}

/** Construit un jeu depuis les fichiers du site (mode statique). */
export function construireJeuStatique(
  transactions: Transaction[] | RawTransactionsJSON,
  salary: SalaryData,
  config: Config,
  budgets: BudgetTarget[]
): JeuDonnees {
  return {
    version: VERSION_SCHEMA,
    origine: "static",
    importedAt: null,
    fileName: null,
    transactions: Array.isArray(transactions)
      ? encodeTransactions(transactions)
      : transactions,
    salary,
    config,
    budgets,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// MÉMORISATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Mémorise un jeu.
 *
 * ⚠️ AUCUN SEUIL DE TAILLE N'EST ÉCRIT ICI. Le stockage du navigateur tourne
 * autour de 5 Mo, mais la limite exacte dépend du navigateur et de ce que le
 * site occupe déjà : un seuil deviné serait faux quelque part. On tente
 * l'écriture ; si elle échoue, on rend `false` et l'écran le DIT.
 *
 * Mesuré sur le jeu de démonstration : la forme encodée pèse 47,5 octets par
 * transaction, contre 241,5 pour la forme décodée qu'on mémorisait avant.
 * C'est pour cela que c'est la forme encodée qui est stockée.
 */
export function memoriserJeu(jeu: JeuDonnees): boolean {
  try {
    localStorage.setItem(CLE, JSON.stringify(jeu));
    return true;
  } catch (err) {
    console.warn("[Budget] Jeu non mémorisé (stockage indisponible ou saturé).", err);
    return false;
  }
}

/** Oublie le jeu mémorisé, ancienne version comprise. */
export function oublierJeu(): void {
  try {
    localStorage.removeItem(CLE);
    localStorage.removeItem(CLE_V1);
  } catch {
    // Sans effet si le stockage est indisponible : il n'y avait rien à effacer.
  }
}

function jeuValide(o: unknown): o is JeuDonnees {
  if (!o || typeof o !== "object") return false;
  const j = o as Partial<JeuDonnees>;
  return (
    j.version === VERSION_SCHEMA &&
    !!j.transactions &&
    Array.isArray(j.transactions.s) &&
    Array.isArray(j.transactions.t) &&
    !!j.salary &&
    Array.isArray(j.salary.months) &&
    !!j.config
  );
}

/**
 * Relit le jeu mémorisé, en migrant l'ancien format si besoin.
 *
 * Un contenu d'une version inconnue est IGNORÉ, pas réparé : peupler à moitié
 * le tableau de bord serait pire que de repartir des fichiers du site.
 */
export function lireJeuMemorise(): JeuDonnees | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) {
      const o: unknown = JSON.parse(brut);
      if (jeuValide(o)) return o;
      console.warn("[Budget] Jeu mémorisé d'une version inconnue — ignoré.");
      return null;
    }
    return migrerV1();
  } catch (err) {
    console.warn("[Budget] Jeu mémorisé illisible — ignoré.", err);
    return null;
  }
}

/**
 * Migre un import mémorisé par une version antérieure.
 *
 * Il portait les transactions DÉCODÉES et aucune configuration. On le
 * convertit plutôt que de le jeter : quelqu'un qui a importé son fichier hier
 * n'a pas à le refaire. La configuration reste vide — l'ancien format ne la
 * portait pas, et l'inventer serait exactement le mélange que ce lot corrige.
 */
function migrerV1(): JeuDonnees | null {
  const brut = localStorage.getItem(CLE_V1);
  if (!brut) return null;
  try {
    const o = JSON.parse(brut) as {
      transactions?: Transaction[];
      salary?: SalaryData;
      fileName?: string;
      importedAt?: string;
    };
    if (!Array.isArray(o.transactions) || !o.salary || !o.importedAt) return null;

    const jeu: JeuDonnees = {
      version: VERSION_SCHEMA,
      origine: "upload",
      importedAt: o.importedAt,
      fileName: o.fileName ?? null,
      transactions: encodeTransactions(o.transactions),
      salary: o.salary,
      config: { init: {}, demo: false },
      budgets: [],
    };
    memoriserJeu(jeu);
    localStorage.removeItem(CLE_V1);
    return jeu;
  } catch (err) {
    console.warn("[Budget] Ancien import illisible — ignoré.", err);
    return null;
  }
}
