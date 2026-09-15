// ── Wrapper de rendu avec providers (React Router, etc.) ──────────────────
import React from "react";
import { MemoryRouter } from "react-router-dom";
import type { RenderOptions } from "@testing-library/react";
import { render } from "@testing-library/react";

interface WrapperOptions extends RenderOptions {
  initialEntries?: string[];
}

/**
 * Wrapper avec MemoryRouter pour les hooks/composants qui utilisent react-router.
 * @param initialEntries - Routes initiales (ex: ["/?month=2025-03"])
 */
export function renderWithRouter(
  ui: React.ReactElement,
  { initialEntries = ["/"], ...options }: WrapperOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Crée un wrapper MemoryRouter pour renderHook.
 */
export function createRouterWrapper(initialEntries: string[] = ["/"]) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}
