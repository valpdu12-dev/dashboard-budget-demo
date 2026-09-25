// ── Poser les règles de la démonstration dans le store, pour un test ─────
//
// Lot C.4. Les hooks lisent les règles du store (`useRegles`). Un test qui
// rend un hook directement doit donc DÉCLARER la configuration qu'il
// vérifie — c'est le prix de la généralisation, et c'est aussi sa preuve :
// avant, le vocabulaire de l'auteur était là sans que personne l'écrive.

import { useDataStore } from "@/stores/useDataStore";
import { makeConfig, makeSalaryData } from "./factories";

/** Pose la configuration de la démonstration. Rien d'autre. */
export function poserReglesDemo(): void {
  useDataStore.getState().setData([], makeSalaryData([]), makeConfig(), "static");
}

/** Pose une source qui ne déclare RIEN : aucun transfert, aucune épargne. */
export function poserSansRegles(): void {
  useDataStore
    .getState()
    .setData([], makeSalaryData([]), makeConfig({ parametrage: undefined }), "upload");
}
