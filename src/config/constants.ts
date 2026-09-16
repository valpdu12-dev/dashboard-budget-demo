// ── Constantes métier (alignées sur V1 helpers.js) ────────────────────────
//
// Les noms de comptes et d'organismes viennent de `accounts.ts` — jamais
// recopiés ici.

import {
  COMPTES,
  COMPTES_AVEC_SOLDE,
  ORGANISMES_UTILISES,
  COMPTE_VERS_ORGANISME,
} from "@/config/accounts";

export const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
] as const;

/** Types considérés comme des transferts internes (exclus par défaut) */
export const TRANSFER_TYPES = [
  "Transfert Banque A vers Banque C",
  "Transfert Banque A vers Banque B",
  "Épargne Banque A",
  "Sortie Epargne",
] as const;

/** Types liés à l'épargne */
export const EPARGNE_TYPES = [
  "Crédit Immobilier",
  "Épargne Banque C",
  "Épargne Banque A",
  "Épargne Banque B",
  "Assurance-vie",
  "Cagnotte partagée",
] as const;

/**
 * Comptes portant un solde propre. Dérivé de `accounts.ts` : source unique.
 * ⚠️ Ajouter un compte ici ne suffit pas à lui donner un solde — `useBalances`
 * applique des règles écrites compte par compte. Voir docs/LIMITES_PARAMETRAGE.md.
 */
export const COMPTES_REELS = COMPTES_AVEC_SOLDE;

/** Organismes effectivement représentés. Dérivé de `accounts.ts`. */
export const ORGANISMES = ORGANISMES_UTILISES;

/** Mapping compte → organisme (pour `toOrganisme`). Dérivé de `accounts.ts`. */
export const COMPTE_TO_ORGANISME: Record<string, string> = {
  ...COMPTE_VERS_ORGANISME,
  // Le type « Sortie Epargne » arrive dans la colonne compte de certaines
  // lignes ; il est rattaché à l'organisme du compte principal.
  "Sortie Epargne": COMPTES[0].organisme,
};

/** Options de période pour le filtre global */
export const PERIOD_OPTIONS = [
  { value: "1M",  label: "1M" },
  { value: "3M",  label: "3M" },
  { value: "6M",  label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "12M", label: "12M" },
  { value: "all", label: "Tout" },
] as const;

/** Tabs de navigation (5 onglets — regroupement par type de flux) */
export const NAV_TABS = [
  { id: "comptes",    label: "Comptes",    icon: "BarChart3",    path: "/" },
  { id: "depenses",   label: "Dépenses",   icon: "TrendingDown", path: "/depenses" },
  { id: "revenus",    label: "Revenus",    icon: "TrendingUp",   path: "/revenus" },
  { id: "patrimoine", label: "Patrimoine", icon: "PiggyBank",    path: "/patrimoine" },
  { id: "insights",   label: "Insights",   icon: "Lightbulb",    path: "/insights" },
] as const;

/**
 * Sous-navigation contextuelle (pills) par onglet.
 * Clé = id de l'onglet ; valeur = liste de pills.
 * `end: true` sur la pill de la route par défaut (évite qu'elle reste
 * active sur les sous-routes).
 *
 * `rubrique` (lot B.4) : la pill n'existe que si le JEU COMPLET porte la
 * donnée correspondante. Sans paie, pas d'écran Salaire ; sans prêt, pas
 * d'écran Prêt. Voir `src/hooks/useRubriques.ts`.
 */
export const SUB_NAV_CONFIG = {
  depenses: [
    { label: "Dépenses", path: "/depenses",        end: true },
    { label: "Budget",   path: "/depenses/budget"            },
  ],
  revenus: [
    { label: "Recettes",     path: "/revenus",           end: true },
    { label: "Salaire",      path: "/revenus/salaire",   rubrique: "paie" },
    { label: "vs Inflation", path: "/revenus/inflation", rubrique: "paie" },
  ],
  patrimoine: [
    { label: "Épargne",    path: "/patrimoine",      end: true },
    { label: "Prêt Immo.", path: "/patrimoine/pret", rubrique: "pret" },
  ],
} as const;
