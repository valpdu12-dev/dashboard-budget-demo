// ── Constantes métier (alignées sur V1 helpers.js) ────────────────────────
//
// Ce qui reste ici ne nomme personne : les mois, les périodes de filtre et
// la structure de la navigation. Tout le vocabulaire — comptes, organismes,
// types — est parti au lot C.4 vers la configuration déclarée par le fichier
// source.

export const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
] as const;

// ⚠️ LOT C.4 — CINQ CONSTANTES ONT ÉTÉ SUPPRIMÉES D'ICI :
//
//   `TRANSFER_TYPES`, `EPARGNE_TYPES` — quatre et six libellés de types qui
//     gouvernaient cinq écrans. Ce sont désormais les natures déclarées par
//     la source (`calculs/regles.ts`).
//   `COMPTES_REELS`, `ORGANISMES`, `COMPTE_TO_ORGANISME` — les comptes et
//     organismes de l'auteur. Ils viennent du tableau `Comptes` du fichier.
//
// Aucune n'est remplacée par un équivalent : elles n'ont plus de lecteur.
// Une constante que personne ne lit est le champ mort que D4 a supprimé de
// `Config` ; il n'y a pas de raison de la garder ici.

/** Options de période pour le filtre global */
export const PERIOD_OPTIONS = [
  { value: "1M",  label: "1M" },
  { value: "3M",  label: "3M" },
  { value: "6M",  label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "12M", label: "12M" },
  { value: "all", label: "Tout" },
] as const;

/**
 * Tabs de navigation (5 onglets — regroupement par type de flux).
 *
 * ⚠️ Lot C.5 — `rubriques` liste les rubriques dont l'onglet a besoin pour
 * avoir quelque chose à montrer. Si AUCUNE n'existe dans le jeu, l'onglet
 * disparaît : `Patrimoine` sans épargne ni prêt n'ouvrait qu'une page qui
 * renvoyait aussitôt à l'accueil — l'application se dérobait sous le doigt,
 * sans un mot. C'est le défaut du B.5, à un autre endroit.
 */
export const NAV_TABS = [
  { id: "comptes",    label: "Comptes",    icon: "BarChart3",    path: "/" },
  { id: "depenses",   label: "Dépenses",   icon: "TrendingDown", path: "/depenses" },
  { id: "revenus",    label: "Revenus",    icon: "TrendingUp",   path: "/revenus" },
  { id: "patrimoine", label: "Patrimoine", icon: "PiggyBank",    path: "/patrimoine",
    rubriques: ["epargne", "pret"] },
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
    { label: "Épargne",    path: "/patrimoine",      end: true, rubrique: "epargne" },
    { label: "Prêt Immo.", path: "/patrimoine/pret", rubrique: "pret" },
  ],
} as const;
