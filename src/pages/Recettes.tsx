// ── Page Recettes V2 — Suivi des revenus et entrées ─────────────────────
// Migré depuis V1 Recettes.jsx (419 lignes → ~220 lignes)
// Améliorations V2 :
//   - Zustand stores pour les filtres drill-down (selRecMonth, selRecType)
//   - Composants partagés (KPICard, ChartTooltip, Chip, DataTable)
//   - Tailwind (0 inline style sauf couleurs dynamiques)
//   - TypeScript strict

import { useMemo } from "react";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowUpCircle, Hash, CalendarRange,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { Chip } from "@/components/ui/Chip";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonPage } from "@/components/ui/Skeleton";

import { useFilterStore } from "@/stores/useFilterStore";
import { useDataStore } from "@/stores/useDataStore";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useChartSize } from "@/hooks/useChartSize";

import { fmt, fmtShort, fmtDate, mkLabel, pctChange } from "@/utils/formatters";
import { DONUT_COLORS } from "@/config/colors";
import type { Transaction } from "@/types";

// ─── Donut outer label (% only) ─────────────────────────────────────────
function renderDonutLabel({
  cx, cy, midAngle, outerRadius, percent,
}: { cx: number; cy: number; midAngle: number; outerRadius: number; percent: number }) {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 20;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#6B7280" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={12}>
      {(percent * 100).toFixed(0)} %
    </text>
  );
}

// ─── Colonnes du DataTable ──────────────────────────────────────────────
const TABLE_COLUMNS = [
  {
    key: "date" as const,
    label: "Date",
    sortable: true,
    // Lot 1.3 — colonne prioritaire du mode carte (< 768 px). Sans effet sur PC.
    priority: true,
    render: (v: unknown) => (
      <span className="text-text-sec whitespace-nowrap">{fmtDate(String(v))}</span>
    ),
  },
  {
    key: "label" as const,
    label: "Libellé",
    sortable: true,
    priority: true,
    render: (v: unknown, row: Record<string, unknown>) => (
      <span className="text-text">{String(v || row.cat3 || "—")}</span>
    ),
  },
  {
    key: "type" as const,
    label: "Type",
    sortable: true,
    render: (v: unknown) => <span className="text-text-sec">{String(v)}</span>,
  },
  {
    key: "compte" as const,
    label: "Compte",
    sortable: true,
    render: (v: unknown) => <span className="text-text-sec">{String(v)}</span>,
  },
  {
    key: "montant" as const,
    label: "Montant",
    sortable: true,
    priority: true,
    align: "right" as const,
    render: (v: unknown) => (
      <span className="text-green font-semibold tabular-nums">{fmt(Number(v))}</span>
    ),
  },
];

// ─── Page Recettes ──────────────────────────────────────────────────────
export default function Recettes() {
  const { status } = useDataStore();
  useFilterSync({ month: "selRecMonth", type: "selRecType" });

  // Lot 1.2 — dimensions de graphique pilotées par le palier d'affichage.
  const { chartHeight, donutRadii, isSmall } = useChartSize();
  const donut = donutRadii(60, 100);
  // ── Stores & hooks ────────────────────────────────────────────────────
  const {
    selRecMonth, setSelRecMonth,
    selRecType, setSelRecType,
    clearRecFilters,
  } = useFilterStore();

  const { baseTx, allMonthsInRange, currentMonth, prevMonth } = useFilteredData();

  // ── Recettes filtrées (Crédit uniquement) ─────────────────────────────
  const recettes = useMemo(() => baseTx.filter((t) => t.dc === "Crédit"), [baseTx]);

  // ── KPIs ──────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = recettes.reduce((s, t) => s + t.montant, 0);
    const nb = recettes.length;
    const moyMois = allMonthsInRange.length ? total / allMonthsInRange.length : 0;

    const curRec = recettes.filter((t) => t.monthKey === currentMonth);
    const prevRec = recettes.filter((t) => t.monthKey === prevMonth);
    const curTotal = curRec.reduce((s, t) => s + t.montant, 0);
    const prevTotal = prevRec.reduce((s, t) => s + t.montant, 0);

    return { total, nb, moyMois, curTotal, prevTotal };
  }, [recettes, allMonthsInRange, currentMonth, prevMonth]);

  // ── LineChart data (par mois × type) ──────────────────────────────────
  const { lineData, types } = useMemo(() => {
    const map: Record<string, Record<string, number | string>> = {};
    const typesSet = new Set<string>();
    recettes.forEach((t) => {
      if (!map[t.monthKey]) map[t.monthKey] = { monthKey: t.monthKey };
      const tp = t.type || "Autre";
      typesSet.add(tp);
      map[t.monthKey][tp] = ((map[t.monthKey][tp] as number) || 0) + t.montant;
    });
    const types = Array.from(typesSet);
    const lineData = allMonthsInRange.map((mk, idx) => {
      const row: Record<string, number | string> = {
        monthKey: mk,
        label: mkLabel(mk),
        ...(map[mk] || {}),
      };
      // prev_* pour comparaison N-1 dans tooltips
      if (idx > 0) {
        const prevMk = allMonthsInRange[idx - 1];
        const prevRow = map[prevMk] || {};
        types.forEach((tp) => { row[`prev_${tp}`] = (prevRow[tp] as number) || 0; });
      }
      return row;
    });
    return { lineData, types };
  }, [recettes, allMonthsInRange]);

  // ── Donut data ────────────────────────────────────────────────────────
  const donutData = useMemo(() => {
    let src = recettes;
    if (selRecMonth) src = src.filter((t) => t.monthKey === selRecMonth);
    const map: Record<string, number> = {};
    src.forEach((t) => {
      const tp = t.type || "Autre";
      map[tp] = (map[tp] || 0) + t.montant;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [recettes, selRecMonth]);

  const donutTotal = useMemo(() => donutData.reduce((s, d) => s + d.value, 0), [donutData]);

  // ── Table data (filtré par drill-down) ────────────────────────────────
  const tableData = useMemo(() => {
    let src: Transaction[] = recettes;
    if (selRecMonth) src = src.filter((t) => t.monthKey === selRecMonth);
    if (selRecType) src = src.filter((t) => t.type === selRecType);
    return src;
  }, [recettes, selRecMonth, selRecType]);

  const hasFilters = selRecMonth || selRecType;

  if (status !== "success") return <SkeletonPage />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Recettes" subtitle="Suivi de vos revenus et entrées" />

      {/* ═══ Filtres actifs ════════════════════════════════════════════════ */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {selRecMonth && (
            <Chip label={mkLabel(selRecMonth)} active onClear={() => setSelRecMonth(null)} />
          )}
          {selRecType && (
            <Chip label={selRecType} active onClear={() => setSelRecType(null)} />
          )}
          <button
            onClick={clearRecFilters}
            className="text-xs text-indigo-text hover:underline ml-1"
          >
            Effacer tout
          </button>
        </div>
      )}

      {/* ═══ KPI Cards ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-grid">
        <KPICard
          label="Total Recettes"
          value={kpis.total}
          customSub={pctChange(kpis.curTotal, kpis.prevTotal)}
          icon={<ArrowUpCircle size={14} />}
        />
        <KPICard
          label="Nb Transactions"
          customValue={String(kpis.nb)}
          icon={<Hash size={14} />}
        />
        <KPICard
          label="Moyenne / mois"
          value={kpis.moyMois}
          icon={<CalendarRange size={14} />}
        />
      </div>

      {/* ═══ Graphiques : Line + Donut ════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LineChart — Évolution mensuelle par type */}
        <div className="card">
          <div className="text-sm font-medium text-text mb-3">
            Évolution mensuelle par type
          </div>
          <ResponsiveContainer width="100%" height={chartHeight(350)}>
            <LineChart
              data={lineData}
              onClick={(e) => {
                const mk = e?.activePayload?.[0]?.payload?.monthKey;
                if (mk) setSelRecMonth(mk as string);
              }}
            >
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => fmtShort(v)}
              />
              {/* Total des recettes du mois, dans l'étiquette plutôt qu'en
                  courbe supplémentaire : une série « Total » relèverait le
                  plafond de l'axe Y et tasserait les trois types réels dans la
                  moitié basse du graphique. Le donut de répartition n'est pas
                  affecté — il se construit sur `types`, pas sur l'étiquette. */}
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(v) => fmt(v)}
                    showPrev={false}
                    showTotal
                    totalLabel="Total recettes"
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {types.map((tp, i) => (
                <Line
                  key={tp}
                  type="monotone"
                  dataKey={tp}
                  stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut — Répartition par type */}
        <div className="card flex flex-col items-center">
          <div className="text-sm font-medium text-text mb-3 self-start">
            Répartition par type{selRecMonth ? ` — ${mkLabel(selRecMonth)}` : ""}
          </div>

          {donutData.length === 0 ? (
            <EmptyState title="Aucune recette sur cette période" />
          ) : (
            <div className={`relative ${isSmall ? "w-full" : ""}`}>
              {/* Lot 1.6 — `svg-img-alt` : `role="img"` en dur sur les secteurs
                  Recharts, neutralisable seulement par `aria-hidden` sur un
                  ancêtre. N'enveloppe que le graphique. */}
              <div aria-hidden="true">
              <ResponsiveContainer width={isSmall ? "100%" : 260} height={chartHeight(260)}>
                <PieChart tabIndex={-1}>
                  <Pie rootTabIndex={-1}
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    innerRadius={donut.inner}
                    outerRadius={donut.outer}
                    label={donut.showRadialLabels ? renderDonutLabel : false}
                    labelLine={false}
                    onClick={(_, idx) => setSelRecType(donutData[idx]?.name || null)}
                    style={{ cursor: "pointer" }}
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatter={(v) => fmt(v)} />} />
                </PieChart>
              </ResponsiveContainer>
              </div>
              {/* Centre donut */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <div className="text-text text-lg font-bold tabular-nums">
                  {fmtShort(donutTotal)}
                </div>
              </div>
            </div>
          )}
          {/* Lot 1.2 — sous 430 px les libellés radiaux déborderaient de
              l'écran : légende rendue hors du graphique pour que le total
              reste centré sur le donut. */}
          {/* Lot 1.6 — toujours rendue, `sr-only` quand le donut porte ses
              propres libellés : ceux-ci sont désormais hors de l'arbre
              d'accessibilité. Aucun changement visuel. */}
          {donutData.length > 0 && (
            <ul className={donut.showRadialLabels ? "sr-only" : "flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 w-full"}>
              {donutData.map((d, i) => (
                <li key={d.name} className="flex items-center gap-1.5 text-xs text-text-sec">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    aria-hidden="true"
                  />
                  {d.name} ({donutTotal ? Math.round((d.value / donutTotal) * 100) : 0} %)
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ═══ Table détail ═════════════════════════════════════════════════ */}
      <DataTable
        data={tableData as unknown as Record<string, unknown>[]}
        columns={TABLE_COLUMNS}
        pageSize={20}
        title="Détail des recettes"
        emptyMessage="Aucune recette trouvée"
      />
    </div>
  );
}
