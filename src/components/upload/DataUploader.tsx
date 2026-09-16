// -- DataUploader modal (V1: 693 lignes -> V2: Tailwind + Lucide + Zustand + Web Worker) --

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileSpreadsheet, Check, X, AlertCircle, Loader2, Download, FileDown,
} from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { useDataStore } from "@/stores/useDataStore";
import { afficherDemo, afficherMesDonnees, effacerMesDonnees } from "@/services/basculeProfil";
import { jeuPersonnelDisponible } from "@/services/profil";
import { fmtImportOrigine } from "@/utils/importLabel";
import { useExcelWorker, type ValidationReport } from "@/hooks/useExcelWorker";
import type { RapportImport } from "@/services/lectureClasseur";
import { MONTHS_FR } from "@/config/constants";

// ---------------------------------------------------------------------------
// CONSTANTES
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_B = MAX_FILE_SIZE_MB * 1024 * 1024;

// ---------------------------------------------------------------------------
// UTILITAIRES DE FORMATAGE
// ---------------------------------------------------------------------------

function fmtEuro(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "0,00 €";
  const neg = v < 0;
  const abs = Math.abs(v).toFixed(2);
  const [i, d] = abs.split(".");
  const ig = i.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (neg ? "−" : "") + ig + "," + d + " €";
}

function fmtDate(iso: string | undefined): string {
  if (!iso || iso === "—") return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtMonthKey(mk: string | undefined): string {
  if (!mk) return "—";
  const [y, m] = mk.split("-");
  return MONTHS_FR[parseInt(m) - 1] + " " + y;
}

function validateFile(file: File | null): string | null {
  if (!file) return "Aucun fichier selectionne.";
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return `Format non pris en charge : "${file.name}". Seuls les fichiers .xlsx sont acceptes.`;
  }
  if (file.size > MAX_FILE_SIZE_B) {
    return `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Taille maximum : ${MAX_FILE_SIZE_MB} Mo.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// SOUS-COMPOSANT : Carte KPI pour le resume de validation
// ---------------------------------------------------------------------------

function ValidationKPI({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  const valueColor =
    positive === true
      ? "text-green"
      : positive === false
        ? "text-red"
        : "text-text";

  return (
    <div className="bg-bg border border-border rounded-lg px-4 py-3">
      <div className="text-[11px] text-text-sec uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className={`text-xl font-bold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-text-sec mt-0.5">{sub}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SOUS-COMPOSANT : Rapport de lecture (format public)
// ---------------------------------------------------------------------------

/** Situe une anomalie : feuille, ligne, colonne. */
function situer(a: RapportImport["anomalies"][number]): string {
  const bouts = [a.feuille];
  if (a.ligne !== undefined) bouts.push(`ligne ${a.ligne}`);
  if (a.colonne) bouts.push(`colonne ${a.colonne}`);
  return bouts.join(" — ");
}

/**
 * Le rapport ligne à ligne.
 *
 * Il est montré AVANT d'appliquer quoi que ce soit : c'est tout l'intérêt de
 * l'aperçu. Une ligne rejetee sans emplacement serait inexploitable — la
 * personne doit pouvoir ouvrir son classeur et aller a la ligne.
 */
export function RapportImportVue({ r }: { r: RapportImport }) {
  const c = r.compteurs;
  const aDesParametres =
    r.parametres.couverture !== null ||
    r.parametres.pret !== null ||
    Object.keys(r.parametres.soldes).length > 0;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2 text-[12px]">
        <span className="px-2.5 py-1 rounded-md bg-green/[0.10] border border-green/25 text-green">
          {c.acceptees} acceptée{c.acceptees > 1 ? "s" : ""}
        </span>
        <span className={`px-2.5 py-1 rounded-md border ${c.rejetees > 0 ? "bg-red/[0.10] border-red/25 text-red" : "bg-border/30 border-border text-text-sec"}`}>
          {c.rejetees} rejetée{c.rejetees > 1 ? "s" : ""}
        </span>
        <span className="px-2.5 py-1 rounded-md bg-border/30 border border-border text-text-sec">
          {c.ignorees} ignorée{c.ignorees > 1 ? "s" : ""}
        </span>
        <span className={`px-2.5 py-1 rounded-md border ${c.avertissements > 0 ? "bg-amber/[0.10] border-amber/25 text-amber" : "bg-border/30 border-border text-text-sec"}`}>
          {c.avertissements} avertissement{c.avertissements > 1 ? "s" : ""}
        </span>
      </div>

      {r.anomalies.length > 0 && (
        <div className="mt-3 max-h-[220px] overflow-y-auto border border-border rounded-lg divide-y divide-border">
          {r.anomalies.map((a, i) => (
            <div key={i} className="px-3 py-2 text-[12px] leading-relaxed">
              <span className={a.gravite === "rejet" ? "text-red font-semibold" : "text-amber font-semibold"}>
                {a.gravite === "rejet" ? "Rejetée" : "Avertissement"}
              </span>
              <span className="text-text-sec"> · {situer(a)}</span>
              <div className="text-text-sec/90 mt-0.5">{a.message}</div>
            </div>
          ))}
        </div>
      )}

      {r.anomaliesNonListees > 0 && (
        <p className="text-[12px] text-text-sec mt-2">
          {r.anomaliesNonListees} autre{r.anomaliesNonListees > 1 ? "s" : ""} anomalie
          {r.anomaliesNonListees > 1 ? "s" : ""} comptée{r.anomaliesNonListees > 1 ? "s" : ""} mais
          non listée{r.anomaliesNonListees > 1 ? "s" : ""}.
        </p>
      )}

      {aDesParametres && (
        <p className="text-[12px] text-text-sec mt-3 px-3 py-2 bg-border/20 border border-border rounded-lg leading-relaxed">
          Votre feuille « Paramètres » a bien été lue. Les soldes de départ, les
          dates de relevé et le prêt ne sont pas encore repris par le tableau de
          bord : seules les transactions et la paie le sont aujourd'hui.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SOUS-COMPOSANT : Barre de progression
// ---------------------------------------------------------------------------

function ProgressBar({ pct, step }: { pct: number; step: string }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs text-text-sec mb-1.5">
        <span>{step}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SOUS-COMPOSANT : Resume de validation
// ---------------------------------------------------------------------------

function ValidationSummary({ v }: { v: ValidationReport }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-text-sec uppercase tracking-wide mb-4">
        Resume de validation
      </h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
        <ValidationKPI
          label="Transactions"
          value={v.nbTransactions.toLocaleString("fr-FR")}
          sub={`sur ${v.nbMois} mois`}
        />
        <ValidationKPI
          label="Periode"
          value={fmtDate(v.dateMin)}
          sub={`→ ${fmtDate(v.dateMax)}`}
        />
        <ValidationKPI
          label="Total Debits"
          value={fmtEuro(v.totalDebits)}
          positive={false}
        />
        <ValidationKPI
          label="Total Credits"
          value={fmtEuro(v.totalCredits)}
          positive={true}
        />
        <ValidationKPI
          label="Net"
          value={fmtEuro(v.net)}
          positive={v.net >= 0}
        />
        <ValidationKPI
          label="Salaires"
          value={`${v.nbSalaryMonths} mois`}
          sub={`dernier : ${fmtMonthKey(v.lastSalaryMonth)}`}
        />
        <ValidationKPI
          label="Net dernier mois"
          value={fmtEuro(v.lastNetSalary)}
          positive={true}
        />
      </div>
      {v.comptes.length > 0 && (
        <div className="mt-3">
          <span className="text-xs text-text-sec">Comptes detectes : </span>
          {v.comptes.map((c) => (
            <span
              key={c}
              className="inline-block mr-1.5 mb-1 px-2 py-0.5 bg-indigo/10 border border-indigo/25 rounded-xl text-[11px] text-indigo-text"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPOSANT PRINCIPAL : DataUploader
// ---------------------------------------------------------------------------

export function DataUploader() {
  const { uploaderOpen, setUploaderOpen } = useUIStore();
  const { origin, importedAt, importFileName } = useDataStore();
  const isFromUpload = origin === "upload";
  const worker = useExcelWorker();

  const {
    status, error: workerError, progressStep, progressPct,
    validation, pendingData, parse, apply, reset,
    demanderModele, modeleEnCours, rapport, memorise,
  } = worker;

  const isLoading = status === "loading";
  const isSuccess = status === "success";
  const isError = status === "error";

  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [applied, setApplied] = useState(false);
  // Lot B.6 — « Garder ces donnees sur cet appareil », cochee par defaut.
  // Cochee par defaut parce que fermer l'onglet et tout reperdre serait une
  // surprise ; decochable parce que sur un poste partage, ecrire le budget de
  // quelqu'un dans le navigateur sans le lui demander n'est pas acceptable.
  const [garder, setGarder] = useState(true);
  const [confirmEffacement, setConfirmEffacement] = useState(false);
  // Un jeu importe est-il memorise ? Se lit dans le stockage, qui ne previent
  // personne : on relit apres chaque geste qui peut l'avoir change.
  const [personnelDispo, setPersonnelDispo] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (uploaderOpen) {
      setLocalError(null);
      setIsDragging(false);
      setApplied(false);
      setGarder(true);
      setConfirmEffacement(false);
      setPersonnelDispo(jeuPersonnelDisponible());
    }
  }, [uploaderOpen]);

  useEffect(() => {
    if (!uploaderOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUploaderOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [uploaderOpen, setUploaderOpen]);

  const processFile = useCallback(
    (file: File) => {
      setApplied(false);
      const err = validateFile(file);
      if (err) {
        setLocalError(err);
        setSelectedFile(null);
        return;
      }
      setLocalError(null);
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          parse(e.target.result);
          return;
        }
        // Sans cette branche, un résultat d'un autre type ne produisait
        // strictement rien : ni erreur, ni message, la roue tournant
        // indéfiniment (point ouvert n° 24).
        setLocalError(
          "Le fichier a ete lu mais son contenu est inexploitable. " +
          "Verifiez qu'il s'agit bien d'un classeur .xlsx."
        );
      };
      reader.onerror = () => {
        // Cause de loin la plus fréquente sur Android : le fichier a été choisi
        // depuis Drive ou une pièce jointe sans être présent sur l'appareil.
        // Android ne fournit alors qu'une référence, et la lecture échoue.
        // « Réessayez » invitait à refaire exactement ce qui venait d'échouer
        // (point ouvert n° 26).
        setLocalError(
          "Impossible de lire le fichier. S'il vient de Drive, d'un mail ou " +
          "d'un autre service en ligne, telechargez-le d'abord sur l'appareil " +
          "puis choisissez-le depuis le dossier Telechargements."
        );
      };
      reader.readAsArrayBuffer(file);
    },
    [parse]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  const handleApply = useCallback(() => {
    apply(selectedFile?.name, garder);
    setApplied(true);
    setPersonnelDispo(jeuPersonnelDisponible());
  }, [apply, selectedFile, garder]);

  // Lot B.6 — trois gestes, et un seul detruit quelque chose.
  //
  // Avant, « Revenir aux donnees par defaut » effacait l'import memorise : un
  // aller sans retour, sous un libelle qui n'annoncait rien de tel. Revenir a
  // la demonstration ne fait plus que changer ce qui est AFFICHE.
  //
  // Chacun rappelle `loadDashboardData` via le service de bascule : sans ce
  // rechargement le dashboard resterait vide jusqu'a un rafraichissement
  // manuel — le `useEffect` d'App.tsx ne se rejoue pas, ses dependances etant
  // des references Zustand stables (constate sur A56 le 11/08/2026).
  const nettoyerEcran = useCallback(() => {
    reset();
    setSelectedFile(null);
    setLocalError(null);
    setApplied(false);
  }, [reset]);

  const handleRevenirDemo = useCallback(() => {
    nettoyerEcran();
    setConfirmEffacement(false);
    void afficherDemo().finally(() => setPersonnelDispo(jeuPersonnelDisponible()));
  }, [nettoyerEcran]);

  const handleAfficherMesDonnees = useCallback(() => {
    nettoyerEcran();
    void afficherMesDonnees();
  }, [nettoyerEcran]);

  const handleEffacer = useCallback(() => {
    nettoyerEcran();
    setConfirmEffacement(false);
    void effacerMesDonnees().finally(() => setPersonnelDispo(jeuPersonnelDisponible()));
  }, [nettoyerEcran]);

  const onClose = useCallback(() => setUploaderOpen(false), [setUploaderOpen]);

  if (!uploaderOpen) return null;

  const dropBorderClass = isDragging
    ? "border-indigo"
    : isSuccess
      ? "border-green"
      : isError
        ? "border-red"
        : "border-border";

  const dropBgClass = isDragging ? "bg-indigo/5" : "bg-border/30";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-[680px] max-h-[90vh] overflow-y-auto shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-lg font-title font-bold text-text">
              Charger un nouveau fichier
            </h2>
            <p className="text-[13px] text-text-sec mt-1">
              Importez votre classeur <strong className="text-text/70">.xlsx</strong> pour
              mettre à jour le tableau de bord. Le nom du fichier n'a aucune
              importance : c'est la structure des feuilles qui compte.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-text-sec hover:text-text transition-colors" aria-label="Fermer">
            <X size={22} />
          </button>
        </div>

        <div className="p-6">
          {/* Profil affiche — lot B.6 */}
          {isFromUpload ? (
            <div className="flex items-start gap-2 px-3.5 py-2.5 bg-green/[0.08] border border-green/20 rounded-lg mb-5 text-[13px] text-green">
              <Check size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p>Le dashboard affiche {fmtImportOrigine(importFileName, importedAt)}.</p>
                {confirmEffacement ? (
                  <>
                    <p className="text-text-sec mt-1.5 leading-relaxed">
                      Seront supprimés de cet appareil : le fichier importé, les
                      objectifs de budget que vous avez modifiés, et ce choix
                      d'affichage. Votre classeur, lui, n'est pas touché.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={handleEffacer}
                        className="px-3 py-1.5 max-md:min-h-tap rounded-lg border border-red/40 bg-red/[0.08] text-red text-[12px] font-medium hover:bg-red/[0.15] transition-colors"
                      >
                        Confirmer l'effacement
                      </button>
                      <button
                        onClick={() => setConfirmEffacement(false)}
                        className="px-3 py-1.5 max-md:min-h-tap rounded-lg border border-border text-text-sec text-[12px] font-medium hover:text-text transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={handleRevenirDemo}
                      title="Vos données restent mémorisées : vous pourrez revenir dessus"
                      className="px-3 py-1.5 max-md:min-h-tap rounded-lg border border-border bg-surface text-text-sec text-[12px] font-medium hover:text-text transition-colors"
                    >
                      Revenir à la démo
                    </button>
                    <button
                      onClick={() => setConfirmEffacement(true)}
                      className="px-3 py-1.5 max-md:min-h-tap rounded-lg border border-border bg-surface text-text-sec text-[12px] font-medium hover:text-red transition-colors"
                    >
                      Effacer mes données
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : personnelDispo ? (
            <div className="flex items-start gap-2 px-3.5 py-2.5 bg-indigo/[0.08] border border-indigo/25 rounded-lg mb-5 text-[13px] text-text-sec">
              <FileSpreadsheet size={16} className="shrink-0 mt-0.5 text-indigo-text" />
              <div className="flex-1 min-w-0">
                <p>
                  Le dashboard affiche la <strong className="text-text">démonstration</strong>.
                  Un fichier que vous avez importé est mémorisé sur cet appareil.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={handleAfficherMesDonnees}
                    className="px-3 py-1.5 max-md:min-h-tap rounded-lg border border-indigo/40 bg-indigo/[0.08] text-indigo-text text-[12px] font-medium hover:bg-indigo/[0.15] transition-colors"
                  >
                    Afficher mes données
                  </button>
                  <button
                    onClick={handleEffacer}
                    className="px-3 py-1.5 max-md:min-h-tap rounded-lg border border-border bg-surface text-text-sec text-[12px] font-medium hover:text-red transition-colors"
                  >
                    Effacer mes données
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Zone drag & drop */}
          <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isLoading && inputRef.current?.click()}
            className={`border-2 border-dashed ${dropBorderClass} rounded-xl px-6 py-10 flex flex-col items-center gap-3 ${dropBgClass} text-center ${isLoading ? "cursor-default" : "cursor-pointer"} transition-all duration-200`}
          >
            <input ref={inputRef} type="file" accept=".xlsx" onChange={handleInputChange} className="hidden" />

            {isLoading ? (
              <Loader2 size={48} className="text-indigo-text animate-spin" />
            ) : isSuccess ? (
              <Check size={48} className="text-green" />
            ) : isError ? (
              <AlertCircle size={48} className="text-red" />
            ) : (
              <Upload size={48} className={isDragging ? "text-indigo-text" : "text-text-sec/60"} />
            )}

            <div>
              {isLoading ? (
                <p className="text-[15px] text-text-sec">Analyse du fichier en cours...</p>
              ) : isSuccess && selectedFile ? (
                <div className="flex items-center gap-2 justify-center">
                  <FileSpreadsheet size={18} className="text-green" />
                  <span className="text-[15px] text-text font-semibold">{selectedFile.name}</span>
                  <span className="text-[13px] text-text-sec">({(selectedFile.size / 1024).toFixed(0)} Ko)</span>
                </div>
              ) : isDragging ? (
                <p className="text-[15px] text-indigo-text font-semibold">Relachez pour charger le fichier</p>
              ) : (
                <p className="text-[15px] text-text-sec">
                  <span className="text-indigo-text font-semibold">Cliquez pour selectionner</span>{" "}ou deposez votre fichier ici
                </p>
              )}
              {!isLoading && !isDragging && (
                <p className="text-xs text-text-sec/60 mt-1.5">
                  Fichiers acceptes : .xlsx {"—"} Taille max : {MAX_FILE_SIZE_MB} Mo
                </p>
              )}
            </div>
          </div>

          {/* Modele de fichier source (lot B.1) */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 px-3.5 py-2.5 bg-border/20 border border-border rounded-lg">
            <p className="text-[12px] text-text-sec leading-relaxed">
              Première fois ? Téléchargez le modèle : trois mois d'exemple, les
              colonnes attendues, et un mode d'emploi dans la première feuille.
            </p>
            <button
              onClick={demanderModele}
              disabled={modeleEnCours}
              className="flex items-center gap-1.5 px-3.5 py-2 max-md:min-h-tap rounded-lg border border-indigo/40 bg-indigo/[0.08] text-indigo-text text-[13px] font-medium hover:bg-indigo/[0.15] disabled:opacity-60 transition-colors"
            >
              {modeleEnCours
                ? <Loader2 size={15} className="animate-spin" />
                : <FileDown size={15} />}
              Télécharger le modèle
            </button>
          </div>

          {/* Barre de progression */}
          {isLoading && <ProgressBar pct={progressPct} step={progressStep} />}

          {/* Erreur */}
          {(localError || (isError && workerError)) && (
            <div className="flex items-start gap-2.5 mt-4 px-4 py-3 bg-red/[0.08] border border-red/25 rounded-lg">
              <AlertCircle size={18} className="text-red shrink-0 mt-0.5" />
              <p className="text-[13px] text-red/80 leading-relaxed">{localError || workerError}</p>
            </div>
          )}

          {/* Validation */}
          {isSuccess && validation && (
            <>
              <ValidationSummary v={validation} />
              {rapport && <RapportImportVue r={rapport} />}
              {/*
                Lot B.6 — la memorisation devient un choix, montre avant
                d'appliquer. Cochee par defaut : le comportement d'avant reste
                celui qui se produit si on ne fait rien.
              */}
              {pendingData && !applied && (
                <label className="flex items-start gap-2.5 mt-3 px-3.5 py-2.5 bg-border/20 border border-border rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={garder}
                    onChange={(e) => setGarder(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-indigo shrink-0"
                  />
                  <span className="text-[12px] text-text-sec leading-relaxed">
                    <span className="text-text font-medium">Garder ces données sur cet appareil.</span>{" "}
                    Elles restent dans ce navigateur — rien n'est envoyé nulle part.
                    Décochez sur un ordinateur partagé : le tableau de bord
                    reviendra à la démonstration dès la fermeture de l'onglet.
                  </span>
                </label>
              )}
              {applied && !garder && (
                <div
                  role="status"
                  className="flex items-start gap-2 mt-3 px-3.5 py-2.5 bg-border/20 border border-border rounded-lg text-[13px] text-text-sec"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Ces données ne sont pas conservées, comme vous l'avez demandé.
                    À la fermeture de l'onglet, le tableau de bord reviendra à la
                    démonstration.
                  </span>
                </div>
              )}
              {applied && (
                <div className="flex items-center gap-2 mt-3 px-3.5 py-2.5 bg-green/[0.08] border border-green/20 rounded-lg text-[13px] text-green">
                  <Check size={16} />
                  <span>Donnees appliquees avec succes. Le dashboard est maintenant a jour.</span>
                </div>
              )}
              {/*
                Lot B.5 — la memorisation peut echouer : navigation privee,
                stockage desactive, quota depasse. L'avaler laisserait croire
                que le fichier sera encore la a la prochaine ouverture.
              */}
              {applied && garder && memorise === false && (
                <div
                  role="status"
                  className="flex items-start gap-2 mt-3 px-3.5 py-2.5 bg-amber/[0.08] border border-amber/25 rounded-lg text-[13px] text-amber"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Ces données ne sont pas mémorisées : votre navigateur a
                    refusé l'écriture.{" "}
                    <span className="text-text-sec">
                      Elles restent affichées jusqu'à la fermeture de l'onglet ;
                      il faudra ensuite réimporter le fichier.
                    </span>
                  </span>
                </div>
              )}
            </>
          )}

          {/* Boutons */}
          <div className="flex flex-wrap gap-2.5 mt-6 justify-end">
            {isError && (
              <button
                onClick={() => { setLocalError(null); setSelectedFile(null); inputRef.current?.click(); }}
                className="px-4 py-2.5 rounded-lg border border-border text-text-sec text-sm font-medium hover:text-text transition-colors"
              >
                Reessayer
              </button>
            )}

            {isSuccess && pendingData && (
              <button
                onClick={() => {
                  const payload = JSON.stringify({ transactions: pendingData.transactions, salary: pendingData.salary }, null, 2);
                  const blob = new Blob([payload], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "budget_data.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-indigo/40 bg-indigo/[0.08] text-indigo-text text-sm font-medium hover:bg-indigo/[0.15] transition-colors"
              >
                <Download size={16} />
                Exporter en JSON
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-border text-text-sec text-sm font-medium hover:text-text transition-colors"
            >
              {applied ? "Fermer" : "Annuler"}
            </button>

            {isSuccess && pendingData && !applied && (
              <button
                onClick={handleApply}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-gradient-to-br from-indigo to-[#4F46E5] text-white text-sm font-semibold shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:opacity-90 transition-opacity"
              >
                <Check size={16} />
                Appliquer au dashboard
              </button>
            )}
          </div>

          {/* Confidentialite */}
          <p className="text-[11px] text-border text-center mt-5 leading-relaxed">
            Vos donnees ne quittent jamais votre navigateur. Le parsing s'effectue entierement en local, sans envoi vers un serveur.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BOUTON D'ACCES AU MODAL (a placer dans Header.tsx)
// ---------------------------------------------------------------------------

export function UploadButton() {
  const { setUploaderOpen } = useUIStore();
  const isFromUpload = useDataStore((s) => s.origin) === "upload";

  // Lot 1.4, point ouvert n° 16 — ce bouton est rendu sur les 9 pages et
  // mesurait 135 x 36 px : la derniere cible tactile sous 44 px du projet.
  // Seule la hauteur etait en defaut (135 >= 44), d'ou `min-h-tap` seul.
  return (
    <button
      onClick={() => setUploaderOpen(true)}
      title={isFromUpload ? "Donnees importees actives" : "Charger un fichier Budget.xlsx"}
      className={`relative flex items-center gap-1.5 px-3.5 py-[7px] max-md:min-h-tap rounded-lg text-[13px] font-medium transition-all ${
        isFromUpload
          ? "bg-green/10 border border-green/30 text-green"
          : "bg-indigo/10 border border-indigo/30 text-indigo-text"
      }`}
    >
      {isFromUpload && (
        <span className="absolute -top-[3px] -right-[3px] w-2 h-2 bg-green rounded-full border-2 border-surface" />
      )}
      <Upload size={15} />
      {isFromUpload ? "Donnees importees" : "Importer .xlsx"}
    </button>
  );
}
