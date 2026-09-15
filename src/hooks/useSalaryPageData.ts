// ── Hook dédié Page Salaire (extrait de V1 Salaire.jsx) ─────────────────
//
// Calcule :
//   1. histData + entrepriseChanges (LineChart historique)
//   2. filteredHistData (filtré par entreprise/année)
//   3. entKPIs (bandeau KPI entreprise ou carrière)
//   4. monthKPIs (KPIs du dernier mois connu)
//   5. stackedData (AreaChart anatomie du salaire)
//   6. projection (bilan N vs N-1 sur période comparable)
//
// Consomme : useDataStore (salary) + useFilterStore (selEntreprise, selYear)

import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { mkLabel, pctChange } from "@/utils/formatters";
// types used implicitly via useDataStore // "@/types";

export interface HistPoint {
  mk: string;
  label: string;
  Net: number;
  Brut: number;
  entreprise: string;
}

export interface EntrepriseChange {
  mk: string;
  entreprise: string;
}

export interface EntKPIs {
  totalNet: number;
  totalBrut: number;
  avgNet: number;
  avgBrut: number;
  months: number;
  ratio: number;
  label: string;
}

export interface MonthKPIs {
  tauxCot: number;
  coutTotal: number;
  cumNet: number;
  prevCumNet: number;
  year: string;
  prevYear: string;
  deltaNet: string;
  patronTotal: number;
  nbMoisYear: number;
  nbMoisPrevYear: number;
}

export interface StackedPoint {
  label: string;
  mk: string;
  net: number;
  cotSal: number;
  retenues: number;
  indem: number;
  brut: number;
}

export interface Projection {
  year: string;
  prevYear: string;
  netY: number;
  brutY: number;
  nbY: number;
  /** Plage de mois réellement comparée, ex. « janv.–mai ». */
  periodLabel: string;
  netPY: number;
  brutPY: number;
  nbPY: number;
  deltaNet: string | null;
  deltaBrut: string | null;
}

/**
 * Numéro de mois d'une clé `AAAA-MM`.
 *
 * Le séparateur compte : un `slice(4, 6)` renverrait « -0 » pour janvier comme
 * pour février, et jusqu'à septembre — tous ces mois se confondraient et
 * l'appariement de période serait faux.
 */
function monthOf(mk: string): string {
  return mk.split("-")[1] ?? "";
}

/**
 * Apparie l'année en cours et l'année précédente **sur la même plage de mois**.
 *
 * Avant cette correction, un bilan « 2026 vs 2025 » confrontait les 5 mois
 * connus de 2026 aux 12 mois de 2025 : l'écart affiché mesurait surtout le
 * nombre de bulletins, pas l'évolution du salaire.
 *
 * L'appariement se fait **par numéro de mois** et non par rang. Si l'année en
 * cours porte janvier à mai, on retient janvier à mai de l'année précédente —
 * et non ses cinq premiers bulletins disponibles, qui seraient décalés en cas
 * de trou dans les données.
 */
function samePeriod<T extends { mk: string }>(
  all: T[],
  year: string,
  prevYear: string,
): { yearData: T[]; prevYearData: T[]; monthKeys: string[] } {
  const yearData = all.filter((s) => s.mk.slice(0, 4) === year);
  const monthKeys = yearData.map((s) => monthOf(s.mk));
  const prevYearData = all.filter(
    (s) => s.mk.slice(0, 4) === prevYear && monthKeys.includes(monthOf(s.mk)),
  );
  return { yearData, prevYearData, monthKeys };
}

/**
 * Libellé de la plage comparée — « janv.–mai » — ou le mois seul s'il n'y en
 * a qu'un. Rend explicite dans le titre ce qui est réellement confronté.
 */
export function periodLabelOf(yearData: { mk: string }[]): string {
  if (yearData.length === 0) return "";
  const sorted = [...yearData].map((s) => s.mk).sort();
  const first = mkLabel(sorted[0]).split(" ")[0];
  const last = mkLabel(sorted[sorted.length - 1]).split(" ")[0];
  return first === last ? first : `${first}–${last}`;
}

export function useSalaryPageData() {
  const { salary } = useDataStore();
  const { selEntreprise, selYear, clearRevFilters } = useFilterStore();

  const months = useMemo(() => salary?.months ?? [], [salary]);

  const patronLast = useMemo(() => salary?.patronLast ?? [], [salary]);


  // ── Mois de référence ──────────────────────────────────────
  // Le comparateur mensuel navigable a été retiré le 29/07/2026 ; l'index
  // local et ses commandes (goPrev/goNext/canPrev/canNext/compMax) sont donc
  // supprimés. Le mois de référence est toujours le dernier connu, ce qui
  // était déjà le comportement par défaut.
  // `prevSal` reste nécessaire : il alimente le delta « vs mois précédent »
  // de la carte de synthèse, qui n'était pas dans le comparateur.
  const lastIdx = months.length ? months.length - 1 : 0;
  const selSal = months[lastIdx] ?? null;
  const prevSal = months[lastIdx - 1] ?? null;

  // Dernier salaire pour le calcul coût employeur
  const lastSal = months.length ? months[months.length - 1] : null;


  // ── 1. Données LineChart historique ────────────────────────
  const { histData, entrepriseChanges } = useMemo(() => {
    if (!months.length) return { histData: [] as HistPoint[], entrepriseChanges: [] as EntrepriseChange[] };

    const histData: HistPoint[] = months.map((s) => ({
      mk: s.mk,
      label: mkLabel(s.mk),
      Net: s.net,
      Brut: s.brut,
      entreprise: s.entreprise,
    }));

    const changes: EntrepriseChange[] = [];
    if (months.length > 0) {
      changes.push({ mk: months[0].mk, entreprise: months[0].entreprise });
    }
    for (let i = 1; i < months.length; i++) {
      if (months[i].entreprise !== months[i - 1].entreprise) {
        changes.push({ mk: months[i].mk, entreprise: months[i].entreprise });
      }
    }
    return { histData, entrepriseChanges: changes };
  }, [months]);

  const filteredHistData = useMemo(() => {
    let data = histData;
    if (selEntreprise) data = data.filter((d) => d.entreprise === selEntreprise);
    if (selYear) data = data.filter((d) => d.mk.startsWith(selYear));
    return data;
  }, [histData, selEntreprise, selYear]);

  // ── 2. Liste entreprises ───────────────────────────────────
  const entreprises = useMemo(
    () => [...new Set(months.map((s) => s.entreprise))],
    [months]
  );

  // ── 3. KPIs entreprise (bandeau) ───────────────────────────
  const entKPIs = useMemo<EntKPIs | null>(() => {
    if (!months.length) return null;
    const data = selEntreprise ? months.filter((s) => s.entreprise === selEntreprise) : months;
    if (!data.length) return null;
    const totalNet = data.reduce((s, d) => s + d.net, 0);
    const totalBrut = data.reduce((s, d) => s + d.brut, 0);
    const avgNet = totalNet / data.length;
    const avgBrut = totalBrut / data.length;
    const ratio = totalBrut > 0 ? totalNet / totalBrut : 0;
    return { totalNet, totalBrut, avgNet, avgBrut, months: data.length, ratio, label: selEntreprise || "Carrière complète" };
  }, [months, selEntreprise]);

  // ── 4. KPIs mois sélectionné ───────────────────────────────
  const monthKPIs = useMemo<MonthKPIs | null>(() => {
    if (!selSal) return null;
    const tauxCot = selSal.brut > 0 ? selSal.cotSal / selSal.brut : 0;
    const patronTotal = patronLast.reduce((s, [, v]) => s + v, 0);
    const coutTotal = selSal.brut + (selSal.mk === lastSal?.mk ? patronTotal : 0);

    const year = selSal.mk.slice(0, 4);
    const prevYear = String(Number(year) - 1);
    // Période comparable : mêmes mois de part et d'autre (voir `samePeriod`).
    const { yearData, prevYearData } = samePeriod(months, year, prevYear);
    const cumNet = yearData.reduce((s, d) => s + d.net, 0);
    const prevCumNet = prevYearData.reduce((s, d) => s + d.net, 0);

    const deltaNet = prevSal ? pctChange(selSal.net, prevSal.net) : "";

    return {
      tauxCot, coutTotal, cumNet, prevCumNet,
      year, prevYear, deltaNet, patronTotal,
      nbMoisYear: yearData.length, nbMoisPrevYear: prevYearData.length,
    };
  }, [selSal, prevSal, patronLast, lastSal, months]);

  // ── 5. Stacked area data ───────────────────────────────────
  const stackedData = useMemo<StackedPoint[]>(() => {
    if (!months.length) return [];
    let data = months;
    if (selEntreprise) data = data.filter((s) => s.entreprise === selEntreprise);
    return data.map((s) => ({
      label: mkLabel(s.mk),
      mk: s.mk,
      net: s.net,
      cotSal: s.cotSal,
      retenues: s.retenues,
      indem: s.indem,
      brut: s.brut,
    }));
  }, [months, selEntreprise]);

  // ── 6. Projection annuelle ─────────────────────────────────
  const projection = useMemo<Projection | null>(() => {
    if (!selSal) return null;
    const year = selSal.mk.slice(0, 4);
    const prevYear = String(Number(year) - 1);
    // Période comparable : mêmes mois de part et d'autre (voir `samePeriod`).
    const { yearData, prevYearData } = samePeriod(months, year, prevYear);

    const netY = yearData.reduce((s, d) => s + d.net, 0);
    const brutY = yearData.reduce((s, d) => s + d.brut, 0);
    const netPY = prevYearData.reduce((s, d) => s + d.net, 0);
    const brutPY = prevYearData.reduce((s, d) => s + d.brut, 0);

    return {
      year, prevYear,
      netY, brutY, nbY: yearData.length,
      netPY, brutPY, nbPY: prevYearData.length,
      periodLabel: periodLabelOf(yearData),
      deltaNet: netPY > 0 ? ((netY - netPY) / netPY * 100).toFixed(1) : null,
      deltaBrut: brutPY > 0 ? ((brutY - brutPY) / brutPY * 100).toFixed(1) : null,
    };
  }, [selSal, months]);


  const hasFilters = !!(selEntreprise || selYear);

  return {
    // Data
    months,
    entreprises,
    filteredHistData,
    entrepriseChanges,
    entKPIs,
    monthKPIs,
    stackedData,
    projection,
    lastSal,
    // Mois de référence (dernier connu)
    selSal,
    // Filtres
    hasFilters,
    clearRevFilters,
  };
}
