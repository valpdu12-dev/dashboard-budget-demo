import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KPICard } from "@/components/ui/KPICard";
import { contrastRatio, FOND_SURFACE } from "@/utils/contrast";

describe("KPICard — affichage de la valeur", () => {
  it("formate en euros par défaut", () => {
    render(<KPICard label="Dépenses" value={1234.56} />);
    expect(screen.getByText(/1.234|1 234/)).toBeTruthy();
  });

  it("formate en pourcentage avec format=pct", () => {
    render(<KPICard label="Taux" value={0.153} format="pct" />);
    expect(screen.getByText(/15,3 %/)).toBeTruthy();
  });

  it("formate en raw (nombre brut) avec format=raw", () => {
    render(<KPICard label="Nb" value={42} format="raw" />);
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("affiche '—' quand value est undefined", () => {
    render(<KPICard label="Solde" />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("affiche customValue à la place de value si fourni", () => {
    render(<KPICard label="Solde" value={100} customValue="N/A" />);
    expect(screen.getByText("N/A")).toBeTruthy();
    expect(screen.queryByText(/100/)).toBeNull();
  });
});

describe("KPICard — label et icône", () => {
  it("affiche le label", () => {
    render(<KPICard label="Solde total" value={5000} />);
    expect(screen.getByText("Solde total")).toBeTruthy();
  });

  it("affiche l'icône si fournie", () => {
    render(<KPICard label="KPI" value={100} icon={<span data-testid="icon">💰</span>} />);
    expect(screen.getByTestId("icon")).toBeTruthy();
  });
});

describe("KPICard — variation (delta)", () => {
  it("affiche le delta en vert quand positif (hausse)", () => {
    // value > prev → pctChange retourne "+X,Y %" → isPositive=true → text-green
    render(<KPICard label="KPI" value={1200} prev={1000} />);
    const delta = document.querySelector(".text-green");
    expect(delta).toBeTruthy();
    expect(delta?.textContent).toMatch(/\+/);
  });

  it("affiche le delta en rouge quand négatif (baisse)", () => {
    render(<KPICard label="KPI" value={800} prev={1000} />);
    const delta = document.querySelector(".text-red");
    expect(delta).toBeTruthy();
  });

  it("n'affiche pas de delta quand prev est undefined", () => {
    render(<KPICard label="KPI" value={1000} />);
    expect(document.querySelector(".text-green")).toBeNull();
    expect(document.querySelector(".text-red")).toBeNull();
  });

  it("affiche customSub à la place du delta calculé", () => {
    render(<KPICard label="KPI" value={1000} prev={800} customSub="Stable" />);
    expect(screen.getByText("Stable")).toBeTruthy();
  });

  // Lot 1.6 — ce test attendait `rgb(255, 0, 0)` à l'identique. Il tombe
  // désormais, et c'est le comportement voulu : #FF0000 ne fait que 3,99:1 sur
  // `surface` (#111827), sous les 4,5 exigés par WCAG AA. `ensureContrast` le
  // relève à l'affichage. Ce qui est garanti n'est donc plus l'égalité exacte
  // mais l'invariant utile : la couleur reste rouge ET devient lisible.
  it("applique subColor en le relevant au seuil de contraste", () => {
    render(<KPICard label="KPI" value={1000} customSub="Note" subColor="#ff0000" />);
    const el = screen.getByText("Note");
    expect(el.style.color).not.toBe("");
    // Teinte conservée : la composante rouge reste dominante.
    const [, r, g, b] = /rgb\((\d+), (\d+), (\d+)\)/.exec(el.style.color) as RegExpExecArray;
    expect(Number(r)).toBeGreaterThan(Number(g));
    expect(Number(r)).toBeGreaterThan(Number(b));
    expect(contrastRatio(el.style.color.replace(/rgb\((\d+), (\d+), (\d+)\)/, (_, x, y, z) =>
      "#" + [x, y, z].map((v: string) => Number(v).toString(16).padStart(2, "0")).join("")
    ), FOND_SURFACE) as number).toBeGreaterThanOrEqual(4.5);
  });

  it("laisse subColor intact quand il est déjà conforme", () => {
    render(<KPICard label="KPI" value={1000} customSub="Note" subColor="#E5E7EB" />);
    expect(screen.getByText("Note").style.color).toBe("rgb(229, 231, 235)");
  });
});

describe("KPICard — couleur personnalisée", () => {
  it("applique la couleur à la valeur", () => {
    render(<KPICard label="KPI" value={1000} color="#22c55e" />);
    const valueEl = document.querySelector("[style*='color']");
    expect(valueEl).toBeTruthy();
  });
});

// ── Lot 1.4 — densité sous 430 px ──────────────────────────────────────────
//
// Ce que ces tests peuvent et ne peuvent pas prouver. jsdom n'applique aucune
// feuille Tailwind : il n'y a ni media query, ni largeur calculée, ni police
// réelle. Vérifier que « le montant tient dans la carte » est donc hors de
// portée d'une suite unitaire — c'est `scripts/audit-mobile/check-kpi.mjs`
// qui le mesure, sous Chrome, au taux de remplissage.
//
// Ce que ces tests verrouillent, c'est le contrat de classes : les deux
// leviers du lot sont présents, et ils sont bien conditionnés à `max-xs:`
// (< 430 px) — donc sans effet sur le rendu PC. C'est précisément la
// régression qu'une relecture distraite introduirait : retirer le préfixe et
// appliquer `text-lg` à tous les écrans.
describe("KPICard — densité mobile (lot 1.4)", () => {
  const kpiCard = () => document.querySelector(".kpi-card") as HTMLElement;
  const valueEl = (text: string) => screen.getByText(text);

  it("réduit le padding de la carte sous 430 px", () => {
    render(<KPICard label="Solde" value={1000} />);
    expect(kpiCard().className).toContain("max-xs:p-3");
  });

  it("réduit la taille de la valeur sous 430 px", () => {
    render(<KPICard label="Solde" customValue="123 456,78 €" />);
    expect(valueEl("123 456,78 €").className).toContain("max-xs:text-lg");
  });

  it("conserve text-xl comme taille de base (rendu PC inchangé)", () => {
    render(<KPICard label="Solde" customValue="1 234,00 €" />);
    const cls = valueEl("1 234,00 €").className;
    expect(cls).toContain("text-xl");
    // Le levier mobile ne doit exister que derrière le palier `max-xs:` :
    // un `text-lg` nu s'appliquerait aussi au bureau.
    expect(cls).not.toMatch(/(^|\s)text-lg(\s|$)/);
  });

  it("n'applique aucun levier de densité en dehors du palier max-xs", () => {
    render(<KPICard label="Solde" value={1000} />);
    const cls = kpiCard().className;
    // Idem côté padding : `p-3` nu écraserait le `p-5` du bureau.
    expect(cls).not.toMatch(/(^|\s)p-3(\s|$)/);
  });

  it("garde les deux leviers sur toutes les formes de valeur", () => {
    // La valeur passe par deux chemins distincts dans le composant
    // (`customValue` ou `value` formaté). Le lot 1.3 a montré qu'une
    // correction appliquée à une seule branche passe inaperçue : on couvre
    // les deux.
    for (const props of [{ value: 1234.56 }, { customValue: "N/A" }] as const) {
      document.body.innerHTML = "";
      const { unmount } = render(<KPICard label="KPI" {...props} />);
      const value = kpiCard().querySelector(".font-title") as HTMLElement;
      expect(value.className).toContain("max-xs:text-lg");
      expect(kpiCard().className).toContain("max-xs:p-3");
      unmount();
    }
  });
});
