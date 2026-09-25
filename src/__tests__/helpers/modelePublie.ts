// ── Le classeur modèle PUBLIÉ — lot F.5 ──────────────────────────────────
//
// Les tests lisent le fichier que le bouton télécharge, tel qu'il est publié :
// `public/modele/Budget_modele.xlsx`. Plus de fabrication en mémoire — la
// fonction qui le faisait a disparu avec `modeleExcel.ts` (F9). Ce fichier
// est lui-même contrôlé par `npm run modele` : il est exactement ce que
// `scripts/generer-modele.mjs` produit.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const CHEMIN_MODELE = resolve(__dirname, "../../../public/modele/Budget_modele.xlsx");

/** Les octets du modèle publié. */
export function octetsModele(): Uint8Array {
  return new Uint8Array(readFileSync(CHEMIN_MODELE));
}

/** Les mêmes, en ArrayBuffer — la forme que reçoit le worker. */
export function modeleEnArrayBuffer(): ArrayBuffer {
  const o = octetsModele();
  return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength) as ArrayBuffer;
}
