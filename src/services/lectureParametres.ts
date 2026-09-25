// ── La feuille `Paramètres` étendue ──────────────────────────────────────
//
// Lot C.2. La v1 ne lisait que deux petits tableaux de DEUX colonnes :
// `Paramètre / Valeur` et `Compte / Solde de départ`. Le format v2 en demande
// davantage — huit colonnes pour les comptes, trois pour les types — et il
// faut donc un lecteur qui sache lire N colonnes nommées.
//
// ⚠️ LE PIÈGE QUI A DICTÉ CE FICHIER. `tableauParEnTete` cherche la PREMIÈRE
// cellule valant « Compte » et lit la colonne d'à côté. Un second tableau
// nommé « Comptes » aurait donc été trouvé À LA PLACE des soldes de départ —
// ou l'inverse, selon leur position sur la feuille. Silencieusement.
//
// D'où la règle du §4.6 du contrat : il n'y a qu'UN SEUL tableau des comptes.
// Celui du format v1 est ce tableau, élargi. Un fichier v1 en est le cas
// particulier à deux colonnes, et se lit sans être retouché.
//
// Contrat : `docs/CONTRAT_PARAMETRAGE.md`, §4.6.

import { nettoyerTexte, normaliserCle } from "@/services/lectureValeurs";
import type { Anomalie } from "@/types/anomalie";
import type { ConfigBrute } from "@/types/budgetConfig";

/** Une ligne de tableau : ses valeurs par champ, et son numéro dans le tableur. */
export interface LigneTableau {
  ligne: number;
  valeurs: Record<string, unknown>;
}

/** Un tableau retrouvé sur la feuille. */
export interface TableauLu {
  /** Les en-têtes tels qu'ils sont écrits, dans l'ordre. Sert aux messages. */
  enTetes: string[];
  /** Les champs du dictionnaire effectivement trouvés. */
  champsTrouves: string[];
  lignes: LigneTableau[];
}

// ─────────────────────────────────────────────────────────────────────────
// LES COLONNES ATTENDUES
// ─────────────────────────────────────────────────────────────────────────

/** Le tableau des comptes. Seule `Compte` est obligatoire. */
export const COLONNES_COMPTES: Record<string, string> = {
  compte: "Compte",
  soldeDepart: "Solde de départ",
  organisme: "Organisme",
  participation: "Participation",
  compteLie: "Compte lié",
  sensRepercute: "Sens répercuté",
  porteUnSolde: "Porte un solde",
  couleur: "Couleur",
};

export const COLONNES_TYPES: Record<string, string> = {
  type: "Type",
  nature: "Nature",
  classeParDefaut: "Classe par défaut",
};

export const COLONNES_CATEGORIES: Record<string, string> = {
  categorie: "Catégorie",
  couleur: "Couleur",
};

export const COLONNES_EMPLOYEURS: Record<string, string> = {
  employeur: "Employeur",
};

/** Ligne du tableau `Paramètre / Valeur` qui déclare le compte des sorties (D2). */
export const PARAM_COMPTE_SORTIES = "Compte crédité par les sorties d'épargne";

/**
 * Les cellules qui ouvrent un tableau sur cette feuille.
 *
 * ⚠️ Elles servent à SAVOIR OÙ S'ARRÊTER. Un tableau se lit de sa ligne
 * d'en-tête jusqu'au bas de la feuille, en sautant les lignes vides — c'est
 * la règle du format v1, et elle permet à deux tableaux de hauteurs
 * différentes de cohabiter côte à côte.
 *
 * Mais elle a un revers, trouvé en écrivant les tests du C.2 : un second
 * tableau posé PLUS BAS DANS LA MÊME COLONNE était avalé par le premier. Un
 * tableau `Employeur` sous le tableau `Compte` donnait un compte nommé
 * « Employeur ». Sans erreur, évidemment.
 *
 * Un tableau s'arrête donc à la cellule qui en ouvre un autre.
 */
const EN_TETES_DE_TABLEAU = [
  "Paramètre",
  COLONNES_COMPTES.compte,
  COLONNES_TYPES.type,
  COLONNES_CATEGORIES.categorie,
  COLONNES_EMPLOYEURS.employeur,
].map((e) => normaliserCle(e));

// ─────────────────────────────────────────────────────────────────────────
// LE LECTEUR DE TABLEAU À N COLONNES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Retrouve un tableau par sa cellule d'en-tête, et lit ses colonnes nommées.
 *
 * Deux règles, et elles sont volontairement strictes :
 *
 * 1. **La ligne d'en-tête s'arrête à la première cellule vide.** Le classeur
 *    modèle pose deux tableaux CÔTE À CÔTE sur les mêmes lignes, séparés par
 *    une colonne vide. Sans cette règle, lire « vers la droite » avalerait le
 *    tableau voisin.
 * 2. **Une ligne dont la cellule de clé est vide est sautée**, sans être une
 *    erreur — c'est ainsi que deux tableaux de hauteurs différentes cohabitent.
 * 3. **Un tableau s'arrête à la cellule qui en ouvre un autre**, pour qu'un
 *    tableau posé plus bas dans la même colonne ne soit pas avalé par celui
 *    du dessus. Voir `EN_TETES_DE_TABLEAU`.
 *
 * Une colonne inconnue du dictionnaire est ignorée sans bruit : c'est déjà la
 * règle du format v1 pour la feuille `Transactions`.
 */
export function tableauColonnes(
  grille: unknown[][],
  enTete: string,
  dictionnaire: Record<string, string>
): TableauLu | null {
  const cible = normaliserCle(enTete);

  for (let r = 0; r < grille.length; r++) {
    const ligneEnTete = grille[r] ?? [];
    for (let c = 0; c < ligneEnTete.length; c++) {
      if (normaliserCle(ligneEnTete[c]) !== cible) continue;

      // ── La ligne d'en-tête, jusqu'à la première cellule vide ─────────
      const enTetes: string[] = [];
      for (let cc = c; cc < ligneEnTete.length; cc++) {
        const texte = nettoyerTexte(ligneEnTete[cc]);
        if (texte === "") break;
        enTetes.push(texte);
      }

      // ── Champ → index de colonne ────────────────────────────────────
      const index: Record<string, number> = {};
      for (const [champ, libelle] of Object.entries(dictionnaire)) {
        const i = enTetes.findIndex((e) => normaliserCle(e) === normaliserCle(libelle));
        if (i !== -1) index[champ] = c + i;
      }

      // ── Les lignes ──────────────────────────────────────────────────
      const lignes: LigneTableau[] = [];
      for (let i = r + 1; i < grille.length; i++) {
        const ligne = grille[i] ?? [];
        if (nettoyerTexte(ligne[c]) === "") continue;
        // Un autre tableau commence ici : celui-ci est fini.
        if (EN_TETES_DE_TABLEAU.includes(normaliserCle(ligne[c]))) break;

        const valeurs: Record<string, unknown> = {};
        for (const [champ, idx] of Object.entries(index)) valeurs[champ] = ligne[idx];
        lignes.push({ ligne: i + 1, valeurs });
      }

      return { enTetes, champsTrouves: Object.keys(index), lignes };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// LA CONFIGURATION BRUTE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Rassemble les quatre tableaux de configuration, tels qu'ils sont écrits.
 *
 * Rien n'est validé ici : c'est le travail de `validerConfig`. Ce fichier ne
 * fait que retrouver les cellules et les rendre avec leur numéro de ligne.
 *
 * @param valeurParam  accès au tableau `Paramètre / Valeur` déjà lu par
 *                     `lectureClasseur`, pour la ligne D2.
 * @param signaler     reçoit les anomalies de STRUCTURE — une colonne
 *                     attendue absente, par exemple.
 */
export function lireConfigBrute(
  grille: unknown[][],
  feuille: string,
  valeurParam: (cle: string) => { v: unknown; ligne: number } | undefined,
  signaler: (a: Anomalie) => void
): ConfigBrute {
  const tComptes = tableauColonnes(grille, COLONNES_COMPTES.compte, COLONNES_COMPTES);
  const tTypes = tableauColonnes(grille, COLONNES_TYPES.type, COLONNES_TYPES);
  const tCategories = tableauColonnes(grille, COLONNES_CATEGORIES.categorie, COLONNES_CATEGORIES);
  const tEmployeurs = tableauColonnes(grille, COLONNES_EMPLOYEURS.employeur, COLONNES_EMPLOYEURS);

  // ── Un tableau Comptes sans colonne « Solde de départ » ─────────────
  //
  // C'est presque toujours une colonne mal orthographiée. Se taire ferait
  // disparaître tous les soldes de départ du fichier sans un mot — et des
  // comptes « non initialisés » que la personne croit avoir renseignés.
  if (tComptes && !tComptes.champsTrouves.includes("soldeDepart")) {
    signaler({
      gravite: "avertissement",
      feuille,
      ligne: tComptes.lignes[0]?.ligne,
      colonne: COLONNES_COMPTES.compte,
      message:
        `Le tableau des comptes ne porte pas de colonne « ${COLONNES_COMPTES.soldeDepart} ». ` +
        `Colonnes lues : ${tComptes.enTetes.join(", ")}. Tous les comptes resteront ` +
        `« non initialisés », jamais 0.`,
    });
  }

  const sorties = valeurParam(PARAM_COMPTE_SORTIES);

  return {
    feuille,
    comptes: (tComptes?.lignes ?? []).map((l) => ({
      ligne: l.ligne,
      compte: l.valeurs.compte,
      soldeDepart: l.valeurs.soldeDepart,
      organisme: l.valeurs.organisme,
      participation: l.valeurs.participation,
      compteLie: l.valeurs.compteLie,
      sensRepercute: l.valeurs.sensRepercute,
      porteUnSolde: l.valeurs.porteUnSolde,
      couleur: l.valeurs.couleur,
    })),
    types: (tTypes?.lignes ?? []).map((l) => ({
      ligne: l.ligne,
      type: l.valeurs.type,
      nature: l.valeurs.nature,
      classeParDefaut: l.valeurs.classeParDefaut,
    })),
    categories: (tCategories?.lignes ?? []).map((l) => ({
      ligne: l.ligne,
      categorie: l.valeurs.categorie,
      couleur: l.valeurs.couleur,
    })),
    employeurs: (tEmployeurs?.lignes ?? []).map((l) => ({
      ligne: l.ligne,
      employeur: l.valeurs.employeur,
    })),
    ...(sorties ? { compteCreditSortiesEpargne: { valeur: sorties.v, ligne: sorties.ligne } } : {}),
  };
}
