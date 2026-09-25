// ── Le schéma de configuration lu dans le fichier source ─────────────────
//
// Lot C.1. Ce type est ce que la feuille `Paramètres` étendue produit, et ce
// que les calculs recevront en paramètre à partir du C.3. Il est écrit
// depuis la FEUILLE, pas depuis `accounts.ts` : recopier la forme du code
// existant aurait figé dans un type neuf les choix de l'auteur.
//
// Contrat : `docs/CONTRAT_PARAMETRAGE.md`.

import type { Classe, Nature, SensRepercute } from "@/config/vocabulaire";

// ─────────────────────────────────────────────────────────────────────────
// CE QUE LA VALIDATION REND — la configuration sûre
// ─────────────────────────────────────────────────────────────────────────

/** Un compte, tel que le fichier le déclare. */
export interface CompteConfig {
  /**
   * Identifiant interne, dérivé du libellé normalisé. Jamais affiché.
   *
   * ⚠️ Il est stable À L'INTÉRIEUR d'un import, pas à travers un renommage :
   * renommer un compte dans le fichier produit un compte DIFFÉRENT, avec son
   * propre solde et sa propre couleur. C'est écrit au §4.3 du contrat, et
   * c'est la promesse que `accounts.ts` annonçait sans la tenir.
   */
  id: string;
  /** Libellé affiché, et clé de rapprochement avec la colonne `Compte`. */
  libelle: string;
  /** Organisme de rattachement. `null` = non déclaré, jamais deviné. */
  organisme: string | null;
  /**
   * Taux de participation. `1` = 100 %, `0.5` = 50 %.
   *
   * Appliqué au `Montant brut` de la feuille `Transactions` (D1). Quand la
   * colonne `Montant brut` est vide, ce taux ne sert à rien : `Montant` est
   * déjà imputé.
   */
  participation: number;
  /** Identifiant du compte lié, ou `null`. Un seul niveau (D3a). */
  compteLie: string | null;
  /**
   * Sens qui se répercute sur le compte lié.
   *
   * Obligatoire dès que `compteLie` est rempli — jamais deviné (§4.7).
   * `null` quand il n'y a pas de compte lié.
   */
  sensRepercute: SensRepercute | null;
  /** Le compte porte-t-il un solde propre ? Absent dans le fichier = oui. */
  porteUnSolde: boolean;
  /** Couleur d'affichage. Toujours définie — palette automatique si absente. */
  couleur: string;
  /**
   * Solde à la date de début de relevé.
   *
   * ⚠️ `null` veut dire « non initialisé », et JAMAIS 0. Les deux ne se
   * ressemblent pas à l'écran, et c'est voulu depuis le lot B.5.
   */
  soldeDepart: number | null;
}

/** Un type de mouvement, tel que le fichier le déclare. */
export interface TypeConfig {
  /** Libellé affiché, tel qu'écrit dans le fichier. */
  libelle: string;
  /** Libellé normalisé — la clé de rapprochement avec la colonne `Type`. */
  cle: string;
  /**
   * Ce que ce type fait aux calculs. Vide = mouvement ordinaire.
   *
   * Plusieurs natures par type sont possibles, et nécessaires : voir
   * `NATURES_INCOMPATIBLES` et le §4.5 du contrat.
   */
  natures: Nature[];
  /**
   * Classe appliquée aux dépenses de ce type quand la colonne `Classe` de la
   * ligne est vide. `null` = aucune — et alors la ligne reste sans classe,
   * ce qui est une valeur, pas un oubli.
   */
  classeParDefaut: Classe | null;
}

/** Une catégorie de budget. */
export interface CategorieConfig {
  libelle: string;
  cle: string;
  couleur: string;
}

/** Toute la configuration lue dans le fichier. */
export interface BudgetConfig {
  comptes: CompteConfig[];
  types: TypeConfig[];
  categories: CategorieConfig[];
  employeurs: string[];
  /**
   * Identifiant du compte crédité par les sorties d'épargne (D2).
   *
   * `null` = non déclaré. Les sorties d'épargne ne sont alors reprises dans
   * aucun solde, et l'écran le dit, chiffré. Elles ne sont pas silencieusement
   * imputées à un compte choisi par l'outil.
   */
  compteCreditSortiesEpargne: string | null;
  /**
   * Vrai quand le fichier n'a rien déclaré du tout.
   *
   * Ce n'est pas une erreur : c'est le cas d'un fichier au format v1. Mais
   * l'appelant doit pouvoir le DIRE, plutôt que de laisser croire à une
   * configuration lue.
   */
  estVide: boolean;
}

/** Une configuration qui ne déclare rien. */
export function configVide(): BudgetConfig {
  return {
    comptes: [],
    types: [],
    categories: [],
    employeurs: [],
    compteCreditSortiesEpargne: null,
    estVide: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CE QUE LA VALIDATION REÇOIT — les lignes brutes, telles que lues
// ─────────────────────────────────────────────────────────────────────────
//
// Chaque ligne porte son numéro dans le tableur. Sans lui, un message
// d'erreur ne sert à rien : « participation illisible » n'aide personne,
// « ligne 14, colonne Participation » se corrige en dix secondes.
//
// Les valeurs sont en `unknown` : elles viennent d'une cellule, on ne
// suppose rien de leur type avant de les avoir lues.

export interface LigneCompteBrute {
  ligne: number;
  compte: unknown;
  soldeDepart?: unknown;
  organisme?: unknown;
  participation?: unknown;
  compteLie?: unknown;
  sensRepercute?: unknown;
  porteUnSolde?: unknown;
  couleur?: unknown;
}

export interface LigneTypeBrute {
  ligne: number;
  type: unknown;
  nature?: unknown;
  classeParDefaut?: unknown;
}

export interface LigneCategorieBrute {
  ligne: number;
  categorie: unknown;
  couleur?: unknown;
}

export interface LigneEmployeurBrute {
  ligne: number;
  employeur: unknown;
}

/** Tout ce que la feuille `Paramètres` a livré, avant validation. */
export interface ConfigBrute {
  /** Nom de la feuille d'où tout cela vient, pour situer les messages. */
  feuille: string;
  comptes: LigneCompteBrute[];
  types: LigneTypeBrute[];
  categories: LigneCategorieBrute[];
  employeurs: LigneEmployeurBrute[];
  /** Ligne `Compte crédité par les sorties d'épargne` du tableau Paramètre/Valeur. */
  compteCreditSortiesEpargne?: { valeur: unknown; ligne: number } | null;
}

/** Une `ConfigBrute` qui ne porte rien. Sert de point de départ aux tests. */
export function configBruteVide(feuille = "Paramètres"): ConfigBrute {
  return { feuille, comptes: [], types: [], categories: [], employeurs: [] };
}
