// ── Hook dédié Épargne (extrait de V1 Epargne.jsx) ──────────────────────
//
// Calcule :
//   1. epargneTx — entrées épargne (type ∈ EPARGNE_TYPES, Débit, hors "Sortie Epargne")
//   2. sortieEpargneTx — retraits (compte "Sortie Epargne")
//   3. recettesTx — crédits (pour ratio)
//   4. KPIs (totalEp, totalEntrees, totalSorties, totalRec, ratio, nbTx, curEp, prevEp)
//   5. chartData — ComposedChart (épargne nette + recettes + ratio)
//   6. donutData — Répartition par type

import { useMemo } from "react";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useFilterStore } from "@/stores/useFilterStore";
import { EPARGNE_TYPES } from "@/config/constants";
import { mkLabel } from "@/utils/formatters";

export interface SavingsKPIs {
  totalEp: number;
  totalEntrees: number;
  totalSorties: number;
  totalRec: number;
  ratio: number;
  nbTx: number;
  curEp: number;
  prevEp: number;
}

export interface SavingsChartPoint {
  monthKey: string;
  label: string;
  Épargne: number;
  Recettes: number;
  Ratio: number;
}

export interface DonutSlice {
  name: string;
  value: number;
}

export function useSavingsData() {
  const { rawPeriodTx, baseTx, allMonthsInRange, currentMonth, prevMonth } = useFilteredData();
  const { selEpMonth } = useFilterStore();

  const txSource = rawPeriodTx || baseTx;

  // ─── Transactions épargne — entrées ────────────────────────────
  const epargneTx = useMemo(
    () => txSource.filter(
      (t) => (EPARGNE_TYPES as readonly string[]).includes(t.type)
        && t.dc === "Débit"
        && t.compte !== "Sortie Epargne"
    ),
    [txSource]
  );

  // ─── Transactions épargne — sorties ────────────────────────────
  const sortieEpargneTx = useMemo(
    () => txSource.filter((t) => t.compte === "Sortie Epargne"),
    [txSource]
  );

  // ─── Recettes (Crédit) ─────────────────────────────────────────
  const recettesTx = useMemo(
    () => baseTx.filter((t) => t.dc === "Crédit"),
    [baseTx]
  );

  // ─── KPIs ──────────────────────────────────────────────────────
  const kpis = useMemo<SavingsKPIs>(() => {
    const totalEntrees = epargneTx.reduce((s, t) => s + t.montant, 0);
    const totalSorties = sortieEpargneTx.reduce((s, t) => s + t.montant, 0);
    const totalEp = totalEntrees - totalSorties;
    const totalRec = recettesTx.reduce((s, t) => s + t.montant, 0);
    const ratio = totalRec > 0 ? totalEp / totalRec : 0;
    const nbTx = epargneTx.length + sortieEpargneTx.length;

    const curEntrees = epargneTx.filter((t) => t.monthKey === currentMonth).reduce((s, t) => s + t.montant, 0);
    const curSorties = sortieEpargneTx.filter((t) => t.monthKey === currentMonth).reduce((s, t) => s + t.montant, 0);
    const curEp = curEntrees - curSorties;

    const prevEntrees = epargneTx.filter((t) => t.monthKey === prevMonth).reduce((s, t) => s + t.montant, 0);
    const prevSorties = sortieEpargneTx.filter((t) => t.monthKey === prevMonth).reduce((s, t) => s + t.montant, 0);
    const prevEp = prevEntrees - prevSorties;

    return { totalEp, totalEntrees, totalSorties, totalRec, ratio, nbTx, curEp, prevEp };
  }, [epargneTx, sortieEpargneTx, recettesTx, currentMonth, prevMonth]);

  // ─── ComposedChart data ────────────────────────────────────────
  const chartData = useMemo<SavingsChartPoint[]>(() => {
    const rows = allMonthsInRange.map((mk) => {
      const entrees = epargneTx.filter((t) => t.monthKey === mk).reduce((s, t) => s + t.montant, 0);
      const sorties = sortieEpargneTx.filter((t) => t.monthKey === mk).reduce((s, t) => s + t.montant, 0);
      const epNet = entrees - sorties;
      const rec = recettesTx.filter((t) => t.monthKey === mk).reduce((s, t) => s + t.montant, 0);
      const ratio = rec > 0 ? epNet / rec : 0;
      return { monthKey: mk, label: mkLabel(mk), Épargne: Math.round(epNet), Recettes: Math.round(rec), Ratio: ratio } as SavingsChartPoint;
    });
    // prev_* pour comparaison N-1 dans tooltips
    for (let i = 1; i < rows.length; i++) {
      (rows[i] as unknown as Record<string, unknown>)["prev_Épargne"] = rows[i - 1].Épargne;
      (rows[i] as unknown as Record<string, unknown>)["prev_Recettes"] = rows[i - 1].Recettes;
      (rows[i] as unknown as Record<string, unknown>)["prev_Ratio"] = rows[i - 1].Ratio;
    }
    return rows;
  }, [epargneTx, sortieEpargneTx, recettesTx, allMonthsInRange]);

  // ─── Donut data (filtré par mois sélectionné) ──────────────────
  const donutData = useMemo<DonutSlice[]>(() => {
    let src = epargneTx;
    if (selEpMonth) src = src.filter((t) => t.monthKey === selEpMonth);
    const map: Record<string, number> = {};
    src.forEach((t) => { map[t.type] = (map[t.type] || 0) + t.montant; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [epargneTx, selEpMonth]);

  const donutTotal = useMemo(
    () => donutData.reduce((s, d) => s + d.value, 0),
    [donutData]
  );

  // ─── Table data (entrées + sorties combinées) ──────────────────
  const tableRawData = useMemo(() => {
    const entrees = epargneTx.map((t) => ({ ...t, isSortie: false }));
    const sorties = sortieEpargneTx.map((t) => ({ ...t, montant: -t.montant, isSortie: true }));
    let src = [...entrees, ...sorties];
    if (selEpMonth) src = src.filter((t) => t.monthKey === selEpMonth);
    return src;
  }, [epargneTx, sortieEpargneTx, selEpMonth]);

  const tableTotal = useMemo(
    () => tableRawData.reduce((s, t) => s + t.montant, 0),
    [tableRawData]
  );

  return {
    kpis,
    chartData,
    donutData,
    donutTotal,
    tableRawData,
    tableTotal,
    currentMonth,
    prevMonth,
    allMonthsInRange,
  };
}
