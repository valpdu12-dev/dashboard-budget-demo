#!/usr/bin/env node
/**
 * Générateur des données de démonstration.
 *
 *   node scripts/generate-demo-data.mjs
 *
 * Produit dans `public/data/` :
 *   transactions.json  2 ans de mouvements (encodage dictionnaire)
 *   salary.json        5 ans de paie
 *   config.json        soldes de départ, prêt, couverture déclarée
 *   budgets.json       objectifs de budget par catégorie
 *   references.json    inflation INSEE et SMIC — données publiques, sourcées
 *
 * ── DEUX RÈGLES NON NÉGOCIABLES ─────────────────────────────────────────
 *
 * 1. GRAINE FIXE. Deux exécutions donnent des fichiers identiques, octet
 *    pour octet. Aucun appel à `Date.now()`, `Math.random()` ni au fuseau
 *    horaire de la machine. Les bornes de période sont écrites en dur.
 *    Conséquence assumée : le « mois courant » de la démo reste septembre
 *    2026. Un jeu qui bouge à chaque exécution rendrait tout écart de test
 *    ininterprétable.
 *
 * 2. RIEN N'EST DÉRIVÉ DE DONNÉES RÉELLES. Marchands, villes, employeurs et
 *    montants sont inventés et écrits dans ce fichier. Aucun n'a été copié,
 *    transformé ni échantillonné depuis un classeur réel.
 *
 * Seule exception à la règle 2, et c'est voulu : `references.json` contient
 * de VRAIES données publiques (inflation INSEE, SMIC), avec leur source et
 * leur date de consultation. Une comparaison du pouvoir d'achat n'a aucun
 * sens face à une inflation inventée.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIE = join(ICI, "..", "public", "data");

// ═══════════════════════════════════════════════════════════════════════
// 1. ALÉATOIRE REPRODUCTIBLE
// ═══════════════════════════════════════════════════════════════════════

const GRAINE = 20260915;

/** mulberry32 — court, rapide, suffisant pour un jeu de démonstration. */
function creerAleatoire(graine) {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const alea = creerAleatoire(GRAINE);

const entre = (min, max) => min + alea() * (max - min);
const entier = (min, max) => Math.floor(entre(min, max + 1));
const piocher = (liste) => liste[Math.floor(alea() * liste.length)];
const euros = (v) => Math.round(v * 100) / 100;
/** Vrai avec la probabilité p. */
const parfois = (p) => alea() < p;

// ═══════════════════════════════════════════════════════════════════════
// 2. PÉRIODE
// ═══════════════════════════════════════════════════════════════════════

const TX_PREMIER_MOIS = "2024-09";
const TX_DERNIER_MOIS = "2026-09";
const TX_DERNIER_JOUR = 15; // le dernier mois est volontairement partiel

const PAIE_PREMIER_MOIS = "2021-09";
const PAIE_DERNIER_MOIS = "2026-08";

/**
 * Mois intérieur SANS AUCUNE DÉPENSE — seul le salaire y tombe.
 * C'est le cas que traite la règle de couverture (docs/CONTRAT_COUVERTURE.md) :
 * un mois couvert sans dépense vaut 0 €, il compte au dénominateur des
 * moyennes, il n'est pas « absent ». Il doit être visible dans la démo.
 */
const MOIS_SANS_DEPENSE = "2025-07";

/** Mois volontairement incomplets — peu de lignes, comme un relevé partiel. */
const MOIS_INCOMPLETS = new Set(["2025-02", "2026-03"]);

function moisSuivant(mk) {
  const [y, m] = mk.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function listerMois(debut, fin) {
  const out = [];
  let mk = debut;
  while (mk <= fin) {
    out.push(mk);
    mk = moisSuivant(mk);
  }
  return out;
}

const joursDansMois = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

const MOIS_TX = listerMois(TX_PREMIER_MOIS, TX_DERNIER_MOIS);
const MOIS_PAIE = listerMois(PAIE_PREMIER_MOIS, PAIE_DERNIER_MOIS);

/** Date ISO dans le mois, en bornant le dernier mois (partiel). */
function dateDans(mk, jour) {
  const max = mk === TX_DERNIER_MOIS ? TX_DERNIER_JOUR : joursDansMois(mk);
  const j = Math.min(Math.max(1, jour), max);
  return `${mk}-${String(j).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════
// 3. VOCABULAIRE INVENTÉ
// ═══════════════════════════════════════════════════════════════════════

const COMPTE_PRINCIPAL = "Banque A - Courant";
const COMPTE_PART_COMMUNE = "Banque A - Part commune";
const COMPTE_APPLI = "Appli partagée - Part commune";
const COMPTE_JOINT_B = "Banque B - Compte joint";
const COMPTE_JOINT_C = "Banque C - Compte joint";
const COMPTE_TR = "Titres-restaurant";
const COMPTE_B_COURANT = "Banque B - Courant";
/** Valeur portée par la colonne compte des sorties d'épargne. */
const COMPTE_SORTIE_EPARGNE = "Sortie Epargne";

const VILLES = ["Villebourg", "Villebourg-sur-Rive", "Grandval", "Rocheville", ""];

const MARCHANDS_COURSES = ["Supermarché Centre", "Supermarché Ouest", "Boulangerie", "Primeur"];
const MARCHANDS_LOISIR = ["Cinéma", "Abonnement vidéo", "Librairie", "Sport en salle", "Concert"];
const MARCHANDS_TRANSPORT = ["Station-service", "Transport urbain", "Péage", "Parking"];
const MARCHANDS_SANTE = ["Pharmacie", "Cabinet médical", "Opticien", "Dentiste"];
const MARCHANDS_MAISON = ["Bricolage", "Jardinerie", "Ameublement", "Électroménager"];
const MARCHANDS_DIVERS = ["Coiffeur", "Pressing", "Fleuriste", "Café", "Restaurant", "Cadeau"];

const EMPLOYEURS = ["Employeur A", "Employeur B", "Employeur C", "Employeur D", "Employeur E"];

// ═══════════════════════════════════════════════════════════════════════
// 4. PRÊT IMMOBILIER (fictif, cohérent)
// ═══════════════════════════════════════════════════════════════════════

const PRET = {
  montant: 180000,
  mensualite: 893.6,
  echeances: 240,
  premiereEcheance: "2022-10",
  jour: 5,
};

/** Résout le taux périodique tel que mensualite = P·r / (1−(1+r)^−n). */
function tauxPeriodique(p, mensualite, n) {
  let lo = 1e-7;
  let hi = 0.05;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const m = (p * mid) / (1 - Math.pow(1 + mid, -n));
    if (m > mensualite) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function tableauAmortissement() {
  const r = tauxPeriodique(PRET.montant, PRET.mensualite, PRET.echeances);
  const lignes = [];
  let solde = PRET.montant;
  let mk = PRET.premiereEcheance;
  for (let k = 0; k < PRET.echeances; k++) {
    const interet = solde * r;
    const capital = PRET.mensualite - interet;
    solde = Math.max(0, solde - capital);
    lignes.push({ mk, interet: euros(interet), capital: euros(capital) });
    mk = moisSuivant(mk);
  }
  return lignes;
}

// ═══════════════════════════════════════════════════════════════════════
// 5. TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════

const transactions = [];

/** Ajoute une transaction. Les champs absents valent "". */
function tx({ compte, type, date, montant, cat1 = "", cat2 = "", cat3 = "", cat4 = "", ville = "", dc, label = "" }) {
  transactions.push({ compte, type, date, montant: euros(montant), cat1, cat2, cat3, cat4, ville, dc, label });
}

const amortissement = tableauAmortissement();
const echeanceParMois = new Map(amortissement.map((l) => [l.mk, l]));

for (const mk of MOIS_TX) {
  const vide = mk === MOIS_SANS_DEPENSE;
  const maigre = MOIS_INCOMPLETS.has(mk);
  const dernier = mk === TX_DERNIER_MOIS;

  // ── Salaire : toujours présent, même le mois sans dépense ──────────
  tx({
    compte: COMPTE_PRINCIPAL, type: "Salaire", date: dateDans(mk, 27),
    montant: entre(2870, 3070), cat3: "Salaire", dc: "Crédit", label: "Virement salaire",
  });

  if (vide) continue; // ← le mois sans aucune dépense s'arrête ici

  // ── Prêt immobilier : capital + intérêts, sur le compte joint C ────
  const ech = echeanceParMois.get(mk);
  if (ech) {
    tx({
      compte: COMPTE_JOINT_C, type: "Crédit Immobilier", date: dateDans(mk, PRET.jour),
      montant: ech.capital, cat2: "Immobilier", cat3: "Remboursement capital",
      dc: "Débit", label: "Échéance prêt — capital",
    });
    tx({
      compte: COMPTE_JOINT_C, type: "Intérêt du prêt", date: dateDans(mk, PRET.jour),
      montant: ech.interet, cat1: "Dépense Fixe", cat2: "Immobilier",
      cat3: "Intérêts", dc: "Débit", label: "Échéance prêt — intérêts",
    });
  }

  // ── Alimentation des comptes joints (sortent du compte principal) ──
  tx({
    compte: COMPTE_JOINT_C, type: "Transfert Banque A vers Banque C", date: dateDans(mk, 2),
    montant: 1160, cat2: "Comptes Bancaires", dc: "Crédit", label: "Alimentation compte joint",
  });
  tx({
    compte: COMPTE_JOINT_B, type: "Transfert Banque A vers Banque B", date: dateDans(mk, 2),
    montant: 300, cat2: "Comptes Bancaires", dc: "Crédit", label: "Alimentation compte joint",
  });

  // ── Charges fixes ──────────────────────────────────────────────────
  const fixes = [
    ["Frais de Copropriété", 168, "Immobilier", COMPTE_JOINT_C, 8],
    ["Assurance habitation", 22.4, "Assurances", COMPTE_PRINCIPAL, 10],
    ["Assurance auto", 47.9, "Assurances", COMPTE_PRINCIPAL, 12],
    ["Assurance prêt", 31.2, "Assurances", COMPTE_JOINT_C, 5],
    ["Electricité", entre(62, 118), "Immobilier", COMPTE_JOINT_C, 15],
    ["Internet et Forfait téléphone", 49.9, "Autre", COMPTE_PRINCIPAL, 6],
    ["Frais Bancaires", 3, "Banque", COMPTE_PRINCIPAL, 28],
    ["Abonnement transport", 88.8, "Transport", COMPTE_PRINCIPAL, 3],
    ["Impôt sur Revenu", 212, "Impots", COMPTE_PRINCIPAL, 18],
  ];
  for (const [type, montant, cat2, compte, jour] of fixes) {
    if (maigre && parfois(0.6)) continue;
    tx({
      compte, type, date: dateDans(mk, jour), montant,
      cat1: "Dépense Fixe", cat2, dc: "Débit", label: type,
    });
  }

  // ── Dépenses courantes ─────────────────────────────────────────────
  const nbCourses = maigre ? entier(1, 3) : dernier ? entier(3, 6) : entier(8, 14);
  for (let i = 0; i < nbCourses; i++) {
    tx({
      compte: parfois(0.6) ? COMPTE_JOINT_B : COMPTE_PART_COMMUNE,
      type: "courses", date: dateDans(mk, entier(1, 28)),
      montant: entre(11, 96), cat1: "Dépense Courante", cat2: "Alimentation",
      cat3: piocher(MARCHANDS_COURSES), ville: piocher(VILLES), dc: "Débit", label: "Achat carte",
    });
  }

  if (!maigre) {
    for (let i = 0; i < entier(6, 12); i++) {
      tx({
        compte: COMPTE_TR, type: "cantine", date: dateDans(mk, entier(1, 28)),
        montant: entre(7.5, 14.5), cat1: "Dépense Courante", cat2: "Alimentation",
        cat3: "Cantine", ville: piocher(VILLES), dc: "Débit", label: "Titre restaurant",
      });
    }
    for (let i = 0; i < entier(1, 3); i++) {
      tx({
        compte: COMPTE_PRINCIPAL, type: "Essence", date: dateDans(mk, entier(1, 28)),
        montant: entre(38, 82), cat1: "Dépense Courante", cat2: "Transport",
        cat3: piocher(MARCHANDS_TRANSPORT), ville: piocher(VILLES), dc: "Débit", label: "Carburant",
      });
    }
    if (parfois(0.55)) {
      tx({
        compte: COMPTE_PRINCIPAL, type: parfois(0.5) ? "Médecin" : "Pharmacie",
        date: dateDans(mk, entier(1, 28)), montant: entre(12, 75),
        cat1: "Dépense Courante", cat2: "Santé", cat3: piocher(MARCHANDS_SANTE),
        ville: piocher(VILLES), dc: "Débit", label: "Santé",
      });
    }
    if (parfois(0.35)) {
      tx({
        compte: COMPTE_PRINCIPAL, type: "Vêtement courant", date: dateDans(mk, entier(1, 28)),
        montant: entre(25, 130), cat1: "Dépense Courante", cat2: "Habillement",
        cat3: "Prêt-à-porter", ville: piocher(VILLES), dc: "Débit", label: "Habillement",
      });
    }
  }

  // ── Dépenses occasionnelles ────────────────────────────────────────
  const nbOcc = maigre ? 1 : dernier ? entier(1, 3) : entier(3, 7);
  const occasionnelles = [
    ["Restaurant", "Alimentation", MARCHANDS_DIVERS, 22, 95],
    ["Loisirs", "Loisir", MARCHANDS_LOISIR, 9, 68],
    ["Équipement", "Autre", MARCHANDS_MAISON, 18, 240],
    ["Cadeaux", "Autre", MARCHANDS_DIVERS, 15, 120],
  ];
  for (let i = 0; i < nbOcc; i++) {
    const [type, cat2, marchands, min, max] = piocher(occasionnelles);
    tx({
      compte: parfois(0.5) ? COMPTE_APPLI : COMPTE_PART_COMMUNE,
      type, date: dateDans(mk, entier(1, 28)), montant: entre(min, max),
      cat1: "Dépense Occasionnelle", cat2, cat3: piocher(marchands),
      ville: piocher(VILLES), dc: "Débit", label: type,
    });
  }

  // ── Épargne ────────────────────────────────────────────────────────
  if (!maigre) {
    tx({
      compte: COMPTE_PRINCIPAL, type: "Épargne Banque A", date: dateDans(mk, 26),
      montant: 150, cat2: "Comptes Bancaires", dc: "Débit", label: "Virement épargne",
    });
    tx({
      compte: COMPTE_PRINCIPAL, type: "Épargne Banque C", date: dateDans(mk, 26),
      montant: 200, cat2: "Comptes Bancaires", dc: "Débit", label: "Virement épargne",
    });
    tx({
      compte: COMPTE_PRINCIPAL, type: "Assurance-vie", date: dateDans(mk, 26),
      montant: 120, cat2: "Comptes Bancaires", dc: "Débit", label: "Versement assurance-vie",
    });
    if (parfois(0.3)) {
      tx({
        compte: COMPTE_PRINCIPAL, type: "Épargne Banque B", date: dateDans(mk, entier(10, 25)),
        montant: entre(50, 300), cat2: "Comptes Bancaires", dc: "Débit", label: "Virement épargne",
      });
    }
    if (parfois(0.2)) {
      tx({
        compte: COMPTE_APPLI, type: "Cagnotte partagée", date: dateDans(mk, entier(5, 25)),
        montant: entre(20, 90), cat2: "Comptes Bancaires", dc: "Débit", label: "Cagnotte",
      });
    }
  }

  // ── Compte secondaire : quelques achats, pour qu'il ne reste pas figé ──
  if (!maigre) {
    for (let i = 0; i < entier(0, 2); i++) {
      tx({
        compte: COMPTE_B_COURANT, type: "CB", date: dateDans(mk, entier(1, 28)),
        montant: entre(12, 70), cat1: "Dépense Occasionnelle", cat2: "Autre",
        cat3: piocher(MARCHANDS_DIVERS), ville: piocher(VILLES), dc: "Débit", label: "Achat carte",
      });
    }
  }

  // ── Sortie d'épargne, rare ─────────────────────────────────────────
  if (parfois(0.08)) {
    tx({
      compte: COMPTE_SORTIE_EPARGNE, type: "Sortie Epargne", date: dateDans(mk, entier(5, 25)),
      montant: entre(200, 900), cat2: "Comptes Bancaires", dc: "Crédit", label: "Retrait épargne",
    });
  }

  // ── Recettes annexes ───────────────────────────────────────────────
  tx({
    compte: COMPTE_TR, type: "Ticket Restaurant", date: dateDans(mk, 4),
    montant: entre(112, 132), cat2: "Comptes Bancaires", dc: "Crédit", label: "Dotation titres",
  });
  if (parfois(0.25)) {
    tx({
      compte: COMPTE_JOINT_B, type: "Virement extérieur", date: dateDans(mk, entier(5, 25)),
      montant: entre(40, 380), cat2: "Comptes Bancaires", dc: "Crédit", label: "Remboursement",
    });
  }
}

transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

// ═══════════════════════════════════════════════════════════════════════
// 6. PAIE — 5 ANS
// ═══════════════════════════════════════════════════════════════════════

/** Changements d'employeur, en dur pour rester reproductibles. */
const CHANGEMENTS = [
  { depuis: "2021-09", entreprise: EMPLOYEURS[0], base: 2180 },
  { depuis: "2022-06", entreprise: EMPLOYEURS[1], base: 2340 },
  { depuis: "2023-04", entreprise: EMPLOYEURS[2], base: 2520 },
  { depuis: "2024-05", entreprise: EMPLOYEURS[3], base: 2740 },
  { depuis: "2025-06", entreprise: EMPLOYEURS[4], base: 2890 },
];

function posteDuMois(mk) {
  let courant = CHANGEMENTS[0];
  for (const c of CHANGEMENTS) if (mk >= c.depuis) courant = c;
  return courant;
}

const paie = MOIS_PAIE.map((mk) => {
  const poste = posteDuMois(mk);
  const net = euros(poste.base * entre(0.985, 1.035));
  const cotSal = euros(net * entre(0.235, 0.255));
  const brut = euros(net + cotSal);
  const mois = Number(mk.slice(5));
  // Prime en juin et en décembre, comme beaucoup de conventions.
  const indem = mois === 6 || mois === 12 ? euros(entre(380, 950)) : 0;
  return { mk, entreprise: poste.entreprise, brut, net: euros(net + indem), cotSal, indem, retenues: euros(entre(0, 42)) };
});

const dernierePaie = paie[paie.length - 1];

const cotLast = [
  ["Sécurité sociale — maladie", euros(dernierePaie.brut * 0.0075)],
  ["Vieillesse plafonnée", euros(dernierePaie.brut * 0.069)],
  ["Vieillesse déplafonnée", euros(dernierePaie.brut * 0.004)],
  ["Retraite complémentaire", euros(dernierePaie.brut * 0.0387)],
  ["Assurance chômage", euros(dernierePaie.brut * 0.0)],
  ["CSG déductible", euros(dernierePaie.brut * 0.068)],
  ["CSG/CRDS non déductible", euros(dernierePaie.brut * 0.029)],
  ["Mutuelle", euros(dernierePaie.brut * 0.011)],
  ["Prévoyance", euros(dernierePaie.brut * 0.009)],
];

const patronLast = [
  ["Maladie — part employeur", euros(dernierePaie.brut * 0.13)],
  ["Vieillesse — part employeur", euros(dernierePaie.brut * 0.104)],
  ["Allocations familiales", euros(dernierePaie.brut * 0.0345)],
  ["Retraite complémentaire", euros(dernierePaie.brut * 0.0587)],
  ["Assurance chômage", euros(dernierePaie.brut * 0.0405)],
  ["Accidents du travail", euros(dernierePaie.brut * 0.0122)],
  ["Formation et apprentissage", euros(dernierePaie.brut * 0.0168)],
];

// ═══════════════════════════════════════════════════════════════════════
// 7. RÉFÉRENCES PUBLIQUES — VRAIES DONNÉES, SOURCÉES
// ═══════════════════════════════════════════════════════════════════════
//
// Ces séries ne sont PAS inventées. Comparer un salaire à une inflation
// imaginaire n'apprendrait rien à personne.

const CONSULTE_LE = "2026-09-15";

/** Inflation, moyenne annuelle, ensemble des ménages, France. Source INSEE. */
const INFLATION_ANNUELLE = {
  2013: 0.9, 2014: 0.5, 2015: 0.0, 2016: 0.2, 2017: 1.0,
  2018: 1.8, 2019: 1.1, 2020: 0.5, 2021: 1.6, 2022: 5.2,
  2023: 4.9, 2024: 2.0, 2025: 0.9,
};

/** Détail par grand poste — publié pour 2024 et 2025 seulement. */
const INFLATION_POSTES = {
  2024: { alimentation: 1.4, services: 2.7, energie: 2.3, transports: 2.5, manufactures: 0.0 },
  2025: { alimentation: 1.2, services: 2.3, energie: -5.6, transports: 0.5, manufactures: -0.3 },
};

const inflation = Object.entries(INFLATION_ANNUELLE).map(([year, taux]) => {
  const p = INFLATION_POSTES[year];
  return {
    year,
    rate_annual: taux,
    rate_alimentation: p ? p.alimentation : null,
    rate_services: p ? p.services : null,
    rate_energie: p ? p.energie : null,
    rate_transports: p ? p.transports : null,
    rate_produits_manufactures: p ? p.manufactures : null,
  };
});

const inflationByCategory = inflation.filter((i) => i.rate_alimentation !== null);

/**
 * SMIC MENSUEL — série reprise du tableau de bord d'origine.
 *
 * `net_monthly` et `date_effective` sont les valeurs de la table
 * `smic_history` de l'application réelle, recopiées sans modification :
 * la démo doit calculer le pouvoir d'achat avec la même référence que
 * l'original, sinon les deux ne se compareraient plus.
 *
 * `brut_monthly` et `brut_hourly` sont ajoutés ici — ils n'existent pas dans
 * la base d'origine. Ce sont les valeurs légales publiées, en vigueur au 1er
 * janvier de l'année, hors Mayotte. Ils servent de contrôle : le rapport
 * net/brut doit rester dans une plage plausible, et un test le vérifie.
 *
 * Ce que dit ce rapport, année par année :
 *   2013-2018  0,776 à 0,783   nets publiés de l'époque, avant le transfert
 *                              de cotisations vers la CSG
 *   2019-2026  0,7916          rapport stable, appliqué à la DERNIÈRE
 *                              revalorisation de l'année
 *
 * ⚠️ UNE EXCEPTION, dans la base d'origine. 2024 vaut 1 398,70 €, soit
 * 0,7916 × 1 766,92 € — le brut du 1er janvier. Les autres années d'après
 * 2019 utilisent la dernière revalorisation ; pour 2024 ce serait celle du
 * 01/11/2024 (1 801,80 € brut, soit 1 426,30 € net). La valeur n'est pas
 * recalculée ici : on ne corrige pas en silence la référence de l'original.
 * Signalé pour arbitrage côté privé.
 */
const SMIC = {
  2013: { net: 1120.43, effet: "01/01/2013", brut: 1430.22, horaire: 9.43 },
  2014: { net: 1128.70, effet: "01/01/2014", brut: 1445.38, horaire: 9.53 },
  2015: { net: 1135.99, effet: "01/01/2015", brut: 1457.52, horaire: 9.61 },
  2016: { net: 1141.61, effet: "01/01/2016", brut: 1466.62, horaire: 9.67 },
  2017: { net: 1149.07, effet: "01/01/2017", brut: 1480.30, horaire: 9.76 },
  2018: { net: 1173.60, effet: "01/01/2018", brut: 1498.47, horaire: 9.88 },
  2019: { net: 1204.19, effet: "01/01/2019", brut: 1521.22, horaire: 10.03 },
  2020: { net: 1219.00, effet: "01/01/2020", brut: 1539.42, horaire: 10.15 },
  2021: { net: 1258.00, effet: "01/01/2021", brut: 1554.58, horaire: 10.25 },
  2022: { net: 1329.05, effet: "01/01/2022", brut: 1603.12, horaire: 10.57 },
  2023: { net: 1383.20, effet: "01/01/2023", brut: 1709.28, horaire: 11.27 },
  2024: { net: 1398.70, effet: "01/01/2024", brut: 1766.92, horaire: 11.65 },
  2025: { net: 1426.30, effet: "01/01/2025", brut: 1801.80, horaire: 11.88 },
  2026: { net: 1478.00, effet: "01/01/2026", brut: 1823.03, horaire: 12.02 },
};

const smic = Object.entries(SMIC).map(([year, v]) => ({
  year,
  net_monthly: v.net,
  date_effective: v.effet,
  brut_monthly: v.brut,
  brut_hourly: v.horaire,
}));

const references = {
  _lisez_moi:
    "Données publiques réelles. Tout le reste du jeu de démonstration est inventé.",
  consulte_le: CONSULTE_LE,
  sources: [
    {
      serie: "inflation",
      libelle: "Indice des prix à la consommation — moyenne annuelle, ensemble des ménages, France",
      producteur: "INSEE",
      url: "https://www.insee.fr/fr/statistiques/8726461",
      note:
        "Taux 2013-2025. Détail par grand poste publié pour 2024 et 2025 seulement. " +
        "Série vérifiée sur insee.fr : identique, valeur par valeur, à celle du tableau de bord d'origine.",
    },
    {
      serie: "smic",
      libelle: "SMIC mensuel net (35 h, 151,67 h/mois), et brut de contrôle",
      producteur: "INSEE / valeurs légales publiées au Journal officiel",
      url: "https://www.insee.fr/fr/statistiques/1375188",
      note:
        "net_monthly et date_effective sont repris sans modification de la base de référence " +
        "du tableau de bord d'origine, pour que la démo calcule le pouvoir d'achat avec la même " +
        "référence. brut_monthly et brut_hourly sont ajoutés comme contrôle : valeurs légales en " +
        "vigueur au 1er janvier, hors Mayotte. Rapport net/brut : 0,776 à 0,783 avant 2019 (nets " +
        "publiés de l'époque), 0,7916 ensuite.",
    },
  ],
  inflation,
  inflationByCategory,
  smic,
};

// ═══════════════════════════════════════════════════════════════════════
// 8. CONFIGURATION, SOLDES, OBJECTIFS
// ═══════════════════════════════════════════════════════════════════════

const config = {
  _lisez_moi: "Jeu de démonstration — données fictives. Voir scripts/generate-demo-data.mjs.",
  demo: true,
  init: {
    [COMPTE_PRINCIPAL]: 4200,
    [COMPTE_JOINT_B]: 1350,
    [COMPTE_JOINT_C]: 980,
    [COMPTE_TR]: 145,
    [COMPTE_B_COURANT]: 2600,
  },
  transfers: ["Transfert Banque A vers Banque C", "Transfert Banque A vers Banque B"],
  comptes: [
    COMPTE_PRINCIPAL, COMPTE_PART_COMMUNE, COMPTE_B_COURANT,
    COMPTE_JOINT_B, COMPTE_JOINT_C, COMPTE_TR, COMPTE_APPLI,
  ],
  comptesLiesPrincipal: [COMPTE_PART_COMMUNE, COMPTE_APPLI],
  colors: {},
  pret: {
    montant: PRET.montant,
    mensualite: PRET.mensualite,
    echeances: PRET.echeances,
    premiere_echeance: PRET.premiereEcheance,
  },
  // Bornes DÉCLARÉES de la période couverte par la source.
  // ⚠️ Champ inerte aujourd'hui : l'application infère encore ses bornes
  // (régime 2 de docs/CONTRAT_COUVERTURE.md). Le régime 1, qui lira ceci,
  // est branché au lot B.
  couverture: {
    debut: `${TX_PREMIER_MOIS}-01`,
    fin: `${TX_DERNIER_MOIS}-${String(TX_DERNIER_JOUR).padStart(2, "0")}`,
  },
};

/** Objectifs de budget par sous-catégorie. Volontairement inégaux. */
const budgets = [
  { cat2: "Alimentation", target: 620, active: true },
  { cat2: "Transport", target: 180, active: true },
  { cat2: "Loisir", target: 140, active: true },
  { cat2: "Santé", target: 60, active: true },
  { cat2: "Habillement", target: 70, active: true },
  { cat2: "Immobilier", target: 1150, active: true },
  { cat2: "Assurances", target: 110, active: true },
  { cat2: "Autre", target: 200, active: true },
  { cat2: "Impots", target: 212, active: true },
  { cat2: "Banque", target: null, active: false },
  { cat2: "Comptes Bancaires", target: null, active: false },
].map((b) => ({ ...b, updated_at: `${CONSULTE_LE}T09:00:00.000Z` }));

// ═══════════════════════════════════════════════════════════════════════
// 9. ENCODAGE DICTIONNAIRE (format attendu par src/utils/decode.ts)
// ═══════════════════════════════════════════════════════════════════════

const table = [];
const index = new Map();
function idx(v) {
  if (v === "") return -1;
  if (!index.has(v)) {
    index.set(v, table.length);
    table.push(v);
  }
  return index.get(v);
}
/** cat1 est lu sans test de -1 : il lui faut toujours un index valide. */
function idxObligatoire(v) {
  if (!index.has(v)) {
    index.set(v, table.length);
    table.push(v);
  }
  return index.get(v);
}

const lignes = transactions.map((t) => [
  idxObligatoire(t.compte),
  idxObligatoire(t.type),
  t.date,
  t.montant,
  idxObligatoire(t.cat1),
  idx(t.cat2),
  idx(t.cat3),
  idx(t.cat4),
  idx(t.ville),
  idxObligatoire(t.dc),
  idx(t.label),
]);

const transactionsJSON = {
  s: table,
  t: lignes,
  fields: ["compte", "type", "date", "montant", "cat1", "cat2", "cat3", "cat4", "ville", "dc", "label"],
};

const salaryJSON = {
  months: paie,
  cotLast,
  patronLast,
  lastMonth: dernierePaie.mk,
};

// ═══════════════════════════════════════════════════════════════════════
// 10. ÉCRITURE
// ═══════════════════════════════════════════════════════════════════════

mkdirSync(SORTIE, { recursive: true });

function ecrire(nom, donnees, compact = false) {
  const texte = compact ? JSON.stringify(donnees) : JSON.stringify(donnees, null, 2);
  writeFileSync(join(SORTIE, nom), texte + "\n", "utf8");
  return texte.length + 1;
}

const tailles = {
  "transactions.json": ecrire("transactions.json", transactionsJSON, true),
  "salary.json": ecrire("salary.json", salaryJSON),
  "config.json": ecrire("config.json", config),
  "budgets.json": ecrire("budgets.json", budgets),
  "references.json": ecrire("references.json", references),
};

// ═══════════════════════════════════════════════════════════════════════
// 11. COMPTE RENDU
// ═══════════════════════════════════════════════════════════════════════

const moisAvecDepense = new Set(
  transactions.filter((t) => t.dc === "Débit").map((t) => t.date.slice(0, 7))
);

console.log(`Graine ${GRAINE} — mêmes fichiers à chaque exécution.\n`);
console.log(`Transactions   ${transactions.length} lignes, ${MOIS_TX.length} mois (${TX_PREMIER_MOIS} → ${TX_DERNIER_MOIS})`);
console.log(`Table de chaînes ${table.length} entrées`);
console.log(`Paie           ${paie.length} mois (${PAIE_PREMIER_MOIS} → ${PAIE_DERNIER_MOIS}), ${EMPLOYEURS.length} employeurs`);
console.log(`Prêt           ${PRET.montant} € / ${PRET.mensualite} € / ${PRET.echeances} échéances, 1re en ${PRET.premiereEcheance}`);
console.log(`Mois sans aucune dépense : ${MOIS_TX.filter((m) => !moisAvecDepense.has(m)).join(", ") || "aucun"}`);
console.log(`Mois volontairement incomplets : ${[...MOIS_INCOMPLETS].join(", ")}`);
console.log(`Mois comparables attendus : ${MOIS_TX.length - 2} (bornes exclues)\n`);
for (const [nom, octets] of Object.entries(tailles)) {
  console.log(`  ${nom.padEnd(20)} ${String(octets).padStart(8)} o`);
}
