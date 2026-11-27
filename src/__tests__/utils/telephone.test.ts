// Les mots de l'en-tête et des filtres au téléphone.
import { describe, it, expect } from "vitest";
import { moisCourt, nombreFiltres, resumeFiltres, titrePage } from "@/utils/telephone";

describe("titrePage", () => {
  it("donne le titre de chaque page", () => {
    expect(titrePage("/")).toBe("Comptes");
    expect(titrePage("/depenses")).toBe("Dépenses");
    expect(titrePage("/depenses/budget/")).toBe("Budget");
    expect(titrePage("/revenus/inflation")).toBe("Salaire et inflation");
    expect(titrePage("/patrimoine/soldes")).toBe("Patrimoine");
  });

  it("chemin inconnu ou piégé : Page introuvable (le routeur affiche PageIntrouvable)", () => {
    expect(titrePage("/nimporte")).toBe("Page introuvable");
    expect(titrePage("constructor")).toBe("Page introuvable");
    expect(titrePage("__proto__")).toBe("Page introuvable");
  });
});

describe("moisCourt", () => {
  it("écrit le mois en français", () => {
    expect(moisCourt("2026-11")).toBe("nov. 2026");
    expect(moisCourt("2025-03")).toBe("mars 2025");
  });

  it("vide ou illisible : rien", () => {
    expect(moisCourt(null)).toBe("");
    expect(moisCourt("2026-1")).toBe("");
  });
});

describe("resumeFiltres et nombreFiltres", () => {
  it("résume la période et la classe", () => {
    expect(resumeFiltres("YTD", "all", false)).toBe("Depuis janvier · toutes classes");
    expect(resumeFiltres("all", "Dépense Courante", true)).toBe("Tout · Courante · transferts");
  });

  it("compte les filtres changés, hors période", () => {
    expect(nombreFiltres("all", false)).toBe(0);
    expect(nombreFiltres("all", true)).toBe(1);
    expect(nombreFiltres("Dépense Fixe", true)).toBe(2);
  });
});
