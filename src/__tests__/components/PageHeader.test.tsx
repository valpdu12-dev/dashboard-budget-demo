import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageHeader } from "@/components/ui/PageHeader";

describe("PageHeader — titre et sous-titre", () => {
  it("affiche le titre", () => {
    render(<PageHeader title="Dépenses" />);
    expect(screen.getByRole("heading", { name: "Dépenses" })).toBeTruthy();
  });

  it("affiche le sous-titre si fourni", () => {
    render(<PageHeader title="Dépenses" subtitle="Détail mensuel" />);
    expect(screen.getByText("Détail mensuel")).toBeTruthy();
  });

  it("n'affiche pas de sous-titre si absent", () => {
    render(<PageHeader title="Dépenses" />);
    expect(screen.queryByText("Détail mensuel")).toBeNull();
  });
});

describe("PageHeader — breadcrumbs", () => {
  it("affiche les breadcrumbs quand fournis", () => {
    render(
      <PageHeader
        title="Détail"
        breadcrumbs={[{ label: "Accueil" }, { label: "Dépenses" }]}
      />
    );
    expect(screen.getByText("Accueil")).toBeTruthy();
    expect(screen.getByText("Dépenses")).toBeTruthy();
  });

  it("n'affiche pas de breadcrumbs si tableau vide", () => {
    const { container } = render(<PageHeader title="Test" breadcrumbs={[]} />);
    const crumbs = container.querySelector(".flex.items-center.gap-1.text-xs");
    expect(crumbs).toBeNull();
  });

  it("rend un bouton pour les crumbs avec onClick", async () => {
    const onClick = vi.fn();
    render(
      <PageHeader
        title="Test"
        breadcrumbs={[{ label: "Accueil", onClick }]}
      />
    );
    const btn = screen.getByRole("button", { name: "Accueil" });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("rend un <span> (pas de button) pour les crumbs sans onClick", () => {
    render(
      <PageHeader
        title="Test"
        breadcrumbs={[{ label: "Accueil" }]}
      />
    );
    expect(screen.queryByRole("button", { name: "Accueil" })).toBeNull();
    expect(screen.getByText("Accueil")).toBeTruthy();
  });

  it("ajoute le séparateur › entre les crumbs", () => {
    const { container } = render(
      <PageHeader
        title="Test"
        breadcrumbs={[{ label: "A" }, { label: "B" }]}
      />
    );
    expect(container.textContent).toContain("›");
  });
});

describe("PageHeader — actions", () => {
  it("rend le slot actions si fourni", () => {
    render(
      <PageHeader
        title="Test"
        actions={<button data-testid="action-btn">Export</button>}
      />
    );
    expect(screen.getByTestId("action-btn")).toBeTruthy();
  });

  it("n'affiche pas de zone actions si absent", () => {
    const { container } = render(<PageHeader title="Test" />);
    // Pas de div flex items-center gap-2 pour les actions
    const actionsDiv = container.querySelector(".flex.items-center.gap-2");
    expect(actionsDiv).toBeNull();
  });
});
