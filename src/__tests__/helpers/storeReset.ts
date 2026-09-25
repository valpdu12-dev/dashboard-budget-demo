// ── Reset des stores Zustand entre les tests ──────────────────────────────
//
// Zustand conserve l'état entre les tests si on ne reset pas.
// Ce module expose des helpers pour reinitialiser chaque store.

import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";

export function resetDataStore() {
  useDataStore.getState().reset();
}

export function resetFilterStore() {
  useFilterStore.setState({
    period: "YTD",
    cat1Filter: "all",
    showTransfers: false,
    selMonth: null,
    selCat2: null,
    selType: null,
    selOrg: null,
    selRecMonth: null,
    selRecType: null,
    selEpMonth: null,
    selEpType: null,
    selEntreprise: null,
    selYear: null,
  });
}

/** Reset tous les stores — à appeler dans beforeEach */
export function resetAllStores() {
  resetDataStore();
  resetFilterStore();
}
