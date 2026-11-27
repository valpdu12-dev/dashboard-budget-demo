// useApparence suit le passage Jour ↔ Nuit et le changement de largeur, et se
// désabonne au démontage. Jour ou Nuit = le thème posé sur la page
// (data-theme), plus le réglage de l'appareil : le faux écran pose aussi l'attribut.
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useApparence } from "@/hooks/useApparence";
import { FOND_SURFACE } from "@/utils/contrast";

type Rappel = () => void;

function poserTheme(nuit: boolean) {
  document.documentElement.setAttribute("data-theme", nuit ? "nuit" : "jour");
}

function fauxEcran(etat: { grand: boolean; nuit: boolean }) {
  const rappels = new Set<Rappel>();
  poserTheme(etat.nuit);
  vi.stubGlobal("matchMedia", (q: string) => ({
    get matches() { return q.includes("min-width") ? etat.grand : q.includes("dark") ? etat.nuit : false; },
    media: q,
    addEventListener: (_: string, r: Rappel) => rappels.add(r),
    removeEventListener: (_: string, r: Rappel) => rappels.delete(r),
    addListener: (r: Rappel) => rappels.add(r),
    removeListener: (r: Rappel) => rappels.delete(r),
  }));
  return { rappels, prevenir: () => { poserTheme(etat.nuit); rappels.forEach((r) => r()); } };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

describe("useApparence", () => {
  it("suit le téléphone qui passe de Jour à Nuit", () => {
    const etat = { grand: false, nuit: false };
    const ecran = fauxEcran(etat);
    const { result } = renderHook(() => useApparence());
    expect(result.current).toMatchObject({ telephone: true, nuit: false, fondCarte: "#ffffff" });

    act(() => { etat.nuit = true; ecran.prevenir(); });
    expect(result.current).toMatchObject({ telephone: true, nuit: true, fondCarte: "#131519" });
  });

  it("au grand écran, le thème suit aussi (plus de fond d'avant)", () => {
    const etat = { grand: false, nuit: true };
    const ecran = fauxEcran(etat);
    const { result } = renderHook(() => useApparence());
    act(() => { etat.grand = true; ecran.prevenir(); });
    expect(result.current).toMatchObject({ telephone: false, nuit: true, fondCarte: "#131519", accentTexte: "#2dd4bf" });
    act(() => { etat.nuit = false; ecran.prevenir(); });
    expect(result.current).toMatchObject({ telephone: false, nuit: false, fondCarte: "#ffffff", accentTexte: "#115e59" });
    expect(result.current.fondCarte).not.toBe(FOND_SURFACE);
  });

  it("retire ses écouteurs au démontage", () => {
    const ecran = fauxEcran({ grand: false, nuit: false });
    const { unmount } = renderHook(() => useApparence());
    expect(ecran.rappels.size).toBeGreaterThan(0);
    unmount();
    expect(ecran.rappels.size).toBe(0);
  });

  it("suit l'attribut data-theme seul (bouton Auto · Jour · Nuit), sans événement de l'écran", async () => {
    const etat = { grand: false, nuit: false };
    fauxEcran(etat);
    const { result } = renderHook(() => useApparence());
    expect(result.current.nuit).toBe(false);
    await act(async () => { poserTheme(true); await Promise.resolve(); });
    expect(result.current).toMatchObject({ telephone: true, nuit: true, fondCarte: "#131519" });
  });

  it("sans matchMedia ni data-theme (tests, vieux navigateurs) : grand écran, Jour", () => {
    const { result } = renderHook(() => useApparence());
    expect(result.current.telephone).toBe(false);
    expect(result.current.fondCarte).toBe("#ffffff");
  });
});
