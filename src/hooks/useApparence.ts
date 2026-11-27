// ── L'apparence du moment (téléphone ? Nuit ?) ──────────────────────────────
//
// Le CSS change seul de couleurs (src/index.css). Mais quelques couleurs sont
// calculées en JavaScript : `ensureContrast` relève une couleur de compte
// contre le FOND de la carte (blanc en Jour, #131519 en Nuit). Ce hook le donne.
// Jour ou Nuit à toutes les largeurs. Sans matchMedia (jsdom, tests) : grand
// écran ; sans data-theme : Jour.
import { useSyncExternalStore } from "react";
import { assombrirPourContraste, ensureContrast } from "@/utils/contrast";
import { themeActuel } from "@/theme";

// Même palier que Tailwind (`max-md:` = « not all and (min-width: 768px) »)
// et que src/index.css : le téléphone, c'est « pas (min-width: 768px) ».
const Q_GRAND = "(min-width: 768px)";

export const FOND_CARTE_JOUR = "#ffffff";   // --ds-surface (Jour)
export const FOND_CARTE_NUIT = "#131519";   // --ds-surface (Nuit)

function requete(q: string): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(q) : null;
}

// Jour ou Nuit = le thème posé sur la page (data-theme, par
// public/theme.js et src/theme.ts : Auto · Jour · Nuit), plus le réglage de
// l'appareil. On suit la largeur (matchMedia) ET l'attribut (MutationObserver).
function abonner(rappel: () => void): () => void {
  const grand = requete(Q_GRAND);
  if (grand && typeof grand.addEventListener === "function") grand.addEventListener("change", rappel);
  else if (grand) grand.addListener(rappel);
  const obs = typeof MutationObserver !== "undefined" && typeof document !== "undefined" ? new MutationObserver(rappel) : null;
  obs?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    if (grand && typeof grand.removeEventListener === "function") grand.removeEventListener("change", rappel);
    else if (grand) grand.removeListener(rappel);
    obs?.disconnect();
  };
}

/** Largeur et thème en une chaîne (« grand-jour », « tel-nuit »…), pour que React compare sans peine. */
type Etat = "grand-jour" | "grand-nuit" | "tel-jour" | "tel-nuit";
function lire(): Etat {
  const grand = requete(Q_GRAND);
  return `${!grand || grand.matches ? "grand" : "tel"}-${themeActuel()}`;
}

export interface Apparence {
  /** Sous 768 px (même palier que la barre du bas). */
  telephone: boolean;
  /** Thème Nuit (data-theme), à toutes les largeurs. */
  nuit: boolean;
  /** Le fond des cartes. */
  fondCarte: string;
  /** L'accent du thème, en texte (Jour #115e59, Nuit #2dd4bf). */
  accentTexte: string;
  /**
   * Une couleur de compte ou de catégorie, rendue lisible en texte sur ce fond
   * (4,5:1). Nuit : `ensureContrast` (éclaircit). Jour : `assombrirPourContraste`
   * (sur du blanc, éclaircir rendrait du blanc).
   */
  contraste: (couleur: string) => string;
}

export const ACCENT_TEXTE_JOUR = "#115e59";
export const ACCENT_TEXTE_NUIT = "#2dd4bf";

export function useApparence(): Apparence {
  const etat = useSyncExternalStore(abonner, lire, () => "grand-jour" as const);
  const nuit = etat.endsWith("nuit");
  const fondCarte = nuit ? FOND_CARTE_NUIT : FOND_CARTE_JOUR;
  return {
    telephone: etat.startsWith("tel"),
    nuit,
    fondCarte,
    accentTexte: nuit ? ACCENT_TEXTE_NUIT : ACCENT_TEXTE_JOUR,
    contraste: (couleur) => (nuit ? ensureContrast(couleur, fondCarte) : assombrirPourContraste(couleur, fondCarte)),
  };
}
