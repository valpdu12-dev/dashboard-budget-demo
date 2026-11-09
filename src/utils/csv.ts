/**
 * DM-01 (A7) — une cellule de l'export CSV, sans injection de formule.
 *
 * Excel, LibreOffice et Numbers lisent une cellule qui commence par `=`,
 * `+`, `-` ou `@` comme une FORMULE. Un libellé importé comme
 * `=HYPERLINK("http://…")` deviendrait un lien actif à l'ouverture du CSV.
 * Règle (OWASP, « CSV injection ») : un TEXTE qui commence par l'un de ces
 * caractères — ou par une tabulation ou un retour chariot — est précédé
 * d'une apostrophe, qui le force en texte.
 *
 * Les NOMBRES ne sont jamais touchés : -42,5 reste un nombre négatif.
 */
const DEBUT_DE_FORMULE = /^[=+\-@\t\r]/;

export function celluleCsv(v: unknown, sep: string): string {
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") return String(v);
  let s = String(v);
  if (DEBUT_DE_FORMULE.test(s)) s = "'" + s;
  return s.includes(sep) || s.includes('"') || s.includes("\n") || s.includes("\r")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}
