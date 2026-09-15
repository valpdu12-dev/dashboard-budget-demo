// ── Palettes de couleurs (migrées depuis V1 helpers.js) ──────────────────

export const CAT2_COLORS: Record<string, string> = {
  "Alimentation": "#e67e22",
  "Assurances": "#8e44ad",
  "Autre": "#95a5a6",
  "Banque": "#34495e",
  "Comptes Bancaires": "#7f8c8d",
  "Habillement": "#e84393",
  "Immobilier": "#2980b9",
  "Impots": "#c0392b",
  "Loisir": "#27ae60",
  "Santé": "#00cec9",
  "Transport": "#f39c12",
};

export const COMPTE_COLORS: Record<string, string> = {
  "Banque A - Courant": "#2563eb",
  "Banque B - Compte joint": "#059669",
  "Banque C - Compte joint": "#d97706",
  "Titres-restaurant": "#dc2626",
  "Banque B - Courant": "#0891b2",
  "Total": "#6366f1",
};

export const ORG_COLORS: Record<string, string> = {
  "Banque A": "#2563eb",
  "Banque C": "#d97706",
  "Banque B": "#059669",
  "Titres-restaurant": "#dc2626",
  "Total": "#a78bfa",
};

export const ENT_COLORS: Record<string, string> = {
  "Employeur A": "#22c55e",
  "Employeur B": "#3b82f6",
  "Employeur C": "#f59e0b",
  "Employeur D": "#ef4444",
  "Employeur E": "#8b5cf6",
};

export const EPARGNE_COLORS: Record<string, string> = {
  "Crédit Immobilier": "#3b82f6",
  "Épargne Banque C": "#f59e0b",
  "Épargne Banque A": "#22c55e",
  "Épargne Banque B": "#06b6d4",
  "Assurance-vie": "#8b5cf6",
  "Cagnotte partagée": "#ec4899",
};

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

/** Couleur d'un compte — table connue, sinon repli stable. */
export const couleurCompte = (nom: string): string =>
  COMPTE_COLORS[nom] ?? couleurStable(nom);

/** Couleur d'un organisme — table connue, sinon repli stable. */
export const couleurOrganisme = (nom: string): string =>
  ORG_COLORS[nom] ?? couleurStable(nom);

/** Couleur d'un employeur — table connue, sinon repli stable. */
export const couleurEmployeur = (nom: string): string =>
  ENT_COLORS[nom] ?? couleurStable(nom);

/** Couleur d'un support d'épargne — table connue, sinon repli stable. */
export const couleurEpargne = (nom: string): string =>
  EPARGNE_COLORS[nom] ?? couleurStable(nom);
