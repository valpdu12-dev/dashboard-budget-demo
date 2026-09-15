// ── Dimensions de graphique pilotées par le palier d'affichage ──────────
//
// Lot 1.2. Avant ce lot, 16 hauteurs et 7 largeurs étaient écrites en dur
// dans les pages. Sur l'A56 (412 px), la surface utile est de 667 px : un
// graphique de 380 px plus son titre dépassait l'écran, et un donut figé à
// 300 px dans un conteneur de 346 px neutralisait tout redimensionnement.
//
// Règle unique de ce module : **au-dessus de 430 px, chaque fonction
// renvoie la valeur d'origine, à l'identique.** Le rendu PC est donc
// inchangé par construction, sans qu'aucune page n'ait à le vérifier.
import { useResponsive } from "./useResponsive";

/**
 * Hauteur maximale d'un graphique sous 430 px.
 *
 * Surface utile mesurée sur l'A56 : 667 px (915 − en-tête − barre du bas). Un
 * graphique de 300 px plus son titre de carte tient largement ; c'est au-delà
 * que l'axe se fait couper par la barre du bas.
 */
const SMALL_HEIGHT_MAX = 300;

/** Rayons de donut hérités des pages (PC). */
export interface DonutRadii {
  inner: number;
  outer: number;
  /** Libellés radiaux autour du donut — remplacés par une légende sous 430 px. */
  showRadialLabels: boolean;
}

export interface ChartSize {
  /** Hauteur de graphique : `basePC` sur PC, réduite et bornée sous 430 px. */
  chartHeight: (basePC: number) => number;
  /**
   * Largeur d'axe Y catégoriel : `basePC` sur PC, `0` sous 430 px — le
   * libellé passe alors au-dessus de sa barre (`<LabelList position="top">`),
   * ce qui rend 100 % de la largeur aux barres au lieu de 54 %.
   */
  axisWidth: (basePC: number) => number;
  /** Rayons de donut, et bascule libellés radiaux → légende sous 430 px. */
  donutRadii: (innerPC: number, outerPC: number) => DonutRadii;
  /** Vrai sous 430 px — pour les cas non couverts par les trois fonctions. */
  isSmall: boolean;
}

/**
 * Hauteur plafonnée — **on écrête, on ne met pas à l'échelle**.
 *
 * Première version du lot 1.2 : `base × 0,72` borné à [200, 300]. Rejeté après
 * essai sur l'appareil — un graphique de 300 px tombait à 216 px et se
 * retrouvait écrasé (axes, légende et courbes comprimés), alors qu'**aucune
 * cible mesurée ne demandait de le réduire**. Le seul défaut relevé par l'audit
 * était le dépassement des 667 px utiles par les graphiques les plus hauts.
 *
 * Écrêter au plafond corrige ce défaut sans en créer un autre : 380 → 300,
 * 350 → 300, 320 → 300, et tout ce qui était déjà à 300 ou moins ne bouge pas.
 */
export function smallHeight(basePC: number): number {
  return Math.min(SMALL_HEIGHT_MAX, basePC);
}

/**
 * Rayons de donut sous 430 px.
 *
 * Les libellés radiaux sont posés à `outerRadius + 20` et rayonnent vers
 * l'extérieur. Sur 346 px de large, le centre est à 173 px : avec un
 * `outerRadius` de 110, le texte démarre à 305 px et sort de l'écran. Plutôt
 * que de réduire le donut d'un tiers pour loger ces libellés, on les retire
 * et on rend l'information par une légende sous le graphique — le donut garde
 * alors sa taille, à la marge de sécurité près.
 */
export function smallDonutRadii(innerPC: number, outerPC: number): DonutRadii {
  return {
    inner: Math.round(innerPC * 0.85),
    outer: Math.round(outerPC * 0.85),
    showRadialLabels: false,
  };
}

/** Dimensions de graphique adaptées au palier d'affichage courant. */
export function useChartSize(): ChartSize {
  const { isSmall } = useResponsive();

  return {
    isSmall,
    chartHeight: (basePC) => (isSmall ? smallHeight(basePC) : basePC),
    axisWidth: (basePC) => (isSmall ? 0 : basePC),
    donutRadii: (innerPC, outerPC) =>
      isSmall
        ? smallDonutRadii(innerPC, outerPC)
        : { inner: innerPC, outer: outerPC, showRadialLabels: true },
  };
}
