// ── Hook du sous-onglet Patrimoine (soldes) — le branchement, rien de plus ─
//
// Patrimoine D-4b (plan 33). Le calcul vit dans `calculs/calculPatrimoine.ts`,
// en fonction pure. Ce hook lit le patrimoine du jeu affiché, ses
// transactions (KPI 6), le filtre de période et les règles, puis mémoïse.
//
// Ne touche pas à l'écran Épargne (`useSavingsData`) : soldes ici, flux là-bas.

import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { useRegles } from "@/hooks/useRegles";
import {
  calculerPatrimoine, resultatVide,
  type ResultatPatrimoine, type SelectionPatrimoine,
} from "@/calculs/calculPatrimoine";
import type { CompteursPatrimoine } from "@/services/lectureClasseur";

/**
 * - "absent" : le jeu affiché n'a pas de feuille Patrimoine ;
 * - "vide"   : feuille présente mais aucun relevé gardé ;
 * - "pret"   : il y a des chiffres à afficher.
 */
export type EtatPatrimoine = "absent" | "vide" | "pret";

export interface SoldesPatrimoine extends ResultatPatrimoine {
  etat: EtatPatrimoine;
  inclureImmobilier: boolean;
  /**
   * Compteurs de lecture de la feuille (lues, gardées, futures, non saisies,
   * ignorées) ; `null` sans feuille. La DEMO ne garde pas le texte des
   * avertissements dans le jeu : ces chiffres sont ce qui en reste.
   */
  compteurs: CompteursPatrimoine | null;
}

/**
 * @param inclureImmobilier interrupteur « Inclure l'immobilier » (activé par
 *   défaut) ; coupé, tout passe en patrimoine financier.
 * @param selection clic sur la légende de l'Évolution : filtre toute la page.
 *   Passer un objet STABLE (useMemo) pour ne pas recalculer à chaque rendu.
 * @param moisRepartition clic sur un mois de l'Évolution : mois du donut.
 */
export function useSoldesPatrimoine(
  inclureImmobilier = true,
  selection: SelectionPatrimoine | null = null,
  moisRepartition: string | null = null,
): SoldesPatrimoine {
  const patrimoine = useDataStore((s) => s.patrimoine);
  const transactions = useDataStore((s) => s.transactions);
  const period = useFilterStore((s) => s.period);
  const regles = useRegles();

  return useMemo((): SoldesPatrimoine => {
    if (!patrimoine) {
      return { ...resultatVide(), etat: "absent", inclureImmobilier, compteurs: null };
    }
    if (!patrimoine.releves.length) {
      return { ...resultatVide(), etat: "vide", inclureImmobilier, compteurs: patrimoine.compteurs };
    }
    const res = calculerPatrimoine(
      patrimoine.releves,
      { inclureImmobilier, period, transactions, selection, moisRepartition },
      regles,
    );
    return { ...res, etat: "pret", inclureImmobilier, compteurs: patrimoine.compteurs };
  }, [patrimoine, transactions, period, regles, inclureImmobilier, selection, moisRepartition]);
}
