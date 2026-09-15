// ── Hook Insights (migré depuis V1 useInsights.js) ──────────────────────
//
// Calcule :
//   1. Top 3 hausses par Cat2 (mois courant vs précédent)
//   2. Top 3 baisses par Cat2
//   3. Détection des récurrents : même Cat3 + même montant sur 3+ mois
//
// Règles :
//   - Seules les dépenses (Débit) sont analysées
//   - Transferts internes exclus
//   - Cat2 vides ou "x" ignorées

import { useMemo } from "react";
import { TRANSFER_TYPES } from "@/config/constants";
import type { Transaction, Insight, Recurring } from "@/types";

interface InsightsResult {
  hausse: Insight[];
  baisse: Insight[];
  recurring: Recurring[];
}

export function useInsights(
  transactions: Transaction[],
  currentMonth: string | null,
  prevMonth: string | null
): InsightsResult {
  return useMemo(() => {
    if (!currentMonth) {
      return { hausse: [], baisse: [], recurring: [] };
    }

    const isTransfer = (t: Transaction) =>
      (TRANSFER_TYPES as readonly string[]).includes(t.type);

    // ─── 1. Top hausses/baisses par Cat2 ──────────────────────────
    const curTx = transactions.filter(
      (t) => t.monthKey === currentMonth && t.dc === "Débit" && !isTransfer(t)
    );
    const prevTx = prevMonth
      ? transactions.filter(
          (t) => t.monthKey === prevMonth && t.dc === "Débit" && !isTransfer(t)
        )
      : [];

    // Agrégation par Cat2
    const curMap: Record<string, number> = {};
    const prevMap: Record<string, number> = {};

    for (const t of curTx) {
      if (t.cat2 && t.cat2 !== "x") {
        curMap[t.cat2] = (curMap[t.cat2] ?? 0) + t.montant;
      }
    }
    for (const t of prevTx) {
      if (t.cat2 && t.cat2 !== "x") {
        prevMap[t.cat2] = (prevMap[t.cat2] ?? 0) + t.montant;
      }
    }

    // Calcul des différences
    const allCat2Keys = Object.keys({ ...curMap, ...prevMap });
    const diffs: Insight[] = allCat2Keys.map((k) => ({
      cat: k,
      cur: curMap[k] ?? 0,
      prev: prevMap[k] ?? 0,
      diff: (curMap[k] ?? 0) - (prevMap[k] ?? 0),
      pct: prevMap[k]
        ? ((curMap[k] ?? 0) - (prevMap[k] ?? 0)) / prevMap[k]
        : curMap[k]
          ? 1
          : 0,
    }));

    const hausse = diffs
      .filter((d) => d.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 3);

    const baisse = diffs
      .filter((d) => d.diff < 0)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 3);

    // ─── 2. Détection des récurrents ──────────────────────────────
    // Clé : Cat3 + montant arrondi à 2 décimales
    // Condition : même clé présente dans 3+ mois distincts
    const txByKey: Record<
      string,
      { name: string; montant: number; months: Set<string> }
    > = {};

    for (const t of transactions) {
      if (t.dc !== "Débit" || isTransfer(t) || t.montant <= 0) continue;
      const key = (t.cat3 || "") + "|" + t.montant.toFixed(2);
      if (!txByKey[key]) {
        txByKey[key] = { name: t.cat3, montant: t.montant, months: new Set() };
      }
      txByKey[key].months.add(t.monthKey);
    }

    const recurring: Recurring[] = [];
    for (const v of Object.values(txByKey)) {
      if (v.months.size >= 3 && v.name && v.name !== "x") {
        const sorted = Array.from(v.months).sort();
        recurring.push({
          name: v.name,
          montant: v.montant,
          freq: v.months.size + " mois",
          last: sorted[sorted.length - 1],
        });
      }
    }
    recurring.sort((a, b) => b.montant - a.montant);

    return {
      hausse,
      baisse,
      recurring: recurring.slice(0, 10),
    };
  }, [transactions, currentMonth, prevMonth]);
}
