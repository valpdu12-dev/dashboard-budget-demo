import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SubNav } from "@/components/layout/SubNav";
import { RouteSiRubrique } from "@/router";
import { useDataStore } from "@/stores/useDataStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeTransactions, makeSalaryData, makeSalaryMonth, makeConfig } from "../helpers/factories";

/**
 * La navigation conditionnelle, vue de l'écran.
 *
 * Retirer une pill ne suffit pas : l'adresse directe reste tapable et un
 * marque-page la rouvre. Les deux chemins sont donc testés pour chacun des
 * quatre jeux.
 */

const echeance = makeTx({ date: "2025-02-05", type: "Crédit Immobilier", montant: 640 });
const PRET = { montant: 180000, mensualite: 893.6, echeances: 240 };

function poser(opts: { paie: boolean; pret: boolean }) {
  const tx = opts.pret ? [...makeTransactions(), echeance] : makeTransactions();
  const salary = makeSalaryData(opts.paie ? [makeSalaryMonth({ mk: "2025-01" })] : []);
  const config = makeConfig(opts.pret ? { pret: PRET } : {});
  useDataStore.getState().setData(tx, salary, config, "static");
}

function rendreSubNav(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <SubNav />
    </MemoryRouter>
  );
}

function rendreRoute(url: string, rubrique: "paie" | "pret", nomPage: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<div>accueil</div>} />
        <Route
          path={url}
          element={<RouteSiRubrique rubrique={rubrique}><div>{nomPage}</div></RouteSiRubrique>}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => resetAllStores());

describe("jeu complet", () => {
  beforeEach(() => poser({ paie: true, pret: true }));

  it("montre Salaire et vs Inflation dans la sous-navigation Revenus", () => {
    rendreSubNav("/revenus");
    expect(screen.getByText("Salaire")).toBeInTheDocument();
    expect(screen.getByText("vs Inflation")).toBeInTheDocument();
  });

  it("montre Prêt Immo. dans la sous-navigation Patrimoine", () => {
    rendreSubNav("/patrimoine");
    expect(screen.getByText("Prêt Immo.")).toBeInTheDocument();
  });

  it("laisse ouvrir /revenus/salaire et /patrimoine/pret en direct", () => {
    rendreRoute("/revenus/salaire", "paie", "page salaire");
    expect(screen.getByText("page salaire")).toBeInTheDocument();
    rendreRoute("/patrimoine/pret", "pret", "page pret");
    expect(screen.getByText("page pret")).toBeInTheDocument();
  });
});

describe("jeu sans paie", () => {
  beforeEach(() => poser({ paie: false, pret: true }));

  it("retire Salaire et vs Inflation de TOUTE la sous-navigation", () => {
    rendreSubNav("/revenus");
    expect(screen.queryByText("Salaire")).toBeNull();
    expect(screen.queryByText("vs Inflation")).toBeNull();
    expect(screen.queryByText("Recettes")).toBeNull(); // une seule pill : la barre disparaît
  });

  it("renvoie /revenus/salaire à l'accueil", () => {
    rendreRoute("/revenus/salaire", "paie", "page salaire");
    expect(screen.getByText("accueil")).toBeInTheDocument();
    expect(screen.queryByText("page salaire")).toBeNull();
  });

  it("renvoie aussi /revenus/inflation à l'accueil", () => {
    rendreRoute("/revenus/inflation", "paie", "page inflation");
    expect(screen.getByText("accueil")).toBeInTheDocument();
  });

  it("laisse le Prêt intact", () => {
    rendreSubNav("/patrimoine");
    expect(screen.getByText("Prêt Immo.")).toBeInTheDocument();
  });
});

describe("jeu sans prêt", () => {
  beforeEach(() => poser({ paie: true, pret: false }));

  it("fait disparaître la barre Patrimoine, qui n'aurait plus qu'une pill", () => {
    rendreSubNav("/patrimoine");
    expect(screen.queryByText("Prêt Immo.")).toBeNull();
    expect(screen.queryByText("Épargne")).toBeNull();
  });

  it("renvoie /patrimoine/pret à l'accueil", () => {
    rendreRoute("/patrimoine/pret", "pret", "page pret");
    expect(screen.getByText("accueil")).toBeInTheDocument();
  });

  it("laisse la paie intacte", () => {
    rendreSubNav("/revenus");
    expect(screen.getByText("Salaire")).toBeInTheDocument();
  });
});

describe("jeu sans paie ni prêt", () => {
  beforeEach(() => poser({ paie: false, pret: false }));

  it("ne laisse aucune sous-navigation sur Revenus ni Patrimoine", () => {
    const { unmount } = rendreSubNav("/revenus");
    expect(screen.queryByText("Salaire")).toBeNull();
    unmount();
    rendreSubNav("/patrimoine");
    expect(screen.queryByText("Prêt Immo.")).toBeNull();
  });

  it("garde la sous-navigation Dépenses, qui ne dépend d'aucune rubrique", () => {
    rendreSubNav("/depenses");
    expect(screen.getByText("Budget")).toBeInTheDocument();
  });

  it("renvoie les trois adresses à l'accueil", () => {
    for (const [url, rub, page] of [
      ["/revenus/salaire", "paie", "salaire"],
      ["/revenus/inflation", "paie", "inflation"],
      ["/patrimoine/pret", "pret", "pret"],
    ] as const) {
      const { unmount } = rendreRoute(url, rub, page);
      expect(screen.getByText("accueil")).toBeInTheDocument();
      unmount();
    }
  });
});

describe("pendant le chargement", () => {
  it("n'expulse PAS d'une adresse directe tant que les données ne sont pas là", () => {
    // Le piège : rediriger pendant le chargement renverrait à l'accueil toute
    // ouverture directe d'une URL profonde. Le défaut serait intermittent,
    // donc invisible à l'essai.
    useDataStore.getState().setLoading();
    rendreRoute("/revenus/salaire", "paie", "page salaire");
    expect(screen.getByText("page salaire")).toBeInTheDocument();
  });
});
