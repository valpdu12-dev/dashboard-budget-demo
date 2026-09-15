// ── Hook de calcul des soldes (optimisé V2 : groupBy Map au lieu de filter) ──
//
// Logique Banque A - Courant multi-comptes (V1 fidèle) :
//   Banque A - Courant      Crédit → + sur Banque A - Courant
//   Banque A - Courant      Débit  → - sur Banque A - Courant
//   Sortie Epargne                 (tout dc) → + sur Banque A - Courant
//   Appli partagée - Part commune        Débit  → - sur Banque A - Courant
//   Banque A - Part commune Débit  → - sur Banque A - Courant
//   Banque B - Compte joint       Crédit (sauf Virement extérieur) → - sur Banque A - Courant
//   Banque C - Compte joint Crédit (sauf Virement extérieur) → - sur Banque A - Courant
//
// Comptes à solde propre (Banque B - Compte joint, Banque C - Compte
// joint, Titres-restaurant, Banque B - Courant) : Crédit → +, Débit → -
//
// ⚠️ Comparaison par ÉGALITÉ STRICTE uniquement : deux comptes commencent par
// « Banque B » et deux par « Banque A ». Aucun startsWith / includes.
//
// FIX PERF : V1 faisait transactions.filter(t => t.monthKey === mk) dans une
// boucle forEach(allMonths) → O(n×m). V2 pré-indexe dans un Map → O(n) + O(m).

import { useMemo } from "react";
import type { Transaction } from "@/types";
import { COMPTES_REELS } from "@/config/constants";

interface BalancesResult {
  balancesByMonth: Record<string, Record<string, number>>;
  currentBalances: Record<string, number>;
  balanceChartData: (monthsInRange: string[]) => Array<Record<string, number | string>>;
}

export function useBalances(
  transactions: Transaction[],
  allMonths: string[],
  initBalances: Record<string, number>
): BalancesResult {

  // ── Étape 1 : Pré-indexer les transactions par monthKey (1 seul pass) ──
  const txByMonth = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const arr = map.get(t.monthKey);
      if (arr) arr.push(t);
      else map.set(t.monthKey, [t]);
    }
    return map;
  }, [transactions]);

  // ── Étape 2 : Calcul des soldes cumulatifs mois par mois ──────────────
  const balancesByMonth = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    const running: Record<string, number> = {};

    // Initialisation des soldes de départ
    for (const compte of COMPTES_REELS) {
      running[compte] = initBalances[compte] ?? 0;
    }

    for (const mk of allMonths) {
      const monthTx = txByMonth.get(mk) ?? []; // O(1) au lieu de O(n)

      for (const t of monthTx) {
        const m = t.montant;

        // ─── Règle Banque A - Courant (multi-comptes) ──────
        if (t.compte === "Banque A - Courant") {
          if (t.dc === "Crédit") running["Banque A - Courant"] += m;
          else running["Banque A - Courant"] -= m;
        }
        if (t.compte === "Sortie Epargne") {
          running["Banque A - Courant"] += m;
        }
        if (t.compte === "Appli partagée - Part commune" && t.dc === "Débit") {
          running["Banque A - Courant"] -= m;
        }
        if (t.compte === "Banque A - Part commune" && t.dc === "Débit") {
          running["Banque A - Courant"] -= m;
        }
        if (t.compte === "Banque B - Compte joint" && t.dc === "Crédit" && t.type !== "Virement extérieur") {
          running["Banque A - Courant"] -= m;
        }
        if (t.compte === "Banque C - Compte joint" && t.dc === "Crédit" && t.type !== "Virement extérieur") {
          running["Banque A - Courant"] -= m;
        }

        // ─── Règles simples : comptes à solde propre ──────────────
        if (t.compte === "Banque B - Compte joint") {
          if (t.dc === "Crédit") running["Banque B - Compte joint"] += m;
          else running["Banque B - Compte joint"] -= m;
        }
        if (t.compte === "Banque C - Compte joint") {
          if (t.dc === "Crédit") running["Banque C - Compte joint"] += m;
          else running["Banque C - Compte joint"] -= m;
        }
        if (t.compte === "Titres-restaurant") {
          if (t.dc === "Crédit") running["Titres-restaurant"] += m;
          else running["Titres-restaurant"] -= m;
        }
        if (t.compte === "Banque B - Courant") {
          if (t.dc === "Crédit") running["Banque B - Courant"] += m;
          else running["Banque B - Courant"] -= m;
        }
      }

      // Snapshot du mois avec Total
      const total = COMPTES_REELS.reduce((sum, c) => sum + (running[c] ?? 0), 0);
      result[mk] = { ...running, Total: total };
    }

    return result;
  }, [txByMonth, allMonths, initBalances]);

  // ── Étape 3 : Soldes du dernier mois (= soldes actuels) ───────────────
  const currentBalances = useMemo(() => {
    if (!allMonths.length) {
      const empty: Record<string, number> = { Total: 0 };
      for (const c of COMPTES_REELS) empty[c] = 0;
      return empty;
    }
    return balancesByMonth[allMonths[allMonths.length - 1]] ?? {};
  }, [balancesByMonth, allMonths]);

  // ── Étape 4 : Données pour le LineChart (mémoïsé via useMemo) ─────────
  // V1 renvoyait une fonction brute recréée à chaque render.
  // V2 : on retourne une fonction stable mais les données internes sont mémoïsées.
  const balanceChartData = useMemo(() => {
    return (monthsInRange: string[]) =>
      monthsInRange.map((mk) => ({
        monthKey: mk,
        "Banque A - Courant": Math.round(balancesByMonth[mk]?.["Banque A - Courant"] ?? 0),
        "Banque B - Compte joint": Math.round(balancesByMonth[mk]?.["Banque B - Compte joint"] ?? 0),
        "Banque C - Compte joint": Math.round(balancesByMonth[mk]?.["Banque C - Compte joint"] ?? 0),
        "Titres-restaurant": Math.round(balancesByMonth[mk]?.["Titres-restaurant"] ?? 0),
        "Banque B - Courant": Math.round(balancesByMonth[mk]?.["Banque B - Courant"] ?? 0),
        Total: Math.round(balancesByMonth[mk]?.["Total"] ?? 0),
      }));
  }, [balancesByMonth]);

  return {
    balancesByMonth,
    currentBalances,
    balanceChartData,
  };
}
