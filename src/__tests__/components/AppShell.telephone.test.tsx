// Le bouton « Filtres (n) » n'existe qu'au petit écran, et pas sur Paramètres ;
// la pastille dit « Mes données » quand un import est affiché, « Démo · <mois> » sinon.
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { EnTeteTelephone } from "@/components/layout/EnTeteTelephone";
import { useDataStore } from "@/stores/useDataStore";

function largeur(px: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: px });
}

function rendre(chemin: string) {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<p>contenu de la page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => useDataStore.setState({ origin: "static" }));
afterEach(() => largeur(1024));

describe("AppShell — filtres au téléphone", () => {
  it("412 px, /depenses : bouton Filtres présent", () => {
    largeur(412);
    rendre("/depenses");
    expect(screen.getByRole("button", { name: /^Filtres \(\d\)$/ })).toBeTruthy();
    expect(screen.getByText("contenu de la page")).toBeTruthy();
  });

  it("412 px, /parametres : pas de bouton Filtres", () => {
    largeur(412);
    rendre("/parametres");
    expect(screen.queryByRole("button", { name: /^Filtres \(\d\)$/ })).toBeNull();
  });

  it("1440 px : pas de bouton Filtres (l'en-tête du grand écran a les siens)", () => {
    largeur(1440);
    rendre("/depenses");
    expect(screen.queryByRole("button", { name: /^Filtres \(\d\)$/ })).toBeNull();
    expect(screen.getByText("Occasionnelle")).toBeTruthy();
  });
});

describe("EnTeteTelephone — pastille", () => {
  it("« Mes données » quand un import est affiché", () => {
    useDataStore.setState({ origin: "upload" });
    render(<MemoryRouter><EnTeteTelephone /></MemoryRouter>);
    expect(screen.getByText("Mes données")).toBeTruthy();
    expect(screen.queryByText(/^Démo/)).toBeNull();
  });

  it("« Démo » sur le jeu de démonstration, avec le titre de la page", () => {
    useDataStore.setState({ origin: "static" });
    render(<MemoryRouter initialEntries={["/depenses/budget"]}><EnTeteTelephone /></MemoryRouter>);
    expect(screen.getByText(/^Démo/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Budget" })).toBeTruthy();
    expect(screen.queryByText("Mes données")).toBeNull();
  });
});
