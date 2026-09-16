// ── Hook de calcul des KPIs (migré depuis V1 useKPIs.js) ────────────────
//
// Calcule :
//   - Solde total + par compte (mois courant et précédent)
//   - Dépenses / Recettes du mois (hors transferts)
//   - Net du mois (recettes - dépenses)
//   - Dernier salaire + salaire précédent
//   - Ratio Fixe / Occasionnelle+Courante
//   - Taux d'épargne : (salaire_net - dépenses) / salaire_net

import { useMemo } from "react";
import { TRANSFER_TYPES } from "@/config/constants";
import type { Transaction, SalaryMonth, KPIs } from "@/types";

export function useKPIs(
  transactions: Transaction[],
  balancesByMonth: Record<string, Record<string, number>>,
  salary: SalaryMonth[],
  currentMonth: string | null,
  prevMonth: string | null
): KPIs {
  return useMemo(() => {
    if (!currentMonth) {
      return {
        curBal: {}, prevBal: {},
        depCur: 0, depPrev: 0,
        recCur: 0, recPrev: 0,
        netMonth: 0,
        lastSal: null, prevSal: null,
        fixe: 0, occ: 0,
        tauxEpargne: null,
      };
    }

    // ─── Soldes ───────────────────────────────────────────────────
    const curBal = balancesByMonth[currentMonth] ?? {};
    const prevBal = prevMonth ? (balancesByMonth[prevMonth] ?? {}) : {};

    // ─── Transactions du mois courant et précédent (hors transferts) ──
    const isTransfer = (t: Transaction) =>
      (TRANSFER_TYPES as readonly string[]).includes(t.type);

    const curTx = transactions.filter(
      (t) => t.monthKey === currentMonth && !isTransfer(t)
    );
    const prevTx = prevMonth
      ? transactions.filter((t) => t.monthKey === prevMonth && !isTransfer(t))
      : [];

    // ─── Dépenses et recettes ─────────────────────────────────────
    const depCur = curTx
      .filter((t) => t.dc === "Débit")
      .reduce((s, t) => s + t.montant, 0);
    const depPrev = prevTx
      .filter((t) => t.dc === "Débit")
      .reduce((s, t) => s + t.montant, 0);
    const recCur = curTx
      .filter((t) => t.dc === "Crédit")
      .reduce((s, t) => s + t.montant, 0);
    const recPrev = prevTx
      .filter((t) => t.dc === "Crédit")
      .reduce((s, t) => s + t.montant, 0);

    // ─── Net du mois ──────────────────────────────────────────────
    const netMonth = recCur - depCur;

    // ─── Salaires ─────────────────────────────────────────────────
    const lastSal = salary.filter((s) => s.mk <= currentMonth).pop() ?? null;
    const prevSal = lastSal
      ? salary.filter((s) => s.mk < lastSal.mk).pop() ?? null
      : null;

    // ─── Ratio Fixe / Occasionnelle+Courante ─────────────────────
    const fixe = curTx
      .filter((t) => t.dc === "Débit" && t.cat1 === "Dépense Fixe")
      .reduce((s, t) => s + t.montant, 0);
    const occ = curTx
      .filter(
        (t) =>
          t.dc === "Débit" &&
          (t.cat1 === "Dépense Occasionnelle" || t.cat1 === "Dépense Courante")
      )
      .reduce((s, t) => s + t.montant, 0);

    // ─── Taux d'épargne ──────────────────────────────────────────
    // `null`, jamais 0 : sans salaire connu, le taux n'est pas calculable.
    // Constaté le 16/09/2026 sur un jeu importé sans feuille de paie —
    // l'écran affichait « 0,0 % », c'est-à-dire « vous n'épargnez rien ».
    const tauxEpargne =
      lastSal && lastSal.net > 0 ? (lastSal.net - depCur) / lastSal.net : null;

    return {
      curBal,
      prevBal,
      depCur,
      depPrev,
      recCur,
      recPrev,
      netMonth,
      lastSal,
      prevSal,
      fixe,
      occ,
      tauxEpargne,
    };
  }, [transactions, balancesByMonth, salary, currentMonth, prevMonth]);
}
