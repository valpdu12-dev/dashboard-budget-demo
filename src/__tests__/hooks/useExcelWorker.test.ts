import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExcelWorker } from "@/hooks/useExcelWorker";
import { useDataStore } from "@/stores/useDataStore";
import { resetDataStore } from "../helpers/storeReset";
import type { RawTransactionsJSON, SalaryData } from "@/types";

// ── Mock du Web Worker ──────────────────────────────────────────────────────
// useExcelWorker instancie new Worker(...) → on mock globalement
type WorkerMockInstance = {
  onmessage: ((e: MessageEvent) => void) | null;
  onerror:   ((e: ErrorEvent) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate:   ReturnType<typeof vi.fn>;
  simulateMessage: (data: unknown) => void;
  simulateError:   (msg: string) => void;
};

let workerInstance: WorkerMockInstance | null = null;

class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror:   ((e: ErrorEvent) => void) | null   = null;
  postMessage = vi.fn();
  terminate   = vi.fn();

  constructor() {
    workerInstance = this as unknown as WorkerMockInstance;
    (workerInstance as WorkerMockInstance).simulateMessage = (data: unknown) => {
      this.onmessage?.({ data } as MessageEvent);
    };
    (workerInstance as WorkerMockInstance).simulateError = (msg: string) => {
      this.onerror?.({ message: msg } as ErrorEvent);
    };
  }
}

const originalWorker = globalThis.Worker;
beforeEach(() => {
  resetDataStore();
  workerInstance = null;
  // @ts-expect-error — mock du Worker global
  globalThis.Worker = MockWorker;
});
afterEach(() => {
  globalThis.Worker = originalWorker;
});

// Données minimales pour simuler un résultat valide
const MOCK_RAW: RawTransactionsJSON = {
  s: ["Banque A - Courant", "CB", "Dépense Courante", "Alimentation", "Supermarché", "", "Débit"],
  t: [[0, 1, "2025-03-15", 50, 2, 3, 4, -1, -1, 6, -1]],
};
const MOCK_SALARY: SalaryData = {
  months: [{ mk: "2025-03", entreprise: "Employeur E", brut: 3500, net: 2800, cotSal: 700, indem: 0, retenues: 0 }],
  cotLast: [],
  patronLast: [],
};
const MOCK_VALIDATION = {
  ok: true, nbTransactions: 1, dateMin: "2025-03-15", dateMax: "2025-03-15",
  nbMois: 1, comptes: ["Banque A - Courant"], totalDebits: 50, totalCredits: 0, net: -50,
  nbSalaryMonths: 1, lastSalaryMonth: "2025-03", lastNetSalary: 2800,
};

describe("useExcelWorker — état initial", () => {
  it("démarre en état idle", () => {
    const { result } = renderHook(() => useExcelWorker());
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.progressPct).toBe(0);
    expect(result.current.validation).toBeNull();
    expect(result.current.pendingData).toBeNull();
  });
});

describe("useExcelWorker — parse()", () => {
  it("passe en status loading et envoie le buffer au worker", () => {
    const { result } = renderHook(() => useExcelWorker());
    const buf = new ArrayBuffer(8);

    act(() => { result.current.parse(buf); });

    expect(result.current.status).toBe("loading");
    expect(result.current.error).toBeNull();
    expect(workerInstance?.postMessage).toHaveBeenCalledWith({ type: "parse", buffer: buf });
  });

  it("met à jour progressStep et progressPct sur message 'progress'", () => {
    const { result } = renderHook(() => useExcelWorker());
    act(() => { result.current.parse(new ArrayBuffer(4)); });

    act(() => {
      workerInstance?.simulateMessage({ type: "progress", step: "Lecture...", pct: 40 });
    });

    expect(result.current.progressStep).toBe("Lecture...");
    expect(result.current.progressPct).toBe(40);
    expect(result.current.status).toBe("loading"); // toujours loading
  });

  it("passe en success et stocke pendingData + validation sur message 'result'", () => {
    const { result } = renderHook(() => useExcelWorker());
    act(() => { result.current.parse(new ArrayBuffer(4)); });

    act(() => {
      workerInstance?.simulateMessage({
        type: "result",
        transactions: MOCK_RAW,
        salary: MOCK_SALARY,
        validation: MOCK_VALIDATION,
      });
    });

    expect(result.current.status).toBe("success");
    expect(result.current.validation?.ok).toBe(true);
    expect(result.current.pendingData?.transactions).toHaveLength(1);
    expect(result.current.progressPct).toBe(100);
  });

  it("passe en error sur message 'error'", () => {
    const { result } = renderHook(() => useExcelWorker());
    act(() => { result.current.parse(new ArrayBuffer(4)); });

    act(() => {
      workerInstance?.simulateMessage({ type: "error", message: "Format invalide" });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Format invalide");
  });

  it("passe en error sur onerror du worker", () => {
    const { result } = renderHook(() => useExcelWorker());
    act(() => { result.current.parse(new ArrayBuffer(4)); });

    act(() => {
      workerInstance?.simulateError("Worker crash");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Worker crash");
  });
});

describe("useExcelWorker — apply()", () => {
  it("appelle setUploadData dans le store quand pendingData est défini", () => {
    const { result } = renderHook(() => useExcelWorker());

    // Simuler un résultat complet
    act(() => { result.current.parse(new ArrayBuffer(4)); });
    act(() => {
      workerInstance?.simulateMessage({
        type: "result",
        transactions: MOCK_RAW,
        salary: MOCK_SALARY,
        validation: MOCK_VALIDATION,
      });
    });
    expect(result.current.status).toBe("success");

    act(() => { result.current.apply(); });

    const store = useDataStore.getState();
    expect(store.status).toBe("success");
    expect(store.origin).toBe("upload");
    expect(store.transactions).toHaveLength(1);
  });

  it("ne fait rien quand pendingData est null", () => {
    const { result } = renderHook(() => useExcelWorker());
    act(() => { result.current.apply(); }); // pas de parse avant
    expect(useDataStore.getState().transactions).toHaveLength(0);
  });
});

describe("useExcelWorker — reset()", () => {
  it("remet tous les états à leurs valeurs initiales", () => {
    const { result } = renderHook(() => useExcelWorker());
    act(() => { result.current.parse(new ArrayBuffer(4)); });
    act(() => {
      workerInstance?.simulateMessage({ type: "error", message: "Erreur" });
    });

    expect(result.current.status).toBe("error");
    act(() => { result.current.reset(); });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.progressPct).toBe(0);
    expect(result.current.progressStep).toBe("");
    expect(result.current.validation).toBeNull();
    expect(result.current.pendingData).toBeNull();
  });
});

describe("useExcelWorker — cleanup", () => {
  it("appelle terminate() sur le worker au démontage", () => {
    const { result, unmount } = renderHook(() => useExcelWorker());
    act(() => { result.current.parse(new ArrayBuffer(4)); }); // initialise le worker
    const w = workerInstance;
    unmount();
    expect(w?.terminate).toHaveBeenCalled();
  });
});
