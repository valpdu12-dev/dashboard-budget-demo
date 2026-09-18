// ── L'écran Paramètres, en lecture seule — lot C.2 (D9) ──────────────────
//
// Critère de sortie du C.2 : l'écran montre la même chose que l'aperçu
// d'import, et ce qui manque y figure COMME MANQUANT, pas comme vide.
//
// Le défaut que ces tests ferment est celui du B.5 : un bandeau posé dans la
// mauvaise branche de rendu, qui faisait disparaître les cartes sans un mot.
// Ici, chaque absence a sa phrase, et on la lit.

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Parametres from "@/pages/Parametres";
import { useDataStore } from "@/stores/useDataStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTransactions, makeSalaryData, makeConfig } from "../helpers/factories";
import type { BudgetConfig } from "@/types/budgetConfig";
import type { DataOrigin } from "@/types";

const PARAMETRAGE: BudgetConfig = {
  estVide: false,
  comptes: [
    {
      id: "caisse de bord", libelle: "Caisse de bord", organisme: "Coopérative du Port",
      participation: 1, compteLie: null, sensRepercute: null, porteUnSolde: true,
      couleur: "#3b82f6", soldeDepart: 800,
    },
    {
      id: "cagnotte du voilier", libelle: "Cagnotte du Voilier", organisme: null,
      participation: 0.3, compteLie: "caisse de bord", sensRepercute: "Débit",
      porteUnSolde: false, couleur: "#22c55e", soldeDepart: null,
    },
  ],
  types: [
    { libelle: "Mise de côté", cle: "mise de côté", natures: ["epargne"], classeParDefaut: null },
    { libelle: "Provisions", cle: "provisions", natures: [], classeParDefaut: "Dépense Courante" },
  ],
  categories: [{ libelle: "Vivres", cle: "vivres", couleur: "#eab308" }],
  employeurs: ["Coopérative du Port"],
  compteCreditSortiesEpargne: "caisse de bord",
};

function poser(parametrage: BudgetConfig | null, origine: DataOrigin = "upload") {
  const config = makeConfig({ parametrage: parametrage ?? undefined });
  useDataStore.getState().setData(makeTransactions(), makeSalaryData([]), config, origine);
}

function rendre() {
  return render(
    <MemoryRouter>
      <Parametres />
    </MemoryRouter>
  );
}

beforeEach(() => {
  resetAllStores();
});

// ═══════════════════════════════════════════════════════════════════════

describe("écran Paramètres — sans configuration lue", () => {
  it("le dit, au lieu d'afficher des tableaux vides", () => {
    poser(null);
    rendre();
    expect(screen.getByText("Aucune configuration lue")).toBeInTheDocument();
  });

  it("explique le cas de la démonstration dans ses propres termes", () => {
    poser(null, "static");
    rendre();
    expect(screen.getByText(/jeu de démonstration ne déclare pas de configuration/)).toBeInTheDocument();
  });

  it("explique le cas d'un fichier sans feuille Paramètres", () => {
    poser(null, "upload");
    rendre();
    expect(screen.getByText(/jamais 0/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("écran Paramètres — avec une configuration lue", () => {
  beforeEach(() => {
    poser(PARAMETRAGE);
    rendre();
  });

  it("montre les comptes tels qu'ils ont été lus", () => {
    // « Caisse de bord » paraît deux fois : dans le tableau, et comme compte
    // crédité par les sorties d'épargne.
    expect(screen.getAllByText("Caisse de bord").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Cagnotte du Voilier")).toBeInTheDocument();
  });

  it("affiche le taux de participation sans traînée de virgule flottante", () => {
    expect(screen.getByText("30 %")).toBeInTheDocument();
  });

  it("dit qu'un taux absent vaut 100 % par défaut, au lieu de le taire", () => {
    expect(screen.getByText("100 %")).toBeInTheDocument();
    expect(screen.getByText("(par défaut)")).toBeInTheDocument();
  });

  it("résout le compte lié en libellé, jamais en identifiant interne", () => {
    // « caisse de bord » en minuscules serait l'identifiant interne : il n'est
    // jamais affiché.
    const cellules = screen.getAllByText("Caisse de bord");
    expect(cellules.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("caisse de bord")).toBeNull();
  });

  it("écrit « non déclaré » là où le fichier ne dit rien", () => {
    expect(screen.getAllByText("non déclaré").length).toBeGreaterThan(0);
  });

  it("écrit « non initialisé », jamais 0,00 €", () => {
    expect(screen.getByText("non initialisé")).toBeInTheDocument();
    expect(screen.getByText("800,00 €")).toBeInTheDocument();
  });

  it("montre les natures, et nomme le mouvement ordinaire", () => {
    expect(screen.getByText("epargne")).toBeInTheDocument();
    expect(screen.getByText("mouvement ordinaire")).toBeInTheDocument();
  });

  it("dit sur quel compte les sorties d'épargne sont créditées", () => {
    expect(screen.getByText(/Créditées sur/)).toBeInTheDocument();
  });

  it("montre les catégories et les employeurs", () => {
    expect(screen.getByText("Vivres")).toBeInTheDocument();
    // Le même nom est ici organisme d'un compte ET employeur : les deux
    // tableaux le portent, et c'est normal.
    expect(screen.getAllByText("Coopérative du Port")).toHaveLength(2);
  });

  it("est en LECTURE SEULE : aucun champ de saisie, et il le dit", () => {
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/c'est le fichier qui fait foi/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("écran Paramètres — ce qui est déclaré vide", () => {
  it("dit qu'aucun compte n'est déclaré, au lieu d'un tableau vide", () => {
    poser({ ...PARAMETRAGE, comptes: [], compteCreditSortiesEpargne: null });
    rendre();
    expect(screen.getByText("Aucun compte déclaré dans le fichier source.")).toBeInTheDocument();
  });

  it("dit qu'aucun compte ne reçoit les sorties d'épargne", () => {
    poser({ ...PARAMETRAGE, compteCreditSortiesEpargne: null });
    rendre();
    expect(screen.getByText(/ne sont reprises dans aucun solde/)).toBeInTheDocument();
  });

  it("dit qu'aucune catégorie et aucun employeur ne sont déclarés", () => {
    poser({ ...PARAMETRAGE, categories: [], employeurs: [] });
    rendre();
    expect(screen.getByText(/Aucune catégorie déclarée/)).toBeInTheDocument();
    expect(screen.getByText(/Aucun employeur déclaré/)).toBeInTheDocument();
  });
});
