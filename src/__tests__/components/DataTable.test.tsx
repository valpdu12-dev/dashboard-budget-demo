// ── Tests du DataTable — lot 1.3, mode carte sous 768 px ────────────────
//
// Ce fichier existe parce que le composant n'était couvert par AUCUN test
// avant le lot 1.3 : les 293 verts hérités ne protégeaient rien ici.
//
// Ce que ces tests assertent en priorité : **ce que le script d'audit
// mesure réellement**. `scripts/audit-mobile/audit.mjs:52-54` ne compte une
// zone de défilement horizontal que si l'`overflowX` calculé vaut `auto` ou
// `scroll` ET que le contenu déborde. jsdom ne calculant aucune mise en
// page, la seule chose vérifiable ici est la première moitié du critère :
// l'absence du conteneur `overflow-x-auto` dans le DOM.
//
// ⚠️ Limite assumée, à ne pas confondre avec une preuve : aucun test de ce
// fichier ne démontre « 0 px de débordement ». Seule la mesure sous Chrome
// (étage 2 du lot 1.3, puis lot 1.5) le fait.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DataTable, type Column } from "@/components/ui/DataTable";

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

/** Largeur du Samsung A56, cible du chantier responsive. */
const A56 = 412;
/** Largeur de bureau — le rendu doit y être celui d'avant le lot 1.3. */
const DESKTOP = 1440;

afterEach(() => {
  setWindowWidth(DESKTOP);
  vi.restoreAllMocks();
});

interface Row extends Record<string, unknown> {
  date: string;
  label: string;
  compte: string;
  montant: number;
}

const ROWS: Row[] = [
  { date: "2026-01-15", label: "Supermarché Centre", compte: "Banque A", montant: -42 },
  { date: "2026-02-03", label: "Boulangerie", compte: "Banque B", montant: -8 },
  { date: "2026-03-21", label: "Abonnement", compte: "Banque C", montant: -15 },
];

const COLUMNS: Column<Row>[] = [
  { key: "date", label: "Date", sortable: true, priority: true },
  { key: "label", label: "Libellé", sortable: true, priority: true },
  { key: "compte", label: "Compte", sortable: true },
  { key: "montant", label: "Montant", sortable: true, priority: true },
];

// ─── Le critère de l'audit ──────────────────────────────────────────────

describe("DataTable — sortie du décompte de zones de défilement", () => {
  it("ne rend AUCUN conteneur overflow-x-auto sous 768 px", () => {
    setWindowWidth(A56);
    const { container } = render(<DataTable data={ROWS} columns={COLUMNS} />);
    // Critère exact de audit.mjs:53 — première moitié, la seule testable ici.
    expect(container.querySelectorAll(".overflow-x-auto")).toHaveLength(0);
  });

  it("ne rend pas non plus de <table> sous 768 px", () => {
    setWindowWidth(A56);
    const { container } = render(<DataTable data={ROWS} columns={COLUMNS} />);
    expect(container.querySelector("table")).toBeNull();
  });

  it("conserve le conteneur overflow-x-auto ET la table au-dessus de 768 px", () => {
    setWindowWidth(DESKTOP);
    const { container } = render(<DataTable data={ROWS} columns={COLUMNS} />);
    expect(container.querySelectorAll(".overflow-x-auto")).toHaveLength(1);
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("bascule à 768 px exactement : 767 en carte, 768 en tableau", () => {
    setWindowWidth(767);
    const { container: small } = render(<DataTable data={ROWS} columns={COLUMNS} />);
    expect(small.querySelector("table")).toBeNull();

    setWindowWidth(768);
    const { container: large } = render(<DataTable data={ROWS} columns={COLUMNS} />);
    expect(large.querySelector("table")).not.toBeNull();
  });
});

// ─── Colonnes prioritaires et repli « Détails » ─────────────────────────

describe("DataTable — colonnes prioritaires en mode carte", () => {
  it("affiche les colonnes prioritaires et masque les autres du DOM", () => {
    setWindowWidth(A56);
    render(<DataTable data={ROWS} columns={COLUMNS} />);

    // Prioritaire : présent d'emblée.
    expect(screen.getAllByText("Supermarché Centre")).toHaveLength(1);
    // Non prioritaire : ABSENT du DOM, pas seulement masqué en CSS —
    // un simple `hidden` laisserait le texte lisible aux lecteurs d'écran.
    expect(screen.queryByText("Banque A")).toBeNull();
  });

  it("révèle la colonne non prioritaire au clic sur « Détails », par carte", () => {
    setWindowWidth(A56);
    render(<DataTable data={ROWS} columns={COLUMNS} />);

    const boutons = screen.getAllByRole("button", { name: /Détails/ });
    expect(boutons).toHaveLength(ROWS.length);

    fireEvent.click(boutons[0]);
    expect(screen.getByText("Banque A")).toBeInTheDocument();
    // Ouvrir une carte n'ouvre pas les autres.
    expect(screen.queryByText("Banque B")).toBeNull();
  });

  it("referme la carte au second clic", () => {
    setWindowWidth(A56);
    render(<DataTable data={ROWS} columns={COLUMNS} />);

    const bouton = screen.getAllByRole("button", { name: /Détails/ })[0];
    fireEvent.click(bouton);
    expect(screen.getByText("Banque A")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Masquer/ })[0]);
    expect(screen.queryByText("Banque A")).toBeNull();
  });

  it("retombe sur les 3 premières colonnes quand aucune priority n'est déclarée", () => {
    setWindowWidth(A56);
    // Cas des appels existants, non modifiés par le lot 1.3.
    const sansPriority: Column<Row>[] = COLUMNS.map((c) => ({ ...c, priority: undefined }));
    render(<DataTable data={ROWS} columns={sansPriority} />);

    // date / label / compte visibles, montant replié.
    expect(screen.getByText("Supermarché Centre")).toBeInTheDocument();
    expect(screen.getByText("Banque A")).toBeInTheDocument();
    expect(screen.queryByText("-42")).toBeNull();
  });

  it("ne rend aucun bouton « Détails » si toutes les colonnes sont prioritaires", () => {
    setWindowWidth(A56);
    const toutes: Column<Row>[] = COLUMNS.map((c) => ({ ...c, priority: true }));
    render(<DataTable data={toutes ? ROWS : ROWS} columns={toutes} />);
    expect(screen.queryByRole("button", { name: /Détails/ })).toBeNull();
  });
});

// ─── Les fonctions ne doivent pas disparaître avec le tableau ───────────

describe("DataTable — fonctions préservées en mode carte", () => {
  it("expose un tri par select, avec les seules colonnes sortable", () => {
    setWindowWidth(A56);
    const colonnes: Column<Row>[] = [
      { key: "date", label: "Date", sortable: true, priority: true },
      { key: "label", label: "Libellé", sortable: false, priority: true },
    ];
    render(<DataTable data={ROWS} columns={colonnes} />);

    const select = screen.getByLabelText("Trier");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Ordre d'origine", "Date"]);
  });

  it("trie réellement les cartes, et inverse le sens au clic sur la flèche", () => {
    setWindowWidth(A56);
    render(<DataTable data={ROWS} columns={COLUMNS} />);

    const libelles = () =>
      screen.getAllByText(/Supermarché Centre|Boulangerie|Abonnement/).map((e) => e.textContent);

    fireEvent.change(screen.getByLabelText("Trier"), { target: { value: "label" } });
    expect(libelles()[0]).toBe("Abonnement");

    fireEvent.click(screen.getByRole("button", { name: /Tri croissant/ }));
    expect(libelles()[0]).toBe("Supermarché Centre");
  });

  it("garde la pagination fonctionnelle en mode carte", () => {
    setWindowWidth(A56);
    render(<DataTable data={ROWS} columns={COLUMNS} pageSize={2} />);

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("Supermarché Centre")).toBeInTheDocument();
    expect(screen.queryByText("Abonnement")).toBeNull();

    fireEvent.click(screen.getByText("→"));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByText("Abonnement")).toBeInTheDocument();
  });

  it("garde l'export CSV en mode carte, avec TOUTES les colonnes", async () => {
    setWindowWidth(A56);
    // jsdom n'implémente pas les Object URL : on les pose avant d'espionner.
    const capture: Blob[] = [];
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: (b: Blob) => { capture.push(b); return "blob:x"; },
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DataTable data={ROWS} columns={COLUMNS} title="Détail" />);
    fireEvent.click(screen.getByTitle("Exporter en CSV"));

    expect(capture).toHaveLength(1);
    // `Blob.text()` n'existe pas sous jsdom — relecture par FileReader.
    const csv = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.readAsText(capture[0]);
    });
    // Le mode carte replie l'AFFICHAGE, il ne retire pas de données : la
    // colonne non prioritaire « Compte » doit rester dans l'export.
    expect(csv).toContain("Compte");
    expect(csv).toContain("Banque B");
    expect(csv.split("\n")).toHaveLength(ROWS.length + 1);
  });

  // Régression attrapée par la mesure Chrome, pas par les tests : le bouton
  // CSV existe en DEUX exemplaires (avec et sans `title`), et seul le premier
  // avait reçu les classes de cible tactile. Mesuré à 57 × 24 px sur
  // Patrimoine et Insights, les deux pages qui appellent sans titre.
  it.each([
    ["avec titre", "Détail"],
    ["sans titre", undefined],
  ])("porte les classes de cible tactile sur le bouton CSV (%s)", (_cas, titre) => {
    setWindowWidth(A56);
    render(<DataTable data={ROWS} columns={COLUMNS} title={titre} />);
    const csv = screen.getByTitle("Exporter en CSV");
    expect(csv).toHaveClass("max-md:min-h-tap", "max-md:min-w-tap");
  });

  it("affiche le message vide en mode carte", () => {
    setWindowWidth(A56);
    render(<DataTable data={[]} columns={COLUMNS} emptyMessage="Aucune dépense trouvée" />);
    expect(screen.getByText("Aucune dépense trouvée")).toBeInTheDocument();
  });
});

// ─── Non-régression du rendu PC ─────────────────────────────────────────

describe("DataTable — rendu desktop inchangé", () => {
  it("rend un en-tête de colonne par colonne, priority comprise", () => {
    setWindowWidth(DESKTOP);
    const { container } = render(<DataTable data={ROWS} columns={COLUMNS} />);
    expect(container.querySelectorAll("thead th")).toHaveLength(COLUMNS.length);
  });

  it("rend une ligne par donnée, sans repli ni bouton Détails", () => {
    setWindowWidth(DESKTOP);
    const { container } = render(<DataTable data={ROWS} columns={COLUMNS} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(ROWS.length);
    expect(screen.queryByRole("button", { name: /Détails/ })).toBeNull();
    expect(screen.queryByLabelText("Trier")).toBeNull();
  });

  it("trie toujours au clic sur l'en-tête", () => {
    setWindowWidth(DESKTOP);
    const { container } = render(<DataTable data={ROWS} columns={COLUMNS} />);
    fireEvent.click(screen.getByText("Libellé"));
    const premiere = container.querySelectorAll("tbody tr td")[1];
    expect(premiere.textContent).toBe("Abonnement");
  });
});
