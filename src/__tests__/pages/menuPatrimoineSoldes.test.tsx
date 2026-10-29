// ── Menu et adresses du sous-onglet Patrimoine (soldes) — D-4c (plan 33) ──
//
// Règle d'or : Épargne et Prêt Immo. gardent leur adresse. La 3e pill
// n'existe que si le jeu affiché a une feuille Patrimoine (useDataStore
// .patrimoine non null) ; sinon l'adresse renvoie ailleurs.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SUB_NAV_CONFIG } from "@/config/constants";
import { SubNav } from "@/components/layout/SubNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { AppRouter } from "@/router";
import { useDataStore } from "@/stores/useDataStore";
import { decodeTransactions } from "@/utils/decode";
import type { PatrimoineLu } from "@/services/lectureClasseur";
import type { Config, RawTransactionsJSON, SalaryData } from "@/types";
import { resetAllStores } from "../helpers/storeReset";
import { makeConfig, makeSalaryData, makeTx } from "../helpers/factories";
import { PARAMETRAGE_DEMO } from "../helpers/parametrageDemo";

// Le cadre et les pages sont remplacés par des étiquettes : on ne teste ici
// que « quelle adresse ouvre quelle page ».
vi.mock("@/components/layout/AppShell", () => ({ AppShell: () => <Outlet /> }));
vi.mock("@/pages/Comptes", () => ({ default: () => <div>PAGE Comptes</div> }));
vi.mock("@/pages/Epargne", () => ({ default: () => <div>PAGE Épargne</div> }));
vi.mock("@/pages/PretImmobilier", () => ({ default: () => <div>PAGE Prêt Immo.</div> }));
vi.mock("@/pages/PatrimoineSoldes", () => ({ default: () => <div>PAGE Patrimoine soldes</div> }));

const DATA = resolve(__dirname, "../../../public/data");
const lire = <T,>(nom: string): T => JSON.parse(readFileSync(resolve(DATA, nom), "utf8")) as T;
const PATRIMOINE = lire<PatrimoineLu>("patrimoine.json");
const TX = decodeTransactions(lire<RawTransactionsJSON>("transactions.json"));
const CONFIG = lire<Config>("config.json");
const SALAIRE = lire<SalaryData>("salary.json");

/** Profil Démo (épargne + prêt), avec ou sans sa feuille Patrimoine. */
function poserDemo(avecSoldes: boolean) {
  useDataStore.getState().setData(TX, SALAIRE, CONFIG, "static");
  if (avecSoldes) useDataStore.setState({ patrimoine: PATRIMOINE });
}

/** Un jeu SANS épargne ni prêt déclarés (aucun type), avec ou sans soldes. */
function poserSansEpargneNiPret(avecSoldes: boolean) {
  const config = makeConfig({ parametrage: { ...PARAMETRAGE_DEMO, types: [] } });
  useDataStore.getState().setData([makeTx({ date: "2026-02-10" })], makeSalaryData([]), config, "upload");
  if (avecSoldes) useDataStore.setState({ patrimoine: PATRIMOINE });
}

const subNav = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <SubNav />
    </MemoryRouter>,
  );
const ouvrir = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRouter />
    </MemoryRouter>,
  );
const liens = () => screen.getAllByRole("link").map((l) => l.textContent);

beforeEach(() => resetAllStores());

describe("Menu Patrimoine — configuration", () => {
  it("3 entrées dans l'ordre : Épargne · Prêt Immo. · Patrimoine", () => {
    expect(SUB_NAV_CONFIG.patrimoine.map((p) => p.label)).toEqual(["Épargne", "Prêt Immo.", "Patrimoine"]);
    expect(SUB_NAV_CONFIG.patrimoine.map((p) => p.path)).toEqual([
      "/patrimoine", "/patrimoine/pret", "/patrimoine/soldes",
    ]);
  });
});

describe("Menu Patrimoine — avec une feuille Patrimoine (profil Démo)", () => {
  beforeEach(() => poserDemo(true));

  it("3 pills ; sur /patrimoine/soldes, seule Patrimoine est active", () => {
    subNav("/patrimoine/soldes");
    expect(liens()).toEqual(["Épargne", "Prêt Immo.", "Patrimoine"]);
    expect(screen.getByRole("link", { name: "Patrimoine" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Épargne" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Prêt Immo." })).not.toHaveAttribute("aria-current");
  });

  it("sur /patrimoine, seule Épargne est active", () => {
    subNav("/patrimoine");
    expect(screen.getByRole("link", { name: "Épargne" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Patrimoine" })).not.toHaveAttribute("aria-current");
  });

  it("/patrimoine ouvre toujours Épargne", async () => {
    ouvrir("/patrimoine");
    expect(await screen.findByText("PAGE Épargne")).toBeInTheDocument();
  });

  it("/patrimoine/pret ouvre toujours Prêt Immo.", async () => {
    ouvrir("/patrimoine/pret");
    expect(await screen.findByText("PAGE Prêt Immo.")).toBeInTheDocument();
  });

  it("/patrimoine/soldes ouvre la nouvelle page", async () => {
    ouvrir("/patrimoine/soldes");
    expect(await screen.findByText("PAGE Patrimoine soldes")).toBeInTheDocument();
  });
});

describe("Menu Patrimoine — sans feuille Patrimoine", () => {
  beforeEach(() => poserDemo(false));

  it("2 pills seulement : Épargne · Prêt Immo.", () => {
    subNav("/patrimoine");
    expect(liens()).toEqual(["Épargne", "Prêt Immo."]);
  });

  it("/patrimoine et /patrimoine/pret ouvrent toujours leurs pages", async () => {
    const { unmount } = ouvrir("/patrimoine");
    expect(await screen.findByText("PAGE Épargne")).toBeInTheDocument();
    unmount();
    ouvrir("/patrimoine/pret");
    expect(await screen.findByText("PAGE Prêt Immo.")).toBeInTheDocument();
  });

  it("/patrimoine/soldes tapée en direct renvoie à l'accueil", async () => {
    ouvrir("/patrimoine/soldes");
    expect(await screen.findByText("PAGE Comptes")).toBeInTheDocument();
    expect(screen.queryByText("PAGE Patrimoine soldes")).not.toBeInTheDocument();
  });

  it("pendant le chargement, n'expulse pas d'une adresse directe", async () => {
    resetAllStores();
    useDataStore.getState().setLoading();
    ouvrir("/patrimoine/soldes");
    expect(await screen.findByText("PAGE Patrimoine soldes")).toBeInTheDocument();
  });
});

describe("un jeu qui n'a que des soldes (ni épargne ni prêt)", () => {
  it("garde l'onglet Patrimoine, et /patrimoine mène aux soldes", async () => {
    poserSansEpargneNiPret(true);
    const { unmount } = render(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect(screen.getAllByText("Patrimoine").length).toBeGreaterThan(0);
    unmount();
    ouvrir("/patrimoine");
    expect(await screen.findByText("PAGE Patrimoine soldes")).toBeInTheDocument();
  });

  it("une seule pill : la barre de sous-navigation disparaît", () => {
    poserSansEpargneNiPret(true);
    subNav("/patrimoine/soldes");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("sans soldes non plus : pas d'onglet Patrimoine, /patrimoine renvoie à l'accueil", async () => {
    poserSansEpargneNiPret(false);
    const { unmount } = render(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect(screen.queryByText("Patrimoine")).toBeNull();
    unmount();
    ouvrir("/patrimoine");
    expect(await screen.findByText("PAGE Comptes")).toBeInTheDocument();
  });
});
