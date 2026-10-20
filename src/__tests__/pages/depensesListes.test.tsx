// ── Page Dépenses : listes Enseigne / Événement ──────────────────────────
//
// Une liste sans aucune valeur n'est pas affichée (décision D6, décidée sur
// le jeu COMPLET). Les noms affichés : « Enseigne », « Événement »,
// « Top 10 enseignes » — plus aucun « Marchand ».

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Depenses from "@/pages/Depenses";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeConfig } from "../helpers/factories";
import type { Transaction } from "@/types";

const PAIE = { months: [], cotLast: [], patronLast: [], lastMonth: "" };

function poser(tx: Transaction[]) {
  useDataStore.getState().setData(tx, PAIE, makeConfig());
  useDataStore.getState().setBudgets({ budgets: [] });
}

function rendre(url = "/depenses") {
  return render(<MemoryRouter initialEntries={[url]}><Depenses /></MemoryRouter>);
}

const AVEC_LES_DEUX = [
  makeTx({ date: "2025-03-02", montant: 40, cat3: "Primeur", cat4: "Rentrée" }),
  makeTx({ date: "2025-03-03", montant: 25, cat3: "Cinéma", cat4: "" }),
  // Hors période YTD 2025 : sert au message « rien sur la période ».
  makeTx({ date: "2024-12-20", montant: 70, cat3: "Cadeau", cat4: "Fêtes de fin d'année" }),
];

beforeEach(() => {
  resetAllStores();
});

describe("Dépenses — les deux listes", () => {
  it("les deux listes sont là quand les deux colonnes ont des valeurs", () => {
    poser(AVEC_LES_DEUX);
    rendre();
    expect(screen.getByRole("button", { name: "Enseigne" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Événement" })).toBeInTheDocument();
  });

  it("aucun Événement dans le fichier → la liste Événement n'est pas affichée", () => {
    poser([makeTx({ cat3: "Primeur", cat4: "" }), makeTx({ cat3: "Cinéma", cat4: "x" })]);
    rendre();
    expect(screen.getByRole("button", { name: "Enseigne" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Événement" })).toBeNull();
  });

  it("aucune Enseigne dans le fichier → seule la liste Événement est affichée", () => {
    poser([makeTx({ cat3: "", cat4: "Rentrée" }), makeTx({ cat3: "X", cat4: "" })]);
    rendre();
    expect(screen.queryByRole("button", { name: "Enseigne" })).toBeNull();
    expect(screen.getByRole("button", { name: "Événement" })).toBeInTheDocument();
  });

  it("aucune valeur dans les deux colonnes → aucune liste", () => {
    poser([makeTx({ cat3: "", cat4: "" })]);
    rendre();
    expect(screen.queryByRole("button", { name: "Enseigne" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Événement" })).toBeNull();
  });

  it("décidé sur le jeu complet : l'événement de 2024 garde la liste en YTD 2025", () => {
    poser([
      makeTx({ date: "2025-03-02", cat3: "Primeur", cat4: "" }),
      makeTx({ date: "2024-12-20", cat3: "Cadeau", cat4: "Fêtes de fin d'année" }),
    ]);
    rendre();
    expect(screen.getByRole("button", { name: "Événement" })).toBeInTheDocument();
  });

  it("une enseigne cochée filtre la page et ouvre « Effacer tout »", async () => {
    poser(AVEC_LES_DEUX);
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.click(screen.getByRole("option", { name: /Primeur/ }));
    expect(useFilterStore.getState().selEnseignes).toEqual(["Primeur"]);
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(screen.getByText("Détail des dépenses (filtré)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Effacer tout" }));
    expect(useFilterStore.getState().selEnseignes).toEqual([]);
  });

  it("un lien ?enseigne=…&enseigne=… ouvre la page déjà filtrée", () => {
    poser(AVEC_LES_DEUX);
    rendre("/depenses?enseigne=Primeur&enseigne=Cin%C3%A9ma");
    expect(useFilterStore.getState().selEnseignes).toEqual(["Primeur", "Cinéma"]);
    expect(screen.getByRole("button", { name: /Enseigne : Primeur \+1/ })).toBeInTheDocument();
  });

  it("rien sur la période : le message le dit, « Passer à « Tout » » le corrige", async () => {
    poser(AVEC_LES_DEUX);
    useFilterStore.setState({ selEvenements: ["Fêtes de fin d'année"] });
    const user = userEvent.setup();
    rendre();
    expect(screen.getByRole("status")).toHaveTextContent("Aucune dépense sur cette période");
    await user.click(screen.getByRole("button", { name: "Passer à « Tout »" }));
    expect(useFilterStore.getState().period).toBe("all");
    expect(screen.queryByText("Aucune dépense sur cette période")).toBeNull();
  });
});

describe("Dépenses — les noms", () => {
  it("colonnes « Enseigne » et « Événement », « Top 10 enseignes », plus aucun « Marchand »", () => {
    poser(AVEC_LES_DEUX);
    const { container } = rendre();
    expect(screen.getAllByText("Enseigne").length).toBeGreaterThan(0);
    expect(screen.getByText("Top 10 enseignes")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((c) => c.textContent?.trim())).toEqual(
      expect.arrayContaining([expect.stringContaining("Enseigne"), expect.stringContaining("Événement")])
    );
    expect(container.textContent).not.toMatch(/[Mm]archand/);
  });
});
