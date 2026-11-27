// ── L'en-tête au téléphone (< 768 px) ─────────────────────────────────────────
// Titre de la page à gauche, pastille à droite : « Démo · <mois> » (le jeu de
// démonstration) ou « Mes données » (un fichier importé). Le mois est celui des
// pages : le dernier mois qui a des lignes (sans relancer les filtres). La période, les classes, les
// transferts, Paramètres, l'import et la bascule Démo / Mes données passent
// dans le bouton « Filtres (n) » (FiltresTelephone).

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { FileUp, FlaskConical } from "lucide-react";
import { useDataStore } from "@/stores/useDataStore";
import { extractAllMonths } from "@/utils/decode";
import { moisCourt, titrePage } from "@/utils/telephone";

export function EnTeteTelephone() {
  const { pathname } = useLocation();
  const mesDonnees = useDataStore((s) => s.origin) === "upload";
  const transactions = useDataStore((s) => s.transactions);
  // Le même « mois actuel » que les pages (filtrerDonnees) : le dernier mois
  // qui a des lignes. Il ne dépend d'aucun filtre.
  const libelleMois = useMemo(() => {
    const mois = extractAllMonths(transactions);
    return moisCourt(mois.length ? mois[mois.length - 1] : null);
  }, [transactions]);

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-2 bg-bg px-4 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-2">
      <h1 className="m-0 min-w-0 truncate font-title text-xl font-bold tracking-tight text-text">{titrePage(pathname)}</h1>
      {mesDonnees ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 min-h-[34px] px-3 rounded-full bg-amber/15 text-amber text-xs font-semibold whitespace-nowrap">
          <FileUp size={15} aria-hidden="true" />
          Mes données
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5 min-h-[34px] px-3 rounded-full bg-accent-doux text-indigo-text text-xs font-semibold whitespace-nowrap">
          <FlaskConical size={15} aria-hidden="true" />
          {libelleMois ? `Démo · ${libelleMois}` : "Démo"}
        </span>
      )}
    </header>
  );
}
