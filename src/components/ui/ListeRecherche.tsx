// ── Liste déroulante à choix multiples, avec recherche (fait maison) ─────
//
// Reprise du site privé (20/10/2026), sans changement de comportement.
// Utilisée pour « Enseigne » et « Événement » sur la page Dépenses. On tape quelques lettres, la liste se réduit ; on coche une ou
// plusieurs valeurs. Plusieurs valeurs cochées = OU (Primeur ou Cinéma).
//
// Accessibilité (motif WAI-ARIA « combobox » + « listbox » multiple) :
//   - bouton déclencheur : aria-haspopup="listbox", aria-expanded ;
//   - champ de recherche : role="combobox", aria-controls, aria-activedescendant ;
//   - liste : aria-multiselectable="true", chaque ligne aria-selected ;
//   - clavier : ↓ ↑ pour se déplacer, Entrée (ou Espace sans saisie) pour
//     cocher / décocher, Échap pour fermer (le focus revient sur le bouton),
//     Tab ferme ;
//   - cibles tactiles ≥ 44 px sous 768 px.
//
// La liste RESTE OUVERTE pendant qu'on coche. La ligne « Toutes » vide la
// sélection et ferme la liste.
//
// Aucune dépendance ajoutée : React + les icônes lucide déjà présentes.
//
// La recherche ignore majuscules et accents (« cine » trouve « Cinéma »).
// C'est une aide à la saisie seulement : les valeurs COCHÉES restent
// comparées telles quelles au filtre.

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { OptionCategorie } from "@/calculs/optionsCategorie";

interface ListeRechercheProps {
  /** Nom affiché de la liste : « Enseigne », « Événement ». */
  libelle: string;
  /** Libellé de la ligne « aucun filtre » : « Toutes », « Tous ». */
  libelleTous: string;
  /** Valeurs proposées, déjà triées, avec leur nombre de transactions. */
  options: OptionCategorie[];
  /** Valeurs cochées ; tableau vide = aucun filtre. */
  valeurs: string[];
  onChange: (v: string[]) => void;
}

/** Minuscules sans accents, pour la recherche uniquement. */
function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function ListeRechercheComponent({
  libelle, libelleTous, options, valeurs, onChange,
}: ListeRechercheProps) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [actif, setActif] = useState(0);

  const racineRef = useRef<HTMLDivElement>(null);
  const boutonRef = useRef<HTMLButtonElement>(null);
  const champRef = useRef<HTMLInputElement>(null);
  /**
   * Rendre le focus au bouton APRÈS le rendu : la première case cochée
   * remplace le bouton gris par le bouton indigo (un autre élément). Un
   * `focus()` immédiat viserait l'ancien bouton, déjà retiré de la page.
   */
  const focusApresRendu = useRef(false);

  const id = useId();
  const listeId = `${id}-liste`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const coches = useMemo(() => new Set(valeurs), [valeurs]);
  const total = useMemo(() => options.reduce((s, o) => s + o.nombre, 0), [options]);

  const filtrees = useMemo(() => {
    const q = normaliser(recherche.trim());
    return q ? options.filter((o) => normaliser(o.valeur).includes(q)) : options;
  }, [options, recherche]);

  /** Ligne 0 = « Toutes » (aucun filtre), puis les valeurs filtrées. */
  const lignes = useMemo<{ valeur: string | null; nombre: number }[]>(
    () => [{ valeur: null, nombre: total }, ...filtrees],
    [filtrees, total]
  );
  const actifBorne = Math.min(actif, lignes.length - 1);

  function ouvrir() {
    setRecherche("");
    const idx = valeurs.length ? options.findIndex((o) => o.valeur === valeurs[0]) + 1 : 0;
    setActif(Math.max(0, idx));
    setOuvert(true);
  }

  function fermer(rendreFocus = true) {
    setOuvert(false);
    focusApresRendu.current = rendreFocus;
  }

  /** Coche ou décoche une valeur ; `null` (« Toutes ») vide tout et ferme. */
  function basculerValeur(v: string | null) {
    if (v === null) {
      onChange([]);
      fermer();
      return;
    }
    onChange(coches.has(v) ? valeurs.filter((x) => x !== v) : [...valeurs, v]);
  }

  // Pas de tableau de dépendances : à vérifier après CHAQUE rendu.
  useEffect(() => {
    if (!ouvert && focusApresRendu.current) {
      focusApresRendu.current = false;
      boutonRef.current?.focus();
    }
  });

  // Focus dans le champ de recherche à l'ouverture.
  useEffect(() => {
    if (ouvert) champRef.current?.focus();
  }, [ouvert]);

  // Clic (ou toucher) en dehors : on ferme, les cases cochées restent.
  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: Event) => {
      if (racineRef.current && !racineRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    };
    document.addEventListener("mousedown", surClic);
    document.addEventListener("touchstart", surClic);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("touchstart", surClic);
    };
  }, [ouvert]);

  // La ligne active reste visible quand on descend au clavier.
  useEffect(() => {
    if (!ouvert) return;
    const el = document.getElementById(`${id}-opt-${actifBorne}`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [actifBorne, ouvert, id]);

  function surToucheChamp(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActif(Math.min(actifBorne + 1, lignes.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActif(Math.max(actifBorne - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        basculerValeur(lignes[actifBorne].valeur);
        break;
      case " ":
        // Espace coche seulement si rien n'est saisi : sinon c'est un
        // caractère de la recherche (« Vacances d'été »).
        if (recherche === "") {
          e.preventDefault();
          basculerValeur(lignes[actifBorne].valeur);
        }
        break;
      case "Escape":
        e.preventDefault();
        fermer();
        break;
      case "Tab":
        fermer(false);
        break;
    }
  }

  function surToucheBouton(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" && !ouvert) {
      e.preventDefault();
      ouvrir();
    }
  }

  const basculer = () => (ouvert ? fermer(false) : ouvrir());

  /** « Primeur » ou « Primeur +2 ». */
  const resume = valeurs.length > 1 ? `${valeurs[0]} +${valeurs.length - 1}` : valeurs[0];

  return (
    // `md:relative` : sur PC le panneau s'ouvre sous SON bouton. Sous 768 px,
    // il se cale sur le conteneur des deux listes (qui porte `relative`) et
    // prend toute la largeur de l'écran, comme sur la maquette mobile.
    <div ref={racineRef} className="min-w-0 md:relative">
      {valeurs.length ? (
        <div className="flex items-center w-full md:w-auto rounded-full border border-indigo bg-indigo/20 text-text">
          <button
            ref={boutonRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={ouvert}
            title={valeurs.join(", ")}
            onClick={basculer}
            onKeyDown={surToucheBouton}
            className="flex flex-1 min-w-0 items-center gap-1.5 pl-3.5 pr-1 py-1 max-md:min-h-[44px] text-xs font-medium text-left"
          >
            <span className="truncate md:max-w-[16rem]">
              <span className="max-md:sr-only">{libelle} : </span>
              {resume}
            </span>
            <ChevronDown size={12} aria-hidden="true" className="shrink-0" />
          </button>
          <button
            type="button"
            aria-label={`Effacer le filtre ${libelle}`}
            onClick={() => {
              // Le bouton effacé disparaît : on rend le focus au déclencheur.
              focusApresRendu.current = true;
              setOuvert(false);
              onChange([]);
            }}
            className="inline-flex items-center justify-center shrink-0 w-7 h-7 mr-0.5 max-md:w-11 max-md:h-11 rounded-full hover:bg-indigo/30"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          ref={boutonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={ouvert}
          onClick={basculer}
          onKeyDown={surToucheBouton}
          className={`inline-flex w-full md:w-auto items-center justify-between gap-1.5 px-3.5 py-1 max-md:min-h-[44px] rounded-full border bg-surface text-xs font-medium transition-colors ${
            ouvert ? "border-indigo text-text" : "border-border text-text-sec hover:border-indigo/50"
          }`}
        >
          {libelle}
          <ChevronDown size={12} aria-hidden="true" className="shrink-0" />
        </button>
      )}

      {ouvert && (
        <div className="absolute z-40 left-0 right-0 md:right-auto md:w-80 mt-1 rounded-xl border border-[#374151] bg-surface shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 min-h-[44px] border-b border-border">
            <Search size={14} aria-hidden="true" className="text-text-sec shrink-0" />
            <input
              ref={champRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listeId}
              aria-autocomplete="list"
              aria-activedescendant={optionId(actifBorne)}
              aria-label={`Rechercher : ${libelle}`}
              placeholder="Rechercher…"
              autoComplete="off"
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value);
                // Une saisie place la ligne active sur le premier résultat.
                setActif(e.target.value.trim() ? 1 : 0);
              }}
              onKeyDown={surToucheChamp}
              className="flex-1 min-w-0 bg-transparent outline-none text-text text-base md:text-sm placeholder:text-text-sec"
            />
          </div>
          <ul
            id={listeId}
            role="listbox"
            aria-label={libelle}
            aria-multiselectable="true"
            className="max-h-72 overflow-y-auto p-1"
          >
            {lignes.map((l, i) => {
              const choisi = l.valeur === null ? valeurs.length === 0 : coches.has(l.valeur);
              return (
                <li
                  key={l.valeur ?? "\u0000tous"}
                  id={optionId(i)}
                  role="option"
                  aria-selected={choisi}
                  // `mousedown` empêché : le champ garde le focus pendant les clics.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => { if (i !== actifBorne) setActif(i); }}
                  onClick={() => { setActif(i); basculerValeur(l.valeur); }}
                  className={`flex items-center gap-2.5 min-h-[36px] max-md:min-h-[44px] px-3 rounded-lg cursor-pointer text-sm text-text ${
                    i === actifBorne ? "bg-indigo/20" : ""
                  } ${choisi ? "font-medium" : ""}`}
                >
                  {l.valeur === null ? (
                    <span className="w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className={`inline-flex items-center justify-center w-4 h-4 shrink-0 rounded border ${
                        choisi ? "bg-indigo-deep border-indigo text-white" : "border-text-sec"
                      }`}
                    >
                      {choisi && <Check size={12} strokeWidth={3} />}
                    </span>
                  )}
                  <span className="truncate flex-1">{l.valeur ?? libelleTous}</span>
                  <span className="shrink-0 text-xs text-text-sec tabular-nums">{l.nombre}</span>
                </li>
              );
            })}
            {filtrees.length === 0 && (
              <li role="presentation" className="px-3 py-2 text-xs text-text-sec">
                Aucun résultat
              </li>
            )}
          </ul>
          {valeurs.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 min-h-[44px] border-t border-border text-xs text-text-sec">
              <span aria-live="polite">
                {valeurs.length} choix
              </span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fermer()}
                className="px-3 max-md:min-h-[44px] min-h-[32px] rounded-lg bg-indigo-deep text-white font-medium"
              >
                Valider
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const ListeRecherche = memo(ListeRechercheComponent);
