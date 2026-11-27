import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { Header } from "@/components/layout/Header";
import { useFilterStore } from "@/stores/useFilterStore";
import { useDataStore } from "@/stores/useDataStore";
// L'en-tête porte un lien (Paramètres) → rendu dans un routeur.
import { renderWithRouter } from "../helpers/renderWithProviders";

/** Samsung Galaxy A56. */
const A56 = 412;
const PC = 1440;

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

beforeEach(() => {
  sessionStorage.clear();
  useFilterStore.setState({ period: "12M", cat1Filter: "all", showTransfers: false });
  useDataStore.setState({ origin: "static" });
});

afterEach(() => {
  setWindowWidth(1024);
  sessionStorage.clear();
});

// Au téléphone (< 768 px) : titre de la page + pastille. Les filtres de
// l'en-tête (ancien repli sous 430 px) passent dans le bouton « Filtres (n) » :
// voir FiltresTelephone.test.tsx. Grand écran : inchangé.
describe("Header — au téléphone", () => {
  it("montre le titre de la page et la pastille, sans les filtres", () => {
    setWindowWidth(A56);
    renderWithRouter(<Header />, { initialEntries: ["/depenses/budget"] });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Budget");
    expect(screen.getByText(/^Démo/)).toBeTruthy();
    expect(screen.queryByText("Occasionnelle")).toBeNull();
    expect(screen.queryByRole("button", { name: /les filtres/ })).toBeNull();
  });

  it("vaut aussi jusqu'à 767 px (même palier que la barre du bas)", () => {
    setWindowWidth(767);
    renderWithRouter(<Header />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Comptes");
    expect(screen.queryByText("Occasionnelle")).toBeNull();
  });

  it("garde le titre de l'onglet du navigateur (Démo / Mes données)", () => {
    setWindowWidth(A56);
    useDataStore.setState({ origin: "upload" });
    renderWithRouter(<Header />);
    expect(document.title).toBe("Dashboard Budget — Mes données");
    expect(screen.getByText("Mes données")).toBeTruthy();
  });
});

describe("Header — grand écran inchangé", () => {
  it("garde les filtres toujours visibles sur PC, sans bouton de repli", () => {
    setWindowWidth(PC);
    renderWithRouter(<Header />);

    expect(screen.getByText("Occasionnelle")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /les filtres/ })).toBeNull();
    expect(screen.getByText("Dashboard Budget — Démo")).toBeTruthy();
  });

  it("à 768 px, c'est encore l'en-tête du grand écran", () => {
    setWindowWidth(768);
    renderWithRouter(<Header />);

    expect(screen.getByText("Occasionnelle")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});

// Le bouton Auto · Jour · Nuit dans l'en-tête du grand écran, avant Paramètres ;
// au téléphone, il est dans Filtres (pas dans l'en-tête).
describe("Header — bouton Auto · Jour · Nuit", () => {
  it("grand écran : dans l'en-tête, avant Paramètres", () => {
    setWindowWidth(PC);
    renderWithRouter(<Header />);
    const groupe = screen.getByRole("radiogroup", { name: "Apparence" });
    const parametres = screen.getByRole("link", { name: /Paramètres/ });
    expect(groupe.compareDocumentPosition(parametres) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("téléphone : pas dans l'en-tête", () => {
    setWindowWidth(A56);
    renderWithRouter(<Header />);
    expect(screen.queryByRole("radiogroup", { name: "Apparence" })).toBeNull();
  });
});
