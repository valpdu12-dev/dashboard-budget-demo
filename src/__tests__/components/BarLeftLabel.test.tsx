import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BarLeftLabel } from "@/pages/Depenses";

/**
 * Libellés des barres horizontales de la page Dépenses (sous 430 px).
 *
 * Défaut constaté sur A56 le 11/08/2026 : le libellé était posé à `y - 6`, or
 * `y` est le bord SUPÉRIEUR de la barre sur un `layout="vertical"`. Le texte
 * flottait donc entre sa barre et la précédente — « Cantine » se lisait au
 * niveau de « Restaurant » — et le tout premier libellé sortait du cadre,
 * faute de marge haute.
 */

function renderLabel(props: Record<string, unknown>) {
  const { container } = render(
    <svg>
      <BarLeftLabel {...props} />
    </svg>
  );
  return container.querySelector("text");
}

describe("BarLeftLabel", () => {
  it("centre le libellé sur la hauteur de sa barre", () => {
    // Barre occupant [100, 140] : le centre est à 120.
    const t = renderLabel({ x: 0, y: 100, height: 40, value: "Cantine" });
    expect(t?.getAttribute("y")).toBe("120");
    expect(t?.getAttribute("dominant-baseline")).toBe("central");
  });

  it("ne place jamais le libellé au-dessus de sa barre", () => {
    // Régression directe : avec `y - 6`, on obtenait 94 pour une barre à 100.
    const t = renderLabel({ x: 0, y: 100, height: 40, value: "Cantine" });
    expect(Number(t?.getAttribute("y"))).toBeGreaterThan(100);
  });

  it("reste dans le cadre pour la première barre du graphique", () => {
    // La première barre commence tout en haut ; l'ancien calcul sortait de la
    // zone de dessin, qui n'offre que ~5 px de marge haute.
    const t = renderLabel({ x: 0, y: 4, height: 34, value: "Courses" });
    expect(Number(t?.getAttribute("y"))).toBeGreaterThanOrEqual(4);
  });

  it("ancre le texte à gauche, quelle que soit la longueur de la barre", () => {
    const court = renderLabel({ x: 0, y: 0, height: 30, value: "A" });
    const long = renderLabel({ x: 300, y: 0, height: 30, value: "B" });
    expect(court?.getAttribute("x")).toBe("0");
    expect(long?.getAttribute("x")).toBe("2");
    expect(long?.getAttribute("text-anchor")).toBe("start");
  });

  it("se replie sur y quand la hauteur n'est pas fournie", () => {
    const t = renderLabel({ x: 0, y: 50, value: "Sans hauteur" });
    expect(t?.getAttribute("y")).toBe("50");
  });

  it("ne rend rien sans valeur", () => {
    expect(renderLabel({ x: 0, y: 10, height: 20 })).toBeNull();
  });

  it("replie un libelle long sur deux lignes", () => {
    const nom = "Equipements Electroniques (TV, Barre de Son, Console, …)";
    const t = renderLabel({ x: 0, y: 0, height: 42, value: nom });
    const tspans = t?.querySelectorAll("tspan");
    expect(tspans?.length).toBe(2);
    const reconstruit = [...(tspans ?? [])].map((e) => e.textContent).join(" ");
    expect(reconstruit).toBe(nom);
    expect(t?.getAttribute("text-anchor")).toBe("start");
  });

  it("garde une seule ligne pour un libelle court", () => {
    const t = renderLabel({ x: 0, y: 0, height: 42, value: "Alimentation" });
    expect(t?.querySelectorAll("tspan").length).toBe(0);
    expect(t?.textContent).toBe("Alimentation");
  });
});
