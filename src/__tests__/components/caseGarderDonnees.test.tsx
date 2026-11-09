// DM-01 (A6) — décision Q1 du 09/11/2026 : la case « Garder ces données sur
// cet appareil » est DÉCOCHÉE par défaut. Sur un ordinateur partagé, un budget
// importé ne doit pas rester dans le navigateur sans un geste explicite.
//
// Le lecteur Excel (un Web Worker) est remplacé par un faux qui a déjà lu un
// fichier : on teste la fenêtre, pas la lecture.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const apply = vi.fn();

vi.mock("@/hooks/useExcelWorker", () => ({
  useExcelWorker: () => ({
    status: "success",
    error: null,
    rapport: null,
    format: null,
    progressStep: "",
    progressPct: 100,
    validation: {
      ok: true, nbTransactions: 1, dateMin: "2025-03-15", dateMax: "2025-03-15",
      nbMois: 1, comptes: ["Banque A - Courant"], totalDebits: 50, totalCredits: 0, net: -50,
      nbSalaryMonths: 1, lastSalaryMonth: "2025-03", lastNetSalary: 2800,
    },
    pendingData: { transactions: [], salary: [] },
    parse: vi.fn(),
    apply,
    reset: vi.fn(),
    memorise: null,
  }),
}));

import { DataUploader } from "@/components/upload/DataUploader";
import { useUIStore } from "@/stores/useUIStore";

beforeEach(() => {
  apply.mockClear();
  useUIStore.setState({ uploaderOpen: true });
});
afterEach(() => useUIStore.setState({ uploaderOpen: false }));

const laCase = () => screen.getByRole("checkbox", { name: /Garder ces données sur cet appareil/ });
const appliquer = () => screen.getByRole("button", { name: /Appliquer au dashboard/ });

describe("case « Garder ces données sur cet appareil » (DM-01 A6)", () => {
  it("est décochée à l'ouverture de la fenêtre", () => {
    render(<DataUploader />);
    expect(laCase()).not.toBeChecked();
  });

  it("sans geste, « Appliquer » ne demande pas de mémoriser", async () => {
    render(<DataUploader />);
    await userEvent.click(appliquer());
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0][1]).toBe(false);
  });

  it("cochée, « Appliquer » demande de mémoriser", async () => {
    render(<DataUploader />);
    await userEvent.click(laCase());
    await userEvent.click(appliquer());
    expect(apply.mock.calls[0][1]).toBe(true);
  });

  it("dit quoi faire sur un ordinateur partagé", () => {
    render(<DataUploader />);
    expect(laCase().closest("label")?.textContent).toMatch(/Sur un ordinateur partagé, ne cochez pas/);
  });
});
