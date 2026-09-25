/**
 * useMortgageData — Hook de la page Prêt Immobilier (Session 3A, Phase 3).
 *
 * Reconstruit le suivi complet du prêt à partir des transactions :
 *   - un type de nature `pret-capital`  → part capital de la mensualité ;
 *   - un type de nature `pret-interets` → part intérêts de la mensualité.
 * Les mois antérieurs au premier prélèvement connu sont reconstitués via le
 * tableau d'amortissement théorique.
 *
 * Lot F.1 — la position se CALCULE depuis la date déclarée : l'échéance
 * courante est le nombre de mois entre l'échéance n° 1 et le dernier mois des
 * données. Les transactions ne servent plus à deviner où on en est.
 *
 * Sans date (ancienne forme, F8), l'astuce d'origine reste :
 * intérêts = solde_début × r, donc solde_début = intérêts / r et
 * solde_fin = solde_début − capital. La position est alors ESTIMÉE
 * (`positionEstimee`), et l'écran le dit.
 *
 * Consomme : useDataStore (transactions) et le bloc Prêt de la source. Sans
 * bloc Prêt déclaré, `pret` est null (E.3) : ni KPI ni projection, seulement
 * l'historique réel des transactions.
 *
 * @returns status, hasData, kpis (capital restant/remboursé, échéances, intérêts),
 *   historyData (capital/intérêts mensuels réels), projectionData (capital restant
 *   dû jusqu'à la fin), donutData (remboursé vs restant), dateFin, currentMonth,
 *   et simulate(extra) — simulateur what-if de remboursement anticipé mensuel.
 */

import { mkLabel } from "@/utils/formatters";
import type { Config, Transaction } from "@/types";
import type { Regles } from "@/calculs/regles";

// ─── Prêt : plus aucune valeur par défaut (E.3) ────────────────────────
// Les trois constantes de repli LOAN_PRINCIPAL/PAYMENT/TERMS ont été
// SUPPRIMÉES au lot E.2. C'était la dernière valeur par défaut chiffrée du
// dashboard : un prêt inventé présenté comme celui de la personne. Sans bloc
// Prêt déclaré par la source, l'écran ne montre plus que l'historique réel
// des transactions, et le DIT.

/**
 * Les deux types qui font exister un prêt dans les données.
 *
 * Exportés depuis le lot B.4 : `useRubriques` s'en sert pour décider si
 * l'écran Prêt immobilier a lieu d'être. Une seule source, sinon les deux
 * définitions divergent le jour où un type change.
 */
// ⚠️ Lot C.4 — `TYPE_PRET_CAPITAL` et `TYPE_PRET_INTERETS` ont été SUPPRIMÉS.
//
// Deux libellés faisaient apparaître ou disparaître un écran entier. Le
// capital et les intérêts sont désormais reconnus par les natures
// `pret-capital` et `pret-interets` déclarées par la source. Plus aucun
// calcul ne les lisait : les garder « au cas où » aurait été le champ mort
// que D4 a supprimé de `Config`.




export interface MortgageKPIs {
  principal: number;        // Montant initial
  capitalRestant: number;   // Capital restant dû
  capitalRembourse: number; // Capital déjà remboursé
  avancement: number;       // Ratio 0..1 (capital remboursé / principal)
  echeancesPayees: number;
  echeancesRestantes: number;
  mensualite: number;
  tauxAnnuel: number;       // Taux nominal annuel (ratio, ex: 0.013)
  interetsPayes: number;    // Intérêts cumulés payés (théoriques)
  interetsRestants: number; // Intérêts restant à payer
  coutTotalInterets: number;// Coût total des intérêts sur la durée
}

export interface MortgageHistoryPoint {
  monthKey: string;
  label: string;
  capital: number;
  interets: number;
  total: number;
}

export interface MortgageProjectionPoint {
  monthKey: string;
  label: string;
  echeance: number;
  capitalRestant: number;
  isProjection: boolean;
}

export interface DonutSlice {
  name: string;
  value: number;
}

/**
 * Un mois où les transactions ne concordent pas avec l'échéancier déclaré —
 * lot F.2. Tous les montants en euros, arrondis au centime.
 */
export interface EcartPret {
  monthKey: string;
  /** N° d'échéance que la déclaration attend ce mois-là (0 = avant le début, > durée = après la fin). */
  echeance: number;
  interetsLus: number;
  interetsAttendus: number;
  mensualiteLue: number;
  mensualiteAttendue: number;
}

/**
 * Le contrôle de cohérence F2 : les transactions VÉRIFIENT la déclaration.
 *
 * `etat` :
 *  - `sans-objet` : rien à comparer (pas de date — la position est alors
 *    déduite des transactions elles-mêmes, les comparer serait circulaire —
 *    ou aucun mois portant capital ET intérêts) ;
 *  - `concorde` : tous les mois comparés tiennent dans les tolérances (O1) ;
 *  - `diverge` : au moins un mois en sort. `message` le dit, chiffré.
 */
export interface ControlePret {
  etat: "sans-objet" | "concorde" | "diverge";
  moisCompares: number;
  ecarts: EcartPret[];
  /** Phrase prête à afficher. Vide quand `etat` vaut `concorde`. */
  message: string;
}

/** O1 — tolérances du contrôle F2, en euros. */
export const TOLERANCE_INTERETS = 2;
export const TOLERANCE_MENSUALITE = 5;

export interface SimulationResult {
  extra: number;            // Remboursement anticipé mensuel simulé
  dateFin: string;          // monthKey de fin
  moisGagnes: number;       // Mois économisés vs scénario actuel
  economieInterets: number; // Intérêts économisés (€)
  echeancesRestantes: number;
}

/** Ajoute n mois à un monthKey "YYYY-MM". */
function addMonths(mk: string, n: number): string {
  const y = parseInt(mk.slice(0, 4), 10);
  const m = parseInt(mk.slice(5, 7), 10);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Nombre de mois de `a` à `b` ("YYYY-MM"), positif si `b` est après `a`. */
function moisEntre(a: string, b: string): number {
  const n = (mk: string) => parseInt(mk.slice(0, 4), 10) * 12 + parseInt(mk.slice(5, 7), 10) - 1;
  return n(b) - n(a);
}

/**
 * Le mois du prêt, tel que la configuration le porte — lot F.1.
 * Accepte `AAAA-MM` ou `AAAA-MM-JJ` (le lecteur écrit déjà `AAAA-MM`).
 * Rend `null` pour tout le reste : un mois n'est jamais deviné.
 */
function moisDuPret(v: string | undefined): string | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!m) return null;
  const mois = parseInt(m[2], 10);
  return mois >= 1 && mois <= 12 ? `${m[1]}-${m[2]}` : null;
}

/** Résout le taux périodique r tel que payment = P·r / (1−(1+r)^−n). */
function solveMonthlyRate(p: number, payment: number, n: number): number {
  if (payment * n <= p) return 0; // prêt à taux nul (ou incohérent)
  let lo = 1e-7;
  let hi = 0.05;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const pay = (p * mid) / (1 - Math.pow(1 + mid, -n));
    if (pay > payment) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Mensualité d'un prêt à annuités constantes — lot E.1.
 *
 * `M = montant · r / (1 − (1 + r)^−durée)`, avec `r = tauxAnnuel / 12`.
 * C'est l'inverse de `solveMonthlyRate` : ici le taux et la durée sont
 * connus, la mensualité se calcule directement — exact, sans approximation.
 * Un taux annuel de 0 % donne `montant / durée`, sans division par zéro.
 *
 * `tauxAnnuel` est un ratio (0,018 pour 1,8 %/an). Le résultat est arrondi
 * au centime.
 */
export function mensualiteDepuisTaux(
  montant: number,
  tauxAnnuel: number,
  dureeMois: number
): number {
  const r = tauxAnnuel / 12;
  const brut =
    r === 0
      ? montant / dureeMois
      : (montant * r) / (1 - Math.pow(1 + r, -dureeMois));
  return Math.round(brut * 100) / 100;
}

/**
 * Le calcul du prêt, sorti de React — lot C.3.
 *
 * Lot C.4 : le capital et les intérêts sont reconnus par les natures
 * `pret-capital` et `pret-interets` déclarées par la source. Sans type
 * déclaré, l'écran Prêt n'a pas de données — et il le dit.
 */
export function calculerPret(
  transactions: Transaction[],
  config: Config | null,
  regles: Regles
) {

  /**
   * Historique mensuel réel du prêt, reconstruit depuis les transactions de
   * nature `pret-capital` et `pret-interets`. Il ne dépend PAS d'un bloc Prêt
   * déclaré : c'est la seule chose que l'écran montre quand le prêt n'est pas
   * paramétré (E.3).
   */
  const historyData = ((): MortgageHistoryPoint[] => {
    const map = new Map<string, { capital: number; interets: number }>();
    for (const t of transactions) {
      const capital = regles.aNature(t.type, "pret-capital");
      const interets = regles.aNature(t.type, "pret-interets");
      if (!capital && !interets) continue;
      const cur = map.get(t.monthKey) ?? { capital: 0, interets: 0 };
      if (capital) cur.capital += t.montant;
      else cur.interets += t.montant;
      map.set(t.monthKey, cur);
    }
    return Array.from(map.entries())
      .map(([monthKey, v]) => ({
        monthKey,
        label: mkLabel(monthKey),
        capital: Math.round(v.capital * 100) / 100,
        interets: Math.round(v.interets * 100) / 100,
        total: Math.round((v.capital + v.interets) * 100) / 100,
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  })();

  // Vrai dès qu'il y a un historique de prêt à montrer — indépendant du bloc.
  const hasData = historyData.length > 0;

  /**
   * Les paramètres du prêt viennent de la source, ou de nulle part (E.3).
   * `null` = aucun bloc Prêt déclaré : plus de constantes de repli. Un bloc
   * incomplet est ignoré en entier, comme au lecteur.
   */
  const pret = (() => {
    const p = config?.pret;
    if (
      p &&
      typeof p.montant === "number" && p.montant > 0 &&
      typeof p.mensualite === "number" && p.mensualite > 0 &&
      typeof p.echeances === "number" && p.echeances > 0
    ) {
      return {
        montant: p.montant, mensualite: p.mensualite, echeances: p.echeances,
        tauxAnnuel: p.taux_annuel,
        // F.1 — le mois de l'échéance n° 1. `date_debut` et
        // `premiere_echeance` en sont deux noms (O5). `null` = pas de date :
        // la position sera ESTIMÉE par les intérêts, et l'écran le dira (F8).
        mois: moisDuPret(p.date_debut) ?? moisDuPret(p.premiere_echeance),
      };
    }
    return null;
  })();

  const pretDeclare = pret !== null;

  // Sans bloc Prêt, l'écran ne montre QUE l'historique des transactions :
  // aucun KPI, aucune projection, aucun échéancier — rien qui ne vienne de la
  // source. C'est E.3 : le dernier prêt inventé du dashboard a disparu.
  if (!pret) {
    return {
      pretDeclare: false,
      positionEstimee: false,
      moisDebut: "",
      controle: {
        etat: "sans-objet", moisCompares: 0, ecarts: [],
        message: "Aucun prêt déclaré : rien à vérifier.",
      } as ControlePret,
      hasData,
      kpis: null,
      historyData,
      projectionData: [] as MortgageProjectionPoint[],
      donutData: [] as DonutSlice[],
      dateFin: "",
      currentMonth: "",
      simulate: (extra: number): SimulationResult => ({
        extra,
        dateFin: "",
        moisGagnes: 0,
        economieInterets: 0,
        echeancesRestantes: 0,
      }),
    };
  }

  // ─── Taux périodique dérivé des paramètres du prêt ────────────────
  // E.1 : quand la source déclare le taux (forme « taux »), on l'utilise
  // directement — exact. Sinon (forme « mensualité »), on le retrouve par
  // approximation.
  const rate =
    pret.tauxAnnuel != null
      ? pret.tauxAnnuel / 12
      : solveMonthlyRate(pret.montant, pret.mensualite, pret.echeances);

  // ─── Échéancier théorique complet ─────────────────────────────────
  // amort[k] = { interet, capital, solde } pour l'échéance k (1-indexé via k-1)
  const schedule = (() => {
    const rows: { interet: number; capital: number; solde: number }[] = [];
    let balance = pret.montant;
    for (let k = 0; k < pret.echeances; k++) {
      const interet = balance * rate;
      const capital = pret.mensualite - interet;
      balance = Math.max(0, balance - capital);
      rows.push({ interet, capital, solde: balance });
    }
    return rows;
  })();

  // ─── Nombre d'échéances restantes pour un solde donné ─────────────
  const remainingTerms = (balance: number, payment = pret.mensualite): number => {
    if (balance <= 0 || rate <= 0) return 0;
    const x = 1 - (balance * rate) / payment;
    if (x <= 0) return pret.echeances; // mensualité ne couvre pas les intérêts
    return -Math.log(x) / Math.log(1 + rate);
  };

  // ─── Où en est le prêt ? ──────────────────────────────────────────
  //
  // F.1 — avec une date, la position se CALCULE : l'échéance courante est le
  // nombre de mois entre l'échéance n° 1 et le dernier mois des données (F1).
  // Jamais l'horloge de la machine : la démonstration reste la même d'un jour
  // à l'autre. Avant la date, le prêt n'a pas commencé (échéance 0) ; après
  // la dernière échéance, il est soldé.
  //
  // F8 — sans date, l'ancienne méthode reste : la position se DÉDUIT des
  // intérêts du dernier mois (`solde = intérêts / taux`). Elle est estimée, et
  // l'écran le dit.
  const dernierMoisDonnees = transactions.reduce(
    (max, t) => (t.monthKey > max ? t.monthKey : max),
    ""
  );
  const positionEstimee = pret.mois === null;

  const current = (() => {
    if (pret.mois !== null) {
      if (!dernierMoisDonnees) {
        return { monthKey: "", echeance: 0, capitalRestant: pret.montant };
      }
      const echeance = Math.min(
        pret.echeances,
        Math.max(0, moisEntre(pret.mois, dernierMoisDonnees) + 1)
      );
      const capitalRestant = echeance === 0 ? pret.montant : schedule[echeance - 1].solde;
      return { monthKey: dernierMoisDonnees, echeance, capitalRestant };
    }
    // Dernier mois disposant d'intérêts ET de capital
    const last = [...historyData]
      .reverse()
      .find((p) => p.interets > 0 && p.capital > 0);
    if (!last) {
      return { monthKey: "", echeance: 0, capitalRestant: pret.montant };
    }
    const soldeDebut = last.interets / rate;
    const capitalRestant = Math.max(0, soldeDebut - last.capital);
    const echeance = Math.round(pret.echeances - remainingTerms(capitalRestant));
    return { monthKey: last.monthKey, echeance, capitalRestant };
  })();

  // ─── F.2 — les transactions vérifient la déclaration ──────────────
  //
  // Pour chaque mois qui porte du capital ET des intérêts, on compare avec
  // l'échéance que la déclaration attend ce mois-là. Hors tolérance (O1),
  // l'outil le DIT, chiffré, et nomme ce qu'il faut vérifier. Il ne corrige
  // rien : un remboursement anticipé, une modulation ou un différé font
  // légitimement diverger l'échéancier (O2), et seul l'utilisateur le sait.
  const controle = ((): ControlePret => {
    const sansObjet = (message: string): ControlePret =>
      ({ etat: "sans-objet", moisCompares: 0, ecarts: [], message });
    if (pret.mois === null) {
      return sansObjet(
        "Contrôle impossible sans date : la position est déduite des transactions elles-mêmes."
      );
    }
    const compares = historyData.filter((p) => p.capital > 0 && p.interets > 0);
    if (compares.length === 0) {
      return sansObjet("Aucun mois ne porte à la fois du capital et des intérêts : rien à comparer.");
    }
    const ecarts: EcartPret[] = [];
    for (const p of compares) {
      const k = moisEntre(pret.mois, p.monthKey) + 1;
      const ligne = k >= 1 && k <= pret.echeances ? schedule[k - 1] : null;
      const interetsAttendus = ligne ? Math.round(ligne.interet * 100) / 100 : 0;
      const mensualiteAttendue = ligne ? pret.mensualite : 0;
      if (
        Math.abs(p.interets - interetsAttendus) > TOLERANCE_INTERETS ||
        Math.abs(p.total - mensualiteAttendue) > TOLERANCE_MENSUALITE
      ) {
        ecarts.push({
          monthKey: p.monthKey, echeance: k,
          interetsLus: p.interets, interetsAttendus,
          mensualiteLue: p.total, mensualiteAttendue,
        });
      }
    }
    if (ecarts.length === 0) {
      return { etat: "concorde", moisCompares: compares.length, ecarts, message: "" };
    }

    const eur = (x: number) => `${x.toFixed(2).replace(".", ",")} €`;
    const e = ecarts[0];
    const hors =
      e.echeance < 1 ? " — avant la première échéance déclarée"
      : e.echeance > pret.echeances ? " — après la dernière échéance déclarée"
      : "";
    let message =
      `Vos transactions ne concordent pas avec le prêt déclaré sur ${ecarts.length} ` +
      `mois sur ${compares.length}. Premier écart : ${mkLabel(e.monthKey)} ` +
      `(échéance n° ${e.echeance}${hors}) — intérêts lus ${eur(e.interetsLus)}, ` +
      `attendus ${eur(e.interetsAttendus)} ; mensualité lue ${eur(e.mensualiteLue)}, ` +
      `attendue ${eur(e.mensualiteAttendue)}. Vérifiez la date de début et le taux.`;

    // Une piste, pas une correction : si les intérêts du dernier mois comparé
    // correspondent à une autre échéance du même échéancier, la date déclarée
    // est sans doute décalée — on dit laquelle collerait.
    const dernier = compares[compares.length - 1];
    let meilleur = -1;
    let ecartMin = Infinity;
    schedule.forEach((r, i) => {
      const d = Math.abs(r.interet - dernier.interets);
      if (d < ecartMin) { ecartMin = d; meilleur = i; }
    });
    const kDernier = moisEntre(pret.mois, dernier.monthKey) + 1;
    if (meilleur >= 0 && ecartMin <= TOLERANCE_INTERETS && meilleur + 1 !== kDernier) {
      const dateProposee = addMonths(dernier.monthKey, -meilleur);
      message +=
        ` Les intérêts de ${mkLabel(dernier.monthKey)} correspondent à l'échéance ` +
        `n° ${meilleur + 1}, soit une date de début en ${mkLabel(dateProposee)}.`;
    }
    message +=
      " Un remboursement anticipé, une modulation ou un différé expliquent aussi " +
      "un écart : l'outil ne les modélise pas.";
    return { etat: "diverge", moisCompares: compares.length, ecarts, message };
  })();

  // ─── KPIs ─────────────────────────────────────────────────────────
  const kpis = ((): MortgageKPIs => {
    const capitalRestant = current.capitalRestant;
    const capitalRembourse = pret.montant - capitalRestant;
    const echeancesPayees = Math.max(0, current.echeance);
    const echeancesRestantes = pret.echeances - echeancesPayees;
    const coutTotalInterets = pret.mensualite * pret.echeances - pret.montant;
    // Intérêts payés = somme des intérêts théoriques des échéances passées
    const interetsPayes = schedule
      .slice(0, echeancesPayees)
      .reduce((s, r) => s + r.interet, 0);
    return {
      principal: pret.montant,
      capitalRestant,
      capitalRembourse,
      avancement: capitalRembourse / pret.montant,
      echeancesPayees,
      echeancesRestantes,
      mensualite: pret.mensualite,
      tauxAnnuel: rate * 12,
      interetsPayes,
      interetsRestants: coutTotalInterets - interetsPayes,
      coutTotalInterets,
    };
  })();

  // ─── Projection du capital restant dû (historique + futur) ────────
  const projectionData = ((): MortgageProjectionPoint[] => {
    if (!current.monthKey) return [];
    // Échéance #1 : le mois déclaré (F.1) ; sans date, déduite du dernier
    // mois réel − (echeance − 1) mois (F8).
    const firstMonth = pret.mois ?? addMonths(current.monthKey, -(current.echeance - 1));
    return schedule.map((r, idx) => {
      const monthKey = addMonths(firstMonth, idx);
      return {
        monthKey,
        label: mkLabel(monthKey),
        echeance: idx + 1,
        capitalRestant: Math.round(r.solde),
        isProjection: monthKey > current.monthKey,
      };
    });
  })();

  // ─── Donut remboursé / restant ────────────────────────────────────
  const donutData: DonutSlice[] = [
    { name: "Capital remboursé", value: Math.round(kpis.capitalRembourse) },
    { name: "Capital restant", value: Math.round(kpis.capitalRestant) },
  ];

  // ─── Date de fin au rythme actuel ─────────────────────────────────
  const dateFin = (() => {
    if (!current.monthKey) return "";
    // Avec une date, la dernière échéance est connue : n° 1 + (durée − 1).
    if (pret.mois !== null) return addMonths(pret.mois, pret.echeances - 1);
    return addMonths(current.monthKey, kpis.echeancesRestantes);
  })();

  // ─── Simulateur what-if (remboursement anticipé mensuel) ──────────
  const simulate = (extra: number): SimulationResult => {
      const B = current.capitalRestant;
      const baseRem = remainingTerms(B);
      if (!current.monthKey || B <= 0) {
        return { extra, dateFin, moisGagnes: 0, economieInterets: 0, echeancesRestantes: 0 };
      }
      if (extra <= 0) {
        return {
          extra: 0,
          dateFin,
          moisGagnes: 0,
          economieInterets: 0,
          echeancesRestantes: Math.ceil(baseRem),
        };
      }
      const newPayment = pret.mensualite + extra;
      const newRem = remainingTerms(B, newPayment);
      const interetsBase = pret.mensualite * baseRem - B;
      const interetsNew = newPayment * newRem - B;
      return {
        extra,
        dateFin: addMonths(current.monthKey, Math.ceil(newRem)),
        moisGagnes: Math.round(Math.ceil(baseRem) - Math.ceil(newRem)),
        economieInterets: Math.max(0, interetsBase - interetsNew),
        echeancesRestantes: Math.ceil(newRem),
      };
  };

  return {
    pretDeclare,
    /** F8 — vrai quand le prêt n'a pas de date : la position est déduite des intérêts. */
    positionEstimee,
    /** F.1 — le mois de l'échéance n° 1 déclaré, `""` sans date. */
    moisDebut: pret.mois ?? "",
    /** F.2 — les transactions vérifient-elles la déclaration ? */
    controle,
    hasData,
    kpis,
    historyData,
    projectionData,
    donutData,
    dateFin,
    currentMonth: current.monthKey,
    simulate,
  };
}
