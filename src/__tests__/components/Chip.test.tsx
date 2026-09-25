import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chip } from "@/components/ui/Chip";

describe("Chip — rendu de base", () => {
  it("affiche le label", () => {
    render(<Chip label="Alimentation" />);
    expect(screen.getByText("Alimentation")).toBeTruthy();
  });

  it("rend un bouton (rôle button)", () => {
    render(<Chip label="Test" />);
    expect(screen.getByRole("button")).toBeTruthy();
  });
});

describe("Chip — état actif / inactif", () => {
  it("applique les classes inactives par défaut", () => {
    render(<Chip label="Test" active={false} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("border-border", "bg-surface", "text-text-sec");
  });

  it("applique les classes actives quand active=true", () => {
    render(<Chip label="Test" active={true} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("border-indigo", "bg-indigo/20", "text-text");
  });

  it("applique le style de couleur personnalisée quand active + color", () => {
    render(<Chip label="Test" active={true} color="#22c55e" />);
    const btn = screen.getByRole("button");
    expect(btn.style.borderColor).toBe("rgb(34, 197, 94)");
  });
});

describe("Chip — interactions", () => {
  it("appelle onClick au clic", async () => {
    const onClick = vi.fn();
    render(<Chip label="Test" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("affiche le bouton clear (×) quand active + onClear", () => {
    render(<Chip label="Test" active={true} onClear={vi.fn()} />);
    expect(screen.getByText("x")).toBeTruthy();
  });

  it("n'affiche pas le bouton clear quand inactif", () => {
    render(<Chip label="Test" active={false} onClear={vi.fn()} />);
    expect(screen.queryByText("x")).toBeNull();
  });

  it("n'affiche pas le bouton clear quand onClear est absent", () => {
    render(<Chip label="Test" active={true} />);
    expect(screen.queryByText("x")).toBeNull();
  });

  it("appelle onClear et stopPropagation au clic sur ×", async () => {
    const onClear = vi.fn();
    const onClick = vi.fn();
    render(<Chip label="Test" active={true} onClick={onClick} onClear={onClear} />);
    await userEvent.click(screen.getByText("x"));
    expect(onClear).toHaveBeenCalledOnce();
    // onClick ne doit PAS être appelé (stopPropagation)
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Chip — indicateur couleur", () => {
  it("affiche le point coloré quand color est fourni", () => {
    const { container } = render(<Chip label="Test" color="#ff0000" />);
    const dot = container.querySelector(".w-2.h-2.rounded-full");
    expect(dot).toBeTruthy();
    expect((dot as HTMLElement).style.background).toBe("rgb(255, 0, 0)");
  });

  it("n'affiche pas le point coloré sans prop color", () => {
    const { container } = render(<Chip label="Test" />);
    const dot = container.querySelector(".w-2.h-2.rounded-full");
    expect(dot).toBeNull();
  });
});
