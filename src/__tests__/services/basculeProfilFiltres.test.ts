import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetFilterStore } from "../helpers/storeReset";
import { afficherDemo, afficherMesDonnees, effacerMesDonnees } from "@/services/basculeProfil";

/**
 * Bascule de profil : les listes Enseigne / Événement repartent vides.
 *
 * Une enseigne de la démonstration n'existe pas chez le visiteur. Gardée
 * après la bascule, elle filtrerait sur du vide : page de zéros sans raison.
 */

vi.mock("@/services/loadDashboardData", () => ({
  loadDashboardData: () => Promise.resolve(),
}));


beforeEach(() => {
  resetFilterStore();
  useFilterStore.setState({
    selEnseignes: ["Primeur"], selEvenements: ["Rentrée"], selCat2: "Alimentation",
  });
});

describe("bascule de profil — pas de filtre fantôme", () => {
  it("Démo → Mes données : Enseigne et Événement vidés", async () => {
    await afficherMesDonnees();
    const s = useFilterStore.getState();
    expect([s.selEnseignes, s.selEvenements]).toEqual([[], []]);
  });

  it("Mes données → Démo : vidés aussi", async () => {
    await afficherDemo();
    const s = useFilterStore.getState();
    expect([s.selEnseignes, s.selEvenements]).toEqual([[], []]);
  });

  it("effacer mes données : vidés aussi", async () => {
    await effacerMesDonnees();
    const s = useFilterStore.getState();
    expect([s.selEnseignes, s.selEvenements]).toEqual([[], []]);
  });

  it("les autres filtres ne sont pas touchés", async () => {
    await afficherDemo();
    expect(useFilterStore.getState().selCat2).toBe("Alimentation");
  });
});
