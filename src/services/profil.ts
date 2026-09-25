// ── Profil affiché : la démonstration, ou les données de la personne ──────
//
// Lot B.6. Jusqu'ici il n'y avait pas de profil : le dernier fichier importé
// était mémorisé, et il revenait à chaque ouverture. Pour retrouver la
// démonstration il fallait EFFACER son import — un aller sans retour, déguisé
// en simple bouton.
//
// Deux choses sont désormais distinctes :
//   • ce qui est MÉMORISÉ  — le jeu de la personne, écrit sur son appareil ;
//   • ce qui est AFFICHÉ   — le profil actif, `demo` ou `personnel`.
//
// Revenir à la démonstration ne touche donc plus à ce qui est mémorisé, et
// l'effacement devient un geste à part, qui se dit et se confirme.

import { CLES_JEU } from "@/services/jeuDonnees";
import { CLE_OBJECTIFS } from "@/services/budgetsLocaux";

export type Profil = "demo" | "personnel";

/** Clé du profil affiché. */
export const CLE_PROFIL = "budget.profil.v1";

/**
 * TOUTES les clés que cette application écrit sur l'appareil.
 *
 * Elles sont réunies ICI, et chaque module donne la sienne plutôt que de la
 * recopier. Le critère de sortie du lot B.6 est « aucun résidu après
 * effacement » : une clé oubliée dans un coin le ferait échouer sans bruit,
 * et un test vérifie que cette liste couvre bien tout ce qui est écrit.
 */
export const CLES_LOCALES: readonly string[] = [...CLES_JEU, CLE_OBJECTIFS, CLE_PROFIL];

/**
 * Profil affiché.
 *
 * En l'absence de valeur — ou devant une valeur illisible — on répond
 * `personnel`. C'est le comportement d'avant ce lot : quelqu'un qui a importé
 * son fichier le retrouve en rouvrant le site. S'il n'y a rien de mémorisé,
 * `loadDashboardData` montre la démonstration de toute façon.
 */
export function lireProfil(): Profil {
  try {
    return localStorage.getItem(CLE_PROFIL) === "demo" ? "demo" : "personnel";
  } catch {
    return "personnel";
  }
}

/** Enregistre le profil affiché. Sans effet si le stockage est refusé. */
export function ecrireProfil(profil: Profil): void {
  try {
    localStorage.setItem(CLE_PROFIL, profil);
  } catch (err) {
    console.warn("[Budget] Profil non mémorisé (stockage indisponible).", err);
  }
}

/**
 * Un jeu importé est-il mémorisé sur cet appareil ?
 *
 * Répond sur la PRÉSENCE de la clé, sans relire ni valider son contenu : il
 * s'agit seulement de savoir s'il y a lieu de proposer « Mes données ».
 */
export function jeuPersonnelDisponible(): boolean {
  try {
    return CLES_JEU.some((cle) => localStorage.getItem(cle) !== null);
  } catch {
    return false;
  }
}

/**
 * Efface tout ce que cette application a écrit sur l'appareil.
 *
 * Y compris les objectifs de budget, qui vivent dans leur propre clé : les
 * laisser derrière aurait rendu à la démonstration des plafonds saisis par la
 * personne, longtemps après qu'elle a cru avoir tout effacé.
 */
export function effacerDonneesPersonnelles(): void {
  for (const cle of CLES_LOCALES) {
    try {
      localStorage.removeItem(cle);
    } catch {
      // Sans effet si le stockage est indisponible : il n'y avait rien à effacer.
    }
  }
}
