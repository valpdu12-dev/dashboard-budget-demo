// ── Store Zustand pour l'état UI ─────────────────────────────────────────
import { create } from "zustand";
import type { AvisStockage } from "@/services/jeuDonnees";

interface UIState {
  /**
   * Ce que la relecture du stockage a à dire — lot C.6, D6.
   *
   * ⚠️ Il vit dans le store de l'INTERFACE, pas dans celui des données : ce
   * n'est pas une propriété du jeu, c'est un message à afficher une fois. Le
   * mettre dans le jeu l'aurait mémorisé avec lui, et le bandeau serait
   * revenu à chaque ouverture, pour toujours.
   */
  avisStockage: AvisStockage | null;
  setAvisStockage: (a: AvisStockage | null) => void;
  uploaderOpen: boolean;
  showBudgetOverlay: boolean;
  setUploaderOpen: (v: boolean) => void;
  setShowBudgetOverlay: (v: boolean) => void;
  toggleBudgetOverlay: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  avisStockage: null,
  setAvisStockage: (a) => set({ avisStockage: a }),
  uploaderOpen: false,
  showBudgetOverlay: false,
  setUploaderOpen: (v) => set({ uploaderOpen: v }),
  setShowBudgetOverlay: (v) => set({ showBudgetOverlay: v }),
  toggleBudgetOverlay: () => set((s) => ({ showBudgetOverlay: !s.showBudgetOverlay })),
}));
