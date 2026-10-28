// ── Hook du sous-onglet Patrimoine — Patrimoine D-4b (plan 33) ───────────
//
// Le hook n'est qu'un branchement : il lit le patrimoine du jeu affiché, ses
// transactions, la période et les règles. Attendus refaits à la main : voir
// l'en-tête de calculs/calculPatrimoine.test.ts (même jeu fictif).

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSoldesPatrimoine } from "@/hooks/useSoldesPatrimoine";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import type { CompteursPatrimoine, PatrimoineLu } from "@/services/lectureClasseur";
import type { Config } from "@/types";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeConfig, makeSalaryData } from "../helpers/factories";
import { relevesFictifs } from "../helpers/patrimoineFictif";

// Dépenses fictives : janv. 1 000, févr. 1 200, mars 800 → 1 000 €/mois en YTD.
// Plus un transfert interne de 500 € en janvier (« Epargne Banque A » dans
// la configuration de la démo), qui ne doit PAS compter.
const TX = [
  makeTx({ date: "2026-01-05", montant: 1000 }),
  makeTx({ date: "2026-01-06", montant: 500, type: "Epargne Banque A" }),
  makeTx({ date: "2026-02-10", montant: 1200 }),
  makeTx({ date: "2026-03-10", montant: 800 }),
];

const COMPTEURS: CompteursPatrimoine = { lignesLues: 60, gardees: 57, futures: 3, nonSaisies: 0, ignorees: 0 };
const PATRIMOINE: PatrimoineLu = {
  releves: relevesFictifs(), nbComptes: 6, dernierMois: "2026-09", compteurs: COMPTEURS,
};

/** Pose un jeu (transactions + configuration), puis son patrimoine. */
function poser(patrimoine: PatrimoineLu | null, config: Config = makeConfig()): void {
  useDataStore.getState().setData(TX, makeSalaryData([]), config, "static");
  useDataStore.setState({ patrimoine });
}

beforeEach(() => resetAllStores());

describe("useSoldesPatrimoine — sans données", () => {
  it("patrimoine null → état « absent », rien à afficher", () => {
    const { result } = renderHook(() => useSoldesPatrimoine());
    expect(result.current.etat).toBe("absent");
    expect(result.current.compteurs).toBeNull();
    expect(result.current.kpis).toBeNull();
    expect(result.current.dernierMoisComplet).toBeNull();
    expect(result.current.serieParBanque).toEqual([]);
    expect(result.current.comptes).toEqual([]);
    expect(result.current.inclureImmobilier).toBe(true);
  });

  it("feuille sans relevé gardé → état « vide », compteurs transmis", () => {
    const compteurs = { lignesLues: 12, gardees: 0, futures: 0, nonSaisies: 3, ignorees: 9 };
    poser({ releves: [], nbComptes: 0, dernierMois: "", compteurs });
    const { result } = renderHook(() => useSoldesPatrimoine());
    expect(result.current.etat).toBe("vide");
    expect(result.current.kpis).toBeNull();
    expect(result.current.compteurs).toEqual(compteurs);
  });
});

describe("useSoldesPatrimoine — avec le jeu fictif", () => {
  it("YTD par défaut : KPI de septembre 2026, transfert interne exclu", () => {
    poser(PATRIMOINE);
    const { result } = renderHook(() => useSoldesPatrimoine());
    const r = result.current;
    expect(r.etat).toBe("pret");
    expect(r.compteurs).toEqual(COMPTEURS);
    expect(r.dernierMoisComplet).toBe("2026-09");
    expect(r.moisIncomplets).toEqual([]);
    expect(r.plage).toEqual({ from: "2026-01", to: "2026-09" });
    expect(r.kpis!.total).toBe(14980.25);
    expect(r.kpis!.evolutionAnnee!.montant).toBe(5760);
    expect(r.kpis!.gainMensuelMoyen).toEqual({ montant: 640, nbMois: 9 });
    // KPI 6 : 1 110,25 ÷ 1 000
    expect(r.kpis!.matelas!.depensesMensuelles).toBe(1000);
    expect(r.kpis!.matelas!.nbMois).toBeCloseTo(1.11025, 10);
    expect(r.serieParBanque).toHaveLength(9);
    expect(r.grille.nbRepris["2026-08"]).toBe(1);
  });

  it("suit le filtre de période existant (3M → juil. à sept.)", () => {
    poser(PATRIMOINE);
    const { result } = renderHook(() => useSoldesPatrimoine());
    act(() => useFilterStore.getState().setPeriod("3M"));
    expect(result.current.plage).toEqual({ from: "2026-07", to: "2026-09" });
    expect(result.current.serieParBanque.map((l) => l.mk)).toEqual(["2026-07", "2026-08", "2026-09"]);
    // Variations juil. 980, août 380, sept. 580 → 1 940 ÷ 3
    expect(result.current.kpis!.gainMensuelMoyen!.montant).toBe(646.67);
    // Aucune transaction de juil. à sept. → matelas impossible
    expect(result.current.kpis!.matelas).toBeNull();
  });

  it("interrupteur désactivé → patrimoine financier (sans l'appartement)", () => {
    poser(PATRIMOINE);
    const { result } = renderHook(() => useSoldesPatrimoine(false));
    expect(result.current.inclureImmobilier).toBe(false);
    expect(result.current.kpis!.total).toBe(11380.25);
    expect(result.current.repartition.map((p) => p.banque)).not.toContain("Immobilier");
    expect(result.current.aDeLImmobilier).toBe(true);
  });

  it("sélection et mois du donut passent au calcul", () => {
    poser(PATRIMOINE);
    const selection = { par: "banque" as const, valeurs: ["Banque B"] };
    const { result } = renderHook(() => useSoldesPatrimoine(true, selection, "2026-03"));
    expect(result.current.selection).toEqual(["Banque B"]);
    expect(result.current.kpis!.total).toBe(3050);
    expect(result.current.moisRepartition).toBe("2026-03");
  });

  it("les règles viennent du jeu affiché : sans configuration, le transfert compte", () => {
    // (1 000 + 500 + 1 200 + 800) ÷ 3 = 1 166,67
    poser(PATRIMOINE, makeConfig({ parametrage: undefined }));
    const { result } = renderHook(() => useSoldesPatrimoine());
    expect(result.current.kpis!.matelas!.depensesMensuelles).toBe(1166.67);
  });

  it("un jeu sans patrimoine posé après → retour à « absent »", () => {
    poser(PATRIMOINE);
    const { result } = renderHook(() => useSoldesPatrimoine());
    expect(result.current.etat).toBe("pret");
    act(() => useDataStore.getState().reset());
    expect(result.current.etat).toBe("absent");
    expect(result.current.kpis).toBeNull();
  });
});
