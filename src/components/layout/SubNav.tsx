// -- SubNav : sous-navigation contextuelle (pills) ------------------------
// Affichée seulement si l'onglet courant possède des pills (SUB_NAV_CONFIG).
// Style aligné sur le composant Chip (cohérence visuelle).
import { NavLink, useLocation } from "react-router-dom";
import { SUB_NAV_CONFIG } from "@/config/constants";
import { useRubriques } from "@/hooks/useRubriques";

type SubNavKey = keyof typeof SUB_NAV_CONFIG;

export function SubNav() {
  const { pathname } = useLocation();
  const rubriques = useRubriques();
  // Segment de tête de l'URL : "/revenus/salaire" -> "revenus"
  const tabId = pathname.split("/")[1] as SubNavKey;
  const toutes = SUB_NAV_CONFIG[tabId] as readonly {
    label: string; path: string; end?: boolean; rubrique?: "paie" | "pret" | "epargne";
  }[] | undefined;

  // Lot B.4 : une pill dont la rubrique n'existe pas dans le jeu complet est
  // retirée de la sous-navigation — pas grisée, pas vide : absente.
  const pills = toutes?.filter((p) => !p.rubrique || rubriques[p.rubrique]);

  // Une seule pill ne navigue nulle part : la barre devient du décor.
  if (!pills || pills.length < 2) return null;

  return (
    <nav className="flex shrink-0 gap-2 overflow-x-auto px-3 py-2.5 md:px-6 border-b border-border bg-surface">
      {pills.map((pill) => (
        <NavLink
          key={pill.path}
          to={pill.path}
          end={"end" in pill ? pill.end : false}
          className={({ isActive }) =>
            // max-md: cible tactile ≥ 48 px sous 768 px uniquement ; le
            // rendu desktop conserve sa pilule compacte.
            `inline-flex items-center justify-center px-3 py-1 max-md:min-h-tap max-md:min-w-tap max-md:px-4 rounded-full text-xs font-medium transition-all border whitespace-nowrap ${
              isActive
                ? "border-indigo bg-indigo/20 text-text"
                : "border-border bg-surface text-text-sec hover:border-indigo/50"
            }`
          }
        >
          {pill.label}
        </NavLink>
      ))}
    </nav>
  );
}
