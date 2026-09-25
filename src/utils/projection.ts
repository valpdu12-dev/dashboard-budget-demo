/**
 * projection — Helper de projection fin de mois (Session 6A, Phase 6, QW3).
 *
 * Extrapole linéairement le net (dépenses/recettes) du mois en cours à partir
 * des jours écoulés. Helper pur et testable, sans dépendance React / store.
 *
 * Exporte : daysInMonthOf(monthKey), lastTxDayOfMonth(tx, monthKey) et
 * projectMonthEnd(depCur, recCur, daysElapsed, daysInMonth) → MonthEndProjection
 * (avec drapeau `reliable` à false si les données sont insuffisantes).
 */

import type { Transaction } from "@/types";

export interface MonthEndProjection {
  /** Net déjà réalisé à ce jour (recettes − dépenses) */
  currentNet: number;
  /** Net projeté en fin de mois (extrapolation linéaire) */
  projectedNet: number;
  /** Dépenses projetées en fin de mois */
  projectedDep: number;
  /** Recettes projetées en fin de mois */
  projectedRec: number;
  /** Jours écoulés utilisés pour l'extrapolation */
  daysElapsed: number;
  /** Nombre total de jours du mois */
  daysInMonth: number;
  /** Indique si la projection est exploitable (données suffisantes) */
  reliable: boolean;
}

/** Nombre de jours du mois pour une monthKey "YYYY-MM". */
export function daysInMonthOf(monthKey: string): number {
  const year = parseInt(monthKey.slice(0, 4), 10);
  const month = parseInt(monthKey.slice(5, 7), 10); // 1-12
  // Le jour 0 du mois suivant = dernier jour du mois courant.
  return new Date(year, month, 0).getDate();
}

/**
 * Dernier jour (numéro 1-31) ayant au moins une transaction dans le mois donné.
 * Renvoie 0 si aucune transaction.
 */
export function lastTxDayOfMonth(tx: Transaction[], monthKey: string): number {
  let max = 0;
  for (const t of tx) {
    if (t.monthKey !== monthKey) continue;
    const day = parseInt(t.date.slice(8, 10), 10);
    if (Number.isFinite(day) && day > max) max = day;
  }
  return max;
}

/**
 * Extrapole le net (et dép/rec) de fin de mois à partir des jours écoulés.
 *
 * @param depCur  Dépenses réalisées du mois en cours (valeur positive)
 * @param recCur  Recettes réalisées du mois en cours (valeur positive)
 * @param daysElapsed  Jours écoulés (ex. dernier jour de transaction)
 * @param daysInMonth  Nombre total de jours du mois
 */
export function projectMonthEnd(
  depCur: number,
  recCur: number,
  daysElapsed: number,
  daysInMonth: number,
): MonthEndProjection {
  const currentNet = recCur - depCur;

  // Garde-fous : données insuffisantes → pas de projection (on renvoie le réalisé)
  const reliable =
    daysElapsed > 0 && daysInMonth > 0 && daysElapsed < daysInMonth;

  if (daysElapsed <= 0 || daysInMonth <= 0) {
    return {
      currentNet,
      projectedNet: currentNet,
      projectedDep: depCur,
      projectedRec: recCur,
      daysElapsed: Math.max(0, daysElapsed),
      daysInMonth: Math.max(0, daysInMonth),
      reliable: false,
    };
  }

  const factor = daysInMonth / daysElapsed;
  const projectedDep = Math.round(depCur * factor);
  const projectedRec = Math.round(recCur * factor);

  return {
    currentNet,
    projectedNet: projectedRec - projectedDep,
    projectedDep,
    projectedRec,
    daysElapsed,
    daysInMonth,
    reliable,
  };
}
