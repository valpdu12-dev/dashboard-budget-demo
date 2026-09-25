// ── Palettes de couleurs (migrées depuis V1 helpers.js) ──────────────────

// ⚠️ LOT C.5 — QUATRE TABLES ONT ÉTÉ SUPPRIMÉES D'ICI :
//
//   `COMPTE_COLORS`, `ORG_COLORS`, `ENT_COLORS`, `EPARGNE_COLORS` — une
//   couleur par libellé, et ces libellés étaient ceux de l'auteur. Elles ne
//   servaient qu'au jeu de démonstration ; tout autre fichier tombait déjà
//   sur `couleurStable` depuis le lot A.2.
//
// Les couleurs viennent maintenant de `hooks/useCouleurs.ts` : ce que la
// source déclare, sinon le repli stable. `CAT2_COLORS` est partie aussi — les
// postes de budget déclarent leur couleur dans le fichier.

export const DONUT_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#06b6d4",
  "#84cc16", "#a855f7", "#fb7185",
];

export const TYPE_COLORS = [
  "#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6", "#22c55e",
  "#84cc16", "#eab308", "#f59e0b", "#f97316", "#ef4444",
  "#ec4899", "#a855f7", "#8b5cf6", "#64748b", "#78716c",
  "#0d9488", "#0284c7", "#7c3aed", "#c026d3", "#e11d48",
];

// ── Couleur de repli déterministe ────────────────────────────────────────
//
// Les tables ci-dessus ne connaissent que les valeurs du jeu de
// démonstration. Au-delà — un 5e organisme, un 8e compte, un 30e employeur —
// une recherche directe renvoyait `undefined`. Le trait du graphique
// devenait invisible, la pastille transparente, sans erreur ni avertissement.
//
// `couleurStable` donne toujours une couleur, et toujours LA MÊME pour un nom
// donné : un employeur ne change pas de couleur entre deux rendus, ni entre
// deux pages. Le hachage est FNV-1a, choisi pour sa simplicité, pas pour ses
// qualités cryptographiques.

export function couleurStable(
  nom: string,
  palette: readonly string[] = DONUT_COLORS
): string {
  let h = 2166136261;
  for (let i = 0; i < nom.length; i++) {
    h ^= nom.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return palette[Math.abs(h) % palette.length];
}

// Les quatre fonctions `couleurCompte`, `couleurOrganisme`, `couleurEmployeur`
// et `couleurEpargne` vivaient ici. Elles consultaient d'abord une table de
// libellés. Elles sont remplacées par `hooks/useCouleurs.ts`, qui consulte
// d'abord la CONFIGURATION DÉCLARÉE.
