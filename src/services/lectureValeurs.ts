// ── Lecture des valeurs d'une cellule ────────────────────────────────────
//
// Trois fonctions, une règle : **on ne devine jamais**. Une valeur qu'on ne
// sait pas lire rend `null`, et l'appelant en fait un rejet nommé. Le lecteur
// de l'ancien format, lui, transformait un montant illisible en 0 — sans un
// mot. C'est le défaut que tout le lot B existe pour supprimer.

import * as XLSX from "xlsx";

/**
 * Normalise une clé — nom de colonne, nom de feuille, libellé de paramètre.
 *
 * Sans casse, sans accents, espaces de bord retirés, espaces internes
 * réduits à un seul. « CATÉGORIE », « Catégorie » et « catégorie  » sont la
 * même chose.
 */
export function normaliserCle(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Nettoie une chaîne lue dans une cellule, sans toucher aux espaces internes. */
export function nettoyerTexte(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\u00a0/g, " ").trim();
}

const AN_MIN = 1990;
const AN_MAX = 2100;

/**
 * Lit une date. Trois écritures acceptées : série Excel, `AAAA-MM-JJ`,
 * `JJ/MM/AAAA`. Rend `null` pour tout le reste, y compris une date hors de
 * l'intervalle 1990-2100 — presque toujours le signe d'une colonne décalée.
 *
 * ⚠️ La série Excel passe par `XLSX.SSF.parse_date_code` et JAMAIS par un
 * objet `Date`. Un `Date` est construit en heure locale : en Europe/Paris, la
 * conversion rendait la veille sur 100 % des lignes (défaut du 11/08/2026).
 */
export function lireDate(v: unknown): string | null {
  if (v == null || v === "") return null;

  if (typeof v === "number" && isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d || !d.y || !d.m || !d.d) return null;
    if (d.y < AN_MIN || d.y > AN_MAX) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }

  const t = nettoyerTexte(v);

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return dateValide(+iso[1], +iso[2], +iso[3]) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;

  const fr = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const [, j, m, a] = fr;
    if (!dateValide(+a, +m, +j)) return null;
    return `${a}-${m.padStart(2, "0")}-${j.padStart(2, "0")}`;
  }

  return null;
}

function dateValide(a: number, m: number, j: number): boolean {
  if (a < AN_MIN || a > AN_MAX || m < 1 || m > 12 || j < 1 || j > 31) return false;
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

/**
 * Lit un nombre. Accepte le point et la virgule, retire les espaces (y compris
 * insécables) et le symbole €. Rend `null` dès que le reste n'est pas un
 * nombre — jamais 0.
 */
export function lireNombre(v: unknown): number | null {
  if (typeof v === "number") return isFinite(v) ? arrondir(v) : null;
  if (v == null) return null;

  const t = nettoyerTexte(v).replace(/[\s\u00a0]/g, "").replace(/€/g, "").replace(",", ".");
  if (t === "") return null;
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;

  const n = Number(t);
  return isFinite(n) ? arrondir(n) : null;
}

/** Arrondi au centime. Deux décimales, pas plus. */
export function arrondir(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Clé de mois « AAAA-MM » depuis une date ou un texte `AAAA-MM`. */
export function lireMois(v: unknown): string | null {
  const t = nettoyerTexte(v);
  if (/^\d{4}-\d{2}$/.test(t)) {
    const m = Number(t.slice(5));
    return m >= 1 && m <= 12 ? t : null;
  }
  const d = lireDate(v);
  return d ? d.slice(0, 7) : null;
}
