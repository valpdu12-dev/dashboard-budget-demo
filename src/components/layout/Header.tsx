// -- Header sticky avec filtres globaux --
// Au téléphone (< 768 px) : EnTeteTelephone (titre de la page + pastille) ; les
// filtres, Paramètres, l'import et la bascule de profil passent dans le bouton
// « Filtres (n) » (FiltresTelephone). Grand écran : deux lignes, comme avant.

import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Wallet, ArrowLeftRight, Settings } from "lucide-react";
import { useFilterStore } from "@/stores/useFilterStore";
import { PERIOD_OPTIONS } from "@/config/constants";
import { UploadButton } from "@/components/upload/DataUploader";
import { useDataStore } from "@/stores/useDataStore";
import { ProfilBascule } from "@/components/layout/ProfilBascule";
import { ChoixApparence } from "@/components/ui/ChoixApparence";
import { Chip } from "@/components/ui/Chip";
import { useResponsive } from "@/hooks/useResponsive";
import type { Cat1Filter } from "@/types";
import { EnTeteTelephone } from "./EnTeteTelephone";

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

  const { isMobile } = useResponsive();

  // Lot D — le titre suit les données affichées, comme le bandeau : « Démo »
  // sur les données de la personne serait faux. L'onglet du navigateur aussi.
  const mesDonnees = useDataStore((s) => s.origin) === "upload";
  const titre = mesDonnees ? "Dashboard Budget — Mes données" : "Dashboard Budget — Démo";
  useEffect(() => { document.title = titre; }, [titre]);

  if (isMobile) return <EnTeteTelephone />;

  return (
    <header className="flex flex-col bg-surface border-b border-border sticky top-0 z-50">
      {/* Ligne 1 : Titre + profil, apparence, Paramètres, import */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 xs:px-6 xs:py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Wallet size={22} className="text-indigo-text shrink-0" />
          <span className="text-base xs:text-xl font-title font-bold text-text truncate">
            {titre}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ProfilBascule />
          {/* Auto · Jour · Nuit, avant Paramètres. */}
          <ChoixApparence />
          {/* Lot C.2 — accès à ce que l'outil a lu du fichier source. Hors
              navigation principale : ce n'est pas un écran de chiffres. */}
          <NavLink
            to="/parametres"
            title="Paramètres lus dans le fichier source"
            aria-label="Paramètres lus dans le fichier source"
            className={({ isActive }) =>
              `inline-flex items-center justify-center min-h-tap min-w-tap rounded-full border transition-all ${
                isActive
                  ? "border-indigo bg-indigo/20 text-text"
                  : "border-border bg-surface text-text-sec hover:text-text"
              }`
            }
          >
            <Settings size={16} />
          </NavLink>
          <UploadButton />
        </div>
      </div>

      {/* Ligne 2 : Filtres */}
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
    </header>
  );
}
