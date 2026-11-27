// ── Hook responsive — matchMedia + repli resize ─────────────────────────
// V1 ne réagissait pas au redimensionnement (bug corrigé en V2 par un
// listener `resize`). Lot 1.1 : passage à `matchMedia`, qui ne déclenche un
// rendu qu'au franchissement d'un palier, au lieu d'un rendu par pixel
// parcouru pendant un redimensionnement.
//
// Repli : `window.matchMedia` n'existe pas sous jsdom (environnement de test).
// On retombe alors sur `resize` + `innerWidth`, ce qui laisse la suite de
// tests existante fonctionnelle sans polyfill dans `vitest.setup.ts`.
import { useState, useEffect } from "react";

/** Palier « petit mobile » — voir tailwind.config.ts (écran `xs`). */
export const SMALL_BREAKPOINT = 430;
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

interface Responsive {
  /** < 430 px — Samsung A56 (412 px) et plus étroit. */
  isSmall: boolean;
  /** < 768 px. */
  isMobile: boolean;
  /** 768 px ≤ largeur < 1024 px. */
  isTablet: boolean;
  /** ≥ 1024 px. */
  isDesktop: boolean;
  width: number;
}

const INITIAL_WIDTH = 1200;

function currentWidth(): number {
  return typeof window !== "undefined" ? window.innerWidth : INITIAL_WIDTH;
}

/** `matchMedia` utilisable ? (absent de jsdom, absent en SSR) */
function hasMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function derive(width: number): Responsive {
  // Avec matchMedia, les paliers sont lus par les MÊMES requêtes que le CSS
  // (`min-width`), pas par `innerWidth`, qui est un nombre entier : avec un zoom
  // (ex. 125 %), la largeur CSS peut valoir 767,2 px, et `innerWidth` un arrondi
  // qui ne tombe pas toujours du même côté que le CSS. Pour une largeur entière,
  // le résultat est le même qu'avant.
  const au = (px: number) =>
    hasMatchMedia() ? window.matchMedia(`(min-width: ${px}px)`).matches : width >= px;
  const petit = !au(SMALL_BREAKPOINT);
  const mobile = !au(MOBILE_BREAKPOINT);
  const bureau = au(TABLET_BREAKPOINT);
  return {
    isSmall:   petit,
    isMobile:  mobile,
    isTablet:  !mobile && !bureau,
    isDesktop: bureau,
    width,
  };
}

/**
 * Renvoie les paliers d'affichage courants.
 *
 * Les booléens sont pilotés par `matchMedia` quand il est disponible ; la
 * largeur en pixels reste lue sur `innerWidth`, aucune API media query ne
 * l'exposant. Les deux sources décrivent le même viewport.
 */
export function useResponsive(): Responsive {
  const [state, setState] = useState<Responsive>(() => derive(currentWidth()));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => setState(derive(window.innerWidth));

    // Repli jsdom / navigateurs sans matchMedia : écoute du resize seul.
    if (!hasMatchMedia()) {
      window.addEventListener("resize", sync);
      sync();
      return () => window.removeEventListener("resize", sync);
    }

    // Un MediaQueryList par palier : le navigateur ne notifie qu'au
    // franchissement, pas à chaque pixel parcouru.
    const queries = [SMALL_BREAKPOINT, MOBILE_BREAKPOINT, TABLET_BREAKPOINT].map(
      (px) => window.matchMedia(`(min-width: ${px}px)`)
    );

    queries.forEach((q) => {
      // Safari < 14 n'expose que addListener sur MediaQueryList.
      if (typeof q.addEventListener === "function") q.addEventListener("change", sync);
      else q.addListener(sync);
    });

    // `width` a encore besoin du resize : aucune media query ne la donne.
    window.addEventListener("resize", sync);
    sync();

    return () => {
      queries.forEach((q) => {
        if (typeof q.removeEventListener === "function") q.removeEventListener("change", sync);
        else q.removeListener(sync);
      });
      window.removeEventListener("resize", sync);
    };
  }, []);

  return state;
}
