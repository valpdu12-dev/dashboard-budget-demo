import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadDashboardData } from "@/services/loadDashboardData";
import { memoriserJeu, VERSION_SCHEMA } from "@/services/jeuDonnees";
import { useDataStore } from "@/stores/useDataStore";
import type { JeuDonnees } from "@/services/jeuDonnees";
import type { SalaryData } from "@/types";

/**
 * Chargement statique, et restitution de l'import mémorisé par-dessus.
 *
 * Arbitrage du 11/08/2026 : à l'ouverture, le dashboard affiche le dernier
 * fichier importé, conservé jusqu'au suivant. Les fichiers du site sont
 * chargés d'abord car ils apportent la configuration et les objectifs de
 * budget, absents du classeur.
 *
 * Lot A.4 : il n'y a plus d'API. L'origine d'un chargement vaut donc
 * toujours « static » — plus jamais « api ».
 */

const TX_SERVEUR = {
  fields: ["compte", "type", "date", "montant", "cat1", "cat2", "cat3", "cat4", "ville", "dc", "label"],
  s: ["Banque A - Courant", "Courses", "Debit", "Serveur"],
  t: [[0, 1, "2026-01-01", 10, -1, -1, -1, -1, -1, 2, 3]],
};
const SALAIRE_SERVEUR = { months: [], cotLast: [], patronLast: [], lastMonth: "2026-01" };
const CONFIG = { comptes: [] };

const salaryImporte = { months: [], cotLast: [], patronLast: [], lastMonth: "2026-06" } as unknown as SalaryData;

/** La configuration que porte le jeu importé — lot B.5. */
const CONFIG_IMPORTEE = { init: { "Banque A - Courant": 1000 }, demo: false };

function memoImport(): JeuDonnees {
  return {
    version: VERSION_SCHEMA,
    origine: "upload",
    importedAt: "2026-08-11T18:00:00.000Z",
    fileName: "Budget_demo.xlsx",
    transactions: {
      fields: ["compte", "type", "date", "montant", "cat1", "cat2", "cat3", "cat4", "ville", "dc", "label"],
      s: ["Compte", "Type", "Debit", "Importe"],
      t: [
        [0, 1, "2026-06-01", 99, -1, -1, -1, -1, -1, 2, 3],
        [0, 1, "2026-06-02", 42, -1, -1, -1, -1, -1, 2, 3],
      ],
    },
    salary: salaryImporte,
    config: CONFIG_IMPORTEE,
    budgets: [],
  };
}

/** Répond aux fichiers du site. */
function mockFetchOk() {
  return vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(
          url.includes("transactions") ? TX_SERVEUR
            : url.includes("salary") ? SALAIRE_SERVEUR
              : CONFIG
        ),
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  useDataStore.getState().reset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("loadDashboardData", () => {
  it("charge les fichiers du site quand aucun import n'est mémorisé", async () => {
    vi.stubGlobal("fetch", mockFetchOk());
    await loadDashboardData();
    const s = useDataStore.getState();
    expect(s.status).toBe("success");
    expect(s.origin).toBe("static");
    expect(s.transactions).toHaveLength(1);
    expect(s.config).toEqual(CONFIG);
  });

  it("affiche l'import mémorisé par-dessus les fichiers du site", async () => {
    memoriserJeu(memoImport());
    vi.stubGlobal("fetch", mockFetchOk());
    await loadDashboardData();
    const s = useDataStore.getState();
    expect(s.origin).toBe("upload");
    expect(s.transactions).toHaveLength(2);
    expect(s.importFileName).toBe("Budget_demo.xlsx");
    expect(s.importedAt).toBe("2026-08-11T18:00:00.000Z");
  });

  it("n'hérite PLUS de la configuration du site sous les données importées", async () => {
    // ⚠️ Renversement du lot B.5. Ce test affirmait l'inverse : la
    // configuration du site « survivait » à l'import. Résultat, les soldes de
    // départ de la démonstration s'affichaient en face des transactions de la
    // personne, sans que rien ne le signale. Un jeu est désormais un tout :
    // il apporte sa propre configuration, ou n'en a pas.
    memoriserJeu(memoImport());
    vi.stubGlobal("fetch", mockFetchOk());
    await loadDashboardData();
    expect(useDataStore.getState().config).toEqual(CONFIG_IMPORTEE);
    expect(useDataStore.getState().config).not.toEqual(CONFIG);
  });

  it("affiche quand même l'import mémorisé si les fichiers sont injoignables", async () => {
    memoriserJeu(memoImport());
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("hors ligne"))));
    await loadDashboardData();
    const s = useDataStore.getState();
    expect(s.status).toBe("success");
    expect(s.origin).toBe("upload");
    expect(s.transactions).toHaveLength(2);
  });

  it("remonte l'erreur si les fichiers échouent et qu'il n'y a rien de mémorisé", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("hors ligne"))));
    await loadDashboardData();
    const s = useDataStore.getState();
    expect(s.status).toBe("error");
    expect(s.error).toContain("hors ligne");
  });

  it("n'appelle AUCUNE adresse /api ni aucun domaine externe", async () => {
    // Critère de sortie du lot A.4 : dans l'onglet Réseau, uniquement les
    // fichiers du site. Ce test le vérifie au niveau du code, la capture
    // d'écran le vérifiera au niveau du navigateur.
    const espion = mockFetchOk();
    vi.stubGlobal("fetch", espion);
    await loadDashboardData();
    const appelees = espion.mock.calls.map((c) => String(c[0]));
    expect(appelees.length).toBeGreaterThan(0);
    for (const url of appelees) {
      expect(url.startsWith("/data/")).toBe(true);
    }
  });

  it("revient aux fichiers du site une fois l'import oublié", async () => {
    memoriserJeu(memoImport());
    vi.stubGlobal("fetch", mockFetchOk());
    await loadDashboardData();
    expect(useDataStore.getState().origin).toBe("upload");

    localStorage.clear(); // ce que fait « Revenir aux donnees par defaut »
    await loadDashboardData();
    const s = useDataStore.getState();
    expect(s.origin).toBe("static");
    expect(s.transactions).toHaveLength(1);
    expect(s.importedAt).toBeNull();
  });
});
