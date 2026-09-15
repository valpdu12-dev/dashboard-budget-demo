// ── Hook dérivé : connecte FilterStore + DataStore → données filtrées ────
//
// Remplace la partie "calcul" de V1 useFilters.js.
// L'état des filtres est dans useFilterStore (Zustand).
// Ce hook calcule : periodRange, rawPeriodTx, baseTx, filteredTx,
// allMonths, allMonthsInRange, currentMonth, prevMonth.

import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { TRANSFER_TYPES } from "@/config/constants";
import { extractAllMonths } from "@/utils/decode";
import { toOrganisme } from "@/utils/organisme";
import type { Transaction } from "@/types";

export function useFilteredData() {
  const { transactions } = useDataStore();
  const {
    period, cat1Filter, showTransfers,
    selMonth, selCat2, selType, selOrg,
  } = useFilterStore();

  // ─── Liste triée de tous les mois disponibles ──────────────────
  const allMonths = useMemo(
    () => extractAllMonths(transactions),
    [transactions]
  );

  // ─── Mois courant et précédent (basés sur l'ensemble des données) ──
  const currentMonth = allMonths.length ? allMonths[allMonths.length - 1] : null;
  const prevMonth = allMonths.length > 1 ? allMonths[allMonths.length - 2] : null;

  // ─── Calcul de la plage de période ─────────────────────────────
  const periodRange = useMemo(() => {
    if (!allMonths.length) return { from: "", to: "" };
    const last = allMonths[allMonths.length - 1];
    const ly = parseInt(last.slice(0, 4));
    const lm = parseInt(last.slice(5, 7));
    let from: string;
    const to = last;

    switch (period) {
      case "1M":
        from = last;
        break;
      case "3M": {
        const d = new Date(ly, lm - 3, 1);
        from = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        break;
      }
      case "6M": {
        const d = new Date(ly, lm - 6, 1);
        from = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        break;
      }
      case "YTD":
        from = ly + "-01";
        break;
      case "12M": {
        const d = new Date(ly, lm - 12, 1);
        from = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        break;
      }
      case "all":
        from = allMonths[0];
        break;
      default:
        from = ly + "-01";
    }

    // Ne pas dépasser le premier mois disponible
    if (from < allMonths[0]) from = allMonths[0];

    return { from, to };
  }, [period, allMonths]);

  // ─── Mois dans la plage active ─────────────────────────────────
  const allMonthsInRange = useMemo(
    () => allMonths.filter((m) => m >= periodRange.from && m <= periodRange.to),
    [allMonths, periodRange]
  );

  // ─── Transactions de la période (sans filtre transferts/cat1) ──
  // Utilisé par la page Épargne qui a besoin des transactions de type transfert
  const rawPeriodTx = useMemo(
    () => transactions.filter(
      (t) => t.monthKey >= periodRange.from && t.monthKey <= periodRange.to
    ),
    [transactions, periodRange]
  );

  // ─── Transactions de base (filtre période + transferts + cat1) ─
  const baseTx = useMemo(() => {
    const transferSet = new Set<string>(TRANSFER_TYPES);
    return rawPeriodTx.filter((t) => {
      if (!showTransfers && transferSet.has(t.type)) return false;
      if (cat1Filter !== "all" && t.cat1 && t.cat1 !== cat1Filter) return false;
      return true;
    });
  }, [rawPeriodTx, showTransfers, cat1Filter]);

  // ─── Transactions filtrées (baseTx + drill-downs dépenses) ─────
  const filteredTx = useMemo(() => {
    let tx: Transaction[] = baseTx;
    if (selMonth) tx = tx.filter((t) => t.monthKey === selMonth);
    if (selCat2) tx = tx.filter((t) => t.cat2 === selCat2);
    if (selType) tx = tx.filter((t) => t.type === selType);
    if (selOrg) tx = tx.filter((t) => toOrganisme(t.compte) === selOrg);
    return tx;
  }, [baseTx, selMonth, selCat2, selType, selOrg]);

  return {
    allMonths,
    allMonthsInRange,
    currentMonth,
    prevMonth,
    periodRange,
    rawPeriodTx,
    baseTx,
    filteredTx,
  };
}
