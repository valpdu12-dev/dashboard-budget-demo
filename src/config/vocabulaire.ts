// ── Le vocabulaire qui reste en dur — et pourquoi ────────────────────────
//
// Tout le lot C consiste à sortir du code les noms de comptes et de types.
// Ce fichier porte l'inverse : les mots qui NE deviennent PAS paramétrables,
// et la raison de chacun. La liste est close. Ce qui n'y figure pas et qui
// nomme un compte ou un type est une violation du critère de sortie (D5).
//
// Référence : `docs/CONTRAT_PARAMETRAGE.md`, §2.1 et §5.

// ─────────────────────────────────────────────────────────────────────────
// LES NATURES
// ─────────────────────────────────────────────────────────────────────────
//
// La nature dit ce qu'un mouvement FAIT AUX CALCULS. Elle remplace les
// quatre listes de libellés qui gouvernent aujourd'hui cinq écrans :
// `TRANSFER_TYPES`, `EPARGNE_TYPES`, `TYPE_PRET_CAPITAL`,
// `TYPE_PRET_INTERETS`.
//
// Elles restent en dur parce que chacune correspond à un calcul écrit dans
// le code. Une nature déclarable mais sans effet serait un champ mort —
// exactement ce que D4 supprime.

export const NATURES = [
  "epargne",
  "sortie-epargne",
  "transfert-interne",
  "apport-exterieur",
  "pret-capital",
  "pret-interets",
  // C.7 — un crédit qui RÉDUIT une dépense (le remboursement d'une dépense
  // partagée, d'un achat rendu). Remplace le débit négatif de l'ancien tableur ;
  // le montant reste positif, la nature porte l'effet. Voir `calculs/mouvements.ts`.
  "remboursement",
] as const;

export type Nature = (typeof NATURES)[number];

/**
 * Les couples de natures qu'un même type ne peut pas porter.
 *
 * Un type PEUT en porter plusieurs — c'est une nécessité mesurée, pas un
 * confort : dans le jeu de démonstration, le remboursement de capital est à
 * la fois une entrée d'épargne et une échéance de prêt, et un virement vers
 * un livret est à la fois un transfert interne et une entrée d'épargne. Une
 * nature unique par type rendrait le rapprochement à zéro écart du C.3
 * impossible.
 *
 * Ces trois couples-là, en revanche, se contredisent.
 */
export const NATURES_INCOMPATIBLES: ReadonlyArray<
  readonly [Nature, Nature, string]
> = [
  [
    "epargne",
    "sortie-epargne",
    "le sens du mouvement deviendrait indécidable : on ne saurait pas si l'argent entre sur le livret ou en sort",
  ],
  [
    "apport-exterieur",
    "transfert-interne",
    "l'un dit que l'argent vient de l'extérieur, l'autre qu'il vient d'un de vos comptes",
  ],
  [
    "pret-capital",
    "pret-interets",
    "l'échéancier compterait la même ligne deux fois",
  ],
];

/** Vrai si le mot est une nature reconnue. */
export function estNature(mot: string): mot is Nature {
  return (NATURES as readonly string[]).includes(mot);
}

// ─────────────────────────────────────────────────────────────────────────
// LES CLASSES DE DÉPENSE
// ─────────────────────────────────────────────────────────────────────────
//
// Décision du plan V3, rappelée au §5 du contrat : la LISTE des trois
// classes est fixe ; seule l'AFFECTATION type → classe devient paramétrable.
// Trois classes forment la structure des écrans Dépenses et Budget — c'est
// une ossature, pas un vocabulaire.

export const CLASSES = [
  "Dépense Fixe",
  "Dépense Courante",
  "Dépense Occasionnelle",
] as const;

export type Classe = (typeof CLASSES)[number];

// ─────────────────────────────────────────────────────────────────────────
// LES DEUX SENS
// ─────────────────────────────────────────────────────────────────────────
//
// Ce sont les deux directions de l'argent, pas des libellés.
//
// ⚠️ Le signe est porté par le SENS, jamais par le montant. Un montant écrit
// dans le fichier est toujours positif (§4.1 du contrat) ; un montant vide,
// négatif ou illisible rejette la ligne, il ne devient jamais 0.
//
// `Débit` et `Crédit` vivent aujourd'hui dans `services/lectureClasseur.ts`,
// qui est le seul à les lire. Ils viendront ici au C.2, quand la lecture de
// la feuille `Paramètres` étendue passera par ce fichier. Les déclarer ici
// avant d'en avoir l'usage ferait exactement le champ mort que D4 supprime.

/**
 * Le sens dans lequel un mouvement se répercute sur le compte lié.
 *
 * ⚠️ « Les deux » n'est jamais une valeur par défaut. Mesuré sur le jeu de
 * démonstration : répercuter les deux sens là où les règles actuelles n'en
 * répercutent qu'un retirerait 36 016,02 € à tort du compte principal
 * (154 débits sur un compte joint, 114 sur l'autre). Un défaut de cette
 * taille, produit par une valeur par défaut, ressemblerait à un choix de
 * l'utilisateur. Voir §4.7 du contrat.
 */
export const SENS_REPERCUTES = ["Débit", "Crédit", "Les deux"] as const;

export type SensRepercute = (typeof SENS_REPERCUTES)[number];
