import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChartSize, smallHeight, smallDonutRadii } from "@/hooks/useChartSize";

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

/** Samsung Galaxy A56 — la cible de la partie 1 du plan. */
const A56 = 412;
/** Juste au-dessus du palier `isSmall` (430 px). */
const JUSTE_AU_DESSUS = 430;

afterEach(() => {
  setWindowWidth(1024);
});

describe("smallHeight", () => {
  it("écrête les graphiques trop hauts pour les 667 px utiles de l'A56", () => {
    expect(smallHeight(380)).toBe(300);
    expect(smallHeight(350)).toBe(300);
    expect(smallHeight(320)).toBe(300);
    expect(smallHeight(600)).toBe(300);
  });

  it("laisse intacte toute hauteur déjà sous le plafond", () => {
    // Régression du 29/07 : une mise à l'échelle × 0,72 écrasait ces graphiques
    // (300 → 216) sans qu'aucune cible mesurée ne le demande.
    expect(smallHeight(300)).toBe(300);
    expect(smallHeight(260)).toBe(260);
    expect(smallHeight(200)).toBe(200);
  });
});

describe("smallDonutRadii", () => {
  it("réduit les rayons et retire les libellés radiaux", () => {
    expect(smallDonutRadii(70, 110)).toEqual({ inner: 60, outer: 94, showRadialLabels: false });
    expect(smallDonutRadii(60, 100)).toEqual({ inner: 51, outer: 85, showRadialLabels: false });
  });
});

describe("useChartSize", () => {
  it("laisse les valeurs PC intactes au-dessus de 430 px", () => {
    setWindowWidth(1440);
    const { result } = renderHook(() => useChartSize());

    expect(result.current.isSmall).toBe(false);
    expect(result.current.chartHeight(380)).toBe(380);
    expect(result.current.chartHeight(260)).toBe(260);
    expect(result.current.axisWidth(160)).toBe(160);
    expect(result.current.donutRadii(70, 110)).toEqual({
      inner: 70,
      outer: 110,
      showRadialLabels: true,
    });
  });

  it("laisse les valeurs PC intactes exactement au palier de 430 px", () => {
    // Le palier est strict (< 430) : à 430 px on est encore en rendu PC.
    setWindowWidth(JUSTE_AU_DESSUS);
    const { result } = renderHook(() => useChartSize());

    expect(result.current.isSmall).toBe(false);
    expect(result.current.chartHeight(380)).toBe(380);
    expect(result.current.axisWidth(160)).toBe(160);
  });

  it("écrête les hauteurs sur l'A56 sans toucher aux graphiques déjà bas", () => {
    setWindowWidth(A56);
    const { result } = renderHook(() => useChartSize());

    expect(result.current.isSmall).toBe(true);
    expect(result.current.chartHeight(380)).toBe(300);
    expect(result.current.chartHeight(300)).toBe(300);
    expect(result.current.chartHeight(260)).toBe(260);
  });

  it("annule la largeur d'axe sur l'A56 pour rendre la place aux barres", () => {
    setWindowWidth(A56);
    const { result } = renderHook(() => useChartSize());

    // Les 3 axes Y figés de Depenses.tsx : 160 / 110 / 90 px sur 346 disponibles.
    expect(result.current.axisWidth(160)).toBe(0);
    expect(result.current.axisWidth(110)).toBe(0);
    expect(result.current.axisWidth(90)).toBe(0);
  });

  it("bascule les donuts en légende sur l'A56", () => {
    setWindowWidth(A56);
    const { result } = renderHook(() => useChartSize());

    const donut = result.current.donutRadii(70, 110);
    expect(donut.showRadialLabels).toBe(false);
    expect(donut.outer).toBeLessThan(110);
  });
});
