import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "@/components/layout/Header";
import { useFilterStore } from "@/stores/useFilterStore";

/** Samsung Galaxy A56 — sous le palier `isSmall` (430 px). */
const A56 = 412;
const PC = 1440;

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

beforeEach(() => {
  sessionStorage.clear();
  useFilterStore.setState({ period: "12M", cat1Filter: "all", showTransfers: false });
});

afterEach(() => {
  setWindowWidth(1024);
  sessionStorage.clear();
});

describe("Header — repli des filtres sous 430 px (lot 1.2)", () => {
  it("affiche les filtres dépliés au premier rendu de la session", () => {
    setWindowWidth(A56);
    render(<Header />);

    // La rangée de filtres est présente : les chips Cat1 sont atteignables.
    expect(screen.getByText("Occasionnelle")).toBeTruthy();
  });

  it("replie les filtres une fois la session marquée comme vue", () => {
    setWindowWidth(A56);
    // Simule un rendu antérieur dans la même session d'onglet.
    sessionStorage.setItem("budget.header.filtersSeen", "1");
    render(<Header />);

    expect(screen.queryByText("Occasionnelle")).toBeNull();
  });

  it("mémorise l'affichage pour que le rendu suivant parte replié", async () => {
    setWindowWidth(A56);
    const { unmount } = render(<Header />);
    expect(sessionStorage.getItem("budget.header.filtersSeen")).toBe("1");
    unmount();

    render(<Header />);
    expect(screen.queryByText("Occasionnelle")).toBeNull();
  });

  it("laisse rouvrir les filtres au bouton une fois repliés", async () => {
    setWindowWidth(A56);
    sessionStorage.setItem("budget.header.filtersSeen", "1");
    render(<Header />);

    await userEvent.click(screen.getByRole("button", { name: /Afficher les filtres/ }));
    expect(screen.getByText("Occasionnelle")).toBeTruthy();
  });

  it("garde les filtres toujours visibles sur PC, sans bouton de repli", () => {
    setWindowWidth(PC);
    sessionStorage.setItem("budget.header.filtersSeen", "1");
    render(<Header />);

    expect(screen.getByText("Occasionnelle")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /les filtres/ })).toBeNull();
  });
});

describe("Header — période lisible sur le bouton replié (lot 1.2)", () => {
  it("porte le libellé de la période active", () => {
    setWindowWidth(A56);
    sessionStorage.setItem("budget.header.filtersSeen", "1");
    useFilterStore.setState({ period: "3M" });
    render(<Header />);

    const bouton = screen.getByRole("button", { name: /Afficher les filtres/ });
    expect(bouton.textContent).toContain("3M");
  });

  it("suit le changement de période", () => {
    setWindowWidth(A56);
    sessionStorage.setItem("budget.header.filtersSeen", "1");
    useFilterStore.setState({ period: "all" });
    render(<Header />);

    expect(screen.getByRole("button", { name: /Afficher les filtres/ }).textContent).toContain("Tout");
  });

  it("expose la période dans le nom accessible du bouton", () => {
    setWindowWidth(A56);
    sessionStorage.setItem("budget.header.filtersSeen", "1");
    useFilterStore.setState({ period: "YTD" });
    render(<Header />);

    expect(screen.getByRole("button", { name: /période YTD/ })).toBeTruthy();
  });

  it("ajoute le compteur des autres filtres sans masquer la période", () => {
    setWindowWidth(A56);
    sessionStorage.setItem("budget.header.filtersSeen", "1");
    useFilterStore.setState({ period: "1M", cat1Filter: "Dépense Fixe", showTransfers: true });
    render(<Header />);

    const bouton = screen.getByRole("button", { name: /Afficher les filtres/ });
    expect(bouton.textContent).toContain("1M");
    expect(bouton.textContent).toContain("2");
  });
});
