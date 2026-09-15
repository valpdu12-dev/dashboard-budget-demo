// ── Vocabulaire des comptes, organismes et employeurs ────────────────────
//
// SOURCE UNIQUE des noms de comptes et d'organismes. Avant le lot A.2 ces
// noms étaient recopiés dans sept fichiers ; les changer demandait de tous
// les retrouver.
//
// Les noms sont NEUTRES : cette copie est publique et ne doit porter aucun
// compte réel. Voir `plan/LISTE_NOIRE.txt` (hors dépôt).
//
// Pourquoi `id` ET `libelle`, alors que le code n'utilise que `libelle` ?
// Aujourd'hui le libellé sert aussi de clé — clé de solde, de couleur,
// d'icône, de série de graphique. C'est pour cela que renommer un compte
// oblige à un remplacement global. Le lot C sépare les deux : `id` restera
// figé, `libelle` viendra de la feuille « Paramètres » du fichier source.
// Les deux champs sont déjà distincts ici pour que le lot C n'ait plus qu'à
// changer les consommateurs, pas la forme des données.
//
// ⚠️ LIMITE CONNUE (lot C). `useBalances.ts` calcule les soldes avec des
// règles écrites pour CES comptes précis. Ajouter un compte à cette liste
// ne lui donne pas de solde : il faut aussi lui écrire sa règle. Voir
// `docs/LIMITES_PARAMETRAGE.md`.

export interface CompteDef {
  /** Identifiant stable. Jamais affiché. Ne change jamais. */
  id: string;
  /** Libellé affiché. Deviendra paramétrable au lot C. */
  libelle: string;
  /** Organisme de rattachement (libellé). */
  organisme: string;
  /** Le compte porte-t-il un solde propre ? */
  soldePropre: boolean;
}

/** Tous les comptes connus de l'application. */
export const COMPTES: readonly CompteDef[] = [
  { id: "banque-a-courant",       libelle: "Banque A - Courant",            organisme: "Banque A",           soldePropre: true  },
  { id: "banque-a-part-commune",  libelle: "Banque A - Part commune",       organisme: "Banque A",           soldePropre: false },
  { id: "banque-b-courant",       libelle: "Banque B - Courant",            organisme: "Banque B",           soldePropre: true  },
  { id: "banque-b-joint",         libelle: "Banque B - Compte joint",       organisme: "Banque B",           soldePropre: true  },
  { id: "banque-c-joint",         libelle: "Banque C - Compte joint",       organisme: "Banque C",           soldePropre: true  },
  { id: "titres-restaurant",      libelle: "Titres-restaurant",             organisme: "Titres-restaurant",  soldePropre: true  },
  { id: "appli-partagee",         libelle: "Appli partagée - Part commune", organisme: "Banque A",           soldePropre: false },
] as const;

/** Libellés de tous les comptes. */
export const COMPTE_LIBELLES: readonly string[] = COMPTES.map((c) => c.libelle);

/** Libellés des comptes portant un solde propre (cartes et courbes de soldes). */
export const COMPTES_AVEC_SOLDE: readonly string[] = COMPTES.filter((c) => c.soldePropre).map(
  (c) => c.libelle
);

/** Organismes effectivement représentés, dans l'ordre de première apparition. */
export const ORGANISMES_UTILISES: readonly string[] = [
  ...new Set(COMPTES.map((c) => c.organisme)),
];

/** Compte → organisme. */
export const COMPTE_VERS_ORGANISME: Record<string, string> = Object.fromEntries(
  COMPTES.map((c) => [c.libelle, c.organisme])
);

/** Recherche par identifiant. Sert de point d'entrée au lot C. */
export function compteParId(id: string): CompteDef | undefined {
  return COMPTES.find((c) => c.id === id);
}
