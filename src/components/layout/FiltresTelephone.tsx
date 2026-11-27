// ── Le bouton « Filtres (n) » au téléphone (< 768 px) ─────────────────────────
// Fermé au départ : le petit texte à côté dit toujours la période et la classe.
// Ouvert : les mêmes filtres que l'en-tête du grand écran (même magasin
// useFilterStore : les chiffres ne changent pas), plus Paramètres, l'import et
// la bascule Démo / Mes données, qui quittent l'en-tête au téléphone, et le
// choix Auto · Jour · Nuit.

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Settings, SlidersHorizontal } from "lucide-react";
import { useFilterStore } from "@/stores/useFilterStore";
import { PERIOD_OPTIONS } from "@/config/constants";
import { UploadButton } from "@/components/upload/DataUploader";
import { ChoixApparence } from "@/components/ui/ChoixApparence";
import { ProfilBascule } from "@/components/layout/ProfilBascule";
import { nombreFiltres, resumeFiltres } from "@/utils/telephone";
import type { Cat1Filter } from "@/types";

const CLASSES: { value: Cat1Filter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "Dépense Fixe", label: "Fixe" },
  { value: "Dépense Courante", label: "Courante" },
  { value: "Dépense Occasionnelle", label: "Occasionnelle" },
];

// Un choix UNIQUE (période, classe) est un groupe de boutons radio : un seul
// arrêt de Tab (le choix actif), les flèches et Début / Fin changent de choix
// (comme ChoixApparence). Une bascule (transferts) garde aria-pressed.
function Pilule({ active, onClick, children, radio = false }: { active: boolean; onClick: () => void; children: ReactNode; radio?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(radio ? { role: "radio", "aria-checked": active, tabIndex: active ? 0 : -1 } : { "aria-pressed": active })}
      className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-full border text-[13px] transition-colors ${
        active ? "border-indigo-deep bg-indigo-deep text-white font-semibold" : "border-border bg-surface text-text font-medium"
      }`}
    >
      {children}
    </button>
  );
}

/** Flèches, Début et Fin dans un groupe de boutons radio : choisit et donne le focus. */
function auClavier(e: KeyboardEvent<HTMLDivElement>) {
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  const i = radios.findIndex((n) => n.getAttribute("aria-checked") === "true");
  const n = radios.length;
  const cible =
    e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n
    : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i + n - 1) % n
    : e.key === "Home" ? 0
    : e.key === "End" ? n - 1
    : -1;
  if (cible < 0 || n === 0) return;
  e.preventDefault();
  radios[cible].click();
  radios[cible].focus();
}

function Groupe({ titre, children, radio = false }: { titre: string; children: ReactNode; radio?: boolean }) {
  const id = `filtres-${titre.toLowerCase()}`;
  // Un seul nom annoncé : le titre visible nomme le groupe.
  return (
    <div className="m-0 min-w-0">
      <p id={id} className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-sec">{titre}</p>
      <div
        className="flex flex-wrap gap-1.5"
        {...(radio ? { role: "radiogroup", "aria-labelledby": id, onKeyDown: auClavier } : { role: "group", "aria-labelledby": id })}
      >
        {children}
      </div>
    </div>
  );
}

export function FiltresTelephone() {
  const { period, setPeriod, cat1Filter, setCat1Filter, showTransfers, setShowTransfers } = useFilterStore();
  const [ouvert, setOuvert] = useState(false);

  const n = nombreFiltres(cat1Filter, showTransfers);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-controls={ouvert ? "filtres-telephone" : undefined}
          className={`inline-flex shrink-0 items-center gap-2 min-h-[44px] px-4 rounded-full border bg-surface text-sm font-semibold ${
            ouvert ? "border-indigo text-indigo-text" : "border-border text-text"
          }`}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filtres ({n})
        </button>
        <span className="min-w-0 truncate text-[13px] text-text-sec">{resumeFiltres(period, cat1Filter, showTransfers)}</span>
      </div>

      {ouvert && (
        <section id="filtres-telephone" className="card flex flex-col gap-3.5 !p-4" aria-label="Filtres">
          <Groupe titre="Période" radio>
            {PERIOD_OPTIONS.map((p) => (
              <Pilule key={p.value} radio active={period === p.value} onClick={() => setPeriod(p.value)}>{p.label}</Pilule>
            ))}
          </Groupe>
          <Groupe titre="Classe" radio>
            {CLASSES.map((c) => (
              <Pilule key={c.value} radio active={cat1Filter === c.value} onClick={() => setCat1Filter(c.value)}>{c.label}</Pilule>
            ))}
          </Groupe>
          <Groupe titre="Lignes">
            <Pilule active={showTransfers} onClick={() => setShowTransfers(!showTransfers)}>Avec les transferts</Pilule>
          </Groupe>
          <Groupe titre="Plus">
            <Link
              to="/parametres"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full border border-border bg-surface text-[13px] font-medium text-text"
            >
              <Settings size={15} aria-hidden="true" />
              Paramètres
            </Link>
            <UploadButton />
            {/* La bascule Démo / Mes données (elle n'efface rien). */}
            <ProfilBascule />
          </Groupe>
          {/* Le bouton Auto · Jour · Nuit. Le titre visible nomme le groupe de
              boutons radio (un seul nom annoncé). */}
          <div className="border-t border-border pt-3.5">
            <p id="titre-apparence" className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-sec">Apparence</p>
            <ChoixApparence grand nommePar="titre-apparence" />
          </div>
        </section>
      )}
    </div>
  );
}
