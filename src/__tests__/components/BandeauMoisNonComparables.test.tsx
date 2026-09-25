import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BandeauMoisNonComparables } from "@/components/ui/BandeauMoisNonComparables";
import { useDataStore } from "@/stores/useDataStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeConfig } from "../helpers/factories";
import type { SalaryData, Transaction } from "@/types";

/**
 * Lot 0, étape 0.6 — quand la moyenne est indisponible, l'écran doit dire
 * pourquoi. Un tiret muet laisse croire à un bug, ou pire, se lit comme un
 * zéro.
 */

const SALAIRE = { months: [], cotLast: [], patronLast: [], lastMonth: "" } as unknown as SalaryData;

function donneesChargees() {
  useDataStore.getState().setData([] as Transaction[], SALAIRE, makeConfig(), "api");
}

beforeEach(() => resetAllStores());

describe("BandeauMoisNonComparables", () => {
  it("ne s'affiche pas quand au moins un mois est comparable", () => {
    donneesChargees();
    const { container } = render(
      <BandeauMoisNonComparables comparableMonths={["2025-02"]} totalMonths={3} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("ne s'affiche pas tant que les données ne sont pas chargées", () => {
    // Pendant le chargement, aucun mois n'est comparable : annoncer un manque
    // ici serait un faux positif à chaque ouverture de page.
    useDataStore.getState().setLoading();
    const { container } = render(
      <BandeauMoisNonComparables comparableMonths={[]} totalMonths={0} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("explique l'indisponibilité, sans se contenter d'un tiret", () => {
    donneesChargees();
    render(<BandeauMoisNonComparables comparableMonths={[]} totalMonths={5} />);
    const bandeau = screen.getByRole("status");
    expect(bandeau).toHaveTextContent(/indisponibles/i);
    expect(bandeau).toHaveTextContent(/premier et le dernier mois/i);
    expect(bandeau).toHaveTextContent(/trois mois/i);
  });

  it("dit qu'aucune donnée n'est chargée quand il n'y a aucun mois", () => {
    donneesChargees();
    render(<BandeauMoisNonComparables comparableMonths={[]} totalMonths={0} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Aucune donnée n'est chargée/i);
  });

  it("dit que les données sont trop courtes avec un ou deux mois", () => {
    donneesChargees();
    const { rerender } = render(
      <BandeauMoisNonComparables comparableMonths={[]} totalMonths={1} />
    );
    expect(screen.getByRole("status")).toHaveTextContent(/ne couvrent qu'un mois/i);

    rerender(<BandeauMoisNonComparables comparableMonths={[]} totalMonths={2} />);
    expect(screen.getByRole("status")).toHaveTextContent(/ne couvrent que deux mois/i);
  });
});
