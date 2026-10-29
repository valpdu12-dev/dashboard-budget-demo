// ── Page Patrimoine (soldes) — Patrimoine D-4c (plan 33), cas P4 du privé ──
//
// Le profil Démo tel qu'il est publié : `public/data/patrimoine.json`,
// `transactions.json`, `config.json`. Attendus refaits À LA MAIN depuis le
// jeu (voir l'en-tête de calculs/calculPatrimoineDemo.test.ts), YTD :
//
//   août 2026 = 2 575,40 + 1 910 + 9 450 + 8 100 + 2 840 + 6 920 + 4 300
//               + 30 345,45 = 66 440,85      juillet 2026 = 65 047,69
//   → KPI 1 : +1 393,16 vs juil. 26
//   → KPI 2 : 66 440,85 − 4 485,40 = 61 955,45 (immobilier compris)
//   → KPI 3 : 2 575,40 + 1 910 = 4 485,40 ; 4 485,40 ÷ 66 440,85 = 6,75 % → « 6,8 % »
//   → KPI 4 : 66 440,85 − 55 833,53 (déc. 2025) = +10 607,32 ; ÷ 55 833,53 = 19,0 %
//   → KPI 5 : 10 607,32 ÷ 8 variations (janv. → août) = +1 325,92
//   → KPI 6 : 4 485,40 ÷ 2 976,99 €/mois = 1,507 → « 1,5 mois » (8 mois)
//   Sans immobilier : 66 440,85 − 30 345,45 = 36 095,40 ;
//     déc. 2025 55 833,53 − 25 028,13 = 30 805,40 → +5 290 ;
//     juil. 65 047,69 − 29 677,29 = 35 370,40 → +725.
//   Novembre 2025 : pas de relevé du livret Banque A → 1 solde repris.
//
// Aucun montant réel : tout vient du jeu fictif de la démo.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PatrimoineSoldes from "@/pages/PatrimoineSoldes";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { decodeTransactions } from "@/utils/decode";
import { fmt as fmtBrut } from "@/utils/formatters";
import type { CompteursPatrimoine, PatrimoineLu } from "@/services/lectureClasseur";
import type { SoldesPatrimoine } from "@/hooks/useSoldesPatrimoine";
import type { Config, RawTransactionsJSON, SalaryData } from "@/types";
import { resetAllStores } from "../helpers/storeReset";

// État « aucun mois complet » : impossible à produire avec des relevés (le
// premier mois d'une grille est toujours complet). Le hook réel est donc
// enveloppé ; un test peut retoucher son résultat, les autres le lisent tel quel.
const retouche = vi.hoisted(() => ({ fn: null as null | ((r: SoldesPatrimoine) => SoldesPatrimoine) }));
vi.mock("@/hooks/useSoldesPatrimoine", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/hooks/useSoldesPatrimoine")>();
  return {
    ...mod,
    useSoldesPatrimoine: (...args: Parameters<typeof mod.useSoldesPatrimoine>) => {
      const r = mod.useSoldesPatrimoine(...args);
      return retouche.fn ? retouche.fn(r) : r;
    },
  };
});

const DATA = resolve(__dirname, "../../../public/data");
const lire = <T,>(nom: string): T => JSON.parse(readFileSync(resolve(DATA, nom), "utf8")) as T;
const PATRIMOINE = lire<PatrimoineLu>("patrimoine.json");
const TX = decodeTransactions(lire<RawTransactionsJSON>("transactions.json"));
const CONFIG = lire<Config>("config.json");
const SALAIRE = lire<SalaryData>("salary.json");

/** Pose le profil Démo, puis le patrimoine voulu (setData le remet à null). */
function charger(patrimoine: PatrimoineLu | null = PATRIMOINE) {
  useDataStore.getState().setData(TX, SALAIRE, CONFIG, "static");
  useDataStore.setState({ patrimoine });
}

beforeEach(() => {
  resetAllStores();
  retouche.fn = null;
});

// Testing Library ramène l'espace insécable de fmt() à un espace simple.
const fmt = (v: number) => fmtBrut(v).replace(/\s/g, " ");
const signe = (v: number) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));
const kpis = () => within(screen.getByTestId("kpis-patrimoine"));

describe("Page Patrimoine (soldes) — KPI du profil Démo", () => {
  it("affiche le mois des KPI : août 2026, dernier mois complet", () => {
    charger();
    render(<PatrimoineSoldes />);
    expect(screen.getByText(/chiffres à fin août 2026 \(dernier mois complet\)/)).toBeInTheDocument();
  });

  it("KPI 1 à 5 (YTD)", () => {
    charger();
    render(<PatrimoineSoldes />);
    const k = kpis();
    expect(k.getByText("Patrimoine total")).toBeInTheDocument();
    expect(k.getByText(fmt(66440.85))).toBeInTheDocument();
    expect(k.getByText(`▲ ${signe(1393.16)} vs juil. 26`)).toBeInTheDocument();
    expect(k.getByText(fmt(61955.45))).toBeInTheDocument();
    expect(k.getByText(fmt(4485.4))).toBeInTheDocument();
    expect(k.getByText("6,8 % du total")).toBeInTheDocument();
    expect(k.getByText(signe(10607.32))).toBeInTheDocument();
    expect(k.getByText("+19,0 % depuis déc. 25")).toBeInTheDocument();
    expect(k.getByText(signe(1325.92))).toBeInTheDocument();
    expect(k.getByText("sur 8 mois de la période")).toBeInTheDocument();
  });

  it("KPI 6 : matelas à une décimale, avec les dépenses moyennes de la page Dépenses", () => {
    charger();
    render(<PatrimoineSoldes />);
    expect(kpis().getByText("1,5 mois")).toBeInTheDocument();
    expect(kpis().getByText(`dépenses moy. ${fmt(2976.99)}/mois (8 mois)`)).toBeInTheDocument();
  });

  it("KPI 6 sans transaction : tiret et explication", () => {
    useDataStore.getState().setData([], SALAIRE, CONFIG, "static");
    useDataStore.setState({ patrimoine: PATRIMOINE });
    render(<PatrimoineSoldes />);
    expect(kpis().getByText("aucune dépense sur la période")).toBeInTheDocument();
  });
});

describe("Page Patrimoine (soldes) — interrupteur « Inclure l'immobilier »", () => {
  it("affiché et activé par défaut quand le jeu contient de l'immobilier", () => {
    charger();
    render(<PatrimoineSoldes />);
    expect(screen.getByRole("switch", { name: "Inclure l'immobilier" })).toHaveAttribute("aria-checked", "true");
  });

  it("désactivé : tous les KPI passent en patrimoine financier", () => {
    charger();
    render(<PatrimoineSoldes />);
    fireEvent.click(screen.getByRole("switch", { name: "Inclure l'immobilier" }));
    expect(screen.getByRole("switch", { name: "Inclure l'immobilier" })).toHaveAttribute("aria-checked", "false");
    const k = kpis();
    expect(k.getByText("Patrimoine financier")).toBeInTheDocument();
    expect(k.getByText(fmt(36095.4))).toBeInTheDocument();
    expect(k.getByText(`▲ ${signe(725)} vs juil. 26`)).toBeInTheDocument();
    expect(k.getByText(signe(5290))).toBeInTheDocument();
    // Le bien immobilier sort du tableau.
    expect(screen.queryByText("Appartement - capital remboursé")).not.toBeInTheDocument();
    expect(screen.getByText("(7 comptes)")).toBeInTheDocument();
  });

  it("masqué quand le jeu n'a pas d'immobilier", () => {
    charger({ ...PATRIMOINE, releves: PATRIMOINE.releves.filter((r) => r.banque !== "Immobilier") });
    render(<PatrimoineSoldes />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(kpis().getByText("Patrimoine total")).toBeInTheDocument();
    expect(kpis().getByText(fmt(36095.4))).toBeInTheDocument();
  });
});

describe("Page Patrimoine (soldes) — messages", () => {
  it("« Tout » : signale le solde repris en novembre 2025", () => {
    charger();
    useFilterStore.setState({ period: "all" });
    render(<PatrimoineSoldes />);
    expect(screen.getByText(/^1 solde repris du mois précédent en novembre 2025/)).toBeInTheDocument();
  });

  it("YTD : novembre 2025 est hors période, aucun message de reprise", () => {
    charger();
    render(<PatrimoineSoldes />);
    expect(screen.queryByText(/solde repris/)).not.toBeInTheDocument();
  });

  it("signale les mois récents incomplets", () => {
    // Livret Banque A oublié en juillet ET en août : ces deux mois sont
    // incomplets, le dernier mois complet devient juin 2026.
    charger({
      ...PATRIMOINE,
      releves: PATRIMOINE.releves.filter(
        (r) => !(r.compte === "Banque A - Livret" && (r.mk === "2026-07" || r.mk === "2026-08")),
      ),
    });
    render(<PatrimoineSoldes />);
    expect(screen.getByText(/Saisie en cours pour juillet 2026 et août 2026/)).toBeInTheDocument();
    expect(screen.getByText(/les chiffres s'arrêtent à juin 2026/)).toBeInTheDocument();
    expect(screen.getByText(/chiffres à fin juin 2026/)).toBeInTheDocument();
    // juin 2026 = 63 655,53 (somme des 8 relevés de juin)
    expect(kpis().getByText(fmt(63655.53))).toBeInTheDocument();
  });
});

describe("Page Patrimoine (soldes) — états", () => {
  const vide = (compteurs: CompteursPatrimoine): PatrimoineLu =>
    ({ releves: [], nbComptes: 0, dernierMois: "", compteurs });

  it("absent : invite à ajouter la feuille (adresse normalement protégée par la route)", () => {
    charger(null);
    render(<PatrimoineSoldes />);
    expect(screen.getByText("Pas encore de feuille Patrimoine")).toBeInTheDocument();
    expect(screen.queryByTestId("kpis-patrimoine")).not.toBeInTheDocument();
  });

  it("vide : cite les compteurs non nuls", () => {
    charger(vide({ lignesLues: 12, gardees: 0, futures: 3, nonSaisies: 9, ignorees: 0 }));
    render(<PatrimoineSoldes />);
    expect(screen.getByText("La feuille Patrimoine n'a aucun relevé lisible")).toBeInTheDocument();
    expect(screen.getByText("12 lignes lues : 9 pas encore saisies (montant vide), 3 datées après aujourd'hui.")).toBeInTheDocument();
    expect(screen.queryByText(/aperçu d'import/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("kpis-patrimoine")).not.toBeInTheDocument();
  });

  it("vide avec des lignes écartées : renvoie à l'aperçu d'import", () => {
    charger(vide({ lignesLues: 12, gardees: 0, futures: 0, nonSaisies: 9, ignorees: 3 }));
    render(<PatrimoineSoldes />);
    expect(screen.getByText("12 lignes lues : 9 pas encore saisies (montant vide), 3 écartées.")).toBeInTheDocument();
    expect(screen.getByText(/rechargez le fichier pour le revoir/)).toBeInTheDocument();
  });

  it("vide sans aucune ligne lue : nomme les colonnes attendues", () => {
    charger(vide({ lignesLues: 0, gardees: 0, futures: 0, nonSaisies: 0, ignorees: 0 }));
    render(<PatrimoineSoldes />);
    expect(screen.getByText(/^Aucune ligne lue : vérifiez que la feuille a les colonnes Transaction/)).toBeInTheDocument();
  });

  it("aucun mois complet : explique la règle du compte clôturé", () => {
    charger();
    retouche.fn = (r) => ({ ...r, kpis: null, dernierMoisComplet: null, moisIncomplets: ["2026-08"] });
    render(<PatrimoineSoldes />);
    expect(screen.getByText("Aucun mois complet")).toBeInTheDocument();
    expect(screen.getByText(/Un compte clôturé doit recevoir un relevé à 0/)).toBeInTheDocument();
    expect(screen.getByText(/aucun mois n'est encore complet/)).toBeInTheDocument();
    expect(screen.queryByTestId("kpis-patrimoine")).not.toBeInTheDocument();
  });
});

describe("Page Patrimoine (soldes) — répartition et tableau", () => {
  it("un clic dans la répartition filtre le tableau, un 2e clic le vide", () => {
    charger();
    render(<PatrimoineSoldes />);
    expect(screen.getByText("(8 comptes)")).toBeInTheDocument();
    const legende = within(screen.getByRole("list", { name: "Répartition par banque" }));
    fireEvent.click(legende.getByRole("button", { name: /^Banque B/ }));
    // Banque B : Courant, Compte titres, Assurance-vie
    expect(screen.getByText("(3 comptes)")).toBeInTheDocument();
    expect(screen.getByText("Banque B - Compte titres")).toBeInTheDocument();
    expect(screen.queryByText("Banque A - Livret")).not.toBeInTheDocument();
    fireEvent.click(legende.getByRole("button", { name: /^Banque B/ }));
    expect(screen.getByText("(8 comptes)")).toBeInTheDocument();
  });

  it("tri par colonne : Solde croissant met le plus petit compte en tête", () => {
    charger();
    render(<PatrimoineSoldes />);
    fireEvent.click(screen.getByRole("columnheader", { name: "Solde" }));
    const lignes = screen.getAllByRole("row");
    // lignes[0] = en-tête ; 1 910 € = Banque B - Courant, le plus petit d'août
    expect(within(lignes[1]).getByText("Banque B - Courant")).toBeInTheDocument();
  });

  it("total du tableau = total du mois", () => {
    charger();
    render(<PatrimoineSoldes />);
    const pied = screen.getByText("Total (8 comptes)").parentElement!;
    expect(within(pied).getByText(fmt(66440.85))).toBeInTheDocument();
  });
});
