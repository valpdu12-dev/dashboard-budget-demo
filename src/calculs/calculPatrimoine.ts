// ── Le calcul du sous-onglet Patrimoine (soldes), sorti de React ──────────
//
// Patrimoine D-4b (plan 33). Recopie de la logique du site privé APRÈS son
// étape P6 — recopiée, jamais importée : la DEMO est un dépôt à part.
//
// Entrée : les relevés de la feuille `Patrimoine` (un solde par compte et par
// mois), tels que le lecteur D-1 les rend (`PatrimoineLu.releves`), déjà
// filtrés sur les dates dépassées. Sortie : grille mois × compte, 6 KPI,
// séries des graphiques, tableau des comptes.
//
// Fonctions PURES : rien n'est lu dans un store, et la date du jour n'est
// jamais lue. Le même jeu donne les mêmes chiffres tous les jours.
//
// Ce qui diffère du privé, et pourquoi :
//   1. Types : `ReleveSoldeLu` (lecteur public) au lieu du type du privé —
//      mêmes champs.
//   2. KPI 6 : un transfert interne est un type de nature `transfert-interne`
//      DÉCLARÉ par la source (lot C), pas une liste écrite dans le code.
//   3. KPI 6 : la dépense est la dépense NETTE de la page Dépenses
//      (`montantDepense`) : un remboursement la réduit. Le privé obtient le
//      même chiffre autrement — son tableur écrit un remboursement comme un
//      débit négatif, que le format public refuse (§3.2).
//   4. Période : même découpage que `filtrerDonnees.ts` (non exporté là-bas,
//      donc recopié ici plutôt que modifié).
//
// Indépendant de l'écran Épargne (`calculEpargne.ts`, des flux) : aucun
// calcul existant n'est appelé ni modifié, sauf `montantDepense`, LU.
//
// Conventions :
//   - mois au format "AAAA-MM" ;
//   - montants arrondis au centime ;
//   - parts et évolutions en RATIO (0,125 = 12,5 %).

import type { PeriodKey, Transaction } from "@/types";
import type { NaturePatrimoine, ReleveSoldeLu } from "@/services/lectureClasseur";
import type { Regles } from "@/calculs/regles";
import { montantDepense } from "@/calculs/mouvements";

/** Valeur de la colonne Banque pour un bien immobilier (format §4 bis). */
export const BANQUE_IMMOBILIER = "Immobilier";

// ─── Outils de mois et d'arrondi ───────────────────────────────────────

/** Arrondi au centime (évite 0,1 + 0,2 = 0,30000000000000004). */
function r2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** "2026-01" → "2025-12". */
export function moisPrecedent(mk: string): string {
  const y = Number(mk.slice(0, 4));
  const m = Number(mk.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** "2025-12" → "2026-01". */
export function moisSuivant(mk: string): string {
  const y = Number(mk.slice(0, 4));
  const m = Number(mk.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Tous les mois de `de` à `a` inclus, sans trou. */
function moisEntre(de: string, a: string): string[] {
  const out: string[] = [];
  for (let mk = de; mk <= a; mk = moisSuivant(mk)) out.push(mk);
  return out;
}

// ─── Interrupteur « Inclure l'immobilier » ─────────────────────────────

/** Natures dans l'ordre d'affichage. */
export const NATURES: NaturePatrimoine[] = ["Epargne", "Liquidité", "Immobilier"];

/** Bien immobilier : banque « Immobilier » OU nature « Immobilier ». */
export function estImmobilier(r: { banque: string; nature: NaturePatrimoine }): boolean {
  return r.banque === BANQUE_IMMOBILIER || r.nature === "Immobilier";
}

/** Désactivé : retire les biens immobiliers (banque ou nature « Immobilier »). */
export function filtrerImmobilier(releves: ReleveSoldeLu[], inclure: boolean): ReleveSoldeLu[] {
  return inclure ? releves : releves.filter((r) => !estImmobilier(r));
}

// ─── Grille mois × compte (report du dernier solde) ────────────────────

/** Un compte de la feuille, avec le mois de son premier relevé. */
export interface InfoCompte {
  compte: string;
  banque: string;
  nature: NaturePatrimoine;
  ordre: number | null;
  /** Premier mois avec un relevé : avant, le compte n'est pas « actif ». */
  premierMois: string;
}

/** Solde d'un compte un mois donné. */
export interface CelluleSolde {
  montant: number;
  /** true = pas de relevé ce mois-là, dernier solde connu repris. */
  repris: boolean;
}

export interface GrilleSoldes {
  /** Mois sans trou, du premier au dernier relevé. */
  mois: string[];
  /** Comptes triés par ordre d'affichage. */
  comptes: InfoCompte[];
  /** mois → compte → solde. Seuls les comptes déjà démarrés y figurent. */
  soldes: Record<string, Record<string, CelluleSolde>>;
  /** mois → nombre de soldes repris du mois précédent. */
  nbRepris: Record<string, number>;
}

/** Une grille sans aucun mois. */
export function grilleVide(): GrilleSoldes {
  return { mois: [], comptes: [], soldes: {}, nbRepris: {} };
}

/**
 * Construit la grille mois × compte.
 *
 * Report : un compte sans relevé un mois, alors qu'il en avait avant, garde
 * son dernier solde (marqué `repris`). Un compte qui n'a pas encore démarré
 * n'a pas de case : il ne compte ni dans les totaux ni dans les reprises.
 *
 * Exemple : un livret à 7 800 € en octobre, rien en novembre, 8 250 € en
 * décembre → novembre = 7 800 € (repris), et nbRepris["novembre"] = 1.
 */
export function construireGrille(releves: ReleveSoldeLu[]): GrilleSoldes {
  if (!releves.length) return grilleVide();

  // Relevés par compte et par mois ; infos du compte = son relevé le plus récent.
  const parCompte = new Map<string, Map<string, number>>();
  const infos = new Map<string, InfoCompte>();
  const dernierVu = new Map<string, string>();
  let premier = releves[0].mk;
  let dernier = releves[0].mk;
  for (const r of releves) {
    if (r.mk < premier) premier = r.mk;
    if (r.mk > dernier) dernier = r.mk;
    if (!parCompte.has(r.compte)) parCompte.set(r.compte, new Map());
    parCompte.get(r.compte)!.set(r.mk, r.montant);
    const prev = infos.get(r.compte);
    const debut = prev && prev.premierMois < r.mk ? prev.premierMois : r.mk;
    if (!prev || r.mk >= dernierVu.get(r.compte)!) {
      infos.set(r.compte, { compte: r.compte, banque: r.banque, nature: r.nature, ordre: r.ordre, premierMois: debut });
      dernierVu.set(r.compte, r.mk);
    } else {
      infos.set(r.compte, { ...prev, premierMois: debut });
    }
  }

  const comptes = Array.from(infos.values()).sort(
    (a, b) => (a.ordre ?? Infinity) - (b.ordre ?? Infinity) || a.compte.localeCompare(b.compte),
  );
  const mois = moisEntre(premier, dernier);
  const soldes: GrilleSoldes["soldes"] = {};
  const nbRepris: GrilleSoldes["nbRepris"] = {};
  const dernierConnu = new Map<string, number>();

  for (const mk of mois) {
    const ligne: Record<string, CelluleSolde> = {};
    let repris = 0;
    for (const c of comptes) {
      const releve = parCompte.get(c.compte)!.get(mk);
      if (releve !== undefined) {
        ligne[c.compte] = { montant: releve, repris: false };
        dernierConnu.set(c.compte, releve);
      } else if (dernierConnu.has(c.compte)) {
        ligne[c.compte] = { montant: dernierConnu.get(c.compte)!, repris: true };
        repris++;
      }
    }
    soldes[mk] = ligne;
    nbRepris[mk] = repris;
  }
  return { mois, comptes, soldes, nbRepris };
}

/**
 * Dernier mois complet : le plus récent où AUCUN solde n'est repris, c'est-à-
 * dire où tous les comptes déjà démarrés ont un vrai relevé.
 *
 * Exemple : août complet → août, même si novembre de l'an dernier avait un
 * oubli. Si août a un oubli ET juillet aussi → juin.
 *
 * ⚠️ Un compte clôturé doit recevoir un relevé à 0 : sinon son solde est
 * repris chaque mois et plus aucun mois n'est complet.
 */
export function dernierMoisComplet(grille: GrilleSoldes): string | null {
  for (let i = grille.mois.length - 1; i >= 0; i--) {
    if (grille.nbRepris[grille.mois[i]] === 0) return grille.mois[i];
  }
  return null;
}

// ─── Totaux d'un mois ──────────────────────────────────────────────────

export interface TotauxMois {
  total: number;
  /** Tout ce qui n'est pas une liquidité : épargne ET immobilier. */
  epargne: number;
  liquidites: number;
}

/** Totaux d'un mois de la grille ; null si le mois n'y est pas. */
export function totauxDuMois(grille: GrilleSoldes, mk: string): TotauxMois | null {
  const ligne = grille.soldes[mk];
  if (!ligne) return null;
  let epargne = 0;
  let liquidites = 0;
  for (const c of grille.comptes) {
    const cell = ligne[c.compte];
    if (!cell) continue;
    if (c.nature === "Liquidité") liquidites += cell.montant;
    else epargne += cell.montant;
  }
  return { total: r2(epargne + liquidites), epargne: r2(epargne), liquidites: r2(liquidites) };
}

// ─── Période (filtre 1M, 3M, 6M, YTD, 12M, Tout) ───────────────────────

export interface PlageMois {
  from: string;
  to: string;
}

/**
 * Plage de la période, finissant au mois `fin`, sans remonter avant `premier`.
 * Même découpage que `filtrerDonnees.ts` : 3M = fin − 3 mois, YTD = janvier
 * → fin… Calculée depuis `fin`, jamais depuis la date du jour.
 */
export function plagePeriode(period: PeriodKey, fin: string, premier: string): PlageMois {
  const y = Number(fin.slice(0, 4));
  const m = Number(fin.slice(5, 7));
  const reculer = (n: number) => {
    const d = new Date(y, m - n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  let from: string;
  switch (period) {
    case "1M": from = fin; break;
    case "3M": from = reculer(3); break;
    case "6M": from = reculer(6); break;
    case "12M": from = reculer(12); break;
    case "all": from = premier; break;
    case "YTD":
    default: from = `${y}-01`;
  }
  if (from < premier) from = premier;
  return { from, to: fin };
}

// ─── Variation mois par mois ───────────────────────────────────────────

export interface VariationMois {
  mk: string;
  /** Total du mois − total du mois précédent. */
  variation: number;
  hausse: boolean;
}

/**
 * Variation du total pour chaque mois de la plage dont le mois précédent est
 * dans la grille (le tout premier mois n'en a donc pas).
 *
 * Exemple YTD fini en août : 8 variations (janvier vs décembre … août vs
 * juillet). Leur somme = août − décembre = KPI 4.
 */
export function variationsMensuelles(grille: GrilleSoldes, plage: PlageMois): VariationMois[] {
  const out: VariationMois[] = [];
  for (const mk of grille.mois) {
    if (mk < plage.from || mk > plage.to) continue;
    const cur = totauxDuMois(grille, mk);
    const prev = totauxDuMois(grille, moisPrecedent(mk));
    if (!cur || !prev) continue;
    const variation = r2(cur.total - prev.total);
    out.push({ mk, variation, hausse: variation >= 0 });
  }
  return out;
}

// ─── Évolution par banque / par nature / par compte ────────────────────

/** Une ligne par mois : `total`, `soldesRepris`, puis une clé par série. */
export interface LigneSerie {
  mk: string;
  total: number;
  soldesRepris: number;
  [serie: string]: string | number;
}

/** Banques dans l'ordre d'affichage (ordre du premier compte de chacune). */
export function banquesOrdonnees(grille: GrilleSoldes): string[] {
  const vues: string[] = [];
  for (const c of grille.comptes) if (!vues.includes(c.banque)) vues.push(c.banque);
  return vues;
}

function serie(
  grille: GrilleSoldes,
  plage: PlageMois,
  cles: string[],
  cleDe: (c: InfoCompte) => string,
): LigneSerie[] {
  return grille.mois
    .filter((mk) => mk >= plage.from && mk <= plage.to)
    .map((mk) => {
      const ligne: LigneSerie = {
        mk, total: totauxDuMois(grille, mk)!.total, soldesRepris: grille.nbRepris[mk],
      };
      const somme: Record<string, number> = Object.fromEntries(cles.map((k) => [k, 0]));
      for (const c of grille.comptes) {
        const cell = grille.soldes[mk][c.compte];
        if (cell) somme[cleDe(c)] += cell.montant;
      }
      for (const k of cles) ligne[k] = r2(somme[k]);
      return ligne;
    });
}

/** Natures présentes dans la grille, dans l'ordre de NATURES. */
export function naturesOrdonnees(grille: GrilleSoldes): NaturePatrimoine[] {
  return NATURES.filter((n) => grille.comptes.some((c) => c.nature === n));
}

/**
 * Évolution « Par banque ». `cles` : banques à sortir (la liste complète,
 * même quand la page est filtrée ; les autres valent 0).
 */
export function serieParBanque(
  grille: GrilleSoldes, plage: PlageMois, cles: string[] = banquesOrdonnees(grille),
): LigneSerie[] {
  return serie(grille, plage, cles, (c) => c.banque);
}

/** Évolution « Par nature » (clés = natures présentes). */
export function serieParNature(
  grille: GrilleSoldes, plage: PlageMois, cles: string[] = naturesOrdonnees(grille),
): LigneSerie[] {
  return serie(grille, plage, cles, (c) => c.nature);
}

/** Graphique « Détail par compte » : une clé par compte (nom du compte). */
export function serieParCompte(grille: GrilleSoldes, plage: PlageMois): LigneSerie[] {
  return serie(grille, plage, grille.comptes.map((c) => c.compte), (c) => c.compte);
}

// ─── Répartition (donut) ───────────────────────────────────────────────

export interface PartBanque {
  banque: string;
  montant: number;
  /** Part du total (ratio) ; null si le total est nul ou négatif. */
  part: number | null;
}

/** Répartition par banque d'un mois, du plus gros au plus petit. */
export function repartitionParBanque(grille: GrilleSoldes, mk: string): PartBanque[] {
  const ligne = grille.soldes[mk];
  if (!ligne) return [];
  const somme = new Map<string, number>();
  for (const b of banquesOrdonnees(grille)) somme.set(b, 0);
  for (const c of grille.comptes) {
    const cell = ligne[c.compte];
    if (cell) somme.set(c.banque, somme.get(c.banque)! + cell.montant);
  }
  const total = totauxDuMois(grille, mk)!.total;
  return Array.from(somme.entries())
    .filter(([, v]) => v !== 0)
    .map(([banque, v]) => ({ banque, montant: r2(v), part: total > 0 ? v / total : null }))
    .sort((a, b) => b.montant - a.montant);
}

export interface PartCompte {
  compte: string;
  banque: string;
  montant: number;
  /** Part du total de la sélection (ratio) ; null si total nul ou négatif. */
  part: number | null;
}

/** Répartition par compte d'un mois (page filtrée), du plus gros au plus petit. */
export function repartitionParCompte(grille: GrilleSoldes, mk: string): PartCompte[] {
  const ligne = grille.soldes[mk];
  if (!ligne) return [];
  const total = totauxDuMois(grille, mk)!.total;
  return grille.comptes
    .filter((c) => ligne[c.compte] && ligne[c.compte].montant !== 0)
    .map((c) => {
      const v = ligne[c.compte].montant;
      return { compte: c.compte, banque: c.banque, montant: r2(v), part: total > 0 ? v / total : null };
    })
    .sort((a, b) => b.montant - a.montant);
}

// ─── Tableau des comptes ───────────────────────────────────────────────

export interface LigneCompte extends InfoCompte {
  solde: number;
  /** Solde − solde du mois précédent (0 si le compte n'existait pas encore). */
  variation1Mois: number;
  /** Solde − solde de décembre N-1 (0 si le compte n'existait pas encore). */
  variationDepuisJanvier: number;
  /** Poids dans le total du mois (ratio) ; null si total nul ou négatif. */
  poids: number | null;
  /** Mini-courbe : solde de chaque mois de la plage où le compte existe. */
  historique: { mk: string; solde: number }[];
}

/**
 * Lignes du tableau des comptes au mois `mk`, dans l'ordre d'affichage.
 *
 * Un compte absent le mois de référence compte pour 0 : les variations des
 * comptes s'additionnent alors exactement aux variations du total (KPI 1 et 4).
 * Exemple : assurance-vie ouverte en mars, 1 120 € en sept. → +1 120 depuis janvier.
 */
export function lignesComptes(grille: GrilleSoldes, mk: string, plage: PlageMois): LigneCompte[] {
  const ligne = grille.soldes[mk];
  if (!ligne) return [];
  const total = totauxDuMois(grille, mk)!.total;
  const prec = grille.soldes[moisPrecedent(mk)] ?? {};
  const dec = grille.soldes[`${Number(mk.slice(0, 4)) - 1}-12`] ?? {};
  return grille.comptes
    .filter((c) => ligne[c.compte])
    .map((c) => {
      const solde = ligne[c.compte].montant;
      return {
        ...c,
        solde,
        variation1Mois: r2(solde - (prec[c.compte]?.montant ?? 0)),
        variationDepuisJanvier: r2(solde - (dec[c.compte]?.montant ?? 0)),
        poids: total > 0 ? solde / total : null,
        historique: grille.mois
          .filter((m) => m >= plage.from && m <= plage.to && grille.soldes[m][c.compte])
          .map((m) => ({ mk: m, solde: grille.soldes[m][c.compte].montant })),
      };
    });
}

// ─── KPI 6 : dépenses mensuelles moyennes ──────────────────────────────

export interface DepensesMoyennes {
  /** Dépense moyenne par mois (€). */
  moyenne: number;
  /** Mois de la plage qui ont des transactions. */
  nbMois: number;
}

/**
 * Dépenses mensuelles moyennes sur la plage, lues dans les transactions.
 *
 * Règle de la page Dépenses : la dépense NETTE (`montantDepense` : un débit
 * compte en plus, un remboursement en moins), SANS les types de nature
 * `transfert-interne` déclarés par la source. Le remboursement du prêt reste
 * dedans. Moyenne sur les mois de la plage qui ont au moins une transaction
 * (un mois sans données ne compte pas pour 0).
 *
 * Source qui ne déclare rien : aucun transfert n'est exclu (règles vides).
 *
 * Exemple : janv. 1 000 €, févr. 1 200 €, mars 800 € → 3 000 ÷ 3 = 1 000 €/mois.
 */
export function depensesMensuellesMoyennes(
  transactions: Transaction[],
  plage: PlageMois,
  regles: Regles,
): DepensesMoyennes | null {
  const mois = new Set<string>();
  let total = 0;
  for (const t of transactions) {
    if (t.monthKey < plage.from || t.monthKey > plage.to) continue;
    mois.add(t.monthKey);
    if (regles.aNature(t.type, "transfert-interne")) continue;
    total += montantDepense(t, regles);
  }
  if (!mois.size) return null;
  return { moyenne: r2(total / mois.size), nbMois: mois.size };
}

// ─── KPI 1 à 6 ─────────────────────────────────────────────────────────

export interface KpisPatrimoine {
  /** Mois des KPI : le dernier mois complet. */
  mois: string;
  // KPI 1 — Patrimoine total
  total: number;
  totalMoisPrecedent: number | null;
  variationMois: number | null;
  // KPI 2 — Épargne placée (immobilier compris)
  epargne: number;
  // KPI 3 — Liquidités
  liquidites: number;
  partLiquidites: number | null;
  // KPI 4 — Depuis le 1er janvier : total du mois − total de décembre N-1
  evolutionAnnee: { reference: string; montant: number; ratio: number | null } | null;
  // KPI 5 — Gain mensuel moyen : moyenne des variations mensuelles de la période
  gainMensuelMoyen: { montant: number; nbMois: number } | null;
  // KPI 6 — Matelas de sécurité : liquidités ÷ dépenses mensuelles moyennes
  matelas: { nbMois: number; depensesMensuelles: number; nbMoisDepenses: number } | null;
}

/**
 * KPI 1 à 6 au mois `mk` (le dernier mois complet).
 *
 * KPI 4 : null si décembre N-1 n'est pas dans la grille (feuille commencée
 * cette année). KPI 5 et KPI 6 : sur la plage de la période choisie.
 */
export function calculerKpis(
  grille: GrilleSoldes,
  mk: string,
  plage: PlageMois,
  transactions: Transaction[],
  regles: Regles,
): KpisPatrimoine | null {
  const cur = totauxDuMois(grille, mk);
  if (!cur) return null;
  const prev = totauxDuMois(grille, moisPrecedent(mk));

  const reference = `${Number(mk.slice(0, 4)) - 1}-12`;
  const dec = totauxDuMois(grille, reference);
  const evolutionAnnee = dec
    ? {
        reference,
        montant: r2(cur.total - dec.total),
        ratio: dec.total > 0 ? (cur.total - dec.total) / dec.total : null,
      }
    : null;

  const variations = variationsMensuelles(grille, plage);
  const gainMensuelMoyen = variations.length
    ? { montant: r2(variations.reduce((s, v) => s + v.variation, 0) / variations.length), nbMois: variations.length }
    : null;

  const dep = depensesMensuellesMoyennes(transactions, plage, regles);
  const matelas = dep && dep.moyenne > 0
    ? { nbMois: cur.liquidites / dep.moyenne, depensesMensuelles: dep.moyenne, nbMoisDepenses: dep.nbMois }
    : null;

  return {
    mois: mk,
    total: cur.total,
    totalMoisPrecedent: prev ? prev.total : null,
    variationMois: prev ? r2(cur.total - prev.total) : null,
    epargne: cur.epargne,
    liquidites: cur.liquidites,
    partLiquidites: cur.total > 0 ? cur.liquidites / cur.total : null,
    evolutionAnnee,
    gainMensuelMoyen,
    matelas,
  };
}

// ─── Tout le sous-onglet en un appel ───────────────────────────────────

/** Filtre de la page par clic sur la légende du graphique Évolution. */
export interface SelectionPatrimoine {
  par: "banque" | "nature";
  /** Banques ou natures retenues (plusieurs possibles). */
  valeurs: string[];
}

export interface OptionsPatrimoine {
  inclureImmobilier: boolean;
  period: PeriodKey;
  transactions: Transaction[];
  /** Filtre de toute la page ; absent ou vide = tout. */
  selection?: SelectionPatrimoine | null;
  /** Mois du donut (clic sur l'Évolution) ; absent = dernier mois complet. */
  moisRepartition?: string | null;
}

export interface ResultatPatrimoine {
  grille: GrilleSoldes;
  /** null si aucun mois n'est complet (ou aucun relevé). */
  dernierMoisComplet: string | null;
  /** Mois plus récents que le dernier mois complet (saisie en cours). */
  moisIncomplets: string[];
  /** Plage des graphiques et des KPI 5 et 6, finie au dernier mois complet. */
  plage: PlageMois | null;
  /** Le jeu contient-il de l'immobilier ? (afficher l'interrupteur) */
  aDeLImmobilier: boolean;
  kpis: KpisPatrimoine | null;
  banques: string[];
  serieParBanque: LigneSerie[];
  serieParNature: LigneSerie[];
  variations: VariationMois[];
  repartition: PartBanque[];
  comptes: LigneCompte[];
  /** Natures présentes (légende « Par nature »), même si la page est filtrée. */
  natures: NaturePatrimoine[];
  /** Valeurs du filtre réellement appliquées (les inconnues sont écartées). */
  selection: string[];
  /** Mois du donut : `moisRepartition` s'il est valide, sinon le dernier mois complet. */
  moisRepartition: string | null;
  /** Donut quand la page est filtrée : répartition par compte (sinon vide). */
  repartitionParCompte: PartCompte[];
  /** Graphique « Détail par compte » (page filtrée seulement, sinon vide). */
  serieParCompte: LigneSerie[];
  /** Comptes du graphique « Détail par compte », dans l'ordre d'affichage. */
  comptesSerie: string[];
}

/** Un résultat sans aucun chiffre (pas de relevé). */
export function resultatVide(): ResultatPatrimoine {
  return {
    grille: grilleVide(), dernierMoisComplet: null, moisIncomplets: [], plage: null,
    aDeLImmobilier: false, kpis: null, banques: [], serieParBanque: [], serieParNature: [],
    variations: [], repartition: [], comptes: [],
    natures: [], selection: [], moisRepartition: null,
    repartitionParCompte: [], serieParCompte: [], comptesSerie: [],
  };
}

/**
 * Calcule tout le sous-onglet Patrimoine.
 *
 * - Interrupteur coupé : les biens immobiliers sortent de TOUT (KPI,
 *   graphiques, légendes).
 * - Sélection : filtre toute la page ; le mois complet se juge sur elle.
 *   Les légendes gardent toutes les valeurs (calculées avant le filtre).
 */
export function calculerPatrimoine(
  releves: ReleveSoldeLu[],
  opts: OptionsPatrimoine,
  regles: Regles,
): ResultatPatrimoine {
  const aDeLImmobilier = releves.some(estImmobilier);
  const base = filtrerImmobilier(releves, opts.inclureImmobilier);

  // Légendes : listes complètes, calculées AVANT le filtre de la page.
  const grilleBase = construireGrille(base);
  const banques = banquesOrdonnees(grilleBase);
  const natures = naturesOrdonnees(grilleBase);

  // Filtre de la page (clic légende) : valeurs inconnues écartées.
  const sel = opts.selection;
  const connues: string[] = sel ? (sel.par === "banque" ? banques : natures) : [];
  const selection = sel ? sel.valeurs.filter((v) => connues.includes(v)) : [];
  const grille = selection.length
    ? construireGrille(base.filter((r) => selection.includes(sel!.par === "banque" ? r.banque : r.nature)))
    : grilleBase;

  const mk = dernierMoisComplet(grille);
  const vide: ResultatPatrimoine = {
    ...resultatVide(),
    grille, dernierMoisComplet: mk, aDeLImmobilier,
    banques, natures, selection, moisRepartition: mk,
  };
  if (!mk) return { ...vide, moisIncomplets: grille.mois };

  const plage = plagePeriode(opts.period, mk, grille.mois[0]);
  const choisi = opts.moisRepartition;
  const moisRepartition = choisi && grille.mois.includes(choisi) && choisi <= mk ? choisi : mk;
  return {
    ...vide,
    moisIncomplets: grille.mois.filter((m) => m > mk),
    plage,
    kpis: calculerKpis(grille, mk, plage, opts.transactions, regles),
    serieParBanque: serieParBanque(grille, plage, banques),
    serieParNature: serieParNature(grille, plage, natures),
    variations: variationsMensuelles(grille, plage),
    repartition: repartitionParBanque(grille, moisRepartition),
    comptes: lignesComptes(grille, mk, plage),
    moisRepartition,
    repartitionParCompte: selection.length ? repartitionParCompte(grille, moisRepartition) : [],
    serieParCompte: selection.length ? serieParCompte(grille, plage) : [],
    comptesSerie: selection.length ? grille.comptes.map((c) => c.compte) : [],
  };
}
