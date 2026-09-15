// ── Fonctions de formatage (alignées sur V1 helpers.js) ──────────────────
import { MONTHS_FR } from "@/config/constants";

/**
 * Formate un montant en euros avec séparateur de milliers
 * Ex: 1234.56 → "1 234,56 €"
 */
export function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "0,00 €";
  const neg = v < 0;
  const a = Math.abs(v).toFixed(2);
  const [i, d] = a.split(".");
  const ig = i.replace(/\B(?=(\d{3})+(?!\d))/g, " "); // espace insécable
  return (neg ? "−" : "") + ig + "," + d + " €";
}

/**
 * Format court : 1,2 M€, 3,5 k€, ou fmt() si < 1000
 */
export function fmtShort(v: number): string {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(".", ",") + " M€";
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace(".", ",") + " k€";
  return fmt(v);
}

/**
 * Formate un ratio en pourcentage : 0.153 → "15,3 %"
 */
export function fmtPct(v: number): string {
  return (v * 100).toFixed(1).replace(".", ",") + " %";
}

/**
 * Formate une date ISO en format FR : "2025-03-15" → "15/03/2025"
 */
export function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return day + "/" + m + "/" + y;
}

/**
 * Label de mois court : "2025-03" → "mars 25"
 */
export function mkLabel(mk: string): string {
  const [y, m] = mk.split("-");
  return MONTHS_FR[parseInt(m) - 1] + " " + y.slice(2);
}

/**
 * Label de mois très court (sans année) : "2025-03" → "mars"
 */
export function mkLabelShort(mk: string): string {
  const [, m] = mk.split("-");
  return MONTHS_FR[parseInt(m) - 1];
}

/**
 * Calcul de variation en % entre valeur courante et précédente
 * Retourne une string formatée "+12,3 %" ou "" si pas de comparaison
 */
export function pctChange(cur: number, prev: number): string {
  if (!prev || prev === 0) return "";
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return (pct >= 0 ? "+" : "") + pct.toFixed(1).replace(".", ",") + " %";
}

/**
 * Part d'une valeur dans un total, en pourcentage entier : `"32 %"`.
 *
 * Écrite pour la légende du donut « Répartition par Catégorie ». Sur un
 * `PieChart`, Recharts ne peut pas afficher d'infobulle au glissement du
 * doigt (l'infobulle y dépend des événements souris des secteurs, et
 * `getMouseInfo` rend `null` faute d'axes) : la part est donc écrite en clair
 * plutôt que cachée derrière une interaction impossible sur téléphone.
 *
 * Rend `"—"` quand le total est nul, absent ou négatif — un `0 %` y serait un
 * chiffre inventé, et `NaN %` une fuite d'implémentation.
 */
export function partDuTotal(value: number, total: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return "—";
  return `${Math.round((value / total) * 100)} %`;
}
