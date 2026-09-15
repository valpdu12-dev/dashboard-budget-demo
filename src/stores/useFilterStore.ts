// ── Store Zustand pour les filtres (remplace le props drilling) ──────────
import { create } from "zustand";
import type { PeriodKey, Cat1Filter } from "@/types";

interface FilterState {
  // Filtres globaux
  period: PeriodKey;
  cat1Filter: Cat1Filter;
  showTransfers: boolean;

  // Drill-down dépenses
  selMonth: string | null;
  selCat2: string | null;
  selType: string | null;
  selOrg: string | null;

  // Drill-down recettes
  selRecMonth: string | null;
  selRecType: string | null;

  // Drill-down épargne
  selEpMonth: string | null;
  selEpType: string | null;

  // Drill-down salaire
  selEntreprise: string | null;
  selYear: string | null;

  // Actions
  setPeriod: (p: PeriodKey) => void;
  setCat1Filter: (c: Cat1Filter) => void;
  setShowTransfers: (v: boolean) => void;
  setSelMonth: (v: string | null) => void;
  setSelCat2: (v: string | null) => void;
  setSelType: (v: string | null) => void;
  setSelOrg: (v: string | null) => void;
  setSelRecMonth: (v: string | null) => void;
  setSelRecType: (v: string | null) => void;
  setSelEpMonth: (v: string | null) => void;
  setSelEpType: (v: string | null) => void;
  setSelEntreprise: (v: string | null) => void;
  setSelYear: (v: string | null) => void;
  clearDepFilters: () => void;
  clearRecFilters: () => void;
  clearEpFilters: () => void;
  clearRevFilters: () => void;
  clearAllFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  period: "YTD",
  cat1Filter: "all",
  showTransfers: false,
  selMonth: null, selCat2: null, selType: null, selOrg: null,
  selRecMonth: null, selRecType: null,
  selEpMonth: null, selEpType: null,
  selEntreprise: null, selYear: null,

  setPeriod:        (p) => set({ period: p }),
  setCat1Filter:    (c) => set({ cat1Filter: c }),
  setShowTransfers: (v) => set({ showTransfers: v }),
  setSelMonth:      (v) => set({ selMonth: v }),
  setSelCat2:       (v) => set({ selCat2: v }),
  setSelType:       (v) => set({ selType: v }),
  setSelOrg:        (v) => set({ selOrg: v }),
  setSelRecMonth:   (v) => set({ selRecMonth: v }),
  setSelRecType:    (v) => set({ selRecType: v }),
  setSelEpMonth:    (v) => set({ selEpMonth: v }),
  setSelEpType:     (v) => set({ selEpType: v }),
  setSelEntreprise: (v) => set({ selEntreprise: v }),
  setSelYear:       (v) => set({ selYear: v }),

  clearDepFilters: () => set({ selMonth: null, selCat2: null, selType: null, selOrg: null }),
  clearRecFilters: () => set({ selRecMonth: null, selRecType: null }),
  clearEpFilters:  () => set({ selEpMonth: null, selEpType: null }),
  clearRevFilters: () => set({ selEntreprise: null, selYear: null }),
  clearAllFilters: () => set({
    selMonth: null, selCat2: null, selType: null, selOrg: null,
    selRecMonth: null, selRecType: null,
    selEpMonth: null, selEpType: null,
    selEntreprise: null, selYear: null,
  }),
}));
