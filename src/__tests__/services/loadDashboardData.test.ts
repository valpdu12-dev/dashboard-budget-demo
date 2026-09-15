import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadDashboardData } from "@/services/loadDashboardData";
import { saveImport } from "@/services/importPersistence";
import { useDataStore } from "@/stores/useDataStore";
import type { ImportMemorise } from "@/services/importPersistence";
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

function memoImport(): ImportMemorise {
  return {
    transactions: [
      { date: "2026-06-01", montant: 99, label: "Importe" },
      { date: "2026-06-02", montant: 42, label: "Importe" },
    ] as unknown as ImportMemorise["transactions"],
    salary: salaryImporte,
    fileName: "Budget_demo.xlsx",
    importedAt: "2026-08-11T18:00:00.000Z",
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
    saveImport(memoImport());
    vi.stubGlobal("fetch", mockFetchOk());
    await loadDashboardData();
    const s = useDataStore.getState();
    expect(s.origin).toBe("upload");
    expect(s.transactions).toHaveLength(2);
    expect(s.importFileName).toBe("Budget_demo.xlsx");
    expect(s.importedAt).toBe("2026-08-11T18:00:00.000Z");
  });

  it("conserve la configuration du site, que le classeur ne contient pas", async () => {
    // C'est la raison de l'ordre : import APRÈS les fichiers, pas à la place.
    saveImport(memoImport());
    vi.stubGlobal("fetch", mockFetchOk());
    await loadDashboardData();
    expect(useDataStore.getState().config).toEqual(CONFIG);
  });

  it("affiche quand même l'import mémorisé si les fichiers sont injoignables", async () => {
    saveImport(memoImport());
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
    saveImport(memoImport());
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
