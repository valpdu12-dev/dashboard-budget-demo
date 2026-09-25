import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInfobulleTactile } from "@/hooks/useInfobulleTactile";

/**
 * Infobulle sur écran tactile.
 *
 * Sur écran tactile, aucun `mouseleave` n'est émis quand le doigt se lève :
 * Recharts gardait l'infobulle affichée indéfiniment, masquant le graphique
 * (constaté sur A56 le 11/08/2026).
 *
 * ⚠️ Une PREMIÈRE version effaçait après un délai déclenché par `touchend`.
 * Ses tests passaient — et elle n'a pas tenu sur l'appareil : `touchend` n'est
 * pas émis quand le navigateur reprend la main pour faire défiler la page, il
 * émet `touchcancel`. Les tests validaient la mécanique du minuteur, pas la
 * réalité des événements. D'où la règle actuelle, sans délai : l'infobulle
 * est visible tant que le doigt touche, et pas au-delà.
 *
 * `active` : `undefined` = Recharts décide, `false` = effacement forcé
 * (`generateCategoricalChart.js:1277` fait `props.active ?? isTooltipActive`).
 */

describe("useInfobulleTactile", () => {
  it("ne présume rien tant qu'aucun toucher n'a eu lieu", () => {
    // Le survol souris sur PC doit rester intact : forcer `false` d'emblée
    // priverait d'infobulle une souris pilotant un écran tactile.
    const { result } = renderHook(() => useInfobulleTactile());
    expect(result.current.active).toBeUndefined();
  });

  it("laisse l'infobulle visible tant que le doigt touche", () => {
    const { result } = renderHook(() => useInfobulleTactile());
    act(() => result.current.handlers.onTouchStart());
    expect(result.current.active).toBeUndefined();
  });

  it("efface l'infobulle dès que le doigt se lève", () => {
    const { result } = renderHook(() => useInfobulleTactile());
    act(() => result.current.handlers.onTouchStart());
    act(() => result.current.handlers.onTouchEnd());
    expect(result.current.active).toBe(false);
  });

  it("efface aussi l'infobulle quand le geste est ANNULÉ", () => {
    // C'est le cas oublié par la première version, et la cause de son échec :
    // le navigateur émet `touchcancel` dès qu'il prend la main pour faire
    // défiler la page — situation courante sur une page de dix écrans.
    const { result } = renderHook(() => useInfobulleTactile());
    act(() => result.current.handlers.onTouchStart());
    act(() => result.current.handlers.onTouchCancel());
    expect(result.current.active).toBe(false);
  });

  it("réaffiche l'infobulle au toucher suivant", () => {
    const { result } = renderHook(() => useInfobulleTactile());
    act(() => result.current.handlers.onTouchStart());
    act(() => result.current.handlers.onTouchEnd());
    expect(result.current.active).toBe(false);

    act(() => result.current.handlers.onTouchStart());
    expect(result.current.active).toBeUndefined();
  });

  it("reste affichée pendant un glissement, sans clignoter", () => {
    // Passer d'une barre à l'autre n'émet ni `touchend` ni `touchcancel`.
    const { result } = renderHook(() => useInfobulleTactile());
    act(() => result.current.handlers.onTouchStart());
    expect(result.current.active).toBeUndefined();
    expect(result.current.active).toBeUndefined();
  });

  it("n'a besoin d'aucun minuteur pour revenir à un état propre", () => {
    // Un état qui n'expire pas ne peut pas rester coincé : c'est tout
    // l'intérêt d'avoir retiré le délai.
    const { result } = renderHook(() => useInfobulleTactile());
    act(() => result.current.handlers.onTouchStart());
    act(() => result.current.handlers.onTouchEnd());
    act(() => result.current.handlers.onTouchEnd()); // relâchement redondant
    expect(result.current.active).toBe(false);
  });
});
