// ── Store Zustand pour l'état UI ─────────────────────────────────────────
import { create } from "zustand";

interface UIState {
  uploaderOpen: boolean;
  showBudgetOverlay: boolean;
  setUploaderOpen: (v: boolean) => void;
  setShowBudgetOverlay: (v: boolean) => void;
  toggleBudgetOverlay: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  uploaderOpen: false,
  showBudgetOverlay: false,
  setUploaderOpen: (v) => set({ uploaderOpen: v }),
  setShowBudgetOverlay: (v) => set({ showBudgetOverlay: v }),
  toggleBudgetOverlay: () => set((s) => ({ showBudgetOverlay: !s.showBudgetOverlay })),
}));
