// ── Le calcul de l'écran Épargne, sorti de React ─────────────────────────
//
// Lot C.3. Déplacé depuis `hooks/useSavingsData.ts`, sans qu'une seule règle
// change.
//
// ⚠️ LOT C.4 — LES DEUX RÈGLES NOMMÉES ONT DISPARU :
//   1. `EPARGNE_TYPES`, six libellés écrits dans le code → la nature
//      `epargne` déclarée par la source ;
//   2. `Sortie Epargne` comme LIBELLÉ DE COMPTE → la nature `sortie-epargne`
//      du TYPE (D2). Le pseudo-compte est retiré : il n'avait ni solde, ni
//      couleur, ni icône, et n'existait dans aucune liste de comptes.
//
// Le calcul lui-même ne bouge pas d'un centime : épargne nette = entrées −
// sorties. Seule la façon de RECONNAÎTRE une entrée et une sortie change.
//
// Calcule :
//   1. epargneTx — entrées épargne (nature `epargne`, Débit)
//   2. sortieEpargneTx — retraits (nature `sortie-epargne`)
//   3. recettesTx — crédits (pour ratio)
//   4. KPIs (totalEp, totalEntrees, totalSorties, totalRec, ratio, nbTx, curEp, prevEp)
//   5. chartData — ComposedChart (épargne nette + recettes + ratio)
//   6. donutData — Répartition par type

import { mkLabel } from "@/utils/formatters";
import type { Transaction } from "@/types";
import type { Regles } from "@/calculs/regles";
import { estRecette } from "@/calculs/mouvements";

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

/** Ce dont le calcul a besoin : des transactions et un état de filtre. */
export interface EntreesEpargne {
  /** Transactions de la période, transferts COMPRIS. */
  txSource: Transaction[];
  /** Transactions de base, pour le total des recettes. */
  baseTx: Transaction[];
  allMonthsInRange: string[];
  currentMonth: string | null;
  prevMonth: string | null;
  /** Mois sélectionné dans le donut, ou `null`. */
  selEpMonth: string | null;
}

export function calculerEpargne(e: EntreesEpargne, regles: Regles) {
  const { txSource, baseTx, allMonthsInRange, currentMonth, prevMonth, selEpMonth } = e;

  // ─── Transactions épargne — entrées ────────────────────────────
  const epargneTx = txSource.filter(
    (t) => regles.aNature(t.type, "epargne")
      && t.dc === "Débit"
      && !regles.aNature(t.type, "sortie-epargne")
  );

  // ─── Transactions épargne — sorties ────────────────────────────
  const sortieEpargneTx = txSource.filter((t) => regles.aNature(t.type, "sortie-epargne"));

  // ─── Recettes (Crédit) ─────────────────────────────────────────
  const recettesTx = baseTx.filter((t) => estRecette(t, regles));

  // ─── KPIs ──────────────────────────────────────────────────────
  const kpis = ((): SavingsKPIs => {
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
  })();

  // ─── ComposedChart data ────────────────────────────────────────
  const chartData = ((): SavingsChartPoint[] => {
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
  })();

  // ─── Donut data (filtré par mois sélectionné) ──────────────────
  const donutData = ((): DonutSlice[] => {
    let src = epargneTx;
    if (selEpMonth) src = src.filter((t) => t.monthKey === selEpMonth);
    const map: Record<string, number> = {};
    src.forEach((t) => { map[t.type] = (map[t.type] || 0) + t.montant; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  })();

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // ─── Table data (entrées + sorties combinées) ──────────────────
  const tableRawData = (() => {
    const entrees = epargneTx.map((t) => ({ ...t, isSortie: false }));
    const sorties = sortieEpargneTx.map((t) => ({ ...t, montant: -t.montant, isSortie: true }));
    let src = [...entrees, ...sorties];
    if (selEpMonth) src = src.filter((t) => t.monthKey === selEpMonth);
    return src;
  })();

  const tableTotal = tableRawData.reduce((s, t) => s + t.montant, 0);

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
