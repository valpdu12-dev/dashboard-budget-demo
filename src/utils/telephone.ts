// ── Textes de l'en-tête et des filtres au téléphone ───────────────────────────
//
// Le petit écran (< 768 px) : titre de la page à gauche, pastille à droite,
// bouton « Filtres (n) ». Ces fonctions ne calculent aucun chiffre : elles
// donnent seulement des mots. Tests : src/__tests__/utils/telephone.test.ts.

import type { Cat1Filter, PeriodKey } from "@/types";

/** Titre de chaque page, par chemin (celui de la barre du bas ou des pilules). */
const TITRES: Record<string, string> = {
  "/": "Comptes",
  "/depenses": "Dépenses",
  "/depenses/budget": "Budget",
  "/revenus": "Recettes",
  "/revenus/salaire": "Salaire",
  "/revenus/inflation": "Salaire et inflation",
  "/patrimoine": "Épargne",
  "/patrimoine/pret": "Prêt immobilier",
  "/patrimoine/soldes": "Patrimoine",
  "/insights": "Insights",
  "/parametres": "Paramètres",
};

/** « /depenses/budget/ » → « Budget ». Chemin inconnu : « Page introuvable » (le routeur affiche PageIntrouvable). */
export function titrePage(chemin: string): string {
  const propre = chemin.length > 1 ? chemin.replace(/\/+$/, "") : chemin;
  return Object.prototype.hasOwnProperty.call(TITRES, propre) ? TITRES[propre] : "Page introuvable";
}

/** « 2026-11 » → « nov. 2026 ». Vide ou illisible : « ». */
export function moisCourt(mois: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mois ?? "");
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(d);
}

const PERIODES: Record<PeriodKey, string> = {
  "1M": "1 mois",
  "3M": "3 mois",
  "6M": "6 mois",
  YTD: "Depuis janvier",
  "12M": "12 mois",
  all: "Tout",
};

const CLASSES: Record<Cat1Filter, string> = {
  all: "toutes classes",
  "Dépense Fixe": "Fixe",
  "Dépense Courante": "Courante",
  "Dépense Occasionnelle": "Occasionnelle",
};

/** Le petit texte à côté du bouton : « Depuis janvier · toutes classes ». */
export function resumeFiltres(period: PeriodKey, cat1: Cat1Filter, showTransfers: boolean): string {
  const morceaux = [PERIODES[period] ?? String(period), CLASSES[cat1] ?? String(cat1)];
  if (showTransfers) morceaux.push("transferts");
  return morceaux.join(" · ");
}

/** Le nombre du bouton « Filtres (n) » : les filtres changés, hors période (déjà écrite à côté). */
export function nombreFiltres(cat1: Cat1Filter, showTransfers: boolean): number {
  return (cat1 !== "all" ? 1 : 0) + (showTransfers ? 1 : 0);
}

/**
 * « 10 520,16 € » → ["10 520", ",16 €"] (centimes en gris au téléphone).
 * Seulement un montant en euros avec deux décimales ; sinon null (le texte reste entier).
 * Les deux morceaux remis bout à bout redonnent le texte exact.
 */
export function centimesAPart(texte: string): [string, string] | null {
  const m = /^(.*\d)(,\d{2}\s?€)$/u.exec(texte);
  return m ? [m[1], m[2]] : null;
}
