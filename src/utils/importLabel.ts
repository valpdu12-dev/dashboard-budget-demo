// ── Libellé d'origine des données affichées ──────────────────────────────
//
// Vit ici plutôt que dans `DataUploader` : la règle `react-refresh` du lint
// interdit à un fichier de composants d'exporter autre chose que des
// composants, et cette fonction doit être testable seule.

/** `2026-08-11T18:00:00Z` → `11/08/2026`. */
function jourFr(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Phrase décrivant l'origine des données affichées, pour le bandeau vert.
 *
 * Le nom de fichier et la date sont facultatifs : un import mémorisé par une
 * version antérieure du dashboard n'en porte pas, et le bandeau doit rester
 * lisible dans ce cas plutôt que d'afficher « undefined ».
 */
export function fmtImportOrigine(
  fileName: string | null,
  importedAt: string | null
): string {
  const base = fileName
    ? `les donnees de « ${fileName} »`
    : "des donnees importees";
  if (!importedAt) return base;
  const jour = jourFr(importedAt);
  return jour ? `${base}, importees le ${jour}` : base;
}
