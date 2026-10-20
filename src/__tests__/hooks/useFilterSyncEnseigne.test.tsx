import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetFilterStore } from "../helpers/storeReset";
import { createRouterWrapper } from "../helpers/renderWithProviders";

const MAPPING = { enseigne: "selEnseignes", evenement: "selEvenements" } as const;

beforeEach(() => {
  resetFilterStore();
});

describe("useFilterSync — Enseigne / Événement", () => {
  it("?enseigne=…&evenement=… ouvre la page déjà filtrée", () => {
    const wrapper = createRouterWrapper(["/depenses?enseigne=Primeur&evenement=Vacances%20d'%C3%A9t%C3%A9"]);
    renderHook(() => useFilterSync({ ...MAPPING }), { wrapper });
    const s = useFilterStore.getState();
    expect(s.selEnseignes).toEqual(["Primeur"]);
    expect(s.selEvenements).toEqual(["Vacances d'été"]);
  });

  it("un paramètre vide est ignoré", () => {
    const wrapper = createRouterWrapper(["/depenses?enseigne=&enseigne=Primeur"]);
    renderHook(() => useFilterSync({ ...MAPPING }), { wrapper });
    expect(useFilterStore.getState().selEnseignes).toEqual(["Primeur"]);
  });

  it("valeurs multiples : ?enseigne=A&enseigne=B", () => {
    const wrapper = createRouterWrapper(["/depenses?enseigne=Primeur&enseigne=Cinéma"]);
    renderHook(() => useFilterSync({ ...MAPPING }), { wrapper });
    expect(useFilterStore.getState().selEnseignes).toEqual(["Primeur", "Cinéma"]);
  });

  it("plusieurs choix dans le store → paramètre répété dans l'URL", () => {
    const wrapper = createRouterWrapper(["/depenses"]);
    const { result } = renderHook(() => {
      useFilterSync({ ...MAPPING });
      return useLocation();
    }, { wrapper });
    act(() => { useFilterStore.getState().setSelEnseignes(["Primeur", "Cinéma"]); });
    expect(new URLSearchParams(result.current.search).getAll("enseigne")).toEqual(["Primeur", "Cinéma"]);
  });

  it("un choix dans le store s'écrit dans l'URL", () => {
    const wrapper = createRouterWrapper(["/depenses"]);
    const { result } = renderHook(() => {
      useFilterSync({ ...MAPPING });
      return useLocation();
    }, { wrapper });
    act(() => { useFilterStore.getState().setSelEvenements(["Vacances d'été"]); });
    expect(new URLSearchParams(result.current.search).get("evenement")).toBe("Vacances d'été");
    act(() => { useFilterStore.getState().clearDepFilters(); });
    expect(result.current.search).toBe("");
  });
});
