// ── L'apparence Auto · Jour · Nuit ─────────────────────────────────────────
//
// - public/theme.js pose le thème AVANT l'affichage (même règle, testée).
// - Ici : le changer, et suivre l'appareil en « Auto » et les autres onglets.
// - Le choix est gardé sur chaque appareil (localStorage « budget-apparence »).
// - La page porte data-theme = jour | nuit (le CSS s'en sert) et
//   data-choix-theme = auto | jour | nuit.

export type ChoixTheme = "auto" | "jour" | "nuit";
export type Theme = "jour" | "nuit";

export const CLE_APPARENCE = "budget-apparence";
/** Événement envoyé quand le choix change (les boutons se mettent à jour). */
export const EVENEMENT_APPARENCE = "budget-apparence";
const Q_SOMBRE = "(prefers-color-scheme: dark)";

/** Couleur de la barre du navigateur (couleur du fond). */
export const COULEUR_BARRE: Record<Theme, string> = { jour: "#f6f5f2", nuit: "#0b0c0f" };

function appareilEnSombre(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(Q_SOMBRE).matches;
}

function estChoix(v: unknown): v is ChoixTheme {
  return v === "auto" || v === "jour" || v === "nuit";
}

/** Le choix posé sur la page (data-choix-theme), s'il y en a un. */
function choixDeLaPage(): ChoixTheme | null {
  if (typeof document === "undefined") return null;
  const v = document.documentElement.getAttribute("data-choix-theme");
  return estChoix(v) ? v : null;
}

/**
 * Le choix gardé. Si le navigateur refuse le
 * stockage, le choix de la page (posé par choisirTheme) fait foi, sinon Auto.
 */
export function lireChoixTheme(): ChoixTheme {
  try {
    const v = window.localStorage.getItem(CLE_APPARENCE);
    return estChoix(v) ? v : "auto";
  } catch {
    return choixDeLaPage() ?? "auto";
  }
}

export function themeDuChoix(choix: ChoixTheme): Theme {
  return choix === "auto" ? (appareilEnSombre() ? "nuit" : "jour") : choix;
}

/** Le thème posé sur la page (jour si rien n'est posé). */
export function themeActuel(): Theme {
  if (typeof document === "undefined") return "jour";
  return document.documentElement.getAttribute("data-theme") === "nuit" ? "nuit" : "jour";
}

/** Pose le thème sur la page, et la couleur de la barre du navigateur. */
export function appliquerTheme(choix: ChoixTheme): void {
  const theme = themeDuChoix(choix);
  const racine = document.documentElement;
  racine.setAttribute("data-theme", theme);
  racine.setAttribute("data-choix-theme", choix);
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = COULEUR_BARRE[theme];
  });
}

export function choisirTheme(choix: ChoixTheme): void {
  try {
    window.localStorage.setItem(CLE_APPARENCE, choix);
  } catch {
    // stockage refusé : le choix vaut jusqu'à la fermeture
  }
  appliquerTheme(choix);
  window.dispatchEvent(new CustomEvent<ChoixTheme>(EVENEMENT_APPARENCE, { detail: choix }));
}

/** En « Auto », suit l'appareil quand il passe du clair au sombre. Une fois, au démarrage. */
export function suivreAppareil(): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const mq = window.matchMedia(Q_SOMBRE);
  // le choix de CETTE page (pas le stockage, qu'un autre onglet a pu changer).
  const rappel = () => {
    if ((choixDeLaPage() ?? lireChoixTheme()) === "auto") appliquerTheme("auto");
  };
  if (typeof mq.addEventListener === "function") mq.addEventListener("change", rappel);
  else mq.addListener(rappel);
  return () => {
    if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", rappel);
    else mq.removeListener(rappel);
  };
}

/**
 * un choix fait dans un autre onglet (événement
 * « storage ») s'applique ici aussi, boutons compris. Une fois, au démarrage.
 */
export function suivreAutresOnglets(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const rappel = (e: StorageEvent) => {
    if (e.key !== CLE_APPARENCE && e.key !== null) return; // null : stockage vidé
    const choix = lireChoixTheme();
    appliquerTheme(choix);
    window.dispatchEvent(new CustomEvent<ChoixTheme>(EVENEMENT_APPARENCE, { detail: choix }));
  };
  window.addEventListener("storage", rappel);
  return () => window.removeEventListener("storage", rappel);
}
