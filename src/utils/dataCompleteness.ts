// ── Détection des données manquantes ─────────────────────────────────────
//
// Plusieurs pages se dégradent EN SILENCE quand une partie des données n'est
// pas arrivée : `useSalaryInflationData.ts:133-136` fait `salary?.inflation
// ?? []`, et la page « Salaire vs Inflation » affiche alors des graphiques
// vides et des tirets, sans distinguer « il n'y a rien à montrer » de « les
// données ne sont pas arrivées ». Point ouvert n° 14, tranché le 11/08/2026.
//
// Cause connue et documentée depuis le 29/07 dans `vite.config.ts:20-24` :
// `public/data/salary.json` ne porte que 4 clés (`months`, `cotLast`,
// `patronLast`, `lastMonth`). Les séries INSEE et SMIC vivent en base D1
// (`inflation_data`, `smic_history`) et ne sont servies que par l'API. Dès
// que le repli hors ligne s'active, elles disparaissent.
//
// Le principe est celui arbitré avec l'utilisateur : **déclarer ce qu'on
// attend, comparer à ce qui arrive, nommer ce qui manque.** C'est le même
// mécanisme que l'invariant « tout ou rien » de l'import.

import type { SalaryData, BudgetData } from "@/types";

/** Ce qu'une page déclare attendre pour être complète. */
export type BesoinDonnees =
  | "inflation"
  | "smic"
  | "inflationParCategorie"
  | "budgets";

export interface ManqueDonnees {
  besoin: BesoinDonnees;
  /** Nom lisible, tel qu'il apparaîtra dans le bandeau. */
  libelle: string;
}

/** Source disponible dans le store au moment du contrôle. */
export interface SourcesDisponibles {
  salary: SalaryData | null;
  budgets: BudgetData | null;
}

const LIBELLES: Record<BesoinDonnees, string> = {
  inflation: "les indices d'inflation INSEE",
  smic: "l'historique du SMIC",
  inflationParCategorie: "le détail de l'inflation par poste",
  budgets: "les budgets cibles",
};

/**
 * Un besoin est satisfait si la donnée est présente ET non vide. Un tableau
 * vide compte comme manquant : c'est exactement ce que produit le repli
 * `?? []`, et c'est ce que l'utilisateur voit sous forme de tirets.
 */
function estPresent(besoin: BesoinDonnees, src: SourcesDisponibles): boolean {
  switch (besoin) {
    case "inflation":
      return (src.salary?.inflation?.length ?? 0) > 0;
    case "smic":
      return (src.salary?.smic?.length ?? 0) > 0;
    case "inflationParCategorie":
      return (src.salary?.inflationByCategory?.length ?? 0) > 0;
    case "budgets":
      return (src.budgets?.budgets?.length ?? 0) > 0;
  }
}

/** Liste, dans l'ordre déclaré, les besoins non satisfaits. */
export function detecterManques(
  besoins: BesoinDonnees[],
  src: SourcesDisponibles
): ManqueDonnees[] {
  return besoins
    .filter((b) => !estPresent(b, src))
    .map((b) => ({ besoin: b, libelle: LIBELLES[b] }));
}

/**
 * Phrase du bandeau. Énumère ce qui manque — « A », « A et B », « A, B et C ».
 *
 * ⚠️ Tournure impersonnelle (« impossible de charger… ») choisie à dessein.
 * Une formulation à verbe accordé obligerait à connaître le genre et le nombre
 * de chaque libellé : « les budgets cibles » est pluriel, « l'historique du
 * SMIC » singulier, et un accord calculé sur le NOMBRE D'ÉLÉMENTS MANQUANTS
 * produit des fautes dès qu'un seul libellé pluriel est seul en liste. Le
 * premier jet le faisait, et son test figurait la faute.
 */
export function fmtManques(manques: ManqueDonnees[]): string {
  if (manques.length === 0) return "";
  const l = manques.map((m) => m.libelle);
  const liste =
    l.length === 1
      ? l[0]
      : `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}`;
  return `Cette page est incomplète : impossible de charger ${liste}.`;
}
