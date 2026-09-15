import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadDashboardData } from "@/services/loadDashboardData";
import { saveImport } from "@/services/importPersistence";
import { useDataStore } from "@/stores/useDataStore";
import type { ImportMemorise } from "@/services/importPersistence";
import type { SalaryData, Config, Transaction } from "@/types";

/**
 * Origine des données (lot 0, étape 0.4).
 *
 * Le dashboard peut afficher des données venues de quatre endroits. Tant que
 * l'origine n'était pas stockée, un repli silencieux sur les fichiers du site
 * se présentait comme une réponse du serveur. Ces tests fixent la règle : une
 * origine par chemin réellement emprunté, et l'import qui l'emporte toujours.
 *
 * Lot A.4 — la démonstration n'appelle plus d'API. « api » reste au type,
 * pour que le code soit reportable tel quel côté privé, mais AUCUN chemin
 * de cette application ne le produit. C'est vérifié ci-dessous.
 */

const TX_SERVEUR = {
  fields: ["compte", "type", "date", "montant", "cat1", "cat2", "cat3", "cat4", "ville", "dc", "label"],
  s: ["Compte courant", "Courses", "Debit", "Serveur"],
  t: [[0, 1, "2026-01-01", 10, -1, -1, -1, -1, -1, 2, 3]],
};
const SALAIRE = { months: [], cotLast: [], patronLast: [], lastMonth: "2026-01" };
const CONFIG = { comptes: [] };

/** Répond au contenu attendu pour une URL de la cascade. */
function corps(url: string) {
  return url.includes("transactions") ? TX_SERVEUR
    : url.includes("salary") ? SALAIRE
      : CONFIG;
}

/** fetch qui répond à tout. */
function fetchToutOk() {
  return vi.fn((url: string) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(corps(url)) })
  );
}

/** fetch qui refuserait toute adresse /api/*, s'il en restait une. */
function fetchApiEnPanne() {
  return vi.fn((url: string) =>
    url.startsWith("/api")
      ? Promise.reject(new Error("API injoignable"))
      : Promise.resolve({ ok: true, json: () => Promise.resolve(corps(url)) })
  );
}

function memoImport(): ImportMemorise {
  return {
    transactions: [
      { date: "2026-06-01", montant: 99, label: "Importe" },
    ] as unknown as Transaction[],
    salary: SALAIRE as unknown as SalaryData,
    fileName: "mon-budget.xlsx",
    importedAt: "2026-08-11T18:00:00.000Z",
  };
}

beforeEach(() => {
  localStorage.clear();
  useDataStore.getState().reset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("origine des données — les quatre valeurs", () => {
  it("vaut « inconnue » tant que rien n'est chargé", () => {
    expect(useDataStore.getState().origin).toBe("inconnue");
  });

  it("vaut « static » quand les fichiers du site répondent", async () => {
    vi.stubGlobal("fetch", fetchToutOk());
    await loadDashboardData();
    expect(useDataStore.getState().origin).toBe("static");
  });

  it("vaut « static » même si toute adresse /api est en panne", async () => {
    // Le chargement ne doit rien attendre d'une API : couper /api ne change
    // strictement rien au résultat.
    vi.stubGlobal("fetch", fetchApiEnPanne());
    await loadDashboardData();
    const s = useDataStore.getState();
    expect(s.status).toBe("success");
    expect(s.origin).toBe("static");
  });

  it("ne vaut JAMAIS « api » : plus aucun chemin ne l'emprunte", async () => {
    vi.stubGlobal("fetch", fetchToutOk());
    await loadDashboardData();
    expect(useDataStore.getState().origin).not.toBe("api");
  });

  it("vaut « upload » dès qu'un fichier est importé", () => {
    useDataStore.getState().setUploadData(
      [] as Transaction[],
      SALAIRE as unknown as SalaryData,
      { fileName: "mon-budget.xlsx" }
    );
    expect(useDataStore.getState().origin).toBe("upload");
  });
});

describe("origine des données — règles de priorité", () => {
  it("l'import l'emporte sur un chargement statique réussi", async () => {
    saveImport(memoImport());
    vi.stubGlobal("fetch", fetchToutOk());
    await loadDashboardData();
    const s = useDataStore.getState();
    // Les fichiers du site ont bien répondu — la configuration en vient
    // toujours — mais les données affichées sont celles du classeur.
    expect(s.config).toEqual(CONFIG);
    expect(s.origin).toBe("upload");
  });

  it("l'import l'emporte aussi quand les fichiers sont injoignables", async () => {
    saveImport(memoImport());
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("hors ligne"))));
    await loadDashboardData();
    expect(useDataStore.getState().origin).toBe("upload");
  });

  it("revient à « static » une fois l'import oublié", async () => {
    saveImport(memoImport());
    vi.stubGlobal("fetch", fetchToutOk());
    await loadDashboardData();
    expect(useDataStore.getState().origin).toBe("upload");

    localStorage.clear(); // ce que fait « Revenir aux données par défaut »
    await loadDashboardData();
    expect(useDataStore.getState().origin).toBe("static");
  });
});

describe("origine des données — jamais devinée", () => {
  it("retombe sur « inconnue » si un appelant pose des données sans le dire", () => {
    useDataStore.getState().setData(
      [] as Transaction[],
      SALAIRE as unknown as SalaryData,
      CONFIG as unknown as Config
    );
    expect(useDataStore.getState().origin).toBe("inconnue");
  });

  it("repasse à « inconnue » après reset, même après un import", () => {
    useDataStore.getState().setUploadData(
      [] as Transaction[],
      SALAIRE as unknown as SalaryData
    );
    useDataStore.getState().reset();
    expect(useDataStore.getState().origin).toBe("inconnue");
  });

  it("une erreur de chargement ne fabrique pas d'origine", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("hors ligne"))));
    await loadDashboardData();
    const s = useDataStore.getState();
    expect(s.status).toBe("error");
    expect(s.origin).toBe("inconnue");
  });
});
