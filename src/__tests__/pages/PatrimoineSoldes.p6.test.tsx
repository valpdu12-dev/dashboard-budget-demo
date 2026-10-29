// ── Page Patrimoine (soldes) — Patrimoine D-4c (plan 33), cas P6 du privé ──
//
// Légende de l'Évolution en boutons (filtre de TOUTE la page, plusieurs
// libellés), graphique « Détail par compte », donut par compte, nature
// Immobilier, clic sur un mois.
//
// Attendus à la main, profil Démo (public/data/patrimoine.json) :
//   Banque B, août 2026 = 1 910 (courant) + 2 840 (titres) + 6 920 (AV)
//     = 11 670 ; juillet 11 440 → +230 ; déc. 2025 10 070 → +1 600 (15,9 %).
//     Épargne de la sélection = 2 840 + 6 920 = 9 760.
//   Banque C, août 2026 = 8 100 + 4 300 = 12 400 (tout en épargne).
//   Banque B + Banque C = 24 070.
//   Liquidité = 2 575,40 + 1 910 = 4 485,40 ; Immobilier = 30 345,45.
//   Mars 2026, Banque B = 1 880 + 2 440 + 6 320 = 10 640.
// Aucun montant réel.
//
// Clic sur un mois : jsdom ne dessine pas les graphiques Recharts. Le
// graphique Évolution est remplacé par un faux qui rend un bouton par mois et
// appelle `onClick` comme Recharts (`activeTooltipIndex`). On teste la page,
// pas Recharts.

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PatrimoineSoldes from "@/pages/PatrimoineSoldes";
import { useDataStore } from "@/stores/useDataStore";
import { decodeTransactions } from "@/utils/decode";
import { fmt as fmtBrut, fmtShort as fmtShortBrut } from "@/utils/formatters";
import type { PatrimoineLu } from "@/services/lectureClasseur";
import type { Config, RawTransactionsJSON, SalaryData } from "@/types";
import { resetAllStores } from "../helpers/storeReset";

vi.mock("recharts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("recharts")>();
  function FauxComposedChart(props: {
    data: { mk: string }[];
    onClick?: (e: { activeTooltipIndex: number }) => void;
    children?: ReactNode;
  }) {
    // Seule l'Évolution a un onClick ; le « Détail par compte » n'en a pas.
    if (!props.onClick) return <div data-testid="faux-detail" />;
    return (
      <div data-testid="faux-evolution">
        {props.data.map((d, i) => (
          <button key={d.mk} type="button" onClick={() => props.onClick!({ activeTooltipIndex: i })}>
            mois {d.mk}
          </button>
        ))}
      </div>
    );
  }
  return { ...mod, ComposedChart: FauxComposedChart };
});

const DATA = resolve(__dirname, "../../../public/data");
const lire = <T,>(nom: string): T => JSON.parse(readFileSync(resolve(DATA, nom), "utf8")) as T;
const PATRIMOINE = lire<PatrimoineLu>("patrimoine.json");
const TX = decodeTransactions(lire<RawTransactionsJSON>("transactions.json"));
const CONFIG = lire<Config>("config.json");
const SALAIRE = lire<SalaryData>("salary.json");

function charger(patrimoine: PatrimoineLu = PATRIMOINE) {
  useDataStore.getState().setData(TX, SALAIRE, CONFIG, "static");
  useDataStore.setState({ patrimoine });
}

beforeEach(() => resetAllStores());

const fmt = (v: number) => fmtBrut(v).replace(/\s/g, " ");
const fmtShort = (v: number) => fmtShortBrut(v).replace(/\s/g, " ");
const signe = (v: number) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));
const kpis = () => within(screen.getByTestId("kpis-patrimoine"));
const legende = () => within(screen.getByRole("list", { name: "Légende — filtrer la page" }));

describe("légende de l'Évolution = filtre de la page", () => {
  it("liste toutes les banques ; un clic sur Banque B filtre toute la page", () => {
    charger();
    render(<PatrimoineSoldes />);
    const l = legende();
    expect(l.getAllByRole("button").map((b) => b.textContent)).toEqual(["Banque A", "Banque B", "Banque C", "Immobilier"]);
    for (const b of ["Banque A", "Banque B", "Banque C", "Immobilier"]) {
      expect(l.getByRole("button", { name: b })).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.queryByTestId("detail-par-compte")).not.toBeInTheDocument();

    fireEvent.click(l.getByRole("button", { name: "Banque B" }));
    expect(l.getByRole("button", { name: "Banque B" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "Filtre de la page" })).getByText("Banque B")).toBeInTheDocument();
    const k = kpis();
    expect(k.getByText("Total de la sélection")).toBeInTheDocument();
    expect(k.getByText(fmt(11670))).toBeInTheDocument();
    expect(k.getByText(`▲ ${signe(230)} vs juil. 26`)).toBeInTheDocument();
    expect(k.getByText(fmt(9760))).toBeInTheDocument();
    expect(k.getByText(signe(1600))).toBeInTheDocument();
    expect(k.getByText("+15,9 % depuis déc. 25")).toBeInTheDocument();
    expect(screen.getByText("(3 comptes)")).toBeInTheDocument();
    expect(screen.getByTestId("detail-par-compte")).toBeInTheDocument();
    expect(screen.getByText("Détail par compte — Banque B")).toBeInTheDocument();
    const donut = within(screen.getByRole("list", { name: "Répartition par compte" }));
    expect(donut.getAllByRole("button")).toHaveLength(3);
    expect(donut.getByRole("button", { name: /Banque B - Compte titres/ })).toBeInTheDocument();
    expect(donut.getByRole("button", { name: /Assurance-vie Banque B/ })).toBeInTheDocument();
  });

  it("plusieurs libellés se cumulent ; un 2e clic retire le libellé", () => {
    charger();
    render(<PatrimoineSoldes />);
    fireEvent.click(legende().getByRole("button", { name: "Banque B" }));
    fireEvent.click(legende().getByRole("button", { name: "Banque C" }));
    expect(kpis().getByText(fmt(24070))).toBeInTheDocument();
    expect(screen.getByText("(5 comptes)")).toBeInTheDocument();
    expect(screen.getByText("Détail par compte — Banque B et Banque C")).toBeInTheDocument();
    fireEvent.click(legende().getByRole("button", { name: "Banque B" }));
    // Banque C seule : total = épargne placée (sélection 100 % épargne)
    expect(kpis().getAllByText(fmt(12400))).toHaveLength(2);
    expect(screen.getByText("(2 comptes)")).toBeInTheDocument();
  });

  it("« Tout afficher » rend la page complète", () => {
    charger();
    render(<PatrimoineSoldes />);
    fireEvent.click(legende().getByRole("button", { name: "Banque B" }));
    fireEvent.click(screen.getByRole("button", { name: "Tout afficher" }));
    expect(kpis().getByText("Patrimoine total")).toBeInTheDocument();
    expect(kpis().getByText(fmt(66440.85))).toBeInTheDocument();
    expect(screen.queryByTestId("detail-par-compte")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Répartition par banque" })).toBeInTheDocument();
  });

  it("page filtrée : un clic dans la répartition par compte filtre le tableau sur ce compte", () => {
    charger();
    render(<PatrimoineSoldes />);
    fireEvent.click(legende().getByRole("button", { name: "Banque B" }));
    const donut = within(screen.getByRole("list", { name: "Répartition par compte" }));
    fireEvent.click(donut.getByRole("button", { name: /Banque B - Compte titres/ }));
    expect(screen.getByText("(1 compte)")).toBeInTheDocument();
  });

  it("par nature : Liquidité seule ; changer de vue efface le filtre", () => {
    charger();
    render(<PatrimoineSoldes />);
    fireEvent.click(screen.getByRole("button", { name: "Par nature" }));
    expect(legende().getAllByRole("button").map((b) => b.textContent)).toEqual(["Épargne", "Liquidité", "Immobilier"]);
    fireEvent.click(legende().getByRole("button", { name: "Liquidité" }));
    expect(kpis().getByText("Total de la sélection")).toBeInTheDocument();
    // total = liquidités : 4 485,40 deux fois
    expect(kpis().getAllByText(fmt(4485.4))).toHaveLength(2);
    expect(screen.getByText("(2 comptes)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Par banque" }));
    expect(kpis().getByText("Patrimoine total")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtre de la page" })).not.toBeInTheDocument();
  });

  it("nature Immobilier : la sélection ne garde que le bien immobilier", () => {
    charger();
    render(<PatrimoineSoldes />);
    fireEvent.click(screen.getByRole("button", { name: "Par nature" }));
    fireEvent.click(legende().getByRole("button", { name: "Immobilier" }));
    // total = épargne placée (l'immobilier y est compté)
    expect(kpis().getAllByText(fmt(30345.45))).toHaveLength(2);
    expect(screen.getByText("(1 compte)")).toBeInTheDocument();
  });

  it("immobilier coupé alors qu'il est filtré : le filtre est ignoré", () => {
    charger();
    render(<PatrimoineSoldes />);
    fireEvent.click(legende().getByRole("button", { name: "Immobilier" }));
    fireEvent.click(screen.getByRole("switch", { name: "Inclure l'immobilier" }));
    expect(kpis().getByText("Patrimoine financier")).toBeInTheDocument();
    expect(kpis().getByText(fmt(36095.4))).toBeInTheDocument();
    expect(screen.queryByTestId("detail-par-compte")).not.toBeInTheDocument();
  });
});

describe("clic sur un mois de l'Évolution → donut de ce mois seulement", () => {
  it("mars 2026 : le donut change, les KPI et le tableau restent en août", () => {
    charger();
    render(<PatrimoineSoldes />);
    expect(screen.getByText("Répartition par banque — août 26")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Revenir à/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "mois 2026-03" }));
    expect(screen.getByText("Répartition par banque — mars 26")).toBeInTheDocument();
    const donut = within(screen.getByRole("list", { name: "Répartition par banque" }));
    expect(donut.getByRole("button", { name: /^Banque B/ })).toHaveTextContent(fmtShort(10640));
    // KPI et tableau : toujours août
    expect(kpis().getByText(fmt(66440.85))).toBeInTheDocument();
    expect(screen.getByText("Détail des comptes — août 26")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revenir à août 26" }));
    expect(screen.getByText("Répartition par banque — août 26")).toBeInTheDocument();
  });

  it("un clic sur le dernier mois complet n'affiche pas « Revenir à »", () => {
    charger();
    render(<PatrimoineSoldes />);
    fireEvent.click(screen.getByRole("button", { name: "mois 2026-03" }));
    fireEvent.click(screen.getByRole("button", { name: "mois 2026-08" }));
    expect(screen.getByText("Répartition par banque — août 26")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Revenir à/ })).not.toBeInTheDocument();
  });
});
