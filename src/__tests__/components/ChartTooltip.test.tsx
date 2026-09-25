import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartTooltip } from "@/components/ui/ChartTooltip";

const basePayload = [
  { name: "Dépenses", value: 1234.56, color: "#6366f1", dataKey: "Dépenses",
    payload: { "prev_Dépenses": 1000 } },
];

describe("ChartTooltip — rendu conditionnel", () => {
  it("ne rend rien si active=false", () => {
    const { container } = render(
      <ChartTooltip active={false} payload={basePayload} label="mars 25" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("ne rend rien si payload est vide", () => {
    const { container } = render(
      <ChartTooltip active={true} payload={[]} label="mars 25" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("ne rend rien si payload est undefined", () => {
    const { container } = render(<ChartTooltip active={true} label="mars 25" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ChartTooltip — contenu", () => {
  it("affiche le label de l'axe", () => {
    render(<ChartTooltip active={true} payload={basePayload} label="mars 25" />);
    expect(screen.getByText("mars 25")).toBeTruthy();
  });

  it("affiche le nom de la série", () => {
    render(<ChartTooltip active={true} payload={basePayload} label="mars 25" />);
    expect(screen.getByText("Dépenses")).toBeTruthy();
  });

  it("formate la valeur par défaut en euros FR", () => {
    render(<ChartTooltip active={true} payload={basePayload} label="mars 25" />);
    // 1234.56 → "1 234,56 €" (format FR)
    expect(screen.getByText(/1.234|1 234/)).toBeTruthy();
  });

  it("utilise un formatter personnalisé", () => {
    render(
      <ChartTooltip
        active={true}
        payload={basePayload}
        label="mars 25"
        formatter={(v) => `${v} pts`}
      />
    );
    expect(screen.getByText("1234.56 pts")).toBeTruthy();
  });
});

describe("ChartTooltip — comparaison N-1", () => {
  it("affiche la comparaison vs précédent par défaut (showPrev=true)", () => {
    render(<ChartTooltip active={true} payload={basePayload} label="mars 25" />);
    expect(screen.getByText("vs prec.")).toBeTruthy();
  });

  it("masque la comparaison quand showPrev=false", () => {
    render(
      <ChartTooltip active={true} payload={basePayload} label="mars 25" showPrev={false} />
    );
    expect(screen.queryByText("vs prec.")).toBeNull();
  });

  it("affiche le delta positif en texte rouge-ish (+%)", () => {
    // cur=1234.56, prev=1000 → hausse → texte "text-red"
    const { container } = render(
      <ChartTooltip active={true} payload={basePayload} label="mars 25" />
    );
    const delta = container.querySelector(".text-red");
    expect(delta).toBeTruthy();
    expect(delta?.textContent).toMatch(/\+/);
  });

  it("affiche le delta négatif avec text-green", () => {
    const payload = [
      { name: "Dépenses", value: 800, color: "#6366f1", dataKey: "Dépenses",
        payload: { "prev_Dépenses": 1000 } },
    ];
    const { container } = render(
      <ChartTooltip active={true} payload={payload} label="mars 25" />
    );
    const delta = container.querySelector(".text-green");
    expect(delta).toBeTruthy();
    expect(delta?.textContent).not.toMatch(/\+/);
  });

  it("affiche '—' quand pas de valeur précédente", () => {
    const payload = [
      { name: "Dépenses", value: 800, color: "#6366f1", dataKey: "Dépenses",
        payload: {} },
    ];
    render(<ChartTooltip active={true} payload={payload} label="mars 25" />);
    expect(screen.queryByText("vs prec.")).toBeNull();
  });

  it("rend plusieurs séries", () => {
    const multi = [
      { name: "Épargne",  value: 300, color: "#22c55e", dataKey: "Épargne",  payload: {} },
      { name: "Recettes", value: 2500, color: "#6366f1", dataKey: "Recettes", payload: {} },
    ];
    render(<ChartTooltip active={true} payload={multi} label="mars 25" />);
    expect(screen.getByText("Épargne")).toBeTruthy();
    expect(screen.getByText("Recettes")).toBeTruthy();
  });
});

describe("ChartTooltip — ligne de total (lot 1.2)", () => {
  const troisTypes = [
    { name: "Salaire",       value: 2908, color: "#6366f1", dataKey: "Salaire",       payload: {} },
    { name: "Remboursement", value: 412,  color: "#22c55e", dataKey: "Remboursement", payload: {} },
    { name: "Autre",         value: 180,  color: "#f59e0b", dataKey: "Autre",         payload: {} },
  ];

  it("n'affiche aucun total par défaut", () => {
    // Le composant est partagé par une dizaine de graphiques, dont des séries
    // non additionnables (indices, pourcentages). Le défaut doit rester muet.
    render(<ChartTooltip active={true} payload={troisTypes} label="avril 26" />);
    expect(screen.queryByText("Total")).toBeNull();
  });

  it("somme les séries affichées quand showTotal est actif", () => {
    render(
      <ChartTooltip active={true} payload={troisTypes} label="avril 26" showTotal
        formatter={(v) => `${v} €`} />,
    );
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getByText("3500 €")).toBeTruthy();
  });

  it("accepte un libellé de total personnalisé", () => {
    render(
      <ChartTooltip active={true} payload={troisTypes} label="avril 26" showTotal
        totalLabel="Total recettes" formatter={(v) => `${v} €`} />,
    );
    expect(screen.getByText("Total recettes")).toBeTruthy();
  });

  it("traite une série manquante comme zéro plutôt que d'invalider le total", () => {
    // Un mois sans remboursement ne doit pas rendre le total indisponible.
    const avecTrou = [
      { name: "Salaire",       value: 2908, color: "#6366f1", dataKey: "Salaire",       payload: {} },
      { name: "Remboursement", value: NaN,  color: "#22c55e", dataKey: "Remboursement", payload: {} },
      { name: "Autre",         value: 412,  color: "#f59e0b", dataKey: "Autre",         payload: {} },
    ];
    render(
      <ChartTooltip active={true} payload={avecTrou} label="avril 26" showTotal
        formatter={(v) => `${v} €`} />,
    );
    // 2908 + 0 + 412 — et non NaN, qui aurait effacé le total.
    expect(screen.getByText("3320 €")).toBeTruthy();
  });
});
