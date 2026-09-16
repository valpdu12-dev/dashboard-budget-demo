// -- Hook useExcelWorker : connexion Web Worker <-> DataUploader <-> useDataStore --
// Instancie le worker parseExcel, gere les messages (progress/result/error),
// decode les transactions et expose parse/apply/reset au composant DataUploader.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataStore } from "@/stores/useDataStore";
import {
  construireJeuDepuisRapport,
  construireJeuAncienFormat,
  memoriserJeu,
} from "@/services/jeuDonnees";
import { decodeTransactions } from "@/utils/decode";
import { telechargerOctets, MIME_XLSX } from "@/utils/telechargement";
import { NOM_FICHIER_MODELE } from "@/services/modeleExcel";
import type { RapportImport, FormatDetecte } from "@/services/lectureClasseur";
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
  /** Rapport détaillé de l'import — seulement pour le format public. */
  rapport: RapportImport | null;
  /** Format reconnu dans le classeur, une fois la lecture faite. */
  format: FormatDetecte | null;
  progressStep: string;
  progressPct: number;
  validation: ValidationReport | null;
  pendingData: ParsedData | null;
  parse: (buffer: ArrayBuffer) => void;
  apply: (fileName?: string) => void;
  /** `null` tant que rien n'a été appliqué ; `false` si la mémorisation a échoué. */
  memorise: boolean | null;
  reset: () => void;
  /** Demande au worker de fabriquer le classeur modèle, puis le télécharge. */
  demanderModele: () => void;
  /** Vrai entre la demande de modèle et sa réception. */
  modeleEnCours: boolean;
}

export function useExcelWorker(): ExcelWorkerState {
  const workerRef = useRef<Worker | null>(null);
  const { poserJeu } = useDataStore();

  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [pendingData, setPendingData] = useState<ParsedData | null>(null);
  const [modeleEnCours, setModeleEnCours] = useState(false);
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  const [brut, setBrut] = useState<{ transactions: RawTransactionsJSON; salary: SalaryData } | null>(null);
  const [format, setFormat] = useState<FormatDetecte | null>(null);

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
          // La forme ENCODÉE est conservée telle quelle : c'est elle qui sera
          // mémorisée (cinq fois plus compacte que la forme décodée), et la
          // ré-encoder produirait une table de chaînes différente pour rien.
          setBrut({ transactions: raw, salary });
          setValidation(msg.validation as ValidationReport);
          setRapport((msg.rapport as RapportImport | null) ?? null);
          setFormat((msg.format as FormatDetecte | null) ?? null);
          setStatus("success");
          setProgressStep("Termine");
          setProgressPct(100);
        } else if (msg.type === "modele") {
          // Le modèle ne passe pas par `status` : il n'a rien à voir avec
          // l'import en cours, et le téléchargement ne doit pas effacer un
          // rapport de validation affiché à l'écran.
          setModeleEnCours(false);
          telechargerOctets(msg.octets as Uint8Array, NOM_FICHIER_MODELE, MIME_XLSX);
        } else if (msg.type === "modele-erreur") {
          setModeleEnCours(false);
          setError(msg.message);
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
      setRapport(null);
      setBrut(null);
      setFormat(null);
      setMemorise(null);
      setProgressStep("Demarrage...");
      setProgressPct(0);

      const w = getWorker();
      w.postMessage({ type: "parse", buffer });
    },
    [getWorker]
  );

  // Appliquer le jeu lu au store, et le memoriser pour les ouvertures
  // suivantes. Lot B.5 : c'est le JEU ENTIER qui est pose et memorise —
  // transactions, paie, configuration, objectifs, couverture et origine.
  const [memorise, setMemorise] = useState<boolean | null>(null);

  const apply = useCallback(
    (fileName?: string) => {
      if (!brut) return;
      // Deux chemins, un seul jeu. Le format public apporte sa configuration
      // (soldes, bornes, prêt) ; l'ancien format n'en porte aucune, et c'est
      // dit plutôt que comblé par celle du jeu précédent.
      const jeu = rapport
        ? construireJeuDepuisRapport(rapport, fileName ?? "")
        : construireJeuAncienFormat(brut.transactions, brut.salary, fileName ?? "");
      poserJeu(jeu);
      // Memorisation best-effort : un echec ne doit pas empecher l'affichage
      // des donnees qui viennent d'etre chargees. Mais il est RENDU, pour que
      // l'ecran puisse le dire au lieu de laisser croire que c'est conserve.
      setMemorise(memoriserJeu(jeu));
    },
    [rapport, brut, poserJeu]
  );

  // Demander la fabrication du classeur modele au worker
  const demanderModele = useCallback(() => {
    setModeleEnCours(true);
    setError(null);
    getWorker().postMessage({ type: "modele" });
  }, [getWorker]);

  // Reset complet
  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setProgressStep("");
    setProgressPct(0);
    setValidation(null);
    setPendingData(null);
    setRapport(null);
    setBrut(null);
    setFormat(null);
    setMemorise(null);
  }, []);

  return {
    status,
    error,
    rapport,
    format,
    progressStep,
    progressPct,
    validation,
    pendingData,
    parse,
    apply,
    reset,
    memorise,
    demanderModele,
    modeleEnCours,
  };
}
