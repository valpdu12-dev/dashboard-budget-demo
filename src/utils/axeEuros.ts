// ── Axe vertical en euros, sur UNE ligne ─────────────────────────────────
// Points ouverts Patrimoine (29/10/2026). `fmtShort` écrit « 700,00 € » sous
// 1 000 € : sur mobile, Recharts coupe à l'espace et l'étiquette passe sur
// deux lignes (« 700,00 / € »). Ici : pas de centimes sous 1 000 €, et des
// espaces insécables, que Recharts ne coupe pas. Utilisé par la page
// Patrimoine seulement : `fmtShort`, partagé par les autres pages, ne change pas.
import { fmtShort } from "@/utils/formatters";

const INSECABLE = "\u00a0";

/** 1 400 → « 1,4 k€ » ; 700 → « 700 € » ; −350 → « −350 € » ; 0 → « 0 € ». */
export function fmtAxe(v: number): string {
  if (!Number.isFinite(v)) return `0${INSECABLE}€`;
  if (Math.abs(v) >= 1000) return fmtShort(v).replace(/ /g, INSECABLE);
  const n = Math.round(v);
  return `${n < 0 ? "−" : ""}${Math.abs(n)}${INSECABLE}€`;
}
