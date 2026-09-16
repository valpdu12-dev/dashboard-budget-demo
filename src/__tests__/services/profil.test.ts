import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CLE_PROFIL,
  CLES_LOCALES,
  lireProfil,
  ecrireProfil,
  jeuPersonnelDisponible,
  effacerDonneesPersonnelles,
} from "@/services/profil";
import { CLE, CLE_V1, VERSION_SCHEMA, memoriserJeu, type JeuDonnees } from "@/services/jeuDonnees";
import { CLE_OBJECTIFS, enregistrerObjectifLocal } from "@/services/budgetsLocaux";

/**
 * Profils Démo / Mes données — lot B.6.
 *
 * Critère de sortie du lot : AUCUN RÉSIDU après effacement. Le test le plus
 * important de ce fichier est donc le dernier : on écrit par tous les chemins
 * que l'application connaît, on efface, et le stockage doit être vide.
 */

function jeu(): JeuDonnees {
  return {
    version: VERSION_SCHEMA,
    origine: "upload",
    importedAt: "2026-09-16T10:00:00.000Z",
    fileName: "Budget_demo.xlsx",
    transactions: { s: [], t: [] },
    salary: { months: [], cotLast: [], patronLast: [], lastMonth: "" },
    config: { init: {}, demo: false },
    budgets: [],
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("profil affiché", () => {
  it("vaut « personnel » quand rien n'a été choisi", () => {
    // Le comportement d'avant le lot : quelqu'un qui a importé son fichier le
    // retrouve en rouvrant le site, sans avoir rien à cliquer.
    expect(lireProfil()).toBe("personnel");
  });

  it("se relit après avoir été écrit", () => {
    ecrireProfil("demo");
    expect(lireProfil()).toBe("demo");
    ecrireProfil("personnel");
    expect(lireProfil()).toBe("personnel");
  });

  it("retombe sur « personnel » devant une valeur illisible", () => {
    localStorage.setItem(CLE_PROFIL, "n'importe quoi");
    expect(lireProfil()).toBe("personnel");
  });
});

describe("disponibilité d'un jeu personnel", () => {
  it("est fausse sur un appareil vierge", () => {
    expect(jeuPersonnelDisponible()).toBe(false);
  });

  it("devient vraie dès qu'un jeu est mémorisé", () => {
    memoriserJeu(jeu());
    expect(jeuPersonnelDisponible()).toBe(true);
  });

  it("reconnaît aussi un import écrit par une version antérieure", () => {
    // Sans cela, quelqu'un qui n'a pas rouvert le site depuis le lot B.5 se
    // verrait proposer la démonstration seule, alors que son fichier est là.
    localStorage.setItem(CLE_V1, JSON.stringify({ transactions: [], salary: {} }));
    expect(jeuPersonnelDisponible()).toBe(true);
  });
});

describe("effacement — critère de sortie du lot B.6", () => {
  it("ne laisse AUCUN résidu, objectifs de budget compris", () => {
    // On écrit par les vrais chemins d'écriture de l'application, pas en
    // posant les clés à la main : si un module se met un jour à écrire
    // ailleurs sans le déclarer dans CLES_LOCALES, ce test le verra.
    memoriserJeu(jeu());
    enregistrerObjectifLocal("Alimentation", 400);
    ecrireProfil("personnel");
    localStorage.setItem(CLE_V1, JSON.stringify({ transactions: [], salary: {} }));
    expect(localStorage.length).toBeGreaterThan(0);

    effacerDonneesPersonnelles();

    expect(localStorage.length).toBe(0);
    expect(localStorage.getItem(CLE)).toBeNull();
    expect(localStorage.getItem(CLE_V1)).toBeNull();
    expect(localStorage.getItem(CLE_OBJECTIFS)).toBeNull();
    expect(localStorage.getItem(CLE_PROFIL)).toBeNull();
  });

  it("tient l'inventaire des clés en un seul endroit", () => {
    for (const cle of [CLE, CLE_V1, CLE_OBJECTIFS, CLE_PROFIL]) {
      expect(CLES_LOCALES).toContain(cle);
    }
  });

  it("ne lève pas quand le stockage refuse", () => {
    const refus = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("stockage refusé");
    });
    expect(() => effacerDonneesPersonnelles()).not.toThrow();
    refus.mockRestore();
  });
});
