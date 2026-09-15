import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BandeauDonneesPartielles } from "@/components/ui/BandeauDonneesPartielles";
import { useDataStore } from "@/stores/useDataStore";
import type { SalaryData, BudgetData, Transaction, Config } from "@/types";

/**
 * Bandeau « données partielles » (point ouvert n° 14).
 *
 * Il n'existe que pour un cas réel : « Budget mensuel » sans budgets cibles
 * affiche un budget total de 0 € et un taux de conformité de 100 % — des
 * chiffres faux et rassurants, pas des cases vides.
 */

const salaryVide = { months: [], cotLast: [], patronLast: [] } as unknown as SalaryData;
const configVide = { init: {} } as unknown as Config;

function chargeAvec(budgets: BudgetData | null) {
  const s = useDataStore.getState();
  s.setData([] as Transaction[], salaryVide, configVide);
  if (budgets) s.setBudgets(budgets);
}

beforeEach(() => useDataStore.getState().reset());

describe("BandeauDonneesPartielles", () => {
  it("ne rend rien quand la donnée attendue est là", () => {
    chargeAvec({ budgets: [{ cat2: "Courses", target: 400, active: true }] } as unknown as BudgetData);
    const { container } = render(<BandeauDonneesPartielles besoins={["budgets"]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("annonce le manque en le nommant", () => {
    chargeAvec(null);
    render(<BandeauDonneesPartielles besoins={["budgets"]} />);
    expect(screen.getByRole("status")).toHaveTextContent("les budgets cibles");
    expect(screen.getByRole("status")).toHaveTextContent("Cette page est incomplète");
  });

  it("explique d'où viennent ces données, plutôt que de constater le manque", () => {
    chargeAvec(null);
    expect(screen.queryByRole("status")).toBeNull();
    render(<BandeauDonneesPartielles besoins={["budgets"]} />);
    expect(screen.getByRole("status")).toHaveTextContent(/viennent du serveur/i);
  });

  it("rassure sur le reste de la page", () => {
    // Sans cette phrase, l'utilisateur peut douter de TOUS les chiffres.
    chargeAvec(null);
    render(<BandeauDonneesPartielles besoins={["budgets"]} />);
    expect(screen.getByRole("status")).toHaveTextContent(/restent justes/i);
  });

  it("ne rend rien tant que le chargement n'est pas terminé", () => {
    // Pendant le chargement tout est « manquant » : annoncer un manque à cet
    // instant serait un faux positif systématique, à chaque ouverture de page.
    useDataStore.getState().setLoading();
    const { container } = render(<BandeauDonneesPartielles besoins={["budgets"]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ne rend rien en cas d'erreur de chargement", () => {
    // L'écran d'erreur dit déjà ce qui s'est passé ; deux messages
    // concurrents brouilleraient le diagnostic.
    useDataStore.getState().setError("réseau indisponible");
    const { container } = render(<BandeauDonneesPartielles besoins={["budgets"]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
