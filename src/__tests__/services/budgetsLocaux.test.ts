// Lot A.4 — objectifs de budget en mémoire locale.
//
// La démonstration n'a pas de serveur. Un objectif modifié doit survivre au
// rechargement, sans jamais rien envoyer. Et quand le navigateur refuse le
// stockage, l'application doit le dire au lieu de faire semblant.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  lireObjectifsLocaux,
  enregistrerObjectifLocal,
  effacerObjectifsLocaux,
} from "@/services/budgetsLocaux";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("objectifs locaux", () => {
  it("part d'un objet vide", () => {
    expect(lireObjectifsLocaux()).toEqual({});
  });

  it("relit ce qui a été enregistré", () => {
    expect(enregistrerObjectifLocal("Alimentation", 620)).toBe(true);
    expect(lireObjectifsLocaux()).toEqual({ Alimentation: 620 });
  });

  it("cumule plusieurs catégories et écrase la même", () => {
    enregistrerObjectifLocal("Alimentation", 620);
    enregistrerObjectifLocal("Transport", 180);
    enregistrerObjectifLocal("Alimentation", 700);
    expect(lireObjectifsLocaux()).toEqual({ Alimentation: 700, Transport: 180 });
  });

  it("efface tout et revient aux valeurs livrées", () => {
    enregistrerObjectifLocal("Loisir", 140);
    effacerObjectifsLocaux();
    expect(lireObjectifsLocaux()).toEqual({});
  });
});

describe("objectifs locaux — stockage hostile", () => {
  it("ignore un contenu illisible au lieu de planter", () => {
    localStorage.setItem("budget.objectifs.v1", "{ ceci n'est pas du JSON");
    expect(lireObjectifsLocaux()).toEqual({});
  });

  it("écarte les valeurs non numériques d'un stockage corrompu", () => {
    // Un NaN qui entrerait dans les calculs de budget contaminerait toutes
    // les moyennes de la page, sans message.
    localStorage.setItem(
      "budget.objectifs.v1",
      JSON.stringify({ Alimentation: 620, Transport: "beaucoup", Loisir: null })
    );
    expect(lireObjectifsLocaux()).toEqual({ Alimentation: 620 });
  });

  it("ignore un tableau là où un objet est attendu", () => {
    localStorage.setItem("budget.objectifs.v1", JSON.stringify([1, 2, 3]));
    expect(lireObjectifsLocaux()).toEqual({});
  });

  it("renvoie false quand le navigateur refuse d'écrire", () => {
    // Navigation privée, quota plein, stockage désactivé : l'écriture lève.
    // L'appelant doit pouvoir le dire à la personne.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(enregistrerObjectifLocal("Alimentation", 620)).toBe(false);
  });

  it("renvoie un objet vide quand la lecture elle-même lève", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(lireObjectifsLocaux()).toEqual({});
  });
});
