import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderHook } from "@testing-library/react";
import { construireOptions } from "@/calculs/optionsCategorie";
import { useOptionsCategorie } from "@/hooks/useOptionsCategorie";
import { decodeTransactions } from "@/utils/decode";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeConfig } from "../helpers/factories";
import type { RawTransactionsJSON } from "@/types";

beforeEach(() => {
  resetAllStores();
});

describe("construireOptions", () => {
  it("exclut les cases vides et « x » (majuscule ou non, espaces compris)", () => {
    const tx = ["Pharmacie", "x", "", "X", " x ", "   ", "Parking"].map((c) => makeTx({ cat3: c }));
    expect(construireOptions(tx, "cat3").map((o) => o.valeur)).toEqual(["Parking", "Pharmacie"]);
  });

  it("compte les transactions par valeur", () => {
    const tx = ["Primeur", "Cinéma", "Primeur", "Primeur"].map((c) => makeTx({ cat3: c }));
    expect(construireOptions(tx, "cat3")).toEqual([
      { valeur: "Cinéma", nombre: 1 },
      { valeur: "Primeur", nombre: 3 },
    ]);
  });

  it("trie dans l'ordre alphabétique français", () => {
    // Un tri brut (codes Unicode) donnerait : Café, Zoo, banque, Épicerie.
    const tx = ["Zoo", "Épicerie", "banque", "Café"].map((c) => makeTx({ cat3: c }));
    expect(construireOptions(tx, "cat3").map((o) => o.valeur)).toEqual(["banque", "Café", "Épicerie", "Zoo"]);
  });

  it("ne regroupe PAS les écritures différentes (PARKING / Parking)", () => {
    const tx = ["PARKING", "Parking", "Parking"].map((c) => makeTx({ cat3: c }));
    const opts = construireOptions(tx, "cat3");
    expect(opts).toHaveLength(2);
    expect(opts.find((o) => o.valeur === "Parking")?.nombre).toBe(2);
    expect(opts.find((o) => o.valeur === "PARKING")?.nombre).toBe(1);
  });

  it("lit la colonne demandée (cat4 = Événement)", () => {
    const tx = [makeTx({ cat3: "Primeur", cat4: "Rentrée" }), makeTx({ cat3: "Cinéma", cat4: "" })];
    expect(construireOptions(tx, "cat4")).toEqual([{ valeur: "Rentrée", nombre: 1 }]);
  });

  it("aucune valeur → liste vide (la page n'affiche alors pas la liste)", () => {
    const tx = [makeTx({ cat4: "" }), makeTx({ cat4: "x" })];
    expect(construireOptions(tx, "cat4")).toEqual([]);
  });
});

describe("useOptionsCategorie", () => {
  it("se base sur TOUTES les transactions, pas sur la période", () => {
    const tx = [
      makeTx({ date: "2023-06-10", cat3: "Cinéma", cat4: "Vacances d'été" }),
      makeTx({ date: "2025-03-10", cat3: "Pharmacie", cat4: "" }),
    ];
    useDataStore.getState().setData(tx, { months: [], cotLast: [], patronLast: [], lastMonth: "" }, makeConfig());
    useFilterStore.getState().setPeriod("1M"); // seul mars 2025 est affiché
    const { result } = renderHook(() => useOptionsCategorie());
    expect(result.current.enseignes.map((o) => o.valeur)).toEqual(["Cinéma", "Pharmacie"]);
    expect(result.current.evenements.map((o) => o.valeur)).toEqual(["Vacances d'été"]);
  });
});

describe("le jeu « Démo » publié", () => {
  const brut = JSON.parse(
    readFileSync(resolve(__dirname, "../../../public/data/transactions.json"), "utf8")
  ) as RawTransactionsJSON;
  const tx = decodeTransactions(brut);

  it("propose 32 enseignes", () => {
    expect(construireOptions(tx, "cat3")).toHaveLength(32);
  });

  it("propose les 6 événements inventés (scénario A), environ 10 % des lignes", () => {
    const ev = construireOptions(tx, "cat4");
    expect(ev.map((o) => o.valeur)).toEqual([
      "Anniversaire", "Fêtes de fin d'année", "Rentrée",
      "Travaux cuisine", "Vacances d'été", "Week-end montagne",
    ]);
    const lignes = ev.reduce((s, o) => s + o.nombre, 0);
    expect(lignes / tx.length).toBeGreaterThan(0.07);
    expect(lignes / tx.length).toBeLessThan(0.13);
  });

  it("un événement ne se pose que sur une dépense", () => {
    const hors = tx.filter((t) => t.cat4 && (t.dc !== "Débit" || !t.cat1));
    expect(hors).toEqual([]);
  });
});
