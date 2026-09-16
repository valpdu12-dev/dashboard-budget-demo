import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMortgageData } from "@/hooks/useMortgageData";
import { useDataStore } from "@/stores/useDataStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeSalaryData, makeConfig } from "../helpers/factories";

/**
 * Le prêt calculé sur des constantes de repli.
 *
 * Sans cet indicateur, un fichier qui porte des échéances sans déclarer le
 * prêt produit un échéancier complet et faux, présenté comme celui de la
 * personne. C'est le genre de silence que le lot B existe pour supprimer.
 */

const echeances = [
  makeTx({ date: "2025-01-05", type: "Crédit Immobilier", montant: 640 }),
  makeTx({ date: "2025-01-05", type: "Intérêt du prêt", montant: 253 }),
];

beforeEach(() => resetAllStores());

describe("origine des paramètres du prêt", () => {
  it("signale le repli quand la source ne déclare rien", () => {
    useDataStore.getState().setData(echeances, makeSalaryData([]), makeConfig(), "upload");
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.parametresDeRepli).toBe(true);
  });

  it("ne signale rien quand la source déclare un prêt complet", () => {
    useDataStore.getState().setData(
      echeances,
      makeSalaryData([]),
      makeConfig({ pret: { montant: 180000, mensualite: 893.6, echeances: 240 } }),
      "upload"
    );
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.parametresDeRepli).toBe(false);
  });

  it("signale le repli quand le bloc déclaré est incomplet", () => {
    // Un bloc à moitié rempli est ignoré en entier : mieux vaut un repli
    // annoncé qu'un montant réel accolé à une mensualité par défaut.
    useDataStore.getState().setData(
      echeances,
      makeSalaryData([]),
      makeConfig({ pret: { montant: 180000, mensualite: 0, echeances: 240 } }),
      "upload"
    );
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.parametresDeRepli).toBe(true);
  });
});
