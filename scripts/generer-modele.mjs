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
      natures: d?.natures ?? [],
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

const BLEU = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F2" } };
const GRIS = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
const GRAS = { bold: true };
const EUROS = '#,##0.00 "€"';
const DATE = "dd/mm/yyyy";

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
    if (remplissage[i]) c.fill = remplissage[i];
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
};

// ─────────────────────────────────────────────────────────────────────────
// 4.1 Lisez-moi
// ─────────────────────────────────────────────────────────────────────────

const LISEZ_MOI = [
  "Budget — modèle de fichier source",
  "",
  "Ce classeur est un EXEMPLE complet, rempli avec des données inventées. Remplacez-les par les vôtres.",
  "",
  "Ce que vous remplissez",
  "  Transactions, colonnes A à J (en-têtes bleus) : un mouvement par ligne.",
  "  Paie : un bulletin par mois. Facultative.",
  "  Paramètres : vos comptes, vos types, vos catégories, vos dates de relevé, votre prêt.",
  "",
  "Ce que le fichier calcule (en-têtes gris — n'écrivez rien dedans)",
  "  Transactions, colonnes K à U, et toute la feuille Visualisation.",
  "",
  "Le montant brut et la participation",
  "  Saisissez dans « Montant brut » le montant payé EN ENTIER.",
  "  La colonne « Montant » applique le taux de « Participation » du compte (feuille Paramètres).",
  "  Exemple : 100 € de courses sur un compte à 50 % → Montant brut 100, Montant 50.",
  "",
  "Le sens et les remboursements",
  "  Le sens vient du type (Paramètres, « Sens par défaut »). Pour une ligne qui fait exception,",
  "  écrivez Débit ou Crédit dans « Sens (si différent) ».",
  "  Un remboursement s'écrit sur le type de la dépense qu'il annule, avec « Crédit » :",
  "  40 € de courses, 15 € remboursés → la catégorie Alimentation compte 25 €.",
  "",
  "Les lignes prévisionnelles",
  "  Un « x » dans « Prévisionnel » : la ligne compte dès que sa date est au plus tard",
  "  la « Fin de relevé » (Paramètres). Après, elle reste de côté.",
  "",
  "Le prêt",
  "  Quatre valeurs dans Paramètres : montant, date de début (mois de la 1re échéance),",
  "  taux annuel, durée en mois. La mensualité et l'échéancier se calculent.",
  "",
  "La Visualisation suit vos Paramètres",
  "  Comptes, types de recette, types d'épargne et catégories y sont lus dans Paramètres :",
  "  ajoutez-en un, il apparaît. Les lignes « Autres » ramassent ce qui n'est pas listé,",
  "  pour que les totaux restent justes.",
  "",
  "Le rapprochement bancaire (Visualisation)",
  "  Saisissez le solde lu sur votre relevé et sa date : l'écart avec le solde calculé s'affiche.",
  "",
  "Les règles du format",
  "  1. L'en-tête est en ligne 1. Un montant est toujours positif : le sens dit Débit ou Crédit.",
  "  2. Un montant illisible ne devient jamais 0 : la ligne est refusée, et l'outil vous le dit.",
  "  3. Une feuille dont le nom n'est pas reconnu est ignorée — celle-ci, par exemple.",
];
const wsLisez = wb.addWorksheet("Lisez-moi");
LISEZ_MOI.forEach((t, i) => {
  const c = wsLisez.getCell(i + 1, 1);
  c.value = t;
  if (i === 0 || /^[A-ZÉ]/.test(t)) c.font = GRAS;
});
wsLisez.getColumn(1).width = 110;

// ─────────────────────────────────────────────────────────────────────────
// 4.2 Transactions — A à J saisies, K à U calculées
// ─────────────────────────────────────────────────────────────────────────

const wsTx = wb.addWorksheet("Transactions");
const SAISIES = [
  "Date", "Compte", "Type", "Montant brut", "Sens (si différent)",
  "Sous-catégorie", "Détail", "Libellé", "Ville", "Prévisionnel",
];
const CALCULEES = [
  "Montant", "Sens", "Classe", "Catégorie", "Compté", "Remboursement",
  "Dépense nette", "Effet sur le compte", "Compte lié", "Effet sur le compte lié",
  "Sortie d'épargne",
];
enTete(
  wsTx,
  [...SAISIES, ...CALCULEES],
  [...SAISIES.map(() => BLEU), ...CALCULEES.map(() => GRIS)]
);

// Les recherches communes, écrites une fois. `$C` = type, `$B` = compte.
const typeLigne = (r, col) =>
  `IFERROR(INDEX(${F}!$${col}:$${col},MATCH($C${r},${F}!$M:$M,0))&"","")`;
const compteLigne = (r, col) =>
  `IFERROR(INDEX(${F}!$${col}:$${col},MATCH($B${r},${F}!$D:$D,0))&"","")`;

/** Les onze formules d'une ligne. */
function formules(r) {
  const taux =
    `IF(ISNA(MATCH($B${r},${F}!$D:$D,0)),1,` +
    `IF(INDEX(${F}!$J:$J,MATCH($B${r},${F}!$D:$D,0))="",1,` +
    `INDEX(${F}!$J:$J,MATCH($B${r},${F}!$D:$D,0))))`;
  const nature = typeLigne(r, "N");
  return {
    K: `IF($D${r}="","",ROUND($D${r}*${taux},2))`,
    L: `IF($C${r}="","",IF($E${r}<>"",$E${r},IF(ISNA(MATCH($C${r},${F}!$M:$M,0)),"⚠ Type inconnu",${typeLigne(r, "P")})))`,
    M: `IF($C${r}="","",IF(ISNA(MATCH($C${r},${F}!$M:$M,0)),"⚠ Type inconnu",IF($L${r}="Crédit","",${typeLigne(r, "O")})))`,
    N: `IF($C${r}="","",${typeLigne(r, "Q")})`,
    O: `IF($A${r}="","",IF(OR($J${r}<>"x",$A${r}<=FinReleve),1,0))`,
    P: `IF($C${r}="","",IF(AND($L${r}="Crédit",OR(${typeLigne(r, "O")}<>"",ISNUMBER(SEARCH("remboursement",${nature})))),1,0))`,
    Q: `IF($K${r}="","",IF(ISNUMBER(SEARCH("transfert-interne",${nature})),0,IF($L${r}="Débit",$K${r},IF($P${r}=1,-$K${r},0))))`,
    R: `IF($K${r}="","",IF($L${r}="Crédit",$K${r},-$K${r}))`,
    S: `IF($B${r}="","",${compteLigne(r, "H")})`,
    T:
      `IF($K${r}="","",IF($S${r}="",0,IF(ISNUMBER(SEARCH("apport-exterieur",${nature})),0,` +
      `IF(OR(${compteLigne(r, "I")}="Les deux",${compteLigne(r, "I")}=IF($P${r}=1,"Débit",$L${r})),` +
      `-IF($P${r}=1,-$K${r},$K${r}),0))))`,
    U: `IF($K${r}="","",IF(ISNUMBER(SEARCH("sortie-epargne",${nature})),$K${r},0))`,
  };
}

const COLS_CALC = ["K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U"];
for (let r = 2; r <= DERNIERE; r++) {
  const l = lignes[r - 2];
  const row = wsTx.getRow(r);
  if (l) {
    row.getCell(1).value = dateUTC(l.date);
    row.getCell(2).value = l.compte;
    row.getCell(3).value = l.type;
    row.getCell(4).value = l.montantBrut;
    row.getCell(6).value = l.cat3 || null;
    row.getCell(7).value = l.cat4 || null;
    row.getCell(8).value = l.label || null;
    row.getCell(9).value = l.ville || null;
  }
  const f = formules(r);
  const cache = l
    ? {
        K: l.montant, L: l.sens, M: l.classe, N: l.categorie, O: 1, P: l.rembourse,
        Q: l.depense, R: l.effet, S: l.lie, T: l.effetLie, U: l.sortieEpargne,
      }
    : { K: "", L: "", M: "", N: "", O: "", P: "", Q: "", R: "", S: "", T: "", U: "" };
  COLS_CALC.forEach((col, i) => {
    row.getCell(11 + i).value = { formula: f[col], result: cache[col] };
  });
  row.getCell(1).numFmt = DATE;
  row.getCell(4).numFmt = EUROS;
  row.getCell(11).numFmt = EUROS;
}
[11, 13, 16, 12, 20, 16, 20, 14, 10, 14, 12, 12, 14, 12, 14, 10, 12, 14, 26, 16, 14]
  .forEach((w, i) => { wsTx.getColumn(i + 1).width = w; });

wsTx.dataValidations.add(`B2:B${DERNIERE}`, {
  type: "list", allowBlank: true, formulae: ["ListeComptes"],
  showErrorMessage: true, errorTitle: "Compte inconnu",
  error: "Choisissez un compte déclaré dans Paramètres, ou déclarez-le d'abord.",
});
wsTx.dataValidations.add(`C2:C${DERNIERE}`, {
  type: "list", allowBlank: true, formulae: ["ListeTypes"],
  showErrorMessage: true, errorTitle: "Type inconnu",
  error: "Choisissez un type déclaré dans Paramètres, ou déclarez-le d'abord.",
});
wsTx.dataValidations.add(`E2:E${DERNIERE}`, {
  type: "list", allowBlank: true, formulae: ['"Débit,Crédit"'],
});
wsTx.dataValidations.add(`J2:J${DERNIERE}`, {
  type: "list", allowBlank: true, formulae: ['"x"'],
});

// ─────────────────────────────────────────────────────────────────────────
// 4.3 Paie — le net est calculé, comme le fait le lecteur
// ─────────────────────────────────────────────────────────────────────────

const wsPaie = wb.addWorksheet("Paie");
enTete(
  wsPaie,
  ["Mois", "Employeur", "Brut", "Cotisations salariales", "Indemnités", "Autres retenues", "Net"],
  [BLEU, BLEU, BLEU, BLEU, BLEU, BLEU, GRIS]
);
salary.months.forEach((m, i) => {
  const r = i + 2;
  const net = arrondir(m.brut - m.cotSal + m.indem - m.retenues);
  if (net !== m.net) echouer(`paie ${m.mk} : net ${m.net} ≠ ${net} recalculé.`);
  const row = wsPaie.getRow(r);
  row.values = [m.mk, m.entreprise, m.brut, m.cotSal, m.indem, m.retenues];
  row.getCell(7).value = { formula: `ROUND(C${r}-D${r}+E${r}-F${r},2)`, result: net };
  for (let c = 3; c <= 7; c++) row.getCell(c).numFmt = EUROS;
});
[10, 22, 12, 22, 12, 16, 12].forEach((w, i) => { wsPaie.getColumn(i + 1).width = w; });

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
  cell(wsParam, `A${i + 1}`, k);
  cell(wsParam, `B${i + 1}`, v, fmt);
});

const COMPTES_ENTETE = [
  "Compte", "Organisme", "Solde de départ", "Porte un solde",
  "Compte lié", "Sens répercuté", "Participation", "Couleur",
];
COMPTES_ENTETE.forEach((h, i) => { wsParam.getCell(1, 4 + i).value = h; });
P.comptes.forEach((c, i) => {
  const r = i + 2;
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
  .forEach((h, i) => { wsParam.getCell(1, 13 + i).value = h; });
TYPES.forEach((t, i) => {
  const r = i + 2;
  [t.libelle, t.natures.join(", ") || null, t.classe || null, t.sens || null, t.categorie || null]
    .forEach((x, j) => { wsParam.getCell(r, 13 + j).value = x; });
});

["Catégorie", "Couleur"].forEach((h, i) => { wsParam.getCell(1, 19 + i).value = h; });
P.categories.forEach((c, i) => {
  wsParam.getCell(i + 2, 19).value = c.libelle;
  wsParam.getCell(i + 2, 20).value = c.couleur ?? null;
});

const EMPLOYEURS = [...new Set(salary.months.map((m) => m.entreprise))];
wsParam.getCell(1, 22).value = "Employeur";
EMPLOYEURS.forEach((e, i) => { wsParam.getCell(i + 2, 22).value = e; });

for (let c = 1; c <= 22; c++) {
  const h = wsParam.getCell(1, c);
  if (h.value) { h.font = GRAS; h.fill = BLEU; }
}
[40, 16, 3, 32, 18, 16, 15, 32, 16, 13, 10, 3, 30, 30, 22, 15, 20, 3, 20, 10, 3, 22]
  .forEach((w, i) => { wsParam.getColumn(i + 1).width = w; });

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
[
  "La colonne A liste les mois proposés en tête de la feuille Visualisation.",
  "Elle part du premier mois de vos transactions. Rien à saisir ici.",
  "Les types (sens, classe, catégorie) se déclarent dans Paramètres, en une seule table.",
].forEach((t, i) => { wsRef.getCell(i + 2, 3).value = t; });
wsRef.getColumn(1).width = 16;
wsRef.getColumn(3).width = 90;

// ─────────────────────────────────────────────────────────────────────────
// 4.6 Les noms
// ─────────────────────────────────────────────────────────────────────────

wb.definedNames.add(`${F}!$D$2:$D$40`, "ListeComptes");
wb.definedNames.add(`${F}!$M$2:$M$120`, "ListeTypes");
wb.definedNames.add(`'Référentiel'!$A$2:$A$${NB_MOIS + 1}`, "ListeMois");
wb.definedNames.add(`${F}!$B$4`, "FinReleve");
wb.definedNames.add(`${F}!$B$5`, "CompteSorties");

// ─────────────────────────────────────────────────────────────────────────
// 4.7 Visualisation — le mois choisi, calculé avec les mêmes règles que l'app
// ─────────────────────────────────────────────────────────────────────────
//
// Rien n'y est écrit en dur : ni solde de départ, ni nom de compte dans une
// formule. Les soldes lisent `Paramètres` ; les remboursements, les comptes
// liés et les sorties d'épargne passent par les colonnes calculées de
// Transactions (P à U), qui suivent les règles de l'application (F11, F12).

const wsViz = wb.addWorksheet("Visualisation");
const MOIS_DEFAUT = "2026-08-01"; // dernier mois complet de la démonstration
const MOIS_FIN = moisSuivant(MOIS_DEFAUT);

cell(wsViz, "A1", "Mois").font = GRAS;
const b1 = cell(wsViz, "B1", dateUTC(MOIS_DEFAUT), "mmmm yyyy");
b1.fill = BLEU;
cell(wsViz, "C1", "jusqu'au");
wsViz.getCell("D1").value = { formula: "EDATE($B$1,1)", result: dateUTC(MOIS_FIN) };
wsViz.getCell("D1").numFmt = DATE;
cell(wsViz, "E1", "(exclu) ← choisissez le mois dans la liste de la cellule B1");
wsViz.dataValidations.add("B1", { type: "list", allowBlank: false, formulae: ["ListeMois"] });

const DANS_MOIS = `${TX("A")},">="&$B$1,${TX("A")},"<"&$D$1,${TX("O")},1`;
const dansMois = (l) => l.date >= MOIS_DEFAUT && l.date < MOIS_FIN && l.compte1 === 1;
const somme = (pred, f) => arrondir(lignes.filter(pred).reduce((s, l) => s + f(l), 0));

let r = 3;
const titre = (textes) => {
  textes.forEach((t, i) => {
    const c = wsViz.getCell(r, i + 1);
    c.value = t;
    c.font = GRAS;
    c.fill = GRIS;
  });
  r++;
};
const ligneCalc = (libelle, cellules) => {
  if (libelle !== null) wsViz.getCell(r, 1).value = libelle;
  cellules.forEach(([formule, valeur, fmt], i) => {
    const c = wsViz.getCell(r, i + 2);
    c.value = { formula: formule, result: valeur };
    c.numFmt = fmt ?? EUROS;
  });
  return r++;
};

// ── Des lignes qui suivent Paramètres ──────────────────────────────────
// F.7 — les libellés de la colonne A ne sont plus écrits par ce script : ils
// sont LUS dans Paramètres, par formule. Ajoutez un compte, un type ou une
// catégorie dans Paramètres, et la Visualisation le montre sans rien toucher
// d'autre. Chaque tableau a un nombre fixe d'emplacements ; les emplacements
// vides restent vides. Une ligne « Autres » ramasse ce qu'aucun emplacement ne
// montre (type ou catégorie non déclarés) : le total reste juste.

const SLOTS = { comptes: 12, recettes: 12, categories: 25, epargne: 10 };
const PLAGE = (col, n) => `${F}!$${col}$2:$${col}$${n + 1}`;
const P_COMPTES = 40;
const P_TYPES = 120;
const P_CATEGORIES = 40;

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
  wsRef.getCell(`${col}1`).font = GRAS;
  wsRef.getCell(`${col}1`).fill = GRIS;
  for (let i = 0; i < n; i++) {
    const r = i + 2;
    const rang = tous[i] === undefined ? -1 : retenus.indexOf(tous[i]);
    wsRef.getCell(`${col}${r}`).value = {
      formula: `IF(${cond(r)},MAX(${col}$1:${col}${r - 1})+1,"")`,
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
const siVide = (ligne, formule) => `IF($A${ligne}="","",${formule})`;
const libelleCalc = (formule, valeur) => {
  wsViz.getCell(r, 1).value = { formula: formule, result: valeur };
};

// ── Les soldes ─────────────────────────────────────────────────────────
const soldeFormule = (ligne, critere) =>
  `IFERROR(INDEX(${F}!$F:$F,MATCH($A${ligne},${F}!$D:$D,0))*1,0)` +
  `+SUMIFS(${TX("R")},${TX("B")},$A${ligne},${TX("A")},${critere},${TX("O")},1)` +
  `+SUMIFS(${TX("T")},${TX("S")},$A${ligne},${TX("A")},${critere},${TX("O")},1)` +
  `+IF($A${ligne}=CompteSorties,SUMIFS(${TX("U")},${TX("A")},${critere},${TX("O")},1),0)`;
const soldeJS = (compte, pred) =>
  arrondir(
    (compteParLibelle.get(compte)?.soldeDepart ?? 0) +
    somme((l) => pred(l) && l.compte === compte, (l) => l.effet) +
    somme((l) => pred(l) && l.lie === compte, (l) => l.effetLie) +
    (compte === sorties ? somme(pred, (l) => l.sortieEpargne) : 0)
  );

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
  [`SUM(B${premiereLigneSolde}:B${derniereLigneSolde})`, totalSoldes(MOIS_DEFAUT)],
  [`SUM(C${premiereLigneSolde}:C${derniereLigneSolde})`, totalSoldes(MOIS_FIN)],
]);
wsViz.getCell(r - 1, 1).font = GRAS;
r++;

// ── Les recettes ───────────────────────────────────────────────────────
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
    siVide(ligne, `SUMIFS(${TX("K")},${TX("C")},$A${ligne},${TX("L")},"Crédit",${TX("P")},0,${DANS_MOIS})`),
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
  `ROUND(B${ligneTotalRecettes}-SUM(B${debutRecettes}:B${finRecettes}),2)`,
  arrondir(totalRecettes - somme((l) => estRecette(l) && typesRecette.some((t) => t.libelle === l.type), (l) => l.montant)),
]]);
if (r !== ligneTotalRecettes) echouer("la ligne du total des recettes n'est pas où « Autres » la cherche.");
ligneCalc("Total des recettes", [[
  `SUMPRODUCT((${TX("L")}="Crédit")*(${TX("P")}=0)*(${TX("O")}=1)*(${TX("A")}>=$B$1)*(${TX("A")}<$D$1)` +
    `*(COUNTIFS(${PLAGE("M", P_TYPES)},${TX("C")},${PLAGE("N", P_TYPES)},"*transfert-interne*")=0),${TX("K")})`,
  totalRecettes,
]]);
wsViz.getCell(r - 1, 1).font = GRAS;
r++;

// ── Les dépenses, par catégorie ────────────────────────────────────────
// « Dépense nette » (colonne Q) : les débits, moins les remboursements (F11).
titre(["Dépenses du mois par catégorie", "Montant", "%"]);
const totalDepenses = somme(dansMois, (l) => l.depense);
const debutDepenses = r;
const ligneTotalDepenses = debutDepenses + SLOTS.categories + 2;
const pourcent = (ligne, v) =>
  [`IF(B${ligne}="","",IFERROR(B${ligne}/$B$${ligneTotalDepenses},0))`,
    v === "" ? "" : totalDepenses ? v / totalDepenses : 0, "0.0%"];
const categoriesDeclarees = P.categories.map((c) => c.libelle);
emplacements(categoriesDeclarees, SLOTS.categories, "catégories").forEach((cat, i) => {
  const ligne = r;
  const source = `${F}!$S$${i + 2}`;
  libelleCalc(`IF(${source}="","",${source})`, cat);
  const v = cat ? somme((l) => dansMois(l) && l.categorie === cat, (l) => l.depense) : "";
  ligneCalc(null, [
    [siVide(ligne, `SUMIFS(${TX("Q")},${TX("N")},$A${ligne},${DANS_MOIS})`), v],
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
    [`ROUND(B${ligneTotalDepenses}-SUM(B${debutDepenses}:B${finCategories})-B${ligne - 1},2)`, v],
    pourcent(ligne, v),
  ]);
}
if (r !== ligneTotalDepenses) echouer("la ligne du total des dépenses n'est pas où les % la cherchent.");
ligneCalc("Total des dépenses", [
  [`SUMIFS(${TX("Q")},${DANS_MOIS})`, totalDepenses],
  [`IFERROR(B${r}/$B$${r},0)`, totalDepenses ? 1 : 0, "0.0%"],
]);
wsViz.getCell(r - 1, 1).font = GRAS;
r++;

// ── L'épargne ──────────────────────────────────────────────────────────
titre(["Épargne du mois", "Montant"]);
const debutEpargne = r;
const typesEpargne = TYPES.filter((t) => t.natures.includes("epargne"));
ecrireRangs(RANGS.epargne, TYPES.map((x) => x.libelle), typesEpargne.map((x) => x.libelle));
emplacements(typesEpargne.map((t) => t.libelle), SLOTS.epargne, "types d'épargne").forEach((type, i) => {
  const ligne = r;
  libelleCalc(kieme(RANGS.epargne, "M", i + 1), type);
  ligneCalc(null, [[
    siVide(ligne, `SUMIFS(${TX("K")},${TX("C")},$A${ligne},${TX("L")},"Débit",${DANS_MOIS})`),
    type ? somme((l) => dansMois(l) && l.type === type && l.sens === "Débit", (l) => l.montant) : "",
  ]]);
});
ligneCalc("Total épargné", [[
  `SUM(B${debutEpargne}:B${r - 1})`,
  somme((l) => dansMois(l) && l.sens === "Débit" &&
    typesEpargne.some((t) => t.libelle === l.type), (l) => l.montant),
]]);
wsViz.getCell(r - 1, 1).font = GRAS;
r++;

// ── Le rapprochement bancaire ──────────────────────────────────────────
// Vous saisissez le solde lu sur le relevé et sa date ; le fichier donne le
// solde qu'il calcule à cette date, et l'écart.
titre(["Rapprochement bancaire — compte", "Date du relevé", "Solde lu sur le relevé", "Solde calculé", "Écart"]);
for (let i = 0; i < 3; i++) {
  const ligne = r;
  const rapproche = soldeFormule(ligne, `"<="&$B${ligne}`);
  wsViz.getCell(ligne, 1).fill = BLEU;
  wsViz.getCell(ligne, 2).fill = BLEU;
  wsViz.getCell(ligne, 2).numFmt = DATE;
  wsViz.getCell(ligne, 3).fill = BLEU;
  wsViz.getCell(ligne, 3).numFmt = EUROS;
  wsViz.getCell(ligne, 4).value = { formula: `IF(OR($A${ligne}="",$B${ligne}=""),"",${rapproche})`, result: "" };
  wsViz.getCell(ligne, 4).numFmt = EUROS;
  wsViz.getCell(ligne, 5).value = { formula: `IF(OR($C${ligne}="",$D${ligne}=""),"",ROUND($C${ligne}-$D${ligne},2))`, result: "" };
  wsViz.getCell(ligne, 5).numFmt = EUROS;
  wsViz.dataValidations.add(`A${ligne}`, { type: "list", allowBlank: true, formulae: ["ListeComptes"] });
  r++;
}

wsViz.getColumn(1).width = 34;
[16, 16, 22, 16, 16].forEach((w, i) => { wsViz.getColumn(i + 2).width = w; });

// ─────────────────────────────────────────────────────────────────────────
// 5. L'ÉCRITURE
// ─────────────────────────────────────────────────────────────────────────

await wb.xlsx.writeFile(sortie);

console.log(`Modèle écrit : ${sortie}`);
console.log(`  Transactions  ${lignes.length} lignes (formules jusqu'à la ligne ${DERNIERE})`);
console.log(`  Types         ${TYPES.length}, comptes ${P.comptes.length}, catégories ${P.categories.length}`);
console.log(`  Paie          ${salary.months.length} mois`);
console.log(`  Visualisation ${MOIS_DEFAUT.slice(0, 7)} — dépenses ${totalDepenses} €, recettes ${totalRecettes} €`);
for (const c of avecSolde) {
  console.log(`    ${c.padEnd(34)} fin du mois ${soldeJS(c, (l) => l.compte1 === 1 && l.date < MOIS_FIN)} €`);
}
