import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useResponsive } from "@/hooks/useResponsive";

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

afterEach(() => {
  setWindowWidth(1024); // Reset
});

describe("useResponsive", () => {
  it("détecte mobile quand width < 768", () => {
    setWindowWidth(375);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it("détecte tablet quand 768 ≤ width < 1024", () => {
    setWindowWidth(900);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it("détecte desktop quand width ≥ 1024", () => {
    setWindowWidth(1440);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
  });

  it("retourne la width courante", () => {
    setWindowWidth(800);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.width).toBe(800);
  });

  it("met à jour quand la fenêtre est redimensionnée", () => {
    setWindowWidth(1200);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isDesktop).toBe(true);

    act(() => {
      setWindowWidth(500);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.isMobile).toBe(true);
    expect(result.current.width).toBe(500);
  });

  it("nettoie l'écouteur au démontage (pas de fuites mémoire)", () => {
    const addSpy    = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useResponsive());
    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  // ── Lot 1.1 — palier isSmall (430 px) ─────────────────────────────────
  // 430 px et non 400 px : le Samsung A56 fait 412 px de large, un seuil à
  // 400 px l'aurait manqué. Voir docs/audits/AUDIT_MOBILE_A56.md § 3.

  it("isSmall est vrai à 412 px (Samsung A56)", () => {
    setWindowWidth(412);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isSmall).toBe(true);
    expect(result.current.isMobile).toBe(true);
  });

  it("isSmall est vrai juste sous le palier (429 px) et faux au palier (430 px)", () => {
    setWindowWidth(429);
    expect(renderHook(() => useResponsive()).result.current.isSmall).toBe(true);

    setWindowWidth(430);
    expect(renderHook(() => useResponsive()).result.current.isSmall).toBe(false);
  });

  it("isSmall reste faux sur les paliers supérieurs (768 et 1440 px)", () => {
    setWindowWidth(768);
    expect(renderHook(() => useResponsive()).result.current.isSmall).toBe(false);

    setWindowWidth(1440);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isSmall).toBe(false);
    expect(result.current.isDesktop).toBe(true);
  });

  it("isSmall suit le redimensionnement via le repli resize (jsdom sans matchMedia)", () => {
    // jsdom n'implémente pas window.matchMedia : ce test vérifie que le
    // repli du hook reste fonctionnel, sans polyfill dans vitest.setup.ts.
    expect(typeof window.matchMedia).not.toBe("function");

    setWindowWidth(1200);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isSmall).toBe(false);

    act(() => {
      setWindowWidth(412);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.isSmall).toBe(true);
    expect(result.current.width).toBe(412);
  });
});
