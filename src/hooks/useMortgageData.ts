/**
 * useMortgageData — Hook de la page Prêt Immobilier (Session 3A, Phase 3).
 *
 * Reconstruit le suivi complet du prêt à partir des transactions :
 *   - type "Crédit Immobilier" → part capital de la mensualité ;
 *   - type "Intérêt du prêt"   → part intérêts de la mensualité.
 * Les mois antérieurs au premier prélèvement connu sont reconstitués via le
 * tableau d'amortissement théorique.
 *
 * Astuce mathématique : intérêts = solde_début × r, donc solde_début = intérêts / r
 * et solde_fin = solde_début − capital. Le capital restant dû se reconstruit
 * exactement sans connaître la date de début du prêt.
 *
 * Consomme : useDataStore (transactions). Paramètres du prêt en constantes
 * (LOAN_PRINCIPAL/PAYMENT/TERMS), destinés à terme à venir de la table `config` D1.
 *
 * @returns status, hasData, kpis (capital restant/remboursé, échéances, intérêts),
 *   historyData (capital/intérêts mensuels réels), projectionData (capital restant
 *   dû jusqu'à la fin), donutData (remboursé vs restant), dateFin, currentMonth,
 *   et simulate(extra) — simulateur what-if de remboursement anticipé mensuel.
 */

import { useMemo, useCallback } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { mkLabel } from "@/utils/formatters";

// ─── Paramètres du prêt ────────────────────────────────────────────────
// Valeurs FICTIVES, cohérentes entre elles (taux nominal ≈ 1,80 %/an).
// Elles décrivent le prêt de la démonstration, pas un prêt réel.
// Au lot A.3 elles seront produites par le générateur et lues depuis
// `config.json` ; au lot B elles viendront de la feuille « Paramètres ».
export const LOAN_PRINCIPAL = 180000;    // Montant initial emprunté
export const LOAN_PAYMENT = 893.6;       // Mensualité (capital + intérêts)
export const LOAN_TERMS = 240;           // Nombre total d'échéances (20 ans)

/**
 * Les deux types qui font exister un prêt dans les données.
 *
 * Exportés depuis le lot B.4 : `useRubriques` s'en sert pour décider si
 * l'écran Prêt immobilier a lieu d'être. Une seule source, sinon les deux
 * définitions divergent le jour où un type change.
 */
export const TYPE_PRET_CAPITAL = "Crédit Immobilier";
export const TYPE_PRET_INTERETS = "Intérêt du prêt";

const CAPITAL_TYPE = TYPE_PRET_CAPITAL;
const INTEREST_TYPE = TYPE_PRET_INTERETS;

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

export function useMortgageData() {
  const { transactions, config, status } = useDataStore();

  /**
   * Paramètres du prêt : `config.pret` s'il est fourni par la source,
   * sinon les constantes ci-dessus. C'est le premier pas hors du code — au
   * lot B ces valeurs viendront de la feuille « Paramètres » du classeur.
   * Un bloc incomplet est ignoré en entier : mieux vaut un prêt de repli
   * cohérent qu'un montant réel accolé à une mensualité par défaut.
   */
  const pret = useMemo(() => {
    const p = config?.pret;
    if (
      p &&
      typeof p.montant === "number" && p.montant > 0 &&
      typeof p.mensualite === "number" && p.mensualite > 0 &&
      typeof p.echeances === "number" && p.echeances > 0
    ) {
      return { montant: p.montant, mensualite: p.mensualite, echeances: p.echeances };
    }
    return { montant: LOAN_PRINCIPAL, mensualite: LOAN_PAYMENT, echeances: LOAN_TERMS };
  }, [config]);

  /**
   * Vrai quand les paramètres affichés ne viennent PAS de la source.
   *
   * Lot B.4. Sans cet indicateur, un fichier importé qui porte des échéances
   * de prêt sans les déclarer produit un échéancier complet — calculé sur les
   * constantes de repli. Des chiffres inventés, présentés comme ceux de la
   * personne, sans un mot. L'écran le dit désormais.
   */
  const parametresDeRepli = useMemo(() => {
    const p = config?.pret;
    return !(
      p &&
      typeof p.montant === "number" && p.montant > 0 &&
      typeof p.mensualite === "number" && p.mensualite > 0 &&
      typeof p.echeances === "number" && p.echeances > 0
    );
  }, [config]);

  // ─── Taux périodique dérivé des paramètres du prêt ────────────────
  const rate = useMemo(
    () => solveMonthlyRate(pret.montant, pret.mensualite, pret.echeances),
    [pret]
  );

  // ─── Échéancier théorique complet (240 lignes) ────────────────────
  // amort[k] = { interet, capital, solde } pour l'échéance k (1-indexé via k-1)
  const schedule = useMemo(() => {
    const rows: { interet: number; capital: number; solde: number }[] = [];
    let balance = pret.montant;
    for (let k = 0; k < pret.echeances; k++) {
      const interet = balance * rate;
      const capital = pret.mensualite - interet;
      balance = Math.max(0, balance - capital);
      rows.push({ interet, capital, solde: balance });
    }
    return rows;
  }, [rate, pret]);

  // ─── Historique mensuel réel (capital + intérêts) ─────────────────
  const historyData = useMemo<MortgageHistoryPoint[]>(() => {
    const map = new Map<string, { capital: number; interets: number }>();
    for (const t of transactions) {
      if (t.type !== CAPITAL_TYPE && t.type !== INTEREST_TYPE) continue;
      const cur = map.get(t.monthKey) ?? { capital: 0, interets: 0 };
      if (t.type === CAPITAL_TYPE) cur.capital += t.montant;
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
  }, [transactions]);

  const hasData = historyData.length > 0 && rate > 0;

  // ─── Nombre d'échéances restantes pour un solde donné ─────────────
  const remainingTerms = useCallback(
    (balance: number, payment = pret.mensualite) => {
      if (balance <= 0 || rate <= 0) return 0;
      const x = 1 - (balance * rate) / payment;
      if (x <= 0) return pret.echeances; // mensualité ne couvre pas les intérêts
      return -Math.log(x) / Math.log(1 + rate);
    },
    [rate, pret]
  );

  // ─── Reconstitution de l'état courant à partir du dernier mois réel ─
  const current = useMemo(() => {
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
  }, [historyData, rate, remainingTerms, pret]);

  // ─── KPIs ─────────────────────────────────────────────────────────
  const kpis = useMemo<MortgageKPIs>(() => {
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
  }, [current, schedule, rate, pret]);

  // ─── Projection du capital restant dû (historique + futur) ────────
  const projectionData = useMemo<MortgageProjectionPoint[]>(() => {
    if (!hasData || !current.monthKey) return [];
    // Échéance #1 = dernier mois réel − (echeance − 1) mois
    const firstMonth = addMonths(current.monthKey, -(current.echeance - 1));
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
  }, [hasData, current, schedule]);

  // ─── Donut remboursé / restant ────────────────────────────────────
  const donutData = useMemo<DonutSlice[]>(
    () => [
      { name: "Capital remboursé", value: Math.round(kpis.capitalRembourse) },
      { name: "Capital restant", value: Math.round(kpis.capitalRestant) },
    ],
    [kpis]
  );

  // ─── Date de fin au rythme actuel ─────────────────────────────────
  const dateFin = useMemo(() => {
    if (!current.monthKey) return "";
    return addMonths(current.monthKey, kpis.echeancesRestantes);
  }, [current.monthKey, kpis.echeancesRestantes]);

  // ─── Simulateur what-if (remboursement anticipé mensuel) ──────────
  const simulate = useCallback(
    (extra: number): SimulationResult => {
      const B = current.capitalRestant;
      const baseRem = remainingTerms(B);
      if (!hasData || B <= 0) {
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
    },
    [current, remainingTerms, hasData, dateFin, pret]
  );

  return {
    status,
    hasData,
    parametresDeRepli,
    kpis,
    historyData,
    projectionData,
    donutData,
    dateFin,
    currentMonth: current.monthKey,
    simulate,
  };
}
