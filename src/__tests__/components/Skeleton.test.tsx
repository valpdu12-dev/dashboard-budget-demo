import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  SkeletonBar, SkeletonCircle,
  SkeletonKPI, SkeletonKPIGrid,
  SkeletonChart, SkeletonDonut,
  SkeletonTable, SkeletonPage,
} from "@/components/ui/Skeleton";

describe("SkeletonBar", () => {
  it("rend un div avec animate-pulse", () => {
    const { container } = render(<SkeletonBar />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("applique la className additionnelle", () => {
    const { container } = render(<SkeletonBar className="h-4 w-32" />);
    expect(container.firstChild).toHaveClass("h-4", "w-32");
  });

  it("applique le style inline", () => {
    const { container } = render(<SkeletonBar style={{ height: "50%" }} />);
    expect((container.firstChild as HTMLElement).style.height).toBe("50%");
  });
});

describe("SkeletonCircle", () => {
  it("rend un div rond avec la taille par défaut (40px)", () => {
    const { container } = render(<SkeletonCircle />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("rounded-full", "animate-pulse");
    expect(el.style.width).toBe("40px");
    expect(el.style.height).toBe("40px");
  });

  it("applique une taille personnalisée", () => {
    const { container } = render(<SkeletonCircle size={60} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("60px");
    expect(el.style.height).toBe("60px");
  });
});

describe("SkeletonKPI", () => {
  it("rend une div avec la classe kpi-card", () => {
    const { container } = render(<SkeletonKPI />);
    expect(container.querySelector(".kpi-card")).toBeTruthy();
  });

  it("contient au moins 3 SkeletonBar", () => {
    const { container } = render(<SkeletonKPI />);
    const bars = container.querySelectorAll(".animate-pulse");
    expect(bars.length).toBeGreaterThanOrEqual(3);
  });
});

describe("SkeletonKPIGrid", () => {
  it("rend 4 cartes par défaut", () => {
    const { container } = render(<SkeletonKPIGrid />);
    const cards = container.querySelectorAll(".kpi-card");
    expect(cards).toHaveLength(4);
  });

  it("rend le bon nombre de cartes via prop count", () => {
    const { container } = render(<SkeletonKPIGrid count={6} />);
    const cards = container.querySelectorAll(".kpi-card");
    expect(cards).toHaveLength(6);
  });

  it("applique la className additionnelle", () => {
    const { container } = render(<SkeletonKPIGrid className="mt-4" />);
    expect(container.firstChild).toHaveClass("mt-4");
  });
});

describe("SkeletonChart", () => {
  it("rend un div avec la classe card", () => {
    const { container } = render(<SkeletonChart />);
    expect(container.querySelector(".card")).toBeTruthy();
  });

  it("rend 12 barres de graphique", () => {
    const { container } = render(<SkeletonChart />);
    // 12 barres + 1 titre = 13 éléments animate-pulse
    const bars = container.querySelectorAll(".animate-pulse");
    expect(bars.length).toBeGreaterThanOrEqual(12);
  });

  it("applique la hauteur personnalisée", () => {
    const { container } = render(<SkeletonChart height={400} />);
    // La div interne porte le style height
    const inner = Array.from(container.querySelectorAll("*"))
      .find((el) => (el as HTMLElement).style?.height?.includes("400")) as HTMLElement | undefined;
    expect(inner).toBeDefined();
  });
});

describe("SkeletonDonut", () => {
  it("rend un div avec la classe card", () => {
    const { container } = render(<SkeletonDonut />);
    expect(container.querySelector(".card")).toBeTruthy();
  });

  it("rend un cercle (rounded-full)", () => {
    const { container } = render(<SkeletonDonut />);
    expect(container.querySelector(".rounded-full")).toBeTruthy();
  });
});

describe("SkeletonTable", () => {
  it("rend une table HTML", () => {
    const { container } = render(<SkeletonTable />);
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("rend 8 lignes par défaut dans le tbody", () => {
    const { container } = render(<SkeletonTable />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(8);
  });

  it("rend le bon nombre de colonnes dans le header", () => {
    const { container } = render(<SkeletonTable cols={3} />);
    const headers = container.querySelectorAll("thead th");
    expect(headers).toHaveLength(3);
  });

  it("respecte les props rows et cols", () => {
    const { container } = render(<SkeletonTable rows={5} cols={4} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
    const firstRowCells = container.querySelectorAll("tbody tr:first-child td");
    expect(firstRowCells).toHaveLength(4);
  });
});

describe("SkeletonPage", () => {
  it("rend la structure complète (KPIGrid + Chart + Donut + Table)", () => {
    const { container } = render(<SkeletonPage />);
    expect(container.querySelector(".kpi-card")).toBeTruthy();
    expect(container.querySelector("table")).toBeTruthy();
    // Plusieurs cards (chart + donut)
    expect(container.querySelectorAll(".card").length).toBeGreaterThanOrEqual(2);
  });
});
