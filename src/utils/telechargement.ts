// ── Téléchargement d'un fichier produit dans le navigateur ───────────────
//
// Isolé ici pour deux raisons : le hook qui l'appelle est testé avec un Worker
// simulé, et cette fonction touche au DOM. Séparées, les deux se testent
// chacune pour ce qu'elles font.

/**
 * Propose au navigateur d'enregistrer des octets sous un nom de fichier.
 *
 * L'URL temporaire est libérée immédiatement après le clic : sans cela, les
 * octets restent en mémoire jusqu'à la fermeture de l'onglet.
 */
export function telechargerOctets(
  octets: Uint8Array,
  nomFichier: string,
  typeMime = "application/octet-stream"
): void {
  // Recopie dans un ArrayBuffer franc. `Uint8Array` peut, selon le typage de
  // la bibliothèque standard, s'appuyer sur un `SharedArrayBuffer` — que
  // `Blob` n'accepte pas. La copie lève l'ambiguïté au lieu de la masquer par
  // une assertion de type.
  const copie = new Uint8Array(octets);
  const blob = new Blob([copie.buffer as ArrayBuffer], { type: typeMime });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Type MIME d'un classeur `.xlsx`. */
export const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
