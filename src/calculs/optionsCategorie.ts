// ── Options des listes « Enseigne » et « Événement » (page Dépenses) ──────
//
// Fonction pure, sans React (comme le reste de `calculs/`).
//
// Les listes sont construites à partir de TOUTES les transactions chargées,
// et non de la période affichée : une liste qui changerait à chaque
// changement de période serait déroutante. Rien n'est écrit en dur : une
// enseigne ajoutée dans le fichier apparaît au prochain import, une enseigne
// supprimée disparaît. Profil « Démo » ou « Mes données » : même calcul.
//
// Règles :
//   - cases vides et « x » (majuscule ou non) exclues — le lecteur du modèle
//     public garde « x » tel quel, c'est donc ici qu'on l'écarte ;
//   - comparaison EXACTE des valeurs : « UBER » et « Uber » restent deux
//     entrées distinctes (les doublons se corrigent dans le fichier) ;
//   - tri alphabétique français (Intl.Collator « fr ») ;
//   - chaque option porte son nombre de transactions ;
//   - aucune valeur → liste vide : la page n'affiche alors pas la liste.

import type { Transaction } from "@/types";

/** Une valeur proposée dans la liste, avec son nombre de transactions. */
export interface OptionCategorie {
  valeur: string;
  nombre: number;
}

/** Colonnes concernées : cat3 = Enseigne, cat4 = Événement. */
export type ChampCategorie = "cat3" | "cat4";

const TRI_FR = new Intl.Collator("fr");

/** Vrai si la valeur ne doit pas être proposée (vide ou « x »). */
function estIgnoree(v: string | null | undefined): boolean {
  const t = (v ?? "").trim();
  return t === "" || t.toLowerCase() === "x";
}

/**
 * Construit la liste triée des valeurs d'une colonne, avec leur compte.
 *
 * Exemple : [« Primeur », « x », « », « Primeur », « Cinéma »]
 *   → [{ Cinéma, 1 }, { Primeur, 2 }]
 */
export function construireOptions(
  transactions: readonly Transaction[],
  champ: ChampCategorie
): OptionCategorie[] {
  const compte = new Map<string, number>();
  for (const t of transactions) {
    const v = t[champ];
    if (estIgnoree(v)) continue;
    compte.set(v, (compte.get(v) ?? 0) + 1);
  }
  return [...compte.entries()]
    .map(([valeur, nombre]) => ({ valeur, nombre }))
    .sort((a, b) => TRI_FR.compare(a.valeur, b.valeur) || (a.valeur < b.valeur ? -1 : 1));
}
