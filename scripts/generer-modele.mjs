// ═══════════════════════════════════════════════════════════════════════
// Le classeur modèle — lot F.3
// ═══════════════════════════════════════════════════════════════════════
//
// Fabrique `Budget_modele.xlsx` : le fichier que chaque utilisateur
// télécharge et remplit. Structure du format v5 (listes déroulantes, colonnes
// calculées, Visualisation), remplie avec les données INVENTÉES de la
// démonstration.
//
// RÈGLES (décisions F4 à F12 du contrat, §9) :
//
//   1. Ce script ne lit AUCUN classeur. Il lit seulement `public/data/*.json`,
//      que le générateur de démonstration refait à l'octet (E7). Aucun
//      montant ne peut venir d'un fichier réel.
//   2. Chaque formule est écrite AVEC sa valeur en cache, calculée ici. Le
//      lecteur de l'application lit les valeurs en cache : une formule sans
//      cache serait lue vide, donc rejetée.
//   3. Les valeurs calculées ici sont CONFRONTÉES à la démonstration : la
//      classe et la catégorie de chaque ligne, et le montant imputé. Le
//      moindre écart arrête le script — un modèle qui ne redonne pas la démo
//      ne sort pas.
//   4. Deux exécutions produisent le même CONTENU (dates du document figées).
//      Le zip, lui, porte l'heure de ses entrées : c'est le contenu
//      décompressé qui se compare (F4).
//
// Usage : node scripts/generer-modele.mjs <chemin du fichier à écrire>

import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const DONNEES = join(ICI, "..", "public", "data");
const lire = (nom) => JSON.parse(readFileSync(join(DONNEES, nom), "utf8"));

const sortie = process.argv[2];
if (!sortie) {
  console.error("Usage : node scripts/generer-modele.mjs <fichier.xlsx>");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────
// 1. LES DONNÉES DE LA DÉMONSTRATION
// ─────────────────────────────────────────────────────────────────────────

const config = lire("config.json");
const salary = lire("salary.json");
const brut = lire("transactions.json");

const champ = (ligne, nom) => {
  const v = ligne[brut.fields.indexOf(nom)];
  if (nom === "montant" || nom === "date") return v;
  return typeof v === "number" ? (v < 0 ? "" : brut.s[v]) : v ?? "";
};
const transactions = brut.t.map((l) =>
  Object.fromEntries(brut.fields.map((f) => [f, champ(l, f)]))
);

const P = config.parametrage;
const libelleDe = new Map(P.comptes.map((c) => [c.id, c.libelle]));
const compteParLibelle = new Map(P.comptes.map((c) => [c.libelle, c]));
const typeDeclare = new Map(P.types.map((t) => [t.libelle, t]));

const arrondir = (n) => Math.round(n * 100) / 100;
const echouer = (m) => { console.error(`\n✗ Modèle : ${m}\n`); process.exit(1); };

// ─────────────────────────────────────────────────────────────────────────
// 2. LA TABLE DES TYPES — une seule vérité
// ─────────────────────────────────────────────────────────────────────────
//
// Le format v5 portait les types DEUX fois : dans `Paramètres` (nature) et
// dans `Référentiel` (sens, classe, catégorie). Deux tables, deux vérités qui
// divergent le jour où l'on en corrige une. Ici, une seule table, dans
// `Paramètres` : Type, Nature, Classe par défaut, Sens par défaut, Catégorie
// (budget). Le lecteur lit les trois premières colonnes, ignore les deux
// autres ; les formules de `Transactions` lisent les cinq.

const vuesParType = new Map();
for (const t of transactions) {
  const v = vuesParType.get(t.type) ?? { sens: new Set(), cat: new Set() };
  v.sens.add(t.dc);
  v.cat.add(t.cat2);
  vuesParType.set(t.type, v);
}
for (const [type, v] of vuesParType) {
  if (v.sens.size > 1 || v.cat.size > 1) {
    echouer(`le type « ${type} » n'a pas un seul sens et une seule catégorie dans la démo.`);
  }
}

const TYPES = [...new Set([...typeDeclare.keys(), ...vuesParType.keys()])]
  .sort((a, b) => a.localeCompare(b, "fr"))
  .map((libelle) => {
    const d = typeDeclare.get(libelle);
    const v = vuesParType.get(libelle);
    return {
      libelle,
      natures: d?.natures ?? [], // remises dans l'ordre de la liste au § 4.4 (H.2)
      classe: d?.classeParDefaut ?? "",
      sens: v ? [...v.sens][0] : "",
      categorie: v ? [...v.cat][0] : "",
    };
  });
const typeParLibelle = new Map(TYPES.map((t) => [t.libelle, t]));

// ─────────────────────────────────────────────────────────────────────────
// 3. CHAQUE LIGNE, CALCULÉE COMME LE FERONT LES FORMULES
// ─────────────────────────────────────────────────────────────────────────
//
// Ces fonctions sont la traduction, ligne pour ligne, des formules écrites
// plus bas. Elles donnent la valeur en cache de chaque cellule calculée.

const participation = (compte) => compteParLibelle.get(compte)?.participation ?? 1;
const aNature = (type, n) => (typeParLibelle.get(type)?.natures ?? []).includes(n);

const lignes = transactions.map((t) => {
  const taux = participation(t.compte);
  const montantBrut = arrondir(t.montant / taux);
  const montant = arrondir(montantBrut * taux);
  if (montant !== t.montant) {
    echouer(`${t.date} ${t.compte} : ${t.montant} ne se retrouve pas depuis le brut (${montant}).`);
  }
  const type = typeParLibelle.get(t.type);
  const sens = t.dc;
  const classe = sens === "Crédit" ? "" : type.classe;
  const categorie = type.categorie;
  if (classe !== t.cat1 || categorie !== t.cat2) {
    echouer(`${t.date} ${t.type} : classe/catégorie « ${classe}/${categorie} » ≠ démo « ${t.cat1}/${t.cat2} ».`);
  }
  const compte = compteParLibelle.get(t.compte);
  const rembourse = sens === "Crédit" && (type.classe !== "" || aNature(t.type, "remboursement")) ? 1 : 0;
  // Comme l'application (filtrerDonnees) : un transfert interne n'est ni une
  // dépense ni une recette — il déplace de l'argent entre vos comptes.
  const transfert = aNature(t.type, "transfert-interne");
  const depense = transfert ? 0 : sens === "Débit" ? montant : rembourse ? -montant : 0;
  const effet = sens === "Crédit" ? montant : -montant;
  const lie = compte?.compteLie ? libelleDe.get(compte.compteLie) : "";
  let effetLie = 0;
  if (lie && !aNature(t.type, "apport-exterieur")) {
    const dcRep = rembourse ? "Débit" : sens;
    const mRep = rembourse ? -montant : montant;
    const sensLie = compte.sensRepercute ?? "";
    if (sensLie === "Les deux" || sensLie === dcRep) effetLie = arrondir(-mRep);
  }
  const sortieEpargne = aNature(t.type, "sortie-epargne") ? montant : 0;
  return {
    ...t, montantBrut, montant, sens, classe, categorie, compte: t.compte,
    compte1: 1, rembourse, transfert, depense, effet, lie, effetLie, sortieEpargne,
  };
});

// ─────────────────────────────────────────────────────────────────────────
// 4. LE CLASSEUR
// ─────────────────────────────────────────────────────────────────────────

const wb = new ExcelJS.Workbook();
const FIGEE = new Date(Date.UTC(2026, 0, 1));
wb.creator = "Dashboard Budget — démonstration";
wb.lastModifiedBy = "Dashboard Budget — démonstration";
wb.created = FIGEE;
wb.modified = FIGEE;
wb.lastPrinted = FIGEE;
wb.title = "Budget — modèle de fichier source";
// Excel recalcule tout à l'ouverture : les caches écrits ici servent au
// lecteur de l'application et aux aperçus, Excel refait le reste.
wb.calcProperties = { fullCalcOnLoad: true };

// Lignes de Transactions préparées (formules, listes). F.6 : 2 000 ne
// suffisaient pas — un vrai fichier de deux ans en comptait déjà 1 999.
const DERNIERE = 5000;
const F = "'Paramètres'";
const TX = (col) => `Transactions!$${col}$2:$${col}$${DERNIERE}`;

// H.1 — deux couleurs franches (décision Q1 du lot H) : celles de la V6 pour
// les en-têtes et les cellules calculées, jaune pâle pour les cellules à
// remplir (la V6 n'en avait pas). Une cellule à remplir est DÉVERROUILLÉE,
// une cellule calculée VERROUILLÉE : le verrou n'agit qu'avec la protection
// de la feuille (H.5). `modeleCouleurs.test.ts` vérifie la règle.
const plein = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const COULEURS = {
  saisie: "FFFFF2CC", calcul: "FFF2F2F2",
  enteteSaisie: "FF1F3864", enteteCalcul: "FF7F7F7F",
};
const A_REMPLIR = plein(COULEURS.saisie);
const CALCULE = plein(COULEURS.calcul);
const BLEU = plein(COULEURS.enteteSaisie); // en-tête d'une colonne à remplir
const GRIS = plein(COULEURS.enteteCalcul); // en-tête d'une colonne calculée
const GRAS = { bold: true };
const ENTETE = { bold: true, color: { argb: "FFFFFFFF" } };
const CENTRE = { horizontal: "center" };
const OUVERT = { locked: false };
const FERME = { locked: true };
const POLICE = { name: "Arial", size: 11 }; // H.4 — la police de la V6
const saisir = (c) => { c.fill = A_REMPLIR; c.protection = OUVERT; c.font = { ...POLICE, ...(c.font ?? {}) }; return c; };
const calculer = (c) => { c.fill = CALCULE; c.protection = FERME; return c; };
/** Couleur et verrou posés sur la colonne entière : les cellules vides les
 *  portent aussi, sans être écrites une à une. */
const colonneSaisie = (ws, n) => { const c = ws.getColumn(n); c.fill = A_REMPLIR; c.protection = OUVERT; c.font = POLICE; };
const colonneCalcul = (ws, n) => { const c = ws.getColumn(n); c.fill = CALCULE; c.protection = FERME; c.font = POLICE; };

// Tailles des tableaux de Paramètres : jusqu'où vont les listes, et donc
// jusqu'où la saisie est préparée.
const P_REGLAGES = 40; // la place d'ajouter une ligne (prêt, ancienne forme…)
const P_COMPTES = 40;
const P_TYPES = 120;
const P_CATEGORIES = 40;
const P_EMPLOYEURS = 40;
// H.3 — les tableaux de Paramètres commencent en ligne PE : au-dessus, chaque
// tableau a son encadré « comment remplir ». Le lecteur retrouve un tableau
// par sa cellule d'en-tête, où qu'elle soit, et ne lit jamais au-dessus.
// Toute référence à une ligne de Paramètres passe par PE : ligne i (0 = la
// première ligne de données) = PL(i).
const PE = 9;
const PL = (i) => PE + 1 + i;
const EUROS = '#,##0.00 "€"';
const DATE = "dd/mm/yyyy";
const MOIS = "mmmm yyyy";

// ─────────────────────────────────────────────────────────────────────────
// H.2 — listes déroulantes et validations
// ─────────────────────────────────────────────────────────────────────────
//
// Une liste là où la valeur se choisit ; une validation là où elle se tape
// (date, montant). Chaque refus parle français et dit quoi faire. Style
// « arrêt » par défaut ; « avertissement » là où le format accepte une valeur
// hors liste (une catégorie non déclarée, un triplet de natures) : Excel
// prévient, le lecteur de l'application juge (décision Q2).
const valider = (ws, plage, regle, titre, message, style = "stop") =>
  ws.dataValidations.add(plage, {
    allowBlank: true, showErrorMessage: true, errorStyle: style,
    errorTitle: titre, error: message, ...regle,
  });
const LISTE = (source) => ({ type: "list", formulae: [source] });
// ⚠️ Mesuré dans Excel (H.2) : une liste tirée d'une plage qui contient des
// cases vides accepte N'IMPORTE QUELLE valeur (« Compte fantôme » passait).
// La liste s'arrête donc à la dernière case remplie : OFFSET + COUNTA. Une
// case vide AU MILIEU du tableau la raccourcirait — le guide le dit.
const LISTE_TABLEAU = (feuille, col, n) =>
  LISTE(`OFFSET(${feuille}!$${col}$${PL(0)},0,0,MAX(1,COUNTA(${feuille}!$${col}$${PL(0)}:$${col}$${PL(n - 1)})),1)`);
const PLUS_QUE_ZERO = { type: "decimal", operator: "greaterThan", formulae: [0] };
const ZERO_OU_PLUS = { type: "decimal", operator: "greaterThanOrEqual", formulae: [0] };
const UN_NOMBRE = { type: "decimal", operator: "between", formulae: [-1e9, 1e9] };
// Dates plausibles : du 01/01/2000 au 31/12/2099. ⚠️ Mesuré dans Excel
// (H.2) : exceljs attend des objets Date — un numéro de série était lu comme
// des millisecondes, et Excel refusait toutes les dates de la démo.
const DATE_PLAUSIBLE = {
  type: "date", operator: "between",
  formulae: [new Date(Date.UTC(2000, 0, 1)), new Date(Date.UTC(2099, 11, 31))],
};
const MSG_DATE = "Une date entre 2000 et 2099, par exemple 14/03/2026.";

// Les natures, dans un ordre fixe qui garde les couples de la démonstration
// tels quels. Le lecteur ne tient pas compte de l'ordre. Le test
// `modeleValidations.test.ts` compare cette liste à `src/config/vocabulaire.ts`.
const NATURES = [
  "epargne", "transfert-interne", "sortie-epargne", "apport-exterieur",
  "pret-capital", "pret-interets", "remboursement",
];
const INCOMPATIBLES = [
  ["epargne", "sortie-epargne"], ["apport-exterieur", "transfert-interne"], ["pret-capital", "pret-interets"],
];
const compatibles = (a, b) => !INCOMPATIBLES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const LISTE_NATURES = [
  ...NATURES,
  ...NATURES.flatMap((a, i) => NATURES.slice(i + 1).filter((b) => compatibles(a, b)).map((b) => `${a}, ${b}`)),
];
const CLASSES = ["Dépense Fixe", "Dépense Courante", "Dépense Occasionnelle"];
const ordreNatures = (natures) => [...natures].sort((a, b) => NATURES.indexOf(a) - NATURES.indexOf(b));

/** Numéro de série Excel d'une date ISO, sans fuseau. */
const serie = (iso) => {
  const [a, m, j] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, j) / 86400000 + 25569;
};
const dateUTC = (iso) => {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
};

const enTete = (ws, valeurs, remplissage) => {
  const r = ws.getRow(1);
  valeurs.forEach((v, i) => {
    const c = r.getCell(i + 1);
    c.value = v;
    c.font = GRAS;
    c.protection = FERME; // un en-tête renommé, et le lecteur ne trouve plus la colonne
    if (remplissage[i]) { c.fill = remplissage[i]; c.font = ENTETE; c.alignment = CENTRE; }
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
};

// H.3 — une note sur chaque en-tête : quoi écrire, un exemple, obligatoire
// ou non. Elle s'affiche au survol. Le lecteur de l'application ne lit pas
// les notes. `modeleConsignes.test.ts` vérifie qu'aucun en-tête n'en manque.
const CALC = "Calculé — n'écrivez rien. ";
const NOTES = {
  // Transactions, à remplir
  Date: "Obligatoire. La date du mouvement. Ex. : 14/03/2026.",
  Compte: "Obligatoire. Choisissez dans la liste : les comptes déclarés dans Paramètres. Ex. : Banque A - Courant.",
  Type: "Obligatoire. Choisissez dans la liste : les types déclarés dans Paramètres. Le type donne le sens, la classe et la catégorie.",
  "Montant brut": "Obligatoire. Le montant payé en entier, toujours positif. Ex. : 100. Sur un compte à 50 %, le Montant (colonne K) vaudra 50.",
  "Sens (si différent)": "Facultatif. Débit ou Crédit, seulement si la ligne fait exception au sens du type. Ex. : 15 € de courses remboursés → Crédit.",
  "Sous-catégorie": "Facultatif. Texte libre. Ex. : Boulangerie.",
  "Détail": "Facultatif. Texte libre.",
  "Libellé": "Facultatif. Le libellé du relevé. Ex. : Achat carte.",
  Ville: "Facultatif. Texte libre.",
  "Prévisionnel": "Facultatif. « x » pour une ligne prévue, pas encore passée. Elle compte dès que sa date atteint la Fin de relevé (Paramètres).",
  // Transactions, calculées
  Montant: CALC + "Montant brut × la participation du compte.",
  Sens: CALC + "Le sens du type, ou votre exception.",
  Classe: CALC + "La classe du type. Vide pour un crédit.",
  "Catégorie": CALC + "La catégorie du type.",
  "Compté": CALC + "1 si la ligne compte. Une ligne prévisionnelle attend la Fin de relevé.",
  Remboursement: CALC + "1 pour un crédit qui réduit une dépense.",
  "Dépense nette": CALC + "Les débits, moins les remboursements. 0 pour un transfert interne.",
  "Effet sur le compte": CALC + "+ pour un crédit, − pour un débit.",
  "Compte lié": CALC + "Le compte lié déclaré dans Paramètres.",
  "Effet sur le compte lié": CALC + "Ce qui est reporté sur le compte lié.",
  "Sortie d'épargne": CALC + "Le montant sorti d'un livret.",
  "N° dépense du mois": CALC + "Le rang de la ligne parmi les dépenses du mois choisi dans Visualisation (B1). Sert à la liste en bas de Visualisation.",
  // Paie
  Mois: "Obligatoire. Choisissez le mois dans la liste. Ex. : septembre 2026.",
  Employeur: "Obligatoire. Choisissez dans la liste : les employeurs déclarés dans Paramètres.",
  Brut: "Obligatoire. Le salaire brut du bulletin. Ex. : 3200.",
  "Cotisations salariales": "Obligatoire. Les cotisations retenues sur le brut. Ex. : 700.",
  "Indemnités": "Facultatif. Vide = 0.",
  "Autres retenues": "Facultatif. Vide = 0.",
  Net: CALC + "Brut − cotisations + indemnités − autres retenues.",
};
// Paramètres : mêmes noms parfois, autre sens. Une table à part.
const NOTES_PARAMETRES = {
  "Paramètre": "Le nom du réglage. Ne le modifiez pas.",
  Valeur: "La valeur du réglage. Voir l'encadré au-dessus.",
  Compte: "Obligatoire. Le nom du compte, écrit comme dans Transactions.",
  Organisme: "Facultatif. La banque ou l'établissement. Ex. : Banque A.",
  "Solde de départ": "Facultatif. Le solde à la date de Début de relevé. Vide = « non initialisé », jamais 0.",
  "Porte un solde": "Facultatif. oui ou non. Vide = oui.",
  "Compte lié": "Facultatif. Le compte d'où l'argent part vraiment. Ex. : un compte joint lié à votre compte courant.",
  "Sens répercuté": "Facultatif. Débit, Crédit ou Les deux : ce qui est reporté sur le compte lié.",
  Participation: "Facultatif. Votre part. Ex. : 50 %. Vide = 100 %.",
  Couleur: "Facultatif. #RRGGBB. Ex. : #2563eb. Vide = une couleur stable choisie pour vous.",
  Type: "Obligatoire. Le nom du type, écrit comme dans Transactions.",
  Nature: "Facultatif. Choisissez dans la liste. Vide pour une dépense ou une recette ordinaire.",
  "Classe par défaut": "Facultatif. Fixe, Courante ou Occasionnelle, pour une dépense.",
  "Sens par défaut": "Facultatif. Débit ou Crédit : le cas le plus fréquent pour ce type.",
  "Catégorie (budget)": "Facultatif. Le poste de budget. Choisissez dans la liste des catégories.",
  "Catégorie": "Obligatoire. Le nom du poste de budget. Ex. : Alimentation.",
  Employeur: "Obligatoire. Le nom de l'employeur, écrit comme dans Paie.",
};
/** Pose la note de chaque en-tête d'une ligne ; un en-tête sans note arrête le script. */
const noterEnTetes = (ws, ligne, table) => {
  ws.getRow(ligne).eachCell((c) => {
    if (typeof c.value !== "string" || !c.fill) return; // seulement les en-têtes peints
    if (c.value === "À remplir" || c.value.startsWith("Calculé —")) return; // la légende
    const note = table[c.value];
    if (!note) echouer(`${ws.name} : en-tête « ${c.value} » sans note.`);
    c.note = note;
  });
};

/** H.1 — la légende des deux couleurs. Posée sur la ligne 1, à droite des
 *  tableaux et après une colonne vide : le lecteur ignore une colonne
 *  inconnue, et un tableau de Paramètres s'arrête à la colonne vide. */
const legende = (ws, ligne, col) => {
  const t = ws.getCell(ligne, col);
  t.value = "Légende :";
  t.font = GRAS;
  saisir(ws.getCell(ligne, col + 1)).value = "À remplir";
  calculer(ws.getCell(ligne, col + 2)).value = "Calculé — n'écrivez rien";
  ws.getColumn(col).width = Math.max(ws.getColumn(col).width ?? 0, 11);
  ws.getColumn(col + 1).width = Math.max(ws.getColumn(col + 1).width ?? 0, 12);
  ws.getColumn(col + 2).width = Math.max(ws.getColumn(col + 2).width ?? 0, 26);
};

// ─────────────────────────────────────────────────────────────────────────
// 4.1 Lisez-moi
// ─────────────────────────────────────────────────────────────────────────

const LISEZ_MOI = [
  "Budget — modèle de fichier source",
  "",
  "Ce classeur est un EXEMPLE complet, rempli avec des données inventées. Remplacez-les par les vôtres.",
  "",
  "À remplir : les cellules jaune pâle, sous les en-têtes bleu nuit.",
  "Calculé : les cellules grises, sous les en-têtes gris. N'écrivez rien dedans.",
  "",
  "Par où commencer",
  "  1. Paramètres : vos comptes, vos types, vos catégories, vos dates de relevé.",
  "     Chaque tableau a son encadré « comment remplir », juste au-dessus.",
  "  2. Transactions : un mouvement par ligne, colonnes A à J. Les listes proposent vos comptes et vos types.",
  "  3. Paie (facultative) : un bulletin par mois.",
  "  4. Visualisation : choisissez un mois en B1. Tout suit vos Paramètres.",
  "     Soldes et recettes à gauche ; épargne et rapprochement bancaire au milieu ; dépenses par catégorie à droite.",
  "     En dessous, les dépenses du mois, ligne à ligne.",
  "",
  "Besoin d'aide sur une colonne ?",
  "  Passez la souris sur son en-tête : une note dit quoi écrire, avec un exemple, et si c'est obligatoire.",
  "  Une valeur refusée ? Le message d'Excel dit pourquoi, et quoi mettre à la place.",
  "",
  "Ce qui est verrouillé",
  "  Les cellules grises, sans mot de passe. Vous pouvez filtrer, élargir une colonne,",
  "  et trier Transactions et Paie par la flèche d'un en-tête bleu nuit.",
  "  Ne renommez jamais un en-tête : l'outil trouve les colonnes par leur nom.",
  "  Une colonne facultative renommée (Libellé, Ville, Prévisionnel…) serait ignorée sans message.",
  "  Pour tout ouvrir : onglet Révision, « Ôter la protection de la feuille ». Aucun mot de passe.",
  "  Pas de ligne vide au milieu d'un tableau de Paramètres : la liste perdrait sa dernière entrée.",
  "",
  "Trois règles",
  "  1. Un montant est toujours positif : c'est le Sens qui dit Débit ou Crédit.",
  "  2. Un montant illisible ne devient jamais 0 : la ligne est refusée, et l'outil vous le dit.",
  "  3. Une feuille dont le nom n'est pas reconnu est ignorée — celle-ci, par exemple.",
];
const wsLisez = wb.addWorksheet("Lisez-moi");
LISEZ_MOI.forEach((t, i) => {
  const c = wsLisez.getCell(i + 1, 1);
  c.value = t;
  if (i === 0 || /^[A-ZÉ]/.test(t)) c.font = GRAS;
  // H.1 — les deux lignes de légende portent leur propre couleur.
  if (t.startsWith("À remplir")) saisir(c);
  if (t.startsWith("Calculé")) calculer(c);
});
wsLisez.getColumn(1).width = 110;

// ─────────────────────────────────────────────────────────────────────────
// 4.2 Transactions — A à J saisies, K à U calculées
// ─────────────────────────────────────────────────────────────────────────

const wsTx = wb.addWorksheet("Transactions");
const SAISIES = [
  // H.3b — Libellé en 2e colonne, pour le confort de saisie. Le lecteur
  // trouve les colonnes par leur nom : l'ordre est libre.
  "Date", "Libellé", "Compte", "Type", "Montant brut",
  "Sens (si différent)", "Sous-catégorie", "Détail", "Ville", "Prévisionnel",
];
const CALCULEES = [
  "Montant", "Sens", "Classe", "Catégorie", "Compté", "Remboursement",
  "Dépense nette", "Effet sur le compte", "Compte lié", "Effet sur le compte lié",
  "Sortie d'épargne", "N° dépense du mois",
];
// H.1 — la couleur d'abord, sur la colonne entière ; l'en-tête ensuite, qui
// reprend la sienne.
SAISIES.forEach((_, i) => colonneSaisie(wsTx, i + 1));
CALCULEES.forEach((_, i) => colonneCalcul(wsTx, SAISIES.length + i + 1));
enTete(
  wsTx,
  [...SAISIES, ...CALCULEES],
  [...SAISIES.map(() => BLEU), ...CALCULEES.map(() => GRIS)]
);

// Les recherches communes, écrites une fois. `$D` = type, `$C` = compte.
const typeLigne = (r, col) =>
  `IFERROR(INDEX(${F}!$${col}:$${col},MATCH($D${r},${F}!$M:$M,0))&"","")`;
const compteLigne = (r, col) =>
  `IFERROR(INDEX(${F}!$${col}:$${col},MATCH($C${r},${F}!$D:$D,0))&"","")`;

/** Les onze formules d'une ligne. */
function formules(r) {
  const taux =
    `IF(ISNA(MATCH($C${r},${F}!$D:$D,0)),1,` +
    `IF(INDEX(${F}!$J:$J,MATCH($C${r},${F}!$D:$D,0))="",1,` +
    `INDEX(${F}!$J:$J,MATCH($C${r},${F}!$D:$D,0))))`;
  const nature = typeLigne(r, "N");
  return {
    K: `IF($E${r}="","",ROUND($E${r}*${taux},2))`,
    L: `IF($D${r}="","",IF($F${r}<>"",$F${r},IF(ISNA(MATCH($D${r},${F}!$M:$M,0)),"⚠ Type inconnu",${typeLigne(r, "P")})))`,
    M: `IF($D${r}="","",IF(ISNA(MATCH($D${r},${F}!$M:$M,0)),"⚠ Type inconnu",IF($L${r}="Crédit","",${typeLigne(r, "O")})))`,
    N: `IF($D${r}="","",${typeLigne(r, "Q")})`,
    O: `IF($A${r}="","",IF(OR($J${r}<>"x",$A${r}<=FinReleve),1,0))`,
    P: `IF($D${r}="","",IF(AND($L${r}="Crédit",OR(${typeLigne(r, "O")}<>"",ISNUMBER(SEARCH("remboursement",${nature})))),1,0))`,
    Q: `IF($K${r}="","",IF(ISNUMBER(SEARCH("transfert-interne",${nature})),0,IF($L${r}="Débit",$K${r},IF($P${r}=1,-$K${r},0))))`,
    R: `IF($K${r}="","",IF($L${r}="Crédit",$K${r},-$K${r}))`,
    S: `IF($C${r}="","",${compteLigne(r, "H")})`,
    T:
      `IF($K${r}="","",IF($S${r}="",0,IF(ISNUMBER(SEARCH("apport-exterieur",${nature})),0,` +
      `IF(OR(${compteLigne(r, "I")}="Les deux",${compteLigne(r, "I")}=IF($P${r}=1,"Débit",$L${r})),` +
      `-IF($P${r}=1,-$K${r},$K${r}),0))))`,
    U: `IF($K${r}="","",IF(ISNUMBER(SEARCH("sortie-epargne",${nature})),$K${r},0))`,
    // H.4 — le rang de la ligne parmi les dépenses du mois choisi dans
    // Visualisation. Un compteur ligne à ligne (MAX des lignes au-dessus + 1) :
    // pas de formule matricielle (mesuré au F.7 : Excel pour Mac les rend vides).
    V: `IF(AND($A${r}<>"",$O${r}=1,$L${r}="Débit",N($Q${r})>0,` +
      `$A${r}>=Visualisation!$B$1,$A${r}<Visualisation!$D$1),MAX($V$1:V${r - 1})+1,"")`,
  };
}

// H.4 — le mois affiché par défaut dans Visualisation (dernier mois complet
// de la démonstration), et le rang de chaque dépense de ce mois : c'est ce que
// la colonne V de Transactions calcule, et ce que liste la Visualisation.
const MOIS_DEFAUT = "2026-08-01";
const MOIS_FIN = "2026-09-01";
const rangDepense = new Map();
lignes.forEach((l, i) => {
  if (l.date >= MOIS_DEFAUT && l.date < MOIS_FIN && l.compte1 === 1 && l.sens === "Débit" && l.depense > 0) {
    rangDepense.set(i, rangDepense.size + 1);
  }
});

const COLS_CALC = ["K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"];
for (let r = 2; r <= DERNIERE; r++) {
  const l = lignes[r - 2];
  const row = wsTx.getRow(r);
  if (l) {
    row.getCell(1).value = dateUTC(l.date);
    row.getCell(2).value = l.label || null;
    row.getCell(3).value = l.compte;
    row.getCell(4).value = l.type;
    row.getCell(5).value = l.montantBrut;
    row.getCell(7).value = l.cat3 || null;
    row.getCell(8).value = l.cat4 || null;
    row.getCell(9).value = l.ville || null;
  }
  const f = formules(r);
  const cache = l
    ? {
        K: l.montant, L: l.sens, M: l.classe, N: l.categorie, O: 1, P: l.rembourse,
        Q: l.depense, R: l.effet, S: l.lie, T: l.effetLie, U: l.sortieEpargne,
        V: rangDepense.get(r - 2) ?? "",
      }
    : { K: "", L: "", M: "", N: "", O: "", P: "", Q: "", R: "", S: "", T: "", U: "", V: "" };
  COLS_CALC.forEach((col, i) => {
    row.getCell(11 + i).value = { formula: f[col], result: cache[col] };
  });
  row.getCell(1).numFmt = DATE;
  row.getCell(5).numFmt = EUROS;
  row.getCell(11).numFmt = EUROS;
}
[11, 28, 22, 20, 13, 12, 16, 16, 12, 12, 12, 12, 14, 12, 14, 10, 12, 14, 26, 16, 14, 12]
  .forEach((w, i) => { wsTx.getColumn(i + 1).width = w; });
// Colonne V vide, légende en W–Y.
legende(wsTx, 1, SAISIES.length + CALCULEES.length + 2);
noterEnTetes(wsTx, 1, NOTES);

// H.2 — une liste ou une validation sur chaque colonne à remplir, sauf le
// texte libre : Sous-catégorie, Détail, Libellé, Ville.
const TX_PLAGE = (col) => `${col}2:${col}${DERNIERE}`;
valider(wsTx, TX_PLAGE("A"), DATE_PLAUSIBLE, "Date", MSG_DATE);
valider(wsTx, TX_PLAGE("C"), LISTE_TABLEAU(F, "D", P_COMPTES), "Compte inconnu",
  "Choisissez un compte déclaré dans Paramètres, ou déclarez-le d'abord.");
valider(wsTx, TX_PLAGE("D"), LISTE_TABLEAU(F, "M", P_TYPES), "Type inconnu",
  "Choisissez un type déclaré dans Paramètres, ou déclarez-le d'abord.");
valider(wsTx, TX_PLAGE("E"), PLUS_QUE_ZERO, "Montant",
  "Un montant positif, sans signe : c'est le Sens qui dit Débit ou Crédit.");
valider(wsTx, TX_PLAGE("F"), LISTE('"Débit,Crédit"'), "Sens",
  "Débit ou Crédit, seulement si la ligne fait exception au sens du type. Sinon, laissez vide.");
valider(wsTx, TX_PLAGE("J"), LISTE('"x"'), "Prévisionnel",
  "Un « x » pour une ligne prévue, pas encore passée. Sinon, laissez vide.");

// ─────────────────────────────────────────────────────────────────────────
// 4.3 Paie — le net est calculé, comme le fait le lecteur
// ─────────────────────────────────────────────────────────────────────────

const wsPaie = wb.addWorksheet("Paie");
// H.1 — 300 bulletins préparés (25 ans) : la colonne Net porte sa formule sur
// chacun, vide tant que le brut est vide. Le lecteur compte ces lignes comme
// vides, comme celles de Transactions.
const PAIE_DERNIERE = 301;
for (let c = 1; c <= 6; c++) colonneSaisie(wsPaie, c);
colonneCalcul(wsPaie, 7);
enTete(
  wsPaie,
  ["Mois", "Employeur", "Brut", "Cotisations salariales", "Indemnités", "Autres retenues", "Net"],
  [BLEU, BLEU, BLEU, BLEU, BLEU, BLEU, GRIS]
);
if (salary.months.length > PAIE_DERNIERE - 1) echouer(`${salary.months.length} bulletins pour ${PAIE_DERNIERE - 1} lignes.`);
for (let r = 2; r <= PAIE_DERNIERE; r++) {
  const m = salary.months[r - 2];
  const row = wsPaie.getRow(r);
  let net = "";
  if (m) {
    net = arrondir(m.brut - m.cotSal + m.indem - m.retenues);
    if (net !== m.net) echouer(`paie ${m.mk} : net ${m.net} ≠ ${net} recalculé.`);
    // H.2 (Q5) — le mois s'écrit comme une date (le 1er), choisie dans une
    // liste ; le lecteur lit une date comme un mois AAAA-MM.
    row.values = [dateUTC(`${m.mk}-01`), m.entreprise, m.brut, m.cotSal, m.indem, m.retenues];
  }
  row.getCell(1).numFmt = MOIS;
  row.getCell(7).value = { formula: `IF(C${r}="","",ROUND(C${r}-D${r}+E${r}-F${r},2))`, result: net };
  for (let c = 3; c <= 7; c++) row.getCell(c).numFmt = EUROS;
}
[16, 22, 12, 22, 12, 16, 12].forEach((w, i) => { wsPaie.getColumn(i + 1).width = w; });
legende(wsPaie, 1, 9); // colonne H vide, légende en I–K
noterEnTetes(wsPaie, 1, NOTES);

const PAIE_PLAGE = (col) => `${col}2:${col}${PAIE_DERNIERE}`;
valider(wsPaie, PAIE_PLAGE("A"), LISTE("ListeMoisPaie"), "Mois",
  "Choisissez le mois dans la liste. Elle couvre les 10 ans qui finissent à la Fin de relevé (Paramètres).");
valider(wsPaie, PAIE_PLAGE("B"), LISTE_TABLEAU(F, "V", P_EMPLOYEURS), "Employeur non déclaré",
  "Cet employeur n'est pas dans le tableau Employeur de Paramètres. Il sera lu quand même ; déclarez-le pour le retrouver dans la liste.",
  "warning");
[["C", "Brut"], ["D", "Cotisations salariales"], ["E", "Indemnités"], ["F", "Autres retenues"]]
  .forEach(([col, nom]) => valider(wsPaie, PAIE_PLAGE(col), ZERO_OU_PLUS, nom,
    "Un montant positif ou nul, sans signe. Le Net se calcule : brut − cotisations + indemnités − autres retenues."));

// ─────────────────────────────────────────────────────────────────────────
// 4.4 Paramètres — cinq tableaux côte à côte, séparés par une colonne vide
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️ Les colonnes comptent : les formules de Transactions lisent D (compte),
// H (compte lié), I (sens répercuté), J (participation), M (type), N
// (nature), O (classe), P (sens), Q (catégorie). Le lecteur, lui, retrouve
// chaque tableau par sa cellule d'en-tête.

const wsParam = wb.addWorksheet("Paramètres");
const cell = (ws, adr, v, fmt) => {
  const c = ws.getCell(adr);
  c.value = v;
  if (fmt) c.numFmt = fmt;
  return c;
};

const sorties = libelleDe.get(P.compteCreditSortiesEpargne) ?? "";
const pret = config.pret;
const PARAMS = [
  ["Paramètre", "Valeur"],
  ["Version du format", 2.2],
  ["Début de relevé", dateUTC(config.couverture.debut), DATE],
  ["Fin de relevé", dateUTC(config.couverture.fin), DATE],
  ["Compte crédité par les sorties d'épargne", sorties],
  ["Prêt — montant", pret.montant, EUROS],
  ["Prêt — date de début", pret.date_debut],
  ["Prêt — taux annuel", pret.taux_annuel, "0.00%"],
  ["Prêt — durée (mois)", pret.echeances],
];
PARAMS.forEach(([k, v, fmt], i) => {
  cell(wsParam, `A${PE + i}`, k);
  cell(wsParam, `B${PE + i}`, v, fmt);
});
/** La ligne d'un réglage, par son nom. */
const ligneParam = (nom) => {
  const i = PARAMS.findIndex(([k]) => k === nom);
  if (i < 0) echouer(`réglage « ${nom} » introuvable.`);
  return PE + i;
};

const COMPTES_ENTETE = [
  "Compte", "Organisme", "Solde de départ", "Porte un solde",
  "Compte lié", "Sens répercuté", "Participation", "Couleur",
];
COMPTES_ENTETE.forEach((h, i) => { wsParam.getCell(PE, 4 + i).value = h; });
P.comptes.forEach((c, i) => {
  const r = PL(i);
  const v = [
    c.libelle, c.organisme ?? null, c.soldeDepart ?? null, c.porteUnSolde ? "oui" : "non",
    c.compteLie ? libelleDe.get(c.compteLie) : null, c.sensRepercute ?? null,
    c.participation ?? 1, c.couleur ?? null,
  ];
  v.forEach((x, j) => { wsParam.getCell(r, 4 + j).value = x; });
  wsParam.getCell(r, 6).numFmt = EUROS;
  wsParam.getCell(r, 10).numFmt = "0%";
});

["Type", "Nature", "Classe par défaut", "Sens par défaut", "Catégorie (budget)"]
  .forEach((h, i) => { wsParam.getCell(PE, 13 + i).value = h; });
TYPES.forEach((t, i) => {
  const r = PL(i);
  const natures = ordreNatures(t.natures).join(", ");
  // H.2 — la nature écrite doit figurer dans la liste proposée : un modèle qui
  // déclencherait son propre avertissement enseignerait à les ignorer.
  if (natures && !LISTE_NATURES.includes(natures)) echouer(`type « ${t.libelle} » : nature « ${natures} » hors liste.`);
  [t.libelle, natures || null, t.classe || null, t.sens || null, t.categorie || null]
    .forEach((x, j) => { wsParam.getCell(r, 13 + j).value = x; });
});

["Catégorie", "Couleur"].forEach((h, i) => { wsParam.getCell(PE, 19 + i).value = h; });
P.categories.forEach((c, i) => {
  wsParam.getCell(PL(i), 19).value = c.libelle;
  wsParam.getCell(PL(i), 20).value = c.couleur ?? null;
});

const EMPLOYEURS = [...new Set(salary.months.map((m) => m.entreprise))];
wsParam.getCell(PE, 22).value = "Employeur";
EMPLOYEURS.forEach((e, i) => { wsParam.getCell(PL(i), 22).value = e; });

for (let c = 1; c <= 22; c++) {
  const h = wsParam.getCell(PE, c);
  if (h.value) { h.font = ENTETE; h.fill = BLEU; h.protection = FERME; }
}
// H.1 — tout Paramètres est à remplir : chaque tableau, jusqu'au bout des
// plages que lisent les listes et la Visualisation. Les colonnes séparatrices
// (C, L, R, U) restent blanches : un tableau s'arrête à la colonne vide.
[[1, 2, P_REGLAGES], [4, 11, P_COMPTES], [13, 17, P_TYPES], [19, 20, P_CATEGORIES], [22, 22, P_EMPLOYEURS]]
  .forEach(([de, a, n]) => {
    for (let r = PL(0); r <= PL(n - 1); r++) for (let c = de; c <= a; c++) saisir(wsParam.getCell(r, c));
  });
[40, 16, 3, 32, 18, 16, 15, 32, 16, 13, 10, 3, 30, 30, 22, 15, 20, 3, 20, 10, 3, 22]
  .forEach((w, i) => { wsParam.getColumn(i + 1).width = w; });
legende(wsParam, PE, 24); // sur la ligne d'en-tête, colonne W vide, légende en X–Z
noterEnTetes(wsParam, PE, NOTES_PARAMETRES);

// H.2 — Paramètres. Texte libre : les noms (Paramètre, Compte, Organisme,
// Type, Catégorie, Employeur) ; ce sont eux qui nourrissent les listes.
const PAR_PLAGE = (col, n) => `${col}${PL(0)}:${col}${PL(n - 1)}`;
const MSG_COULEUR = "Une couleur au format #RRGGBB, par exemple #2563eb. Vide : une couleur stable est choisie pour vous.";
valider(wsParam, `B${ligneParam("Début de relevé")}:B${ligneParam("Fin de relevé")}`, DATE_PLAUSIBLE,
  "Date de relevé", MSG_DATE);
valider(wsParam, `B${ligneParam("Compte crédité par les sorties d'épargne")}`, LISTE_TABLEAU(F, "D", P_COMPTES), "Compte inconnu",
  "Choisissez un compte déclaré dans le tableau Compte, à droite.");
valider(wsParam, PAR_PLAGE("F", P_COMPTES), UN_NOMBRE, "Solde de départ",
  "Un nombre, sans texte. Vide : le compte reste « non initialisé », jamais 0.");
valider(wsParam, PAR_PLAGE("G", P_COMPTES), LISTE('"oui,non"'), "Porte un solde",
  "oui ou non. Vide : oui.");
valider(wsParam, PAR_PLAGE("H", P_COMPTES), LISTE_TABLEAU(F, "D", P_COMPTES), "Compte lié inconnu",
  "Choisissez un compte déclaré dans ce même tableau.");
valider(wsParam, PAR_PLAGE("I", P_COMPTES), LISTE('"Débit,Crédit,Les deux"'), "Sens répercuté",
  "Débit, Crédit ou Les deux : ce qui est reporté sur le compte lié.");
valider(wsParam, PAR_PLAGE("J", P_COMPTES), { type: "decimal", operator: "between", formulae: [0, 1] },
  "Participation", "Un taux entre 0 % et 100 %, par exemple 50 %. Vide : 100 %.");
valider(wsParam, PAR_PLAGE("K", P_COMPTES), { type: "custom", formulae: [`OR(K${PL(0)}="",AND(LEFT(K${PL(0)},1)="#",LEN(K${PL(0)})=7))`] },
  "Couleur", MSG_COULEUR);
valider(wsParam, PAR_PLAGE("N", P_TYPES), LISTE("ListeNatures"), "Nature hors liste",
  "Cette combinaison n'est pas dans la liste. L'import la vérifiera : une nature inconnue ou un couple contradictoire y sera refusé, avec la raison.",
  "warning");
valider(wsParam, PAR_PLAGE("O", P_TYPES), LISTE(`"${CLASSES.join(",")}"`), "Classe",
  "Dépense Fixe, Dépense Courante ou Dépense Occasionnelle. Vide pour un type qui n'est pas une dépense.");
valider(wsParam, PAR_PLAGE("P", P_TYPES), LISTE('"Débit,Crédit"'), "Sens par défaut",
  "Débit ou Crédit : le sens de ce type dans la plupart des lignes.");
valider(wsParam, PAR_PLAGE("Q", P_TYPES), LISTE_TABLEAU(F, "S", P_CATEGORIES), "Catégorie non déclarée",
  "Cette catégorie n'est pas dans le tableau Catégorie. Elle fonctionnera, avec une couleur choisie pour vous.",
  "warning");
valider(wsParam, PAR_PLAGE("T", P_CATEGORIES), { type: "custom", formulae: [`OR(T${PL(0)}="",AND(LEFT(T${PL(0)},1)="#",LEN(T${PL(0)})=7))`] },
  "Couleur", MSG_COULEUR);

// H.3 — un encadré « comment remplir » au-dessus de chaque tableau (décision
// du 25/09 : au-dessus plutôt qu'à droite, faute de place). Lignes 1 à PE-2,
// une ligne vide, puis l'en-tête. Le lecteur ne lit jamais au-dessus d'un
// en-tête ; et aucune ligne de l'encadré n'est un nom d'en-tête.
const BANDEAU = plein("FFD9E1F2"); // le bleu pâle des bandeaux de la V6
const encadre = (ws, de, a, titre, lignes) => {
  ws.mergeCells(1, de, 1, a);
  const t = ws.getCell(1, de);
  t.value = titre;
  t.font = GRAS;
  t.fill = BANDEAU;
  ws.mergeCells(2, de, PE - 2, a);
  const c = ws.getCell(2, de);
  c.value = lignes.join("\n");
  c.fill = BANDEAU;
  c.alignment = { wrapText: true, vertical: "top" };
};
for (let r = 2; r <= PE - 2; r++) wsParam.getRow(r).height = 20;
encadre(wsParam, 1, 2, "RÉGLAGES — comment remplir", [
  "Une ligne par réglage : le nom en A, la valeur en B. Ne changez pas les noms.",
  "Début et Fin de relevé : les dates que couvre votre fichier.",
  "Prêt : les 4 lignes ensemble, ou aucune. Date de début au format AAAA-MM.",
  "Une ligne vide ou une valeur illisible n'est jamais remplacée par défaut : l'import le dit.",
]);
encadre(wsParam, 4, 11, "COMPTES — comment remplir", [
  "Un compte par ligne, écrit comme dans Transactions. Seule la colonne Compte est obligatoire.",
  "Solde de départ : le solde à la date de Début de relevé. Vide = « non initialisé », jamais 0.",
  "Porte un solde : « non » pour un compte suivi sans solde (titres-restaurant, compte de passage).",
  "Compte lié + Sens répercuté : le compte d'où l'argent part vraiment (compte joint, carte).",
  "Participation : votre part, par exemple 50 % pour un compte à deux. Vide = 100 %.",
  "Pas de ligne vide au milieu du tableau : la liste des comptes s'arrêterait là.",
]);
encadre(wsParam, 13, 17, "TYPES — comment remplir", [
  "Un type par ligne, écrit comme dans Transactions.",
  "Nature : ce que le mouvement fait aux calculs (épargne, transfert, prêt…). Vide pour une dépense ou une recette ordinaire.",
  "Classe : Fixe, Courante ou Occasionnelle, pour une dépense.",
  "Sens : Débit ou Crédit, le cas le plus fréquent. Catégorie : le poste de budget.",
  "Pas de ligne vide au milieu du tableau : la liste des types s'arrêterait là.",
]);
encadre(wsParam, 19, 22, "CATÉGORIES et EMPLOYEURS", [
  "Catégorie : un poste de budget par ligne, avec sa couleur si vous voulez (#RRGGBB).",
  "Employeur : un par ligne, pour la liste de la feuille Paie.",
  "Pas de ligne vide au milieu.",
]);

// ─────────────────────────────────────────────────────────────────────────
// 4.5 Référentiel — la liste des mois de la Visualisation
// ─────────────────────────────────────────────────────────────────────────

const wsRef = wb.addWorksheet("Référentiel");
enTete(wsRef, ["Mois (liste)", "", "Ce que fait cette feuille"], [GRIS, null, null]);
const moisSuivant = (iso) => {
  const [a, m] = iso.split("-").map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
};
let mois = transactions.reduce((min, t) => (t.date < min ? t.date : min), "9999").slice(0, 7) + "-01";
const NB_MOIS = 60;
for (let i = 0; i < NB_MOIS; i++) {
  const r = i + 2;
  const f = i === 0
    ? `DATE(YEAR(MIN(${TX("A")})),MONTH(MIN(${TX("A")})),1)`
    : `EDATE(A${r - 1},1)`;
  wsRef.getCell(r, 1).value = { formula: f, result: dateUTC(mois) };
  wsRef.getCell(r, 1).numFmt = "mmmm yyyy";
  mois = moisSuivant(mois);
}
// H.2 (Q5) — colonne B : les mois proposés dans Paie. 120 mois (10 ans) qui
// finissent au mois de la Fin de relevé. Sans Fin de relevé, la liste est
// VIDE : le fichier ne devine pas une date à votre place.
const NB_MOIS_PAIE = 120;
const moisDecale = (iso, n) => {
  const [a, m] = iso.split("-").map(Number);
  const k = a * 12 + (m - 1) + n;
  return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}-01`;
};
wsRef.getCell("B1").value = "Mois de paie (liste)";
wsRef.getCell("B1").font = ENTETE;
wsRef.getCell("B1").fill = GRIS;
wsRef.getCell("B1").alignment = CENTRE;
const premierMoisPaie = moisDecale(config.couverture.fin, -(NB_MOIS_PAIE - 1));
for (let i = 0; i < NB_MOIS_PAIE; i++) {
  const r = i + 2;
  const f = i === 0
    ? `IF(FinReleve="","",EDATE(DATE(YEAR(FinReleve),MONTH(FinReleve),1),-${NB_MOIS_PAIE - 1}))`
    : `IF(B${r - 1}="","",EDATE(B${r - 1},1))`;
  wsRef.getCell(r, 2).value = { formula: f, result: dateUTC(moisDecale(premierMoisPaie, i)) };
  wsRef.getCell(r, 2).numFmt = MOIS;
}
for (const m of salary.months) {
  const k = moisDecale(`${m.mk}-01`, 0);
  if (k < premierMoisPaie || k > moisDecale(config.couverture.fin, 0)) echouer(`paie ${m.mk} hors de la liste des mois de paie.`);
}

// H.2 (Q2) — colonne M : les natures proposées dans Paramètres. Les 7 seules,
// et les 18 couples que le lecteur accepte ; jamais les 3 couples refusés.
wsRef.getCell("M1").value = "Natures (liste)";
wsRef.getCell("M1").font = ENTETE;
wsRef.getCell("M1").fill = GRIS;
LISTE_NATURES.forEach((n, i) => { wsRef.getCell(i + 2, 13).value = n; });
wsRef.getColumn(13).width = 36;

[
  "La colonne A liste les mois proposés en tête de la feuille Visualisation.",
  "Elle part du premier mois de vos transactions. Rien à saisir ici.",
  "La colonne B liste les mois proposés dans Paie : 10 ans, jusqu'à la Fin de relevé (Paramètres).",
  "La colonne M liste les natures proposées dans Paramètres, seules ou par deux.",
  "Les types (sens, classe, catégorie) se déclarent dans Paramètres, en une seule table.",
].forEach((t, i) => { wsRef.getCell(i + 2, 3).value = t; });
// H.3 — ce texte devient l'encadré de la feuille, du même bleu que ceux de
// Paramètres. Référentiel n'est pas lu par l'application.
for (let r = 1; r <= 6; r++) wsRef.getCell(r, 3).fill = BANDEAU;
wsRef.getCell("C1").value = "Ce que fait cette feuille — rien à remplir ici";
wsRef.getColumn(1).width = 16;
wsRef.getColumn(2).width = 20;
wsRef.getColumn(3).width = 90;
legende(wsRef, 1, 9); // après les colonnes de rangs (E–G), légende en I–K

// ─────────────────────────────────────────────────────────────────────────
// 4.6 Les noms
// ─────────────────────────────────────────────────────────────────────────

wb.definedNames.add(`${F}!$D$${PL(0)}:$D$${PL(P_COMPTES - 1)}`, "ListeComptes");
wb.definedNames.add(`${F}!$M$${PL(0)}:$M$${PL(P_TYPES - 1)}`, "ListeTypes");
wb.definedNames.add(`'Référentiel'!$B$2:$B$${NB_MOIS_PAIE + 1}`, "ListeMoisPaie");
wb.definedNames.add(`'Référentiel'!$M$2:$M$${LISTE_NATURES.length + 1}`, "ListeNatures");
wb.definedNames.add(`'Référentiel'!$A$2:$A$${NB_MOIS + 1}`, "ListeMois");
wb.definedNames.add(`${F}!$B$${ligneParam("Fin de relevé")}`, "FinReleve");
wb.definedNames.add(`${F}!$B$${ligneParam("Compte crédité par les sorties d'épargne")}`, "CompteSorties");

// ─────────────────────────────────────────────────────────────────────────
// 4.7 Visualisation — le mois choisi, calculé avec les mêmes règles que l'app
// ─────────────────────────────────────────────────────────────────────────
//
// Rien n'y est écrit en dur : ni solde de départ, ni nom de compte dans une
// formule. Les soldes lisent `Paramètres` ; les remboursements, les comptes
// liés et les sorties d'épargne passent par les colonnes calculées de
// Transactions (P à U), qui suivent les règles de l'application (F11, F12).

const wsViz = wb.addWorksheet("Visualisation");
if (MOIS_FIN !== moisSuivant(MOIS_DEFAUT)) echouer("MOIS_FIN ne suit pas MOIS_DEFAUT.");

cell(wsViz, "A1", "Mois").font = GRAS;
const b1 = cell(wsViz, "B1", dateUTC(MOIS_DEFAUT), "mmmm yyyy");
saisir(b1);
b1.font = { bold: true, color: { argb: "FFC0392B" } }; // V6 : gras, rouge
legende(wsViz, 2, 1); // ligne 2, libre : les blocs commencent en ligne 3
cell(wsViz, "C1", "jusqu'au");
wsViz.getCell("D1").value = { formula: "EDATE($B$1,1)", result: dateUTC(MOIS_FIN) };
wsViz.getCell("D1").numFmt = DATE;
cell(wsViz, "E1", "(exclu) ← choisissez le mois dans la liste de la cellule B1").font =
  { italic: true, color: { argb: "FF808080" } }; // V6 : l'aide en italique gris
valider(wsViz, "B1", LISTE("ListeMois"), "Mois",
  "Choisissez le mois dans la liste : elle part du premier mois de vos transactions.");

const DANS_MOIS = `${TX("A")},">="&$B$1,${TX("A")},"<"&$D$1,${TX("O")},1`;
const dansMois = (l) => l.date >= MOIS_DEFAUT && l.date < MOIS_FIN && l.compte1 === 1;
const somme = (pred, f) => arrondir(lignes.filter(pred).reduce((s, l) => s + f(l), 0));

// H.4 — la disposition de la V6 (décision Q4 du lot H) : trois colonnes de
// blocs en haut, la liste des dépenses du mois en dessous.
//   A–C : soldes, puis recettes       E–I : épargne, puis rapprochement
//   K–M : dépenses par catégorie      A–F, sous les blocs : les dépenses du mois
// Chaque bloc a son origine (ligne, colonne). Ses formules ne connaissent que
// des colonnes RELATIVES : X(0) le libellé, X(1) la 1re valeur, X(2)…
const lettre = (n) => {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
let r = 3;
let c0 = 1;
const X = (k) => lettre(c0 + k);
const bloc = (ligne, col) => { r = ligne; c0 = col; };
const titre = (textes) => {
  textes.forEach((t, i) => {
    const c = wsViz.getCell(r, c0 + i);
    c.value = t;
    c.font = ENTETE;
    c.fill = GRIS;
  });
  r++;
};
const ligneCalc = (libelle, cellules) => {
  if (libelle !== null) wsViz.getCell(r, c0).value = libelle;
  cellules.forEach(([formule, valeur, fmt], i) => {
    const c = wsViz.getCell(r, c0 + 1 + i);
    c.value = { formula: formule, result: valeur };
    c.numFmt = fmt ?? EUROS;
  });
  return r++;
};
/** La ligne qu'on vient d'écrire passe en gras (un total). */
const enGras = () => {
  for (let k = 0; k < 3; k++) {
    const c = wsViz.getCell(r - 1, c0 + k);
    if (c.value !== null && c.value !== undefined) c.font = GRAS;
  }
};

// ── Des lignes qui suivent Paramètres ──────────────────────────────────
// F.7 — les libellés ne sont pas écrits par ce script : ils sont LUS dans
// Paramètres, par formule. Ajoutez un compte, un type ou une catégorie dans
// Paramètres, et la Visualisation le montre sans rien toucher d'autre. Chaque
// tableau a un nombre fixe d'emplacements ; les emplacements vides restent
// vides. Une ligne « Autres » ramasse ce qu'aucun emplacement ne montre (type
// ou catégorie non déclarés) : le total reste juste.

const SLOTS = { comptes: 12, recettes: 12, categories: 25, epargne: 10 };
const PLAGE = (col, n) => `${F}!$${col}$${PL(0)}:$${col}$${PL(n - 1)}`;
// P_COMPTES, P_TYPES, P_CATEGORIES : définis en tête (H.1).

// Le rang de chaque ligne retenue est calculé dans `Référentiel` (colonnes E
// à G), une cellule par ligne de Paramètres, sans formule matricielle : une
// formule matricielle écrite par un script est lue différemment selon la
// version d'Excel (mesuré : Excel pour Mac la rendait vide). Un compteur ligne
// à ligne se lit partout pareil.
const REF = "'Référentiel'";
const RANGS = {
  comptes: ["E", "(calcul) rang compte à solde", P_COMPTES,
    (r) => `AND(${F}!D${r}<>"",${F}!G${r}<>"non")`],
  recettes: ["F", "(calcul) rang type de recette", P_TYPES,
    (r) => `AND(${F}!M${r}<>"",${F}!P${r}="Crédit",ISERROR(SEARCH("transfert-interne",${F}!N${r})))`],
  epargne: ["G", "(calcul) rang type d'épargne", P_TYPES,
    (r) => `AND(${F}!M${r}<>"",ISNUMBER(SEARCH(",epargne,",","&SUBSTITUTE(${F}!N${r}," ","")&",")))`],
};
/** Écrit une colonne de rangs ; en cache, le rang de chaque ligne retenue. */
const ecrireRangs = ([col, entete, n, cond], tous, retenus) => {
  wsRef.getCell(`${col}1`).value = entete;
  wsRef.getCell(`${col}1`).font = ENTETE;
  wsRef.getCell(`${col}1`).fill = GRIS;
  for (let i = 0; i < n; i++) {
    const r = i + 2;
    const rang = tous[i] === undefined ? -1 : retenus.indexOf(tous[i]);
    // Ligne r de Référentiel ↔ ligne PL(i) de Paramètres (H.3 : décalées).
    wsRef.getCell(`${col}${r}`).value = {
      formula: `IF(${cond(PL(i))},MAX(${col}$1:${col}${r - 1})+1,"")`,
      result: rang >= 0 ? rang + 1 : "",
    };
  }
  wsRef.getColumn(col).width = 16;
};
/** k-ième ligne retenue : son libellé, lu dans Paramètres par son rang. */
const kieme = ([colRang, , n], colParam, k) =>
  `IFERROR(INDEX(${PLAGE(colParam, n)},MATCH(${k},${REF}!$${colRang}$2:$${colRang}$${n + 1},0)),"")`;

const emplacements = (liste, n, quoi) => {
  if (liste.length > n) echouer(`${liste.length} ${quoi} pour ${n} emplacements.`);
  return Array.from({ length: n }, (_, i) => liste[i] ?? "");
};
const siVide = (ligne, formule) => `IF($${X(0)}${ligne}="","",${formule})`;
const libelleCalc = (formule, valeur) => {
  wsViz.getCell(r, c0).value = { formula: formule, result: valeur };
};

// ── Les soldes (A–C) ───────────────────────────────────────────────────
const soldeFormule = (ligne, critere) =>
  `IFERROR(INDEX(${F}!$F:$F,MATCH($${X(0)}${ligne},${F}!$D:$D,0))*1,0)` +
  `+SUMIFS(${TX("R")},${TX("C")},$${X(0)}${ligne},${TX("A")},${critere},${TX("O")},1)` +
  `+SUMIFS(${TX("T")},${TX("S")},$${X(0)}${ligne},${TX("A")},${critere},${TX("O")},1)` +
  `+IF($${X(0)}${ligne}=CompteSorties,SUMIFS(${TX("U")},${TX("A")},${critere},${TX("O")},1),0)`;
const soldeJS = (compte, pred) =>
  arrondir(
    (compteParLibelle.get(compte)?.soldeDepart ?? 0) +
    somme((l) => pred(l) && l.compte === compte, (l) => l.effet) +
    somme((l) => pred(l) && l.lie === compte, (l) => l.effetLie) +
    (compte === sorties ? somme(pred, (l) => l.sortieEpargne) : 0)
  );

bloc(3, 1);
titre(["Soldes des comptes", "Début du mois", "Fin du mois"]);
const avecSolde = P.comptes.filter((c) => c.porteUnSolde).map((c) => c.libelle);
ecrireRangs(RANGS.comptes, P.comptes.map((c) => c.libelle), avecSolde);
const premiereLigneSolde = r;
emplacements(avecSolde, SLOTS.comptes, "comptes à solde").forEach((compte, i) => {
  const ligne = r;
  libelleCalc(kieme(RANGS.comptes, "D", i + 1), compte);
  ligneCalc(null, [
    [siVide(ligne, soldeFormule(ligne, `"<"&$B$1`)),
      compte ? soldeJS(compte, (l) => l.compte1 === 1 && l.date < MOIS_DEFAUT) : ""],
    [siVide(ligne, soldeFormule(ligne, `"<"&$D$1`)),
      compte ? soldeJS(compte, (l) => l.compte1 === 1 && l.date < MOIS_FIN) : ""],
  ]);
});
const derniereLigneSolde = r - 1;
const totalSoldes = (col) =>
  arrondir(avecSolde.reduce((s, c) => s + soldeJS(c, (l) => l.compte1 === 1 && l.date < col), 0));
ligneCalc("Total", [
  [`SUM(${X(1)}${premiereLigneSolde}:${X(1)}${derniereLigneSolde})`, totalSoldes(MOIS_DEFAUT)],
  [`SUM(${X(2)}${premiereLigneSolde}:${X(2)}${derniereLigneSolde})`, totalSoldes(MOIS_FIN)],
]);
enGras();
r++;

// ── Les recettes (A–C, sous les soldes) ────────────────────────────────
// Les transferts internes n'en sont pas : ils déplacent de l'argent entre vos
// comptes (même règle que l'application). Le total ne dépend pas des
// emplacements : tout crédit du mois, ni remboursement ni transfert interne.
titre(["Recettes du mois", "Montant"]);
const debutRecettes = r;
const typesRecette = TYPES.filter((x) => x.sens === "Crédit" && !x.natures.includes("transfert-interne"));
ecrireRangs(RANGS.recettes, TYPES.map((x) => x.libelle), typesRecette.map((x) => x.libelle));
emplacements(typesRecette.map((t) => t.libelle), SLOTS.recettes, "types de recette").forEach((type, i) => {
  const ligne = r;
  libelleCalc(kieme(RANGS.recettes, "M", i + 1), type);
  ligneCalc(null, [[
    siVide(ligne, `SUMIFS(${TX("K")},${TX("D")},$${X(0)}${ligne},${TX("L")},"Crédit",${TX("P")},0,${DANS_MOIS})`),
    type
      ? somme((l) => dansMois(l) && l.type === type && l.sens === "Crédit" && l.rembourse === 0, (l) => l.montant)
      : "",
  ]]);
});
const finRecettes = r - 1;
const estRecette = (l) => dansMois(l) && l.sens === "Crédit" && l.rembourse === 0 && !l.transfert;
const totalRecettes = somme(estRecette, (l) => l.montant);
const ligneTotalRecettes = r + 1;
ligneCalc("Autres recettes (type non listé)", [[
  `ROUND(${X(1)}${ligneTotalRecettes}-SUM(${X(1)}${debutRecettes}:${X(1)}${finRecettes}),2)`,
  arrondir(totalRecettes - somme((l) => estRecette(l) && typesRecette.some((t) => t.libelle === l.type), (l) => l.montant)),
]]);
if (r !== ligneTotalRecettes) echouer("la ligne du total des recettes n'est pas où « Autres » la cherche.");
ligneCalc("Total des recettes", [[
  `SUMPRODUCT((${TX("L")}="Crédit")*(${TX("P")}=0)*(${TX("O")}=1)*(${TX("A")}>=$B$1)*(${TX("A")}<$D$1)` +
    `*(COUNTIFS(${PLAGE("M", P_TYPES)},${TX("D")},${PLAGE("N", P_TYPES)},"*transfert-interne*")=0),${TX("K")})`,
  totalRecettes,
]]);
enGras();
const finGauche = r;

// ── L'épargne (E–F) ────────────────────────────────────────────────────
bloc(3, 5);
titre(["Épargne du mois", "Montant"]);
const debutEpargne = r;
const typesEpargne = TYPES.filter((t) => t.natures.includes("epargne"));
ecrireRangs(RANGS.epargne, TYPES.map((x) => x.libelle), typesEpargne.map((x) => x.libelle));
emplacements(typesEpargne.map((t) => t.libelle), SLOTS.epargne, "types d'épargne").forEach((type, i) => {
  const ligne = r;
  libelleCalc(kieme(RANGS.epargne, "M", i + 1), type);
  ligneCalc(null, [[
    siVide(ligne, `SUMIFS(${TX("K")},${TX("D")},$${X(0)}${ligne},${TX("L")},"Débit",${DANS_MOIS})`),
    type ? somme((l) => dansMois(l) && l.type === type && l.sens === "Débit", (l) => l.montant) : "",
  ]]);
});
ligneCalc("Total épargné", [[
  `SUM(${X(1)}${debutEpargne}:${X(1)}${r - 1})`,
  somme((l) => dansMois(l) && l.sens === "Débit" &&
    typesEpargne.some((t) => t.libelle === l.type), (l) => l.montant),
]]);
enGras();
r++;

// ── Le rapprochement bancaire (E–I, sous l'épargne) ────────────────────
// Vous saisissez le solde lu sur le relevé et sa date ; le fichier donne le
// solde qu'il calcule à cette date, et l'écart.
titre(["Rapprochement bancaire — compte", "Date du relevé", "Solde lu sur le relevé", "Solde calculé", "Écart"]);
for (let i = 0; i < 3; i++) {
  const ligne = r;
  const rapproche = soldeFormule(ligne, `"<="&$${X(1)}${ligne}`);
  saisir(wsViz.getCell(ligne, c0));
  saisir(wsViz.getCell(ligne, c0 + 1));
  wsViz.getCell(ligne, c0 + 1).numFmt = DATE;
  saisir(wsViz.getCell(ligne, c0 + 2));
  wsViz.getCell(ligne, c0 + 2).numFmt = EUROS;
  wsViz.getCell(ligne, c0 + 3).value = {
    formula: `IF(OR($${X(0)}${ligne}="",$${X(1)}${ligne}=""),"",${rapproche})`, result: "",
  };
  wsViz.getCell(ligne, c0 + 3).numFmt = EUROS;
  wsViz.getCell(ligne, c0 + 4).value = {
    formula: `IF(OR($${X(2)}${ligne}="",$${X(3)}${ligne}=""),"",ROUND($${X(2)}${ligne}-$${X(3)}${ligne},2))`, result: "",
  };
  wsViz.getCell(ligne, c0 + 4).numFmt = EUROS;
  valider(wsViz, `${X(0)}${ligne}`, LISTE_TABLEAU(F, "D", P_COMPTES), "Compte inconnu",
    "Choisissez un compte déclaré dans Paramètres.");
  valider(wsViz, `${X(1)}${ligne}`, DATE_PLAUSIBLE, "Date du relevé", MSG_DATE);
  valider(wsViz, `${X(2)}${ligne}`, UN_NOMBRE, "Solde lu", "Le solde lu sur le relevé : un nombre, négatif s'il est débiteur.");
  r++;
}
const finMilieu = r;

// ── Les dépenses, par catégorie (K–M) ──────────────────────────────────
// « Dépense nette » (colonne Q) : les débits, moins les remboursements (F11).
bloc(3, 11);
titre(["Dépenses du mois par catégorie", "Montant", "%"]);
const totalDepenses = somme(dansMois, (l) => l.depense);
const debutDepenses = r;
const ligneTotalDepenses = debutDepenses + SLOTS.categories + 2;
const pourcent = (ligne, v) =>
  [`IF(${X(1)}${ligne}="","",IFERROR(${X(1)}${ligne}/$${X(1)}$${ligneTotalDepenses},0))`,
    v === "" ? "" : totalDepenses ? v / totalDepenses : 0, "0.0%"];
const categoriesDeclarees = P.categories.map((c) => c.libelle);
emplacements(categoriesDeclarees, SLOTS.categories, "catégories").forEach((cat, i) => {
  const ligne = r;
  const source = `${F}!$S$${PL(i)}`;
  libelleCalc(`IF(${source}="","",${source})`, cat);
  const v = cat ? somme((l) => dansMois(l) && l.categorie === cat, (l) => l.depense) : "";
  ligneCalc(null, [
    [siVide(ligne, `SUMIFS(${TX("Q")},${TX("N")},$${X(0)}${ligne},${DANS_MOIS})`), v],
    pourcent(ligne, v),
  ]);
});
const finCategories = r - 1;
{
  const ligne = r;
  const v = somme((l) => dansMois(l) && l.categorie === "", (l) => l.depense);
  ligneCalc("Sans catégorie", [[`SUMIFS(${TX("Q")},${TX("N")},"",${DANS_MOIS})`, v], pourcent(ligne, v)]);
}
{
  const ligne = r;
  const v = somme((l) => dansMois(l) && l.categorie !== "" && !categoriesDeclarees.includes(l.categorie), (l) => l.depense);
  ligneCalc("Autres catégories (non listées)", [
    [`ROUND(${X(1)}${ligneTotalDepenses}-SUM(${X(1)}${debutDepenses}:${X(1)}${finCategories})-${X(1)}${ligne - 1},2)`, v],
    pourcent(ligne, v),
  ]);
}
if (r !== ligneTotalDepenses) echouer("la ligne du total des dépenses n'est pas où les % la cherchent.");
ligneCalc("Total des dépenses", [
  [`SUMIFS(${TX("Q")},${DANS_MOIS})`, totalDepenses],
  [`IFERROR(${X(1)}${r}/$${X(1)}$${r},0)`, totalDepenses ? 1 : 0, "0.0%"],
]);
enGras();
const finDroite = r;

// ── Les dépenses du mois, ligne à ligne (A–F, sous les blocs) ──────────
// H.4 — comme la V6 : les dépenses seules (débits, sans les transferts
// internes). Sans formule matricielle : Transactions numérote ses dépenses du
// mois dans la colonne V (« N° dépense du mois »), et chaque ligne de la liste
// va chercher la k-ième. LISTE_MAX lignes au plus ; au-delà, la feuille le
// DIT, avec le nombre de lignes non listées — jamais une liste tronquée en
// silence.
const LISTE_MAX = 200;
bloc(Math.max(finGauche, finMilieu, finDroite) + 1, 1);
const ligneCompte = r;
const nDepenses = rangDepense.size;
{
  const t = wsViz.getCell(r, 1);
  t.value = "Dépenses du mois, ligne à ligne";
  t.font = GRAS;
  const n = wsViz.getCell(r, 2);
  n.value = { formula: `MAX(${TX("V")})`, result: nDepenses };
  n.numFmt = "0";
  wsViz.getCell(r, 3).value = {
    formula: `IF($B$${r}>${LISTE_MAX},"⚠ "&($B$${r}-${LISTE_MAX})&" dépenses de plus ne sont pas listées : ${LISTE_MAX} lignes au plus.",` +
      `$B$${r}&" dépense(s) ce mois-ci.")`,
    result: nDepenses > LISTE_MAX
      ? `⚠ ${nDepenses - LISTE_MAX} dépenses de plus ne sont pas listées : ${LISTE_MAX} lignes au plus.`
      : `${nDepenses} dépense(s) ce mois-ci.`,
  };
  r++;
}
titre(["Date", "Libellé", "Compte", "Type", "Catégorie", "Montant"]);
const depensesListees = lignes.filter((_, i) => rangDepense.has(i));
const COLS_LISTE = [
  ["A", DATE, (l) => dateUTC(l.date), false],
  ["B", null, (l) => l.label || "", true],
  ["C", null, (l) => l.compte, true],
  ["D", null, (l) => l.type, true],
  ["N", null, (l) => l.categorie, true],
  ["K", EUROS, (l) => l.montant, false],
];
for (let k = 1; k <= LISTE_MAX; k++) {
  const l = depensesListees[k - 1];
  COLS_LISTE.forEach(([col, fmt, val, texte], i) => {
    const c = wsViz.getCell(r, 1 + i);
    // `&""` : une cellule de texte vide ne doit pas s'afficher « 0 ».
    c.value = {
      formula: `IF(${k}>$B$${ligneCompte},"",INDEX(${TX(col)},MATCH(${k},${TX("V")},0))${texte ? '&""' : ""})`,
      result: l ? val(l) : "",
    };
    if (fmt) c.numFmt = fmt;
  });
  r++;
}

// ── Mise en page (V6) ──────────────────────────────────────────────────
[34, 28, 22, 20, 34, 16, 22, 16, 16, 3, 32, 16, 10]
  .forEach((w, i) => { wsViz.getColumn(i + 1).width = w; });
wsViz.views = [{ state: "frozen", ySplit: 2 }];

// ─────────────────────────────────────────────────────────────────────────
// 5. L'ÉCRITURE
// ─────────────────────────────────────────────────────────────────────────

// H.1 — la règle, appliquée en dernier sur toutes les feuilles : toute
// formule porte la couleur « calculé » et reste verrouillée. Aucune cellule
// calculée ne peut y échapper, quel que soit le bloc qui l'a écrite.
wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => {
  if (c.type === ExcelJS.ValueType.Formula) calculer(c);
})));

// H.4 — Arial partout, comme la V6 ; la taille et le gras de chaque cellule
// sont gardés. Les cellules VIDES à remplir l'ont reçue par `saisir` et par
// les colonnes préparées : les parcourir toutes créait des milliers de
// cellules vides (+108 Ko, mesuré).
wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => {
  c.font = { ...POLICE, ...(c.font ?? {}), name: "Arial", size: c.font?.size ?? 11 };
})));
wsLisez.getCell("A1").font = { name: "Arial", size: 13, bold: true };

// H.5 — le verrou (décisions H4 et Q3 du lot H). Chaque feuille est protégée
// SANS mot de passe : les cellules calculées (verrouillées depuis H.1) ne se
// modifient plus, les cellules à remplir (déverrouillées) si. On peut
// sélectionner, filtrer, trier (Transactions et Paie, voir H.5b), élargir une
// colonne ; on ne peut ni insérer ni supprimer des lignes (les formules sont
// posées sur 5 000 lignes).
// Pour enlever la protection : Révision › Ôter la protection, sans mot de passe.
// ⚠️ Jamais de mot de passe : exceljs y ajouterait un sel aléatoire (le modèle
// ne serait plus reproductible), et un classeur chiffré à l'ouverture ne se
// lirait plus du tout. `modeleProtection.test.ts` le vérifie.
//
// H.5b — trier par date (demande du 25/09). Excel ne trie que des cellules
// déverrouillées : le filtre, et donc le tri, portent sur les colonnes À
// REMPLIR seulement (Transactions A–J, Paie A–F). Les colonnes calculées ne
// lisent que leur propre ligne : elles suivent le tri sans rien déplacer.
// Contrepartie choisie : plus de filtre sur les colonnes calculées
// (Catégorie, Classe, Sens).
// Excel refuse aussi le tri si l'en-tête de la zone est verrouillé (mesuré
// dans Excel le 25/09) : ces en-têtes-là sont donc ouverts. Choix validé.
// Contrepartie connue et écrite dans le guide : Date, Compte, Type renommés
// sont signalés à l'import ; une colonne facultative renommée (Libellé,
// Ville, Prévisionnel…) est ignorée sans message. Les en-têtes gris restent
// verrouillés.
wsTx.autoFilter = `A1:${lettre(SAISIES.length)}${DERNIERE}`;
wsPaie.autoFilter = `A1:F${PAIE_DERNIERE}`;
for (const [ws, n] of [[wsTx, SAISIES.length], [wsPaie, 6]]) {
  for (let col = 1; col <= n; col++) ws.getRow(1).getCell(col).protection = OUVERT;
}
const PERMIS = {
  selectLockedCells: true, selectUnlockedCells: true,
  formatColumns: true, formatRows: true, autoFilter: true,
  formatCells: false, sort: false, insertRows: false, deleteRows: false,
  insertColumns: false, deleteColumns: false, insertHyperlinks: false, pivotTables: false,
};
for (const ws of wb.worksheets) {
  const trier = ws === wsTx || ws === wsPaie;
  await ws.protect(undefined, { ...PERMIS, sort: trier });
}

await wb.xlsx.writeFile(sortie);

console.log(`Modèle écrit : ${sortie}`);
console.log(`  Transactions  ${lignes.length} lignes (formules jusqu'à la ligne ${DERNIERE})`);
console.log(`  Types         ${TYPES.length}, comptes ${P.comptes.length}, catégories ${P.categories.length}`);
console.log(`  Paie          ${salary.months.length} mois`);
console.log(`  Visualisation ${MOIS_DEFAUT.slice(0, 7)} — dépenses ${totalDepenses} €, recettes ${totalRecettes} €`);
for (const c of avecSolde) {
  console.log(`    ${c.padEnd(34)} fin du mois ${soldeJS(c, (l) => l.compte1 === 1 && l.date < MOIS_FIN)} €`);
}
