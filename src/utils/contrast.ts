// ── Contraste WCAG ───────────────────────────────────────────────────────
// Lot 1.6 — accessibilité.
//
// Pourquoi ce module existe. Après la correction des tokens de palette
// (`text-sec`, `indigo-text`, `indigo-deep`), il restait 4 nœuds
// `color-contrast` en échec, tous de la même forme : une valeur de carte KPI
// rendue dans une COULEUR DE DONNÉE, passée en `style={{ color }}` depuis
// `config/colors.ts` — la couleur du compte ou de la catégorie concernée.
//
//   #6366F1 → 3,97   #2563EB → 3,43   #DC2626 → 3,67   #64748B → 3,72
//   (sur `surface` #111827, 18 px gras, seuil AA = 4,5:1)
//
// Ces valeurs ne sont pas des tokens de design : ce sont des identifiants
// visuels qui servent AUSSI à colorer les secteurs de graphique, où le seuil
// applicable est celui du non-texte (3:1) et où elles passent toutes. Les
// éclaircir dans `colors.ts` aurait déplacé toute la charte graphique pour
// corriger 4 nœuds de texte.
//
// D'où cette fonction : elle n'est appliquée qu'au TEXTE, à l'affichage, et
// laisse `colors.ts` intact.

/** Composantes RVB 0-255 d'une couleur `#rgb` ou `#rrggbb`. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  const court = /^[0-9a-f]{3}$/i.test(h);
  const long = /^[0-9a-f]{6}$/i.test(h);
  if (!court && !long) return null;
  const plein = court ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(plein.slice(0, 2), 16),
    parseInt(plein.slice(2, 4), 16),
    parseInt(plein.slice(4, 6), 16),
  ];
}

const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

/** Luminance relative WCAG 2.1 (§ relative luminance). */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs, de 1 à 21. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Éclaircit `fg` vers le blanc, par pas de 2 %, jusqu'à atteindre `cible` de
 * contraste sur `bg`. Renvoie `fg` inchangé s'il est déjà conforme, et le
 * blanc si même lui n'y suffit pas (cas impossible sur un fond sombre, mais
 * la fonction ne doit pas boucler).
 *
 * Le déplacement vers le blanc — plutôt qu'une correction en HSL — garde la
 * teinte reconnaissable : #2563EB (bleu CA) reste bleu, #DC2626 (rouge
 * Titres-restaurant) reste rouge. C'est ce qui compte ici, puisque la couleur sert
 * d'identifiant visuel entre la carte KPI et le graphique.
 */
export function ensureContrast(fg: string, bg: string, cible = 4.5): string {
  const rgb = hexToRgb(fg);
  if (!rgb || !hexToRgb(bg)) return fg;

  const actuel = contrastRatio(fg, bg);
  if (actuel === null || actuel >= cible) return fg;

  const [r0, g0, b0] = rgb;
  for (let i = 1; i <= 50; i += 1) {
    const t = i / 50;
    const candidat = rgbToHex(
      r0 + (255 - r0) * t,
      g0 + (255 - g0) * t,
      b0 + (255 - b0) * t
    );
    const ratio = contrastRatio(candidat, bg);
    if (ratio !== null && ratio >= cible) return candidat;
  }
  return "#ffffff";
}

/** Fond des cartes KPI (`surface`). Constante pour éviter la divergence. */
export const FOND_SURFACE = "#111827";
