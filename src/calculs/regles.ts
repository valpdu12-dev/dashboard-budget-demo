// ── Les règles, lues depuis la configuration ─────────────────────────────
//
// Lot C.4. C'est le fichier qui remplace les listes de libellés du lot B :
// `TRANSFER_TYPES`, `EPARGNE_TYPES`, `TYPE_PRET_CAPITAL`,
// `TYPE_PRET_INTERETS`, `HALF_COMPTES`, `COMPTES_REELS`, et les trois règles
// nommées de `useBalances`.
//
// Il ne connaît aucun nom de compte ni aucun libellé de type. Il ne sait que
// deux choses : ce que la source a déclaré, et quoi faire quand elle n'a rien
// déclaré.
//
// ⚠️ CE QU'IL FAIT QUAND LA SOURCE NE DÉCLARE RIEN. Il ne remplace pas le
// silence par les valeurs de l'auteur : il rend des règles VIDES. Aucun type
// n'est alors un transfert interne, aucun n'est de l'épargne, aucun compte
// n'a de compte lié. Les écrans le disent (D7), et les avertissements de
// l'import le chiffrent. C'est plus faux en apparence et plus vrai en fait :
// appliquer à quelqu'un d'autre les règles de l'auteur, c'était le défaut que
// tout ce lot existe pour supprimer.
//
// Contrat : `docs/CONTRAT_PARAMETRAGE.md`.

import { normaliserCle } from "@/services/lectureValeurs";
import type { Nature } from "@/config/vocabulaire";
import type { BudgetConfig, CompteConfig } from "@/types/budgetConfig";
import type { Config } from "@/types";

export interface Regles {
  /** Vrai quand la source a déclaré une configuration. */
  declaree: boolean;

  /** Les comptes déclarés, dans l'ordre du fichier. Vide si rien n'est déclaré. */
  comptesDeclares: readonly CompteConfig[];

  /** Le compte déclaré portant ce libellé, ou `undefined`. */
  compte(libelle: string): CompteConfig | undefined;

  /** Les natures déclarées pour ce libellé de type. Jamais `undefined`. */
  natures(type: string): readonly Nature[];

  /** Ce type porte-t-il cette nature ? */
  aNature(type: string, n: Nature): boolean;

  /**
   * F11 (lot F.3, amendé le 24/09/2026) — la classe de dépense déclarée pour
   * ce type (« Classe par défaut »), ou `null`. Un type qui a une classe est
   * un type de DÉPENSE : un crédit sur ce type est un remboursement.
   */
  classeDe(type: string): string | null;

  /** Au moins un type déclaré porte-t-il cette nature ? */
  natureDeclaree(n: Nature): boolean;

  /**
   * Libellé du compte crédité par les sorties d'épargne (D2), ou `null`.
   *
   * `null` ne veut pas dire « le compte principal » : il veut dire que les
   * sorties ne sont créditées à AUCUN compte, et l'écran le dit.
   */
  compteSorties: string | null;

  /** Couleur déclarée pour un compte, ou `undefined` — jamais une couleur inventée ici. */
  couleurCompte(libelle: string): string | undefined;

  /** Couleur déclarée pour une catégorie de budget, ou `undefined`. */
  couleurCategorie(libelle: string): string | undefined;

  /**
   * Couleur d'un organisme : celle de son PREMIER compte déclaré.
   *
   * Le format ne déclare pas de couleur d'organisme, et en inventer une
   * colonne pour ça alourdirait le fichier. Prendre celle du premier compte
   * rattaché donne une couleur cohérente avec les cartes, et déterministe.
   */
  couleurOrganisme(nom: string): string | undefined;
}

const AUCUNE: readonly Nature[] = [];

/**
 * Construit les règles depuis la configuration du jeu affiché.
 *
 * Accepte `Config | null` pour se brancher directement sur le store, et
 * `BudgetConfig` pour les tests, qui n'ont pas besoin d'un jeu entier.
 */
export function construireRegles(source: Config | BudgetConfig | null | undefined): Regles {
  const parametrage = extraire(source);

  if (!parametrage || parametrage.estVide) return reglesVides();

  const parLibelle = new Map<string, CompteConfig>();
  for (const c of parametrage.comptes) parLibelle.set(normaliserCle(c.libelle), c);

  const parType = new Map<string, readonly Nature[]>();
  for (const t of parametrage.types) parType.set(t.cle, t.natures);

  const naturesPresentes = new Set<Nature>();
  for (const t of parametrage.types) for (const n of t.natures) naturesPresentes.add(n);

  // Le compte des sorties est stocké par identifiant ; les calculs, eux,
  // travaillent sur des libellés — c'est la colonne `Compte` des transactions
  // qui fait le lien.
  const sorties = parametrage.compteCreditSortiesEpargne;
  const compteSorties =
    sorties === null
      ? null
      : parametrage.comptes.find((c) => c.id === sorties)?.libelle ?? null;

  const natures = (type: string): readonly Nature[] =>
    parType.get(normaliserCle(type)) ?? AUCUNE;

  const parClasse = new Map<string, string | null>();
  for (const t of parametrage.types) parClasse.set(t.cle, t.classeParDefaut ?? null);

  return {
    declaree: true,
    comptesDeclares: parametrage.comptes,
    compte: (libelle) => parLibelle.get(normaliserCle(libelle)),
    natures,
    aNature: (type, n) => natures(type).includes(n),
    classeDe: (type) => parClasse.get(normaliserCle(type)) ?? null,
    natureDeclaree: (n) => naturesPresentes.has(n),
    compteSorties,
    couleurCompte: (libelle) => parLibelle.get(normaliserCle(libelle))?.couleur,
    couleurCategorie: (libelle) =>
      parametrage.categories.find((c) => c.cle === normaliserCle(libelle))?.couleur,
    couleurOrganisme: (nom) =>
      parametrage.comptes.find(
        (c) => c.organisme && normaliserCle(c.organisme) === normaliserCle(nom)
      )?.couleur,
  };
}

function extraire(
  source: Config | BudgetConfig | null | undefined
): BudgetConfig | null {
  if (!source) return null;
  if ("estVide" in source) return source;
  return source.parametrage ?? null;
}

/** Des règles qui ne savent rien — et qui ne font donc rien. */
export function reglesVides(): Regles {
  return {
    declaree: false,
    comptesDeclares: [],
    compte: () => undefined,
    natures: () => AUCUNE,
    aNature: () => false,
    classeDe: () => null,
    natureDeclaree: () => false,
    compteSorties: null,
    couleurCompte: () => undefined,
    couleurCategorie: () => undefined,
    couleurOrganisme: () => undefined,
  };
}
