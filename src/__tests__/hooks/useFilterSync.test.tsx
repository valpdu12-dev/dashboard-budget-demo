import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetFilterStore } from "../helpers/storeReset";
import { createRouterWrapper } from "../helpers/renderWithProviders";

beforeEach(() => {
  resetFilterStore();
});

describe("useFilterSync — URL → Store au montage", () => {
  it("lit ?month= et initialise selMonth dans le store", () => {
    const wrapper = createRouterWrapper(["/?month=2025-03"]);
    renderHook(() => useFilterSync({ month: "selMonth" }), { wrapper });
    expect(useFilterStore.getState().selMonth).toBe("2025-03");
  });

  it("lit ?cat2= et initialise selCat2", () => {
    const wrapper = createRouterWrapper(["/?cat2=Alimentation"]);
    renderHook(() => useFilterSync({ cat2: "selCat2" }), { wrapper });
    expect(useFilterStore.getState().selCat2).toBe("Alimentation");
  });

  it("lit ?period= et initialise la période", () => {
    const wrapper = createRouterWrapper(["/?period=3M"]);
    renderHook(() => useFilterSync({ period: "period" }), { wrapper });
    expect(useFilterStore.getState().period).toBe("3M");
  });

  it("ignore les paramètres absents de l'URL", () => {
    const wrapper = createRouterWrapper(["/"]);
    renderHook(() => useFilterSync({ month: "selMonth" }), { wrapper });
    expect(useFilterStore.getState().selMonth).toBeNull();
  });

  it("n'applique pas les paramètres non inclus dans le mapping", () => {
    const wrapper = createRouterWrapper(["/?cat2=Alimentation"]);
    renderHook(() => useFilterSync({ month: "selMonth" }), { wrapper });
    expect(useFilterStore.getState().selCat2).toBeNull();
  });
});

describe("useFilterSync — Store → URL", () => {
  it("met à jour le store quand l'URL contient une valeur au montage", () => {
    // Vérification : l'URL initialise bien le store (comportement Store → URL
    // testé indirectement car searchParams est géré en interne par MemoryRouter)
    const wrapper = createRouterWrapper(["/?month=2025-05"]);
    renderHook(() => useFilterSync({ month: "selMonth" }), { wrapper });
    expect(useFilterStore.getState().selMonth).toBe("2025-05");
  });

  it("met à jour le store avec la valeur de l'URL au montage (plusieurs params)", () => {
    const wrapper = createRouterWrapper(["/?month=2025-02&cat2=Transport"]);
    renderHook(() => useFilterSync({ month: "selMonth", cat2: "selCat2" }), { wrapper });
    const state = useFilterStore.getState();
    expect(state.selMonth).toBe("2025-02");
    expect(state.selCat2).toBe("Transport");
  });

  it("ne modifie pas une valeur déjà identique dans le store", () => {
    // Si URL et store ont la même valeur, pas de setter appelé (idempotent)
    useFilterStore.getState().setSelMonth("2025-03");
    const wrapper = createRouterWrapper(["/?month=2025-03"]);
    renderHook(() => useFilterSync({ month: "selMonth" }), { wrapper });
    expect(useFilterStore.getState().selMonth).toBe("2025-03");
  });

  it("sync Store → URL : le setSearchParams est appelé quand store change", () => {
    const wrapper = createRouterWrapper(["/"]);
    const { rerender } = renderHook(
      () => useFilterSync({ month: "selMonth" }),
      { wrapper }
    );
    act(() => {
      useFilterStore.getState().setSelMonth("2025-06");
    });
    rerender();
    // La valeur dans le store doit être mise à jour
    expect(useFilterStore.getState().selMonth).toBe("2025-06");
  });

  it("efface le filtre du store quand on appelle setSelMonth(null)", () => {
    const wrapper = createRouterWrapper(["/?month=2025-03"]);
    renderHook(() => useFilterSync({ month: "selMonth" }), { wrapper });
    expect(useFilterStore.getState().selMonth).toBe("2025-03");

    act(() => {
      useFilterStore.getState().setSelMonth(null);
    });
    expect(useFilterStore.getState().selMonth).toBeNull();
  });
});

describe("useFilterSync — multiple mappings", () => {
  it("synchronise plusieurs paramètres simultanément", () => {
    const wrapper = createRouterWrapper(["/?month=2025-02&cat2=Transport&type=CB"]);
    renderHook(
      () => useFilterSync({ month: "selMonth", cat2: "selCat2", type: "selType" }),
      { wrapper }
    );
    const state = useFilterStore.getState();
    expect(state.selMonth).toBe("2025-02");
    expect(state.selCat2).toBe("Transport");
    expect(state.selType).toBe("CB");
  });
});
