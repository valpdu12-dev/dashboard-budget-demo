import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMortgageData } from "@/hooks/useMortgageData";
import { useDataStore } from "@/stores/useDataStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeSalaryData, makeConfig } from "../helpers/factories";

/**
 * Le prêt n'est plus jamais inventé (E.3).
 *
 * Un fichier qui porte des échéances de prêt sans déclarer le bloc Prêt ne
 * produit plus d'échéancier de repli. L'écran montre le seul historique réel,
 * et dit ce qui lui manque. C'est le dernier prêt en dur du dashboard qui
 * disparaît.
 */

const echeances = [
  makeTx({ date: "2025-01-05", type: "Crédit Immobilier", montant: 640 }),
  makeTx({ date: "2025-01-05", type: "Intérêt du prêt", montant: 253 }),
];

beforeEach(() => resetAllStores());

describe("prêt non déclaré", () => {
  it("sans bloc Prêt : l'historique reste, mais aucun KPI inventé", () => {
    useDataStore.getState().setData(echeances, makeSalaryData([]), makeConfig(), "upload");
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.pretDeclare).toBe(false);
    expect(result.current.hasData).toBe(true); // il y a un historique
    expect(result.current.historyData.length).toBeGreaterThan(0);
    expect(result.current.kpis).toBeNull(); // rien d'inventé
    expect(result.current.projectionData).toHaveLength(0);
    expect(result.current.dateFin).toBe("");
  });

  it("avec un bloc Prêt complet : la projection revient", () => {
    useDataStore.getState().setData(
      echeances,
      makeSalaryData([]),
      makeConfig({ pret: { montant: 180000, mensualite: 893.6, echeances: 240 } }),
      "upload"
    );
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.pretDeclare).toBe(true);
    expect(result.current.kpis).not.toBeNull();
  });

  it("un bloc à moitié rempli est traité comme non déclaré", () => {
    // Mieux vaut « pas de prêt » annoncé qu'un montant réel accolé à une
    // mensualité par défaut.
    useDataStore.getState().setData(
      echeances,
      makeSalaryData([]),
      makeConfig({ pret: { montant: 180000, mensualite: 0, echeances: 240 } }),
      "upload"
    );
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.pretDeclare).toBe(false);
    expect(result.current.kpis).toBeNull();
  });
});
