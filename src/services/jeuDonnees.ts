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
 * 3 — `budget.jeu.v3`    : le jeu entier + la CONFIGURATION déclarée par le
 *                          fichier source (`config.parametrage`) — lot C.
 */
export const VERSION_SCHEMA = 3;

/** Clé du jeu mémorisé au schéma courant. */
export const CLE = "budget.jeu.v3";
/** Clé du schéma du lot B.5, relue le temps d'une migration. */
export const CLE_V2 = "budget.jeu.v2";
/** Clé de l'import d'avant le lot B.5, encore relue le temps d'une migration. */
export const CLE_V1 = "budget.import.v1";

/**
 * Les clés que ce module écrit sur l'appareil.
 *
 * Déclarées ici et reprises par `profil.ts`, qui tient l'inventaire complet :
 * une clé recopiée à la main ailleurs finirait par survivre à un effacement.
 */
export const CLES_JEU: readonly string[] = [CLE, CLE_V2, CLE_V1];

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
    // Lot C.2. Une configuration vide n'est pas transportée : l'absence du
    // champ dit « ce fichier ne déclare rien », ce qui n'est pas la même
    // chose qu'une configuration lue et trouvée vide.
    ...(rapport.parametres.config.estVide ? {} : { parametrage: rapport.parametres.config }),
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
            ...(rapport.parametres.pret.tauxAnnuel != null
              ? { taux_annuel: rapport.parametres.pret.tauxAnnuel }
              : {}),
            ...(rapport.parametres.pret.dateDebut
              ? { date_debut: rapport.parametres.pret.dateDebut }
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

function jeuValide(o: unknown, version = VERSION_SCHEMA): o is JeuDonnees {
  if (!o || typeof o !== "object") return false;
  const j = o as Partial<JeuDonnees>;
  return (
    j.version === version &&
    !!j.transactions &&
    Array.isArray(j.transactions.s) &&
    Array.isArray(j.transactions.t) &&
    !!j.salary &&
    Array.isArray(j.salary.months) &&
    !!j.config
  );
}

/**
 * Ce que la relecture du stockage a à dire à la personne — lot C.6, D6.
 *
 * ⚠️ UN `console.warn` N'EST PAS UNE RÉPONSE. Personne n'ouvre la console.
 * Jusqu'ici, un jeu mémorisé d'une version inconnue disparaissait sans un
 * mot : la personne rouvrait le site et retrouvait la démonstration à la
 * place de ses données, sans savoir pourquoi. Chaque cas porte désormais un
 * message, et l'écran l'affiche.
 */
export interface AvisStockage {
  code: "migre" | "version-inconnue" | "illisible";
  titre: string;
  message: string;
}

export interface LectureStockage {
  jeu: JeuDonnees | null;
  avis: AvisStockage | null;
}

const AVIS_MIGRE: AvisStockage = {
  code: "migre",
  titre: "Vos données ont été reprises, sans leur configuration",
  message:
    "Elles ont été mémorisées par une version antérieure, qui ne conservait pas " +
    "la feuille « Paramètres » de votre fichier. Vos comptes n'ont donc ni taux " +
    "de participation, ni compte lié, et leurs soldes de départ sont inconnus. " +
    "Réimportez votre classeur pour les retrouver.",
};

/**
 * Relit le jeu mémorisé, en migrant les schémas antérieurs.
 *
 * ⚠️ LA MIGRATION EST TOUT OU RIEN. Un contenu qu'on ne sait pas convertir en
 * entier est IGNORÉ, pas réparé : peupler à moitié le tableau de bord serait
 * pire que de repartir des fichiers du site. Et le refus est VISIBLE.
 */
export function lireJeuMemorise(): LectureStockage {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) {
      const o: unknown = JSON.parse(brut);
      if (jeuValide(o)) return { jeu: o, avis: null };
      return {
        jeu: null,
        avis: {
          code: "version-inconnue",
          titre: "Vos données mémorisées n'ont pas pu être relues",
          message:
            "Elles ont été écrites par une version que celle-ci ne sait pas " +
            "convertir. Elles n'ont pas été effacées, mais elles ne sont pas " +
            "affichées : réimportez votre classeur.",
        },
      };
    }
    const v2 = migrerV2();
    if (v2) return { jeu: v2, avis: AVIS_MIGRE };

    const v1 = migrerV1();
    if (v1) return { jeu: v1, avis: AVIS_MIGRE };

    return { jeu: null, avis: null };
  } catch (err) {
    console.warn("[Budget] Jeu mémorisé illisible — ignoré.", err);
    return {
      jeu: null,
      avis: {
        code: "illisible",
        titre: "Vos données mémorisées sont illisibles",
        message:
          "Le contenu écrit sur cet appareil n'a pas pu être relu. Rien n'a été " +
          "effacé, mais rien n'a pu être affiché : réimportez votre classeur.",
      },
    };
  }
}

/**
 * Migre un jeu mémorisé au schéma 2 — lot C.6, décision D6.
 *
 * Le schéma 2 portait tout SAUF la configuration déclarée par le fichier
 * source : elle n'existait pas encore. On le convertit plutôt que de le
 * jeter — quelqu'un qui a importé son classeur hier n'a pas à le refaire —
 * et un bandeau dit ce qui manque. Inventer une configuration serait
 * exactement le mélange de deux jeux que le lot B.5 a supprimé.
 */
function migrerV2(): JeuDonnees | null {
  const brut = localStorage.getItem(CLE_V2);
  if (!brut) return null;
  try {
    const o: unknown = JSON.parse(brut);
    if (!jeuValide(o, 2)) return null;

    const jeu: JeuDonnees = { ...o, version: VERSION_SCHEMA };
    memoriserJeu(jeu);
    localStorage.removeItem(CLE_V2);
    return jeu;
  } catch (err) {
    console.warn("[Budget] Jeu mémorisé v2 illisible — ignoré.", err);
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
