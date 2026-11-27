// La carte KPI au téléphone (centimes en gris, couleur lisible
// sur le fond du thème). La couleur suit le thème à toutes les largeurs.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { KPICard } from "@/components/ui/KPICard";
import { contrastRatio, ensureContrast } from "@/utils/contrast";

function simulerEcran(telephone: boolean, nuit: boolean) {
  // Nuit = data-theme sur la page (bouton Auto · Jour · Nuit).
  document.documentElement.setAttribute("data-theme", nuit ? "nuit" : "jour");
  vi.stubGlobal("matchMedia", (q: string) => ({
    // useApparence demande « (min-width: 768px) » (grand écran).
    matches: q.includes("min-width") ? !telephone : q.includes("dark") ? nuit : false,
    media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
  }));
}

/** « rgb(r, g, b) » → « #rrggbb ». */
function versHex(rgb: string): string {
  const [r, g, b] = (rgb.match(/\d+/g) ?? []).map(Number);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

afterEach(() => vi.unstubAllGlobals());

describe("KPICard au téléphone", () => {
  it("Jour : centimes à part, même texte, couleur lisible sur du blanc", () => {
    simulerEcran(true, false);
    const { container } = render(<KPICard label="Solde" customValue="10 520,16 €" color="#22c55e" />);
    const valeur = container.querySelector(".text-xl") as HTMLElement;
    expect(valeur.textContent).toBe("10 520,16 €");
    expect(valeur.querySelector("span.text-text-sec")?.textContent).toBe(",16 €");
    expect(contrastRatio(versHex(valeur.style.color), "#ffffff")!).toBeGreaterThanOrEqual(4.5);
  });

  it("Nuit : couleur lisible sur le fond sombre des cartes", () => {
    simulerEcran(true, true);
    const { container } = render(<KPICard label="Solde" customValue="5,00 €" color="#2563eb" />);
    const valeur = container.querySelector(".text-xl") as HTMLElement;
    expect(contrastRatio(versHex(valeur.style.color), "#131519")!).toBeGreaterThanOrEqual(4.5);
  });

  it("grand écran : aucun découpage des centimes ; couleur lisible sur le fond du thème", () => {
    simulerEcran(false, false);
    const { container } = render(<KPICard label="Solde" customValue="10 520,16 €" color="#22c55e" />);
    const valeur = container.querySelector(".text-xl") as HTMLElement;
    expect(valeur.querySelector("span")).toBeNull();
    expect(contrastRatio(versHex(valeur.style.color), "#ffffff")!).toBeGreaterThanOrEqual(4.5);
  });

  it("grand écran en Nuit : relevée contre #131519 (plus l'ancien #111827)", () => {
    simulerEcran(false, true);
    const { container } = render(<KPICard label="Solde" customValue="5,00 €" color="#2563eb" />);
    const valeur = container.querySelector(".text-xl") as HTMLElement;
    expect(versHex(valeur.style.color)).toBe(ensureContrast("#2563eb", "#131519").toLowerCase());
  });
});
