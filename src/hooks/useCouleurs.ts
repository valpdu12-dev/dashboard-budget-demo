// ── Les couleurs des écrans, bâties depuis la configuration ──────────────
//
// Lot C.5. Quatre tables de couleurs vivaient dans `config/colors.ts`, une
// par famille, chacune indexée par les LIBELLÉS de l'auteur : ses comptes,
// ses organismes, ses supports d'épargne, ses employeurs. Elles ne
// connaissaient que le jeu de démonstration — au-delà, `couleurStable`
// prenait le relais depuis le lot A.2.
//
// Elles ont disparu. Une couleur vient maintenant de trois endroits, dans cet
// ordre :
//
//   1. ce que la source DÉCLARE — colonne `Couleur` des comptes et des
//      catégories ;
//   2. pour un organisme, la couleur de son premier compte déclaré, pour que
//      la courbe et la carte s'accordent ;
//   3. `couleurStable`, le repli déterministe : toujours une couleur, et
//      toujours LA MÊME pour un nom donné.
//
// ⚠️ Il n'y a plus de nom privilégié. La démonstration garde les couleurs de
// ses comptes et de ses postes de budget parce qu'elle les DÉCLARE, comme
// n'importe quel fichier — pas parce que le code les connaît.

import { useMemo } from "react";
import { couleurStable, DONUT_COLORS, TYPE_COLORS } from "@/config/colors";
import { useRegles } from "@/hooks/useRegles";

/**
 * La couleur de la série « Total ».
 *
 * Ce n'est le compte de personne : c'est une étiquette de l'application, au
 * même titre que « Débit » ou « Crédit ». Elle reste donc écrite ici.
 */
export const COULEUR_TOTAL = "#6366f1";

const TOTAL = "Total";

export interface Couleurs {
  compte(nom: string): string;
  organisme(nom: string): string;
  categorie(nom: string): string;
  /** Un type de mouvement — support d'épargne, nature de dépense. */
  type(nom: string): string;
  employeur(nom: string): string;
}

export function useCouleurs(): Couleurs {
  const regles = useRegles();

  return useMemo<Couleurs>(() => ({
    compte: (nom) =>
      nom === TOTAL ? COULEUR_TOTAL : regles.couleurCompte(nom) ?? couleurStable(nom),
    organisme: (nom) =>
      nom === TOTAL ? COULEUR_TOTAL : regles.couleurOrganisme(nom) ?? couleurStable(nom),
    categorie: (nom) => regles.couleurCategorie(nom) ?? couleurStable(nom),
    // Le format ne déclare pas de couleur de type. Le repli stable suffit :
    // il donne toujours une couleur, et toujours la même. Une colonne de plus
    // dans le fichier ne vaut pas le gain.
    type: (nom) => couleurStable(nom, TYPE_COLORS),
    employeur: (nom) => couleurStable(nom, DONUT_COLORS),
  }), [regles]);
}
