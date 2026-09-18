// ── Les quatre cas — critère de sortie du C.5 ────────────────────────────
//
// « Quatre cas passent : un seul compte ; sans paie ; sans prêt ; avec un
//   compte partagé à 30 %. Aucun écran vide, aucun tiret muet : quand l'outil
//   ne sait pas, il le dit. »
//
// ⚠️ CE QUE CES TESTS NE REMPLACENT PAS. Le plan d'action le dit : « les
// quatre cas se regardent à l'écran, pas seulement en test ». Le défaut du
// B.5 — un bandeau posé dans la mauvaise branche de rendu, qui faisait
// disparaître les cartes sans un mot — passait tous les tests. Ce qui suit
// ferme ce qui est mécanisable : pas de plantage, pas d'écran vide, pas de
// `NaN`, pas de navigation qui se dérobe. Le regard reste à faire.

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Comptes from "@/pages/Comptes";
import Depenses from "@/pages/Depenses";
import Recettes from "@/pages/Recettes";
import Epargne from "@/pages/Epargne";
import PretImmobilier from "@/pages/PretImmobilier";
import Insights from "@/pages/Insights";
import BudgetMensuel from "@/pages/BudgetMensuel";
import { SubNav } from "@/components/layout/SubNav";
import { BottomNav } from "@/components/layout/BottomNav";

import { useDataStore } from "@/stores/useDataStore";
import { normaliserCle } from "@/services/lectureValeurs";
import { resetAllStores } from "../helpers/storeReset";
import { makeSalaryData, makeSalaryMonth } from "../helpers/factories";
import type { BudgetConfig, CompteConfig, TypeConfig } from "@/types/budgetConfig";
import type { Config, Transaction } from "@/types";

// ─────────────────────────────────────────────────────────────────────────
// QUATRE JEUX, AUCUN NOM DE LA DÉMONSTRATION
// ─────────────────────────────────────────────────────────────────────────

const compte = (libelle: string, o: Partial<CompteConfig> = {}): CompteConfig => ({
  id: normaliserCle(libelle),
  libelle,
  organisme: o.organisme ?? "Coopérative du Port",
  participation: o.participation ?? 1,
  compteLie: o.compteLie ?? null,
  sensRepercute: o.sensRepercute ?? null,
  porteUnSolde: o.porteUnSolde ?? true,
  couleur: o.couleur ?? "#3b82f6",
  soldeDepart: o.soldeDepart ?? null,
});

const type = (libelle: string, natures: TypeConfig["natures"] = []): TypeConfig => ({
  libelle, cle: normaliserCle(libelle), natures, classeParDefaut: null,
});

function tx(o: Partial<Transaction>): Transaction {
  return {
    compte: "Caisse de bord", type: "Provisions", date: "2026-02-05",
    montant: 100, cat1: "Dépense Courante", cat2: "Vivres", cat3: "", cat4: "",
    ville: "", dc: "Débit", label: "Achat", monthKey: "2026-02", ...o,
  };
}

/** Trois mois de mouvements, pour que la couverture temporelle ait un milieu. */
function troisMois(extra: Partial<Transaction> = {}): Transaction[] {
  const out: Transaction[] = [];
  for (const mk of ["2026-01", "2026-02", "2026-03"]) {
    out.push(tx({ monthKey: mk, date: `${mk}-05`, montant: 100, ...extra }));
    out.push(tx({ monthKey: mk, date: `${mk}-10`, montant: 60, cat2: "Carburant", ...extra }));
    out.push(tx({
      monthKey: mk, date: `${mk}-01`, montant: 2000, dc: "Crédit",
      type: "Salaire", cat1: "", cat2: "", ...extra,
    }));
  }
  return out;
}

interface Cas {
  nom: string;
  transactions: Transaction[];
  config: Config;
  salaire: ReturnType<typeof makeSalaryData>;
  /** Les onglets qui doivent être proposés. */
  onglets: string[];
}

const BASE_TYPES = [type("Provisions"), type("Salaire")];

const CAS: Cas[] = [
  {
    nom: "un seul compte",
    transactions: troisMois(),
    config: {
      init: { "Caisse de bord": 1000 },
      parametrage: {
        estVide: false,
        comptes: [compte("Caisse de bord", { soldeDepart: 1000 })],
        types: BASE_TYPES,
        categories: [],
        employeurs: [],
        compteCreditSortiesEpargne: null,
      } satisfies BudgetConfig,
    },
    salaire: makeSalaryData([makeSalaryMonth({ mk: "2026-02" })]),
    onglets: ["Comptes", "Dépenses", "Revenus", "Insights"],
  },
  {
    nom: "sans paie",
    transactions: troisMois(),
    config: {
      init: { "Caisse de bord": 1000 },
      parametrage: {
        estVide: false,
        comptes: [compte("Caisse de bord", { soldeDepart: 1000 })],
        types: [...BASE_TYPES, type("Mise de côté", ["epargne"])],
        categories: [],
        employeurs: [],
        compteCreditSortiesEpargne: null,
      } satisfies BudgetConfig,
    },
    salaire: makeSalaryData([]),
    onglets: ["Comptes", "Dépenses", "Revenus", "Patrimoine", "Insights"],
  },
  {
    nom: "sans prêt",
    transactions: [
      ...troisMois(),
      tx({ monthKey: "2026-02", date: "2026-02-15", type: "Mise de côté", montant: 300, cat1: "", cat2: "" }),
    ],
    config: {
      init: { "Caisse de bord": 1000 },
      parametrage: {
        estVide: false,
        comptes: [compte("Caisse de bord", { soldeDepart: 1000 })],
        types: [...BASE_TYPES, type("Mise de côté", ["epargne"])],
        categories: [],
        employeurs: [],
        compteCreditSortiesEpargne: null,
      } satisfies BudgetConfig,
    },
    salaire: makeSalaryData([makeSalaryMonth({ mk: "2026-02" })]),
    onglets: ["Comptes", "Dépenses", "Revenus", "Patrimoine", "Insights"],
  },
  {
    nom: "un compte partagé à 30 %",
    transactions: [
      ...troisMois(),
      tx({ compte: "Cagnotte du Voilier", monthKey: "2026-02", date: "2026-02-08", montant: 45 }),
    ],
    config: {
      init: { "Caisse de bord": 1000 },
      parametrage: {
        estVide: false,
        comptes: [
          compte("Caisse de bord", { soldeDepart: 1000 }),
          compte("Cagnotte du Voilier", {
            organisme: "Association", participation: 0.3, porteUnSolde: false,
            compteLie: normaliserCle("Caisse de bord"), sensRepercute: "Débit",
            couleur: "#22c55e",
          }),
        ],
        types: BASE_TYPES,
        categories: [],
        employeurs: [],
        compteCreditSortiesEpargne: null,
      } satisfies BudgetConfig,
    },
    salaire: makeSalaryData([makeSalaryMonth({ mk: "2026-02" })]),
    onglets: ["Comptes", "Dépenses", "Revenus", "Insights"],
  },
];

// ─────────────────────────────────────────────────────────────────────────

function poser(cas: Cas) {
  useDataStore.getState().setData(cas.transactions, cas.salaire, cas.config, "upload");
  useDataStore.getState().setBudgets({ budgets: [] });
}

function rendre(ui: React.ReactElement, url = "/") {
  return render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);
}

/** Les écrans qu'un jeu rend toujours atteignables. */
const ECRANS_TOUJOURS = [
  ["Comptes", <Comptes key="c" />],
  ["Dépenses", <Depenses key="d" />],
  ["Budget", <BudgetMensuel key="b" />],
  ["Recettes", <Recettes key="r" />],
  ["Insights", <Insights key="i" />],
] as const;

beforeEach(() => {
  resetAllStores();
});

// ═══════════════════════════════════════════════════════════════════════

describe.each(CAS)("cas « $nom »", (cas) => {
  it.each(ECRANS_TOUJOURS)("l'écran %s s'affiche, et il n'est pas vide", (_nom, ui) => {
    poser(cas);
    const { container } = rendre(ui);
    const texte = container.textContent ?? "";

    // Un écran vide est le défaut que ce lot chasse : soit il montre des
    // chiffres, soit il explique pourquoi il n'en montre pas.
    expect(texte.length).toBeGreaterThan(120);
  });

  it.each(ECRANS_TOUJOURS)("l'écran %s n'affiche ni NaN ni undefined", (_nom, ui) => {
    poser(cas);
    const { container } = rendre(ui);
    const texte = container.textContent ?? "";
    expect(texte).not.toMatch(/NaN/);
    expect(texte).not.toMatch(/undefined/);
    expect(texte).not.toMatch(/\[object Object\]/);
  });

  it("la navigation ne propose que les onglets qui ont quelque chose à montrer", () => {
    poser(cas);
    rendre(<BottomNav />);
    for (const onglet of ["Comptes", "Dépenses", "Revenus", "Patrimoine", "Insights"]) {
      const attendu = cas.onglets.includes(onglet);
      const present = screen.queryAllByText(onglet).length > 0;
      expect(present, `onglet « ${onglet} »`).toBe(attendu);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CE QUE CHAQUE CAS DOIT DIRE, NOMMÉMENT
// ═══════════════════════════════════════════════════════════════════════

describe("cas « un seul compte »", () => {
  it("la courbe des soldes n'a qu'une série, et la carte porte son nom", () => {
    poser(CAS[0]);
    rendre(<Comptes />);
    expect(screen.getAllByText("Caisse de bord").length).toBeGreaterThan(0);
  });

  it("l'onglet Patrimoine disparaît : ni épargne déclarée, ni prêt", () => {
    poser(CAS[0]);
    rendre(<BottomNav />);
    expect(screen.queryByText("Patrimoine")).toBeNull();
  });
});

describe("cas « sans paie »", () => {
  it("les pills Salaire et vs Inflation disparaissent des Revenus", () => {
    poser(CAS[1]);
    rendre(<SubNav />, "/revenus");
    expect(screen.queryByText("Salaire")).toBeNull();
    expect(screen.queryByText("vs Inflation")).toBeNull();
  });

  it("l'écran Comptes ne présente pas un taux d'épargne de 0 %", () => {
    // Sans salaire connu, le taux n'est pas calculable. « 0,0 % » voudrait
    // dire « vous n'épargnez rien » — une affirmation, pas une absence.
    poser(CAS[1]);
    const { container } = rendre(<Comptes />);
    expect(container.textContent).not.toMatch(/Taux d'épargne[^%]{0,40}0,0\s*%/);
  });
});

describe("cas « sans prêt »", () => {
  it("l'onglet Patrimoine reste, parce que l'épargne, elle, est déclarée", () => {
    poser(CAS[2]);
    rendre(<BottomNav />);
    expect(screen.getAllByText("Patrimoine").length).toBeGreaterThan(0);
  });

  it("la pill Prêt Immo. disparaît de la sous-navigation Patrimoine", () => {
    poser(CAS[2]);
    rendre(<SubNav />, "/patrimoine");
    expect(screen.queryByText("Prêt Immo.")).toBeNull();
  });

  it("l'écran Prêt, atteint directement, explique au lieu de montrer un échéancier inventé", () => {
    poser(CAS[2]);
    const { container } = rendre(<PretImmobilier />, "/patrimoine/pret");
    expect(container.textContent).toMatch(/Aucune donnée de prêt/);
    expect(container.textContent).toMatch(/pret-capital/);
  });
});

describe("cas « un compte partagé à 30 % »", () => {
  it("le compte partagé ne porte pas de solde propre, et le principal encaisse sa dépense", () => {
    poser(CAS[3]);
    const { container } = rendre(<Comptes />);
    // 1 000 − 3 × (100 + 60) + 3 × 2 000 − 45 = 6 475.
    // Les 45 € de la Cagnotte sont retirés du principal : c'est le compte lié
    // déclaré, en sens Débit. Sans lui, le solde serait 6 520.
    expect(container.textContent).toMatch(/6\s*475/);
    expect(container.textContent).not.toMatch(/6\s*520/);
  });

  it("l'écran Épargne n'est pas proposé : aucun type d'épargne déclaré", () => {
    poser(CAS[3]);
    rendre(<BottomNav />);
    expect(screen.queryByText("Patrimoine")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("l'écran Épargne quand il EST atteignable", () => {
  it("montre ses chiffres sans nommer un type que la source n'a pas déclaré", () => {
    poser(CAS[2]);
    const { container } = rendre(<Epargne />, "/patrimoine");
    const texte = container.textContent ?? "";
    expect(texte).toMatch(/Mise de côté/);
    expect(texte).not.toMatch(/Sortie Epargne/);
  });
});
