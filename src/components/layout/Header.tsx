// -- Header sticky avec filtres globaux --

import { useState, useEffect } from "react";
import { Wallet, ArrowLeftRight, SlidersHorizontal } from "lucide-react";
import { useFilterStore } from "@/stores/useFilterStore";
import { PERIOD_OPTIONS } from "@/config/constants";
import { UploadButton } from "@/components/upload/DataUploader";
import { ProfilBascule } from "@/components/layout/ProfilBascule";
import { Chip } from "@/components/ui/Chip";
import { useResponsive } from "@/hooks/useResponsive";
import type { Cat1Filter } from "@/types";

/**
 * Les filtres ont-ils déjà été montrés dans cette session d'onglet ?
 *
 * `sessionStorage` peut lever : navigation privée sur certains navigateurs,
 * cookies tiers bloqués, quota atteint. Un en-tête ne doit pas se briser pour
 * ça — en cas d'échec on considère que les filtres n'ont pas été vus, ce qui
 * ramène simplement au comportement « dépliés ».
 */
const FILTERS_SEEN_KEY = "budget.header.filtersSeen";

function hasSeenFilters(): boolean {
  try {
    return sessionStorage.getItem(FILTERS_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markFiltersSeen(): void {
  try {
    sessionStorage.setItem(FILTERS_SEEN_KEY, "1");
  } catch {
    /* stockage indisponible — sans effet sur le rendu */
  }
}

// Options de filtre Cat1 exposées dans le Header (state déjà géré par useFilterStore)
const CAT1_OPTIONS: { value: Cat1Filter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "Dépense Fixe", label: "Fixe" },
  { value: "Dépense Courante", label: "Courante" },
  { value: "Dépense Occasionnelle", label: "Occasionnelle" },
];

export function Header() {
  const { period, setPeriod, cat1Filter, setCat1Filter, showTransfers, setShowTransfers } =
    useFilterStore();

  // Lot 1.1 — sous 430 px, la rangée de filtres est repliée derrière un
  // bouton. Mesuré à 412 px : en-tête collant de 194 px, soit 21 % de
  // l'écran, avant tout contenu ; porter les cibles tactiles à 48 px
  // l'aurait poussé vers 260 px. Replié, il retombe à ~52 px.
  // Au-dessus de 430 px (tablette, PC) `isSmall` est faux : les filtres
  // sont toujours rendus et le balisage est identique à l'avant-lot 1.1.
  const { isSmall } = useResponsive();

  // Lot 1.2 — les filtres sont dépliés au premier affichage de la session,
  // puis repliés. Un repli d'emblée les rendait indécouvrables ; les laisser
  // ouverts en permanence reprenait les 194 px que le lot 1.1 a libérés.
  // `sessionStorage` et non `localStorage` : la découverte doit se rejouer à
  // chaque nouvelle session, pas une seule fois dans la vie du navigateur.
  const [filtersOpen, setFiltersOpen] = useState(() => !hasSeenFilters());

  useEffect(() => {
    if (filtersOpen) markFiltersSeen();
  }, [filtersOpen]);

  const showFilters = !isSmall || filtersOpen;

  // Lot 1.2 — la période n'était comptée par aucun badge : une fois les
  // filtres repliés, rien n'indiquait si les montants affichés portaient sur
  // l'année, le trimestre ou le mois. Elle est donc rendue en toutes lettres
  // sur le bouton, et le compteur ne couvre plus que les autres filtres.
  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? "";
  const activeFilters = (cat1Filter !== "all" ? 1 : 0) + (showTransfers ? 1 : 0);

  return (
    <header className="flex flex-col bg-surface border-b border-border sticky top-0 z-50">
      {/* Ligne 1 : Titre + (bouton Filtres sous 430 px) + Upload */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 xs:px-6 xs:py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Wallet size={22} className="text-indigo-text shrink-0" />
          <span className="text-base xs:text-xl font-title font-bold text-text truncate">
            {isSmall ? "Budget Démo" : "Dashboard Budget — Démo"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSmall && (
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="header-filters"
              aria-label={`${filtersOpen ? "Masquer" : "Afficher"} les filtres — période ${periodLabel}`}
              className={`inline-flex items-center justify-center gap-1.5 min-h-tap min-w-tap px-3 rounded-full text-xs font-medium transition-all border ${
                filtersOpen || activeFilters > 0
                  ? "border-indigo bg-indigo/20 text-text"
                  : "border-border bg-surface text-text-sec"
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>{periodLabel}</span>
              {activeFilters > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-indigo-deep text-white text-[11px] leading-none">
                  {activeFilters}
                </span>
              )}
            </button>
          )}
          <ProfilBascule />
          <UploadButton />
        </div>
      </div>

      {/* Ligne 2 : Filtres — masquée sous 430 px tant que non dépliée */}
      {showFilters && (
      <div
        id="header-filters"
        className="flex flex-wrap gap-2.5 items-center px-3 py-2 xs:px-6 border-t border-border"
      >
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 max-md:min-h-tap max-md:min-w-tap rounded-md text-xs transition-all ${
                period === p.value
                  ? "bg-indigo-deep text-white font-semibold"
                  : "bg-border text-text-sec hover:text-text"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Séparateur vertical (caché en mobile) */}
        <span className="hidden sm:block w-px h-5 bg-border" aria-hidden="true" />

        {/* Filtre par Cat1 (chips) */}
        <div className="flex flex-wrap gap-1.5">
          {CAT1_OPTIONS.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              active={cat1Filter === c.value}
              onClick={() => setCat1Filter(c.value)}
            />
          ))}
        </div>

        {/* Toggle inclure transferts */}
        <button
          onClick={() => setShowTransfers(!showTransfers)}
          aria-pressed={showTransfers}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 max-md:min-h-tap max-md:min-w-tap max-md:px-4 rounded-full text-xs font-medium transition-all border ${
            showTransfers
              ? "border-indigo bg-indigo/20 text-text"
              : "border-border bg-surface text-text-sec hover:border-indigo/50"
          }`}
        >
          <ArrowLeftRight size={12} />
          Transferts
        </button>
      </div>
      )}
    </header>
  );
}
