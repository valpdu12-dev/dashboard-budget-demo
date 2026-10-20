// ── Passer d'un profil à l'autre ─────────────────────────────────────────
//
// Lot B.6. Trois gestes, trois conséquences, écrites une seule fois pour que
// l'en-tête et la fenêtre d'import ne puissent pas en donner deux versions.
//
// Ce module est à part de `profil.ts` : il a besoin de `loadDashboardData`,
// qui lit lui-même le profil. Les réunir ferait un cercle entre les deux
// fichiers.

import { loadDashboardData } from "@/services/loadDashboardData";
import { ecrireProfil, effacerDonneesPersonnelles } from "@/services/profil";
import { useFilterStore } from "@/stores/useFilterStore";

/**
 * Vide les listes Enseigne / Événement de la page Dépenses.
 *
 * Une enseigne de la démonstration n'existe pas chez le visiteur (et
 * inversement) : gardée après une bascule, elle filtrerait sur du vide —
 * un « filtre fantôme », page de zéros sans raison visible.
 */
export function viderFiltresCategorie(): void {
  useFilterStore.getState().setSelEnseignes([]);
  useFilterStore.getState().setSelEvenements([]);
}

/**
 * Afficher la démonstration, SANS rien effacer.
 *
 * Le jeu de la personne reste écrit sur l'appareil : « Mes données » le
 * ramène en un clic.
 */
export async function afficherDemo(): Promise<void> {
  ecrireProfil("demo");
  viderFiltresCategorie();
  await loadDashboardData();
}

/** Réafficher le jeu importé mémorisé sur cet appareil. */
export async function afficherMesDonnees(): Promise<void> {
  ecrireProfil("personnel");
  viderFiltresCategorie();
  await loadDashboardData();
}

/**
 * Effacer pour de bon : le jeu importé, les objectifs modifiés, le profil.
 *
 * C'est le seul geste destructeur de l'application, et il est irréversible —
 * le fichier source, lui, reste chez la personne. L'écran le dit et demande
 * une confirmation avant d'appeler ceci.
 */
export async function effacerMesDonnees(): Promise<void> {
  effacerDonneesPersonnelles();
  viderFiltresCategorie();
  await loadDashboardData();
}
