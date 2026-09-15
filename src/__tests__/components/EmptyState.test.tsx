import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState — contenu", () => {
  it("affiche le titre", () => {
    render(<EmptyState title="Aucune transaction" />);
    expect(screen.getByText("Aucune transaction")).toBeTruthy();
  });

  it("affiche la description si fournie", () => {
    render(<EmptyState title="Vide" description="Ajoutez des données pour commencer." />);
    expect(screen.getByText("Ajoutez des données pour commencer.")).toBeTruthy();
  });

  it("n'affiche pas de description si absente", () => {
    render(<EmptyState title="Vide" />);
    expect(screen.queryByText("Ajoutez des données")).toBeNull();
  });

  it("affiche l'icône Inbox par défaut", () => {
    const { container } = render(<EmptyState title="Vide" />);
    // Lucide rend un SVG
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("affiche une icône personnalisée si fournie", () => {
    render(<EmptyState title="Vide" icon={<span data-testid="custom-icon">📭</span>} />);
    expect(screen.getByTestId("custom-icon")).toBeTruthy();
  });

  it("applique la classe text-center sur le container", () => {
    const { container } = render(<EmptyState title="Vide" />);
    expect(container.firstChild).toHaveClass("text-center");
  });

  it("rend le titre avec la classe font-medium", () => {
    render(<EmptyState title="Aucune donnée" />);
    const title = screen.getByText("Aucune donnée");
    expect(title).toHaveClass("font-medium");
  });
});
