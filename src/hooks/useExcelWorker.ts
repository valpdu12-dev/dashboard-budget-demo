// -- Hook useExcelWorker : connexion Web Worker <-> DataUploader <-> useDataStore --
// Instancie le worker parseExcel, gere les messages (progress/result/error),
// decode les transactions et expose parse/apply/reset au composant DataUploader.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { saveImport } from "@/services/importPersistence";
import { decodeTransactions } from "@/utils/decode";
import type { Transaction, RawTransactionsJSON, SalaryData } from "@/types";

// -- Types pour les messages du Worker --

export type UploadStatus = "idle" | "loading" | "success" | "error";

export interface ValidationReport {
  ok: boolean;
  nbTransactions: number;
  dateMin: string;
  dateMax: string;
  nbMois: number;
  comptes: string[];
  totalDebits: number;
  totalCredits: number;
  net: number;
  nbSalaryMonths: number;
  lastSalaryMonth: string;
  lastNetSalary: number;
}

interface ParsedData {
  transactions: Transaction[];
  salary: SalaryData;
}

export interface ExcelWorkerState {
  status: UploadStatus;
  error: string | null;
  progressStep: string;
  progressPct: number;
  validation: ValidationReport | null;
  pendingData: ParsedData | null;
  parse: (buffer: ArrayBuffer) => void;
  apply: (fileName?: string) => void;
  reset: () => void;
}

export function useExcelWorker(): ExcelWorkerState {
  const workerRef = useRef<Worker | null>(null);
  const { setUploadData } = useDataStore();

  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [pendingData, setPendingData] = useState<ParsedData | null>(null);

  // Initialisation lazy du worker
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("@/components/upload/parseExcel.worker.ts", import.meta.url),
        { type: "module" }
      );

      workerRef.current.onmessage = (event: MessageEvent) => {
        const msg = event.data;

        if (msg.type === "progress") {
          setProgressStep(msg.step);
          setProgressPct(msg.pct);
        } else if (msg.type === "result") {
          // Decoder les transactions depuis le format dictionnaire
          const raw = msg.transactions as RawTransactionsJSON;
          const decoded = decodeTransactions(raw);
          const salary = msg.salary as SalaryData;

          setPendingData({ transactions: decoded, salary });
          setValidation(msg.validation as ValidationReport);
          setStatus("success");
          setProgressStep("Termine");
          setProgressPct(100);
        } else if (msg.type === "error") {
          setError(msg.message);
          setStatus("error");
        }
      };

      workerRef.current.onerror = (ev) => {
        setError(ev.message || "Erreur inconnue du worker");
        setStatus("error");
      };
    }
    return workerRef.current;
  }, []);

  // Cleanup a la destruction du composant
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Envoyer un buffer au worker pour parsing
  const parse = useCallback(
    (buffer: ArrayBuffer) => {
      setStatus("loading");
      setError(null);
      setValidation(null);
      setPendingData(null);
      setProgressStep("Demarrage...");
      setProgressPct(0);

      const w = getWorker();
      w.postMessage({ type: "parse", buffer });
    },
    [getWorker]
  );

  // Appliquer les donnees parsees au store global, et les memoriser pour les
  // ouvertures suivantes du dashboard (arbitrage du 11/08 : au demarrage, le
  // dernier fichier importe est affiche, et il est conserve jusqu'au suivant).
  const apply = useCallback(
    (fileName?: string) => {
      if (!pendingData) return;
      const importedAt = new Date().toISOString();
      setUploadData(pendingData.transactions, pendingData.salary, {
        fileName, importedAt,
      });
      // Memorisation best-effort : un echec de stockage ne doit pas empecher
      // l'affichage des donnees qui viennent d'etre chargees.
      saveImport({
        transactions: pendingData.transactions,
        salary: pendingData.salary,
        fileName: fileName ?? "",
        importedAt,
      });
    },
    [pendingData, setUploadData]
  );

  // Reset complet
  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setProgressStep("");
    setProgressPct(0);
    setValidation(null);
    setPendingData(null);
  }, []);

  return {
    status,
    error,
    progressStep,
    progressPct,
    validation,
    pendingData,
    parse,
    apply,
    reset,
  };
}
