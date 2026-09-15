import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { saveImport, loadImport, clearImport } from "@/services/importPersistence";
import type { ImportMemorise } from "@/services/importPersistence";
import type { SalaryData } from "@/types";

/**
 * Mémorisation du dernier fichier importé.
 *
 * Besoin mesuré sur A56 le 11/08/2026 : onglet fermé puis rouvert, l'import
 * était perdu et il fallait recharger le classeur.
 */

const salaryFactice = { months: [], cotLast: [], patronLast: [], lastMonth: "2026-06" } as unknown as SalaryData;

function memo(over: Partial<ImportMemorise> = {}): ImportMemorise {
  return {
    transactions: [{ date: "2026-06-01", montant: 12 }] as unknown as ImportMemorise["transactions"],
    salary: salaryFactice,
    fileName: "Budget_demo.xlsx",
    importedAt: "2026-08-11T18:00:00.000Z",
    ...over,
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("importPersistence", () => {
  it("relit ce qui a été mémorisé", () => {
    expect(saveImport(memo())).toBe(true);
    const lu = loadImport();
    expect(lu?.fileName).toBe("Budget_demo.xlsx");
    expect(lu?.importedAt).toBe("2026-08-11T18:00:00.000Z");
    expect(lu?.transactions).toHaveLength(1);
  });

  it("rend null quand rien n'a été mémorisé", () => {
    expect(loadImport()).toBeNull();
  });

  it("oublie l'import après clearImport", () => {
    saveImport(memo());
    clearImport();
    expect(loadImport()).toBeNull();
  });

  it("remplace l'import précédent — un seul est conservé", () => {
    saveImport(memo({ fileName: "ancien.xlsx" }));
    saveImport(memo({ fileName: "nouveau.xlsx" }));
    expect(loadImport()?.fileName).toBe("nouveau.xlsx");
  });

  it("ignore un contenu tronqué plutôt que de peupler à moitié", () => {
    // Mieux vaut repartir des données du serveur qu'afficher un dashboard
    // incomplet sans le dire.
    localStorage.setItem("budget.import.v1", JSON.stringify({ transactions: [] }));
    expect(loadImport()).toBeNull();
  });

  it("ignore un contenu illisible sans lever d'exception", () => {
    localStorage.setItem("budget.import.v1", "{ ceci n'est pas du JSON");
    expect(() => loadImport()).not.toThrow();
    expect(loadImport()).toBeNull();
  });

  it("survit à un stockage saturé sans empêcher l'affichage", () => {
    // Le quota dépassé ne doit jamais faire échouer l'import en cours :
    // l'utilisateur voit ses données, elles ne sont simplement pas retenues.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(saveImport(memo())).toBe(false);
  });

  it("conserve le nom de fichier vide sans casser la relecture", () => {
    saveImport(memo({ fileName: "" }));
    expect(loadImport()?.fileName).toBe("");
  });
});
