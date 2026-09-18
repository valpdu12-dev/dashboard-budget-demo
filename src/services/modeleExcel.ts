// ── Classeur modèle au format public ─────────────────────────────────────
//
// Lot B.1. Produit `Budget_modele.xlsx` — un exemple complet et cohérent du
// format décrit dans `docs/FORMAT_FICHIER_SOURCE.md`.
//
// OÙ VIT CE FICHIER, ET POURQUOI. Il n'est PAS versionné. Le contrôle de
// publication (`scripts/verifier-publication.mjs`) refuse les extensions
// `.xlsx` dans la source — c'est volontaire, ce sont les extensions des
// données brutes. Le modèle est donc FABRIQUÉ À LA DEMANDE, dans le
// navigateur, par le bouton « Télécharger le modèle ». Aucun binaire au
// dépôt, aucune exception à maintenir, et le modèle reste disponible depuis
// le site en ligne.
//
// POURQUOI LE WORKER LE CONSTRUIT. Ce module importe SheetJS. S'il était
// importé par un composant, SheetJS entrerait dans le bundle principal —
// environ 400 Ko chargés à l'ouverture, pour un bouton que presque personne
// ne cliquera. Le worker embarque déjà la bibliothèque : il fabrique donc le
// classeur et rend les octets. Coût sur le chargement initial : zéro.
//
// DÉTERMINISME. Aucune horloge, aucun aléa, dates de propriétés figées :
// deux appels produisent le même fichier, octet pour octet. Un test le
// vérifie. C'est la même discipline que `scripts/generate-demo-data.mjs`.

import * as XLSX from "xlsx";

/** Une ligne de la feuille `Transactions` du modèle. */
export interface LigneTransactionModele {
  date: string;
  compte: string;
  type: string;
  montant: number;
  /**
   * Montant AVANT partage — décision D1, format v2.
   *
   * Rempli, l'outil lui applique le taux de participation du compte et ignore
   * `montant`. Le modèle le renseigne sur les seules lignes d'un compte
   * partagé, avec exactement le double du montant imputé : la démonstration
   * du mécanisme ne change donc aucun chiffre.
   */
  montantBrut?: number;
  sens: "Débit" | "Crédit";
  /**
   * Vide pour ce qui n'est pas une dépense classable : remboursement de
   * capital, épargne, transfert interne. Voir `docs/FORMAT_FICHIER_SOURCE.md`
   * §3.3 — une classe vide ne veut pas dire « non renseignée », elle veut
   * dire « cette ligne n'est pas une dépense à classer ».
   */
  classe: string;
  categorie: string;
  sousCategorie: string;
  detail: string;
  libelle: string;
  ville: string;
  previsionnel: string;
}

/** Une ligne de la feuille `Paie` du modèle. */
export interface LignePaieModele {
  mois: string;
  employeur: string;
  brut: number;
  cotisations: number;
  indemnites: number;
  retenues: number;
  net: number;
}

/** Bornes de relevé déclarées par le modèle. */
export const BORNES_MODELE = { debut: "01/01/2026", fin: "31/03/2026" } as const;

/** Paramètres du prêt du modèle. Le trio montant/mensualité/échéances est complet. */
export const PRET_MODELE = {
  montant: 180000,
  mensualite: 893.6,
  echeances: 240,
  premiereEcheance: "2022-10",
} as const;

/**
 * Les comptes que le modèle déclare : libellé, solde de départ, solde propre.
 *
 * ⚠️ Lot C.2. « Banque A - Part commune » a été AJOUTÉ ici. Le modèle portait
 * des transactions sur ce compte sans le déclarer dans son propre tableau —
 * invisible tant que la référence était la liste figée de l'application,
 * signalé dès que c'est le tableau `Comptes` qui fait foi. Le modèle aurait
 * produit un avertissement, et un modèle qui déclenche des avertissements
 * enseigne à les ignorer.
 *
 * Son solde de départ est VIDE, et c'est une valeur : ce compte ne porte pas
 * de solde propre, ses dépenses sont retirées du compte principal. Lui
 * inventer un solde serait un chiffre faux d'apparence normale.
 */
export interface CompteModele {
  libelle: string;
  /** `null` = non initialisé, jamais 0. */
  solde: number | null;
  porteUnSolde: boolean;
  /** Libellé du compte qui sert de contrepartie, ou `null`. */
  compteLie: string | null;
  /** Obligatoire dès que `compteLie` est rempli — jamais deviné (§4.7). */
  sensRepercute: "Débit" | "Crédit" | "Les deux" | null;
  /** Taux de participation, appliqué au `Montant brut`. `null` = 100 %. */
  participation: string | null;
}

export const COMPTES_MODELE: readonly CompteModele[] = [
  { libelle: "Banque A - Courant", solde: 3200, porteUnSolde: true, compteLie: null, sensRepercute: null , participation: null },
  { libelle: "Banque B - Courant", solde: 1500, porteUnSolde: true, compteLie: null, sensRepercute: null , participation: null },
  { libelle: "Banque B - Compte joint", solde: 850, porteUnSolde: true, compteLie: "Banque A - Courant", sensRepercute: "Crédit" , participation: null },
  { libelle: "Banque C - Compte joint", solde: 1200, porteUnSolde: true, compteLie: "Banque A - Courant", sensRepercute: "Crédit" , participation: null },
  { libelle: "Titres-restaurant", solde: 95, porteUnSolde: true, compteLie: null, sensRepercute: null , participation: null },
  { libelle: "Banque A - Part commune", solde: null, porteUnSolde: false, compteLie: "Banque A - Courant", sensRepercute: "Débit" , participation: "50 %" },
] as const;

/**
 * Les types du modèle et leur NATURE — lot C.4.
 *
 * Sans ce tableau, l'outil ne sait pas qu'un virement vers un livret est de
 * l'épargne, ni qu'une échéance de prêt en est une. Il ne le devine pas : il
 * compte la ligne comme une dépense ordinaire, et l'écran Épargne n'a rien à
 * montrer. C'est le comportement voulu — et c'est pour cela que le modèle
 * doit le déclarer.
 *
 * ⚠️ `Crédit Immobilier` porte DEUX natures : le remboursement de capital est
 * à la fois une entrée d'épargne et une échéance de prêt. Voir §4.5 du
 * contrat.
 */
/** Les catégories de budget du modèle, et leur couleur. */
export const CATEGORIES_MODELE: readonly (readonly [string, string])[] = [
  ["Alimentation", "#e67e22"],
  ["Assurances", "#8e44ad"],
  ["Immobilier", "#2980b9"],
  ["Impots", "#c0392b"],
  ["Loisir", "#27ae60"],
  ["Santé", "#00cec9"],
  ["Transport", "#f39c12"],
] as const;

export const TYPES_MODELE: readonly (readonly [string, string])[] = [
  ["Crédit Immobilier", "epargne, pret-capital"],
  ["Intérêt du prêt", "pret-interets"],
  ["Épargne Banque A", "epargne, transfert-interne"],
  ["Transfert Banque A vers Banque B", "transfert-interne"],
] as const;

/** Soldes de départ, au premier jour du relevé. Dérivé de `COMPTES_MODELE`. */
export const SOLDES_MODELE: readonly (readonly [string, number])[] = COMPTES_MODELE.filter(
  (c): c is CompteModele & { solde: number } => c.solde !== null
).map((c) => [c.libelle, c.solde] as const);

/** Salaires nets versés, mois par mois. Cohérents avec la feuille `Paie`. */
const SALAIRES = [2538, 2538, 2577];

/** Parts capital et intérêts de la mensualité, mois par mois. Somme = 893,60. */
const ECHEANCES_PRET = [
  [640.15, 253.45],
  [641.11, 252.49],
  [642.07, 251.53],
];

const MOIS = ["01", "02", "03"];

function ligne(
  jour: string,
  mois: string,
  compte: string,
  type: string,
  montant: number,
  sens: "Débit" | "Crédit",
  classe: string,
  categorie: string,
  sousCategorie = "",
  libelle = "",
  ville = ""
): LigneTransactionModele {
  return {
    date: `${jour}/${mois}/2026`,
    compte,
    type,
    montant,
    sens,
    classe,
    categorie,
    sousCategorie,
    detail: "",
    libelle,
    ville,
    previsionnel: "",
  };
}

/**
 * Les transactions du modèle : trois mois complets, tous les cas de figure du
 * format représentés au moins une fois.
 */
export const TRANSACTIONS_MODELE: readonly LigneTransactionModele[] = MOIS.flatMap(
  (m, i) => [
    ligne("02", m, "Banque A - Courant", "Salaire", SALAIRES[i], "Crédit", "", "", "", "Virement employeur"),
    ligne("03", m, "Titres-restaurant", "Ticket Restaurant", 190, "Crédit", "", "Comptes Bancaires", "", "Dotation mensuelle"),
    ligne("05", m, "Banque A - Courant", "Crédit Immobilier", ECHEANCES_PRET[i][0], "Débit", "", "Immobilier", "", "Échéance de prêt — capital"),
    ligne("05", m, "Banque A - Courant", "Intérêt du prêt", ECHEANCES_PRET[i][1], "Débit", "Dépense Fixe", "Immobilier", "", "Échéance de prêt — intérêts"),
    ligne("05", m, "Banque A - Courant", "Assurance habitation", 21.4, "Débit", "Dépense Fixe", "Assurances", "", "Prélèvement assureur"),
    ligne("06", m, "Banque A - Courant", "Electricité", 78.9, "Débit", "Dépense Fixe", "Immobilier", "", "Prélèvement fournisseur"),
    ligne("06", m, "Banque A - Courant", "Internet et Forfait téléphone", 45.9, "Débit", "Dépense Fixe", "Autre", "", "Prélèvement opérateur"),
    ligne("07", m, "Banque A - Courant", "Abonnement transport", 88.8, "Débit", "Dépense Fixe", "Transport", "", "Abonnement mensuel"),
    // ⚠️ Les deux seules lignes du modèle à porter un « Montant brut » : le
    // compte est partagé à 50 %, la course a coûté 192,60 € et 96,30 € vous
    // sont imputés. C'est le mécanisme de la décision D1, montré sur un cas
    // réel — et le montant imputé ne change pas d'un centime.
    { ...ligne("08", m, "Banque A - Part commune", "courses", 96.3, "Débit", "Dépense Courante", "Alimentation", "Supermarché", "Courses de la semaine", "Ville A"), montantBrut: 192.6 },
    ligne("12", m, "Titres-restaurant", "cantine", 9.6, "Débit", "Dépense Courante", "Alimentation", "Cantine", "Déjeuner"),
    ligne("14", m, "Banque A - Courant", "Essence", 62.5, "Débit", "Dépense Courante", "Transport", "Station-service", "Plein"),
    { ...ligne("16", m, "Banque A - Part commune", "courses", 74.15, "Débit", "Dépense Courante", "Alimentation", "Supermarché", "Courses de la semaine", "Ville A"), montantBrut: 148.3 },
    ligne("18", m, "Banque B - Compte joint", "Transfert Banque A vers Banque B", 300, "Crédit", "", "Comptes Bancaires", "", "Alimentation du compte joint"),
    ligne("20", m, "Banque A - Courant", "Restaurant", 38.4, "Débit", "Dépense Occasionnelle", "Alimentation", "Restaurant", "Dîner", "Ville A"),
    ligne("22", m, "Banque A - Courant", "Loisirs", 24, "Débit", "Dépense Occasionnelle", "Loisir", "Cinéma", "Séance"),
    ligne("25", m, "Banque A - Courant", "Médecin", 26.5, "Débit", "Dépense Courante", "Santé", "Consultation", "Consultation"),
    ligne("28", m, "Banque A - Courant", "Épargne Banque A", 200, "Débit", "", "Comptes Bancaires", "", "Virement vers épargne"),
  ]
).concat([
  // Une ligne PRÉVISIONNELLE, hors des bornes du relevé : elle montre la
  // colonne `Prévisionnel` à l'œuvre. Elle ne doit PAS être importée.
  {
    date: "05/04/2026",
    compte: "Banque A - Courant",
    type: "Crédit Immobilier",
    montant: 643.03,
    sens: "Débit",
    classe: "",
    categorie: "Immobilier",
    sousCategorie: "",
    detail: "",
    libelle: "Échéance à venir — non constatée",
    ville: "",
    previsionnel: "x",
  },
]);

/** La feuille `Paie` du modèle. Le net est recalculé par l'outil ; il sert ici de contrôle. */
export const PAIE_MODELE: readonly LignePaieModele[] = [
  { mois: "2026-01", employeur: "Employeur A", brut: 3100, cotisations: 682, indemnites: 120, retenues: 0, net: 2538 },
  { mois: "2026-02", employeur: "Employeur A", brut: 3100, cotisations: 682, indemnites: 120, retenues: 0, net: 2538 },
  { mois: "2026-03", employeur: "Employeur A", brut: 3150, cotisations: 693, indemnites: 120, retenues: 0, net: 2577 },
];

const EN_TETE_TRANSACTIONS = [
  "Date", "Compte", "Type", "Montant", "Montant brut", "Sens", "Classe",
  "Catégorie", "Sous-catégorie", "Détail", "Libellé", "Ville", "Prévisionnel",
];

const EN_TETE_PAIE = [
  "Mois", "Employeur", "Brut", "Cotisations salariales",
  "Indemnités", "Autres retenues", "Net",
];

const LISEZ_MOI: string[][] = [
  ["Budget — modèle de fichier source"],
  [""],
  ["Ce classeur est un EXEMPLE complet, à remplacer par vos propres données."],
  ["Le format est décrit dans docs/FORMAT_FICHIER_SOURCE.md."],
  [""],
  ["Les trois feuilles"],
  ["  Transactions   obligatoire — vos mouvements, un par ligne"],
  ["  Paie           facultative — un bulletin par mois ; sans elle, les écrans Salaire disparaissent"],
  ["  Paramètres     facultative — soldes de départ, dates de relevé, prêt"],
  [""],
  ["Les cinq règles à retenir"],
  ["  1. L'en-tête est en ligne 1. L'ordre des colonnes est libre."],
  ["  2. Le montant est TOUJOURS positif. C'est la colonne Sens qui dit Débit ou Crédit."],
  ["  3. Le montant est celui qui vous est IMPUTÉ. Une dépense partagée à moitié se note 40, pas 80."],
  ["  4. Classe vaut Dépense Fixe, Dépense Courante ou Dépense Occasionnelle."],
  ["     Laissez-la vide pour ce qui n'est pas une dépense : épargne, transfert, capital de prêt."],
  ["  5. Un montant illisible ne devient jamais 0 : la ligne est refusée et vous est signalée."],
  [""],
  ["Les dates"],
  ["  Écrites ici au format JJ/MM/AAAA. Une vraie date Excel ou AAAA-MM-JJ conviennent aussi."],
  [""],
  ["Une feuille dont le nom n'est pas reconnu est ignorée — celle-ci, par exemple."],
];

/**
 * Construit le classeur modèle.
 *
 * @returns les octets du fichier `.xlsx`, prêts à être téléchargés ou écrits.
 */
export function construireClasseurModele(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Propriétés FIGÉES : sans elles, SheetJS écrit la date du jour et deux
  // exécutions ne produisent plus le même fichier.
  wb.Props = {
    Title: "Budget — modèle de fichier source",
    Author: "Dashboard Budget — démonstration",
    CreatedDate: new Date(Date.UTC(2026, 0, 1, 0, 0, 0)),
  };

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(LISEZ_MOI), "Lisez-moi");

  const tx = [
    EN_TETE_TRANSACTIONS,
    ...TRANSACTIONS_MODELE.map((l) => [
      l.date, l.compte, l.type, l.montant, l.montantBrut ?? "", l.sens, l.classe,
      l.categorie, l.sousCategorie, l.detail, l.libelle, l.ville, l.previsionnel,
    ]),
  ];
  const wsTx = XLSX.utils.aoa_to_sheet(tx);
  wsTx["!cols"] = [
    { wch: 11 }, { wch: 26 }, { wch: 28 }, { wch: 10 }, { wch: 13 }, { wch: 8 },
    { wch: 21 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 10 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

  const paie = [
    EN_TETE_PAIE,
    ...PAIE_MODELE.map((p) => [
      p.mois, p.employeur, p.brut, p.cotisations, p.indemnites, p.retenues, p.net,
    ]),
  ];
  const wsPaie = XLSX.utils.aoa_to_sheet(paie);
  wsPaie["!cols"] = [
    { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPaie, "Paie");

  // Deux tableaux sur la même feuille : Paramètre/Valeur en colonnes A-B,
  // Le tableau des comptes en colonnes D-E-F. Le lecteur le retrouve par sa
  // cellule d'en-tête : la position n'est pas imposée, mais la ligne
  // d'en-tête s'arrête à la première cellule vide — d'où la colonne C laissée
  // vide entre les deux tableaux.
  const gauche: (string | number)[][] = [
    ["Paramètre", "Valeur"],
    ["Version du format", 1],
    ["Début de relevé", BORNES_MODELE.debut],
    ["Fin de relevé", BORNES_MODELE.fin],
    ["Prêt — montant", PRET_MODELE.montant],
    ["Prêt — mensualité", PRET_MODELE.mensualite],
    ["Prêt — nombre d'échéances", PRET_MODELE.echeances],
    ["Prêt — première échéance", PRET_MODELE.premiereEcheance],
  ];
  const comptes: (string | number)[][] = [
    ["Compte", "Solde de départ", "Porte un solde", "Compte lié", "Sens répercuté", "Participation"],
    ...COMPTES_MODELE.map((c) => [
      c.libelle, c.solde ?? "", c.porteUnSolde ? "oui" : "non",
      c.compteLie ?? "", c.sensRepercute ?? "", c.participation ?? "",
    ]),
  ];
  const types: (string | number)[][] = [
    ["Type", "Nature"],
    ...TYPES_MODELE.map((t) => [t[0], t[1]]),
  ];
  const categories: (string | number)[][] = [
    ["Catégorie", "Couleur"],
    ...CATEGORIES_MODELE.map((c) => [c[0], c[1]]),
  ];
  const employeurs: (string | number)[][] = [
    ["Employeur"],
    ...[...new Set(PAIE_MODELE.map((p) => p.employeur))].map((e) => [e]),
  ];

  // ⚠️ Une colonne VIDE sépare chaque tableau du suivant : la ligne d'en-tête
  // se lit de sa cellule vers la droite et s'arrête à la première case vide.
  // Sans ce blanc, le tableau des comptes avalerait celui des types.
  const hauteur = Math.max(
    gauche.length, comptes.length, types.length, categories.length, employeurs.length
  );
  const parametres: (string | number)[][] = [];
  for (let i = 0; i < hauteur; i++) {
    const g = gauche[i] ?? ["", ""];
    const c = comptes[i] ?? ["", "", "", "", "", ""];
    const t = types[i] ?? ["", ""];
    const k = categories[i] ?? ["", ""];
    const e = employeurs[i] ?? [""];
    parametres.push([
      g[0], g[1], "",
      c[0], c[1], c[2], c[3], c[4], c[5], "",
      t[0], t[1], "",
      k[0], k[1], "",
      e[0],
    ]);
  }
  const wsParam = XLSX.utils.aoa_to_sheet(parametres);
  wsParam["!cols"] = [
    { wch: 26 }, { wch: 14 }, { wch: 3 },
    { wch: 26 }, { wch: 16 }, { wch: 15 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 3 },
    { wch: 30 }, { wch: 26 }, { wch: 3 },
    { wch: 18 }, { wch: 10 }, { wch: 3 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsParam, "Paramètres");

  // ⚠️ Avec `type: "array"`, SheetJS rend un ArrayBuffer, PAS un Uint8Array.
  // La première version de ce fichier l'affirmait par une assertion de type,
  // et le mensonge tenait : `new Uint8Array(buffer)` marche, `Buffer.from`
  // aussi. Ce qui ne tenait pas, c'est le test de reproductibilité, qui
  // comparait deux `.length` tous deux `undefined` — il passait sans rien
  // vérifier. La vue est donc construite pour de vrai.
  const octets = XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true });
  return new Uint8Array(octets as ArrayBuffer);
}

/** Nom proposé au téléchargement. */
export const NOM_FICHIER_MODELE = "Budget_modele.xlsx";
