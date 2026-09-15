// ── Page Épargne V2 (V1: 373 lignes → V2: ~220 lignes) ──────────────────
// Sections : Chips filtres + 6 KPIs + ComposedChart dual Y + Donut par type + DataTable
// Améliorations V2 : Tailwind, composants partagés, hook dédié, 0 inline style sauf couleurs dynamiques

import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  PiggyBank, ArrowUpCircle, ArrowDownCircle, Landmark, Percent, Hash,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { Chip } from "@/components/ui/Chip";
import { DataTable } from "@/components/ui/DataTable";
import { SkeletonPage } from "@/components/ui/Skeleton";

import { useFilterStore } from "@/stores/useFilterStore";
import { useDataStore } from "@/stores/useDataStore";
import { useSavingsData } from "@/hooks/useSavingsData";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useChartSize } from "@/hooks/useChartSize";

import { fmt, fmtShort, fmtPct, fmtDate, mkLabel } from "@/utils/formatters";
import { couleurEpargne } from "@/config/colors";

// ─── Donut outer label ───────────────────────────────────────────────────
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

// ─── Tooltip custom (ratio en %) ─────────────────────────────────────────
function SavingsTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg text-xs">
      <div className="text-text-sec mb-1.5 font-medium">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-sec">{p.name}</span>
          <span className="ml-auto text-text font-medium tabular-nums">
            {p.name === "Ratio" ? fmtPct(p.value) : fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Couleur donut par type ──────────────────────────────────────────────
const getTypeColor = (name: string) =>
  couleurEpargne(name);

// ─── Colonnes DataTable ──────────────────────────────────────────────────
const TABLE_COLUMNS = [
  {
    key: "date" as const,
    label: "Date",
    sortable: true,
    // Lot 1.3 — colonne prioritaire du mode carte (< 768 px). Sans effet sur PC.
    priority: true,
    render: (v: unknown) => <span className="text-text-sec whitespace-nowrap">{fmtDate(String(v))}</span>,
  },
  {
    key: "label" as const,
    label: "Libellé",
    sortable: true,
    priority: true,
    render: (v: unknown, row: Record<string, unknown>) => (
      <span className="text-text md:max-w-[200px] md:truncate md:block">{String(v || row.cat3 || "—")}</span>
    ),
  },
  {
    key: "type" as const,
    label: "Type",
    sortable: true,
    render: (v: unknown, row: Record<string, unknown>) => (
      <span className={row.isSortie ? "text-red" : "text-text-sec"}>
        {row.isSortie ? "Sortie Epargne" : String(v)}
      </span>
    ),
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
    render: (v: unknown, row: Record<string, unknown>) => (
      <span className={`font-semibold tabular-nums ${row.isSortie ? "text-red" : "text-amber"}`}>
        {fmt(Number(v))}
      </span>
    ),
  },
];

// ─── Page Épargne ────────────────────────────────────────────────────────
export default function Epargne() {
  const { status } = useDataStore();
  useFilterSync({ month: "selEpMonth", type: "selEpType" });

  // Lot 1.2 — dimensions de graphique pilotées par le palier d'affichage.
  const { chartHeight, donutRadii, isSmall } = useChartSize();
  const donut = donutRadii(60, 100);
  const {
    selEpMonth, selEpType, setSelEpMonth, setSelEpType, clearEpFilters,
  } = useFilterStore();

  const {
    kpis, chartData, donutData, donutTotal, tableRawData, tableTotal,
  } = useSavingsData();

  const hasFilters = selEpMonth || selEpType;

  // Filtrage table par type sélectionné (en plus du mois déjà filtré dans le hook).
  // Doit rester AVANT tout return conditionnel (règle des Hooks React).
  const filteredTableData = useMemo(() => {
    let data = tableRawData;
    if (selEpType) data = data.filter((t) => !t.isSortie && t.type === selEpType);
    return data;
  }, [tableRawData, selEpType]);

  if (status !== "success") return <SkeletonPage />;

  const tableRows = filteredTableData as unknown as Record<string, unknown>[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Épargne" subtitle="Suivi de votre épargne et transferts" />

      {/* Filtres actifs */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {selEpMonth && (
            <Chip label={mkLabel(selEpMonth)} active onClear={() => setSelEpMonth(null)} />
          )}
          {selEpType && (
            <Chip label={selEpType} active onClear={() => setSelEpType(null)} />
          )}
          <button onClick={clearEpFilters} className="text-xs text-indigo-text hover:underline ml-1">
            Effacer tout
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 stagger-grid">
        <KPICard label="Épargne nette" value={kpis.totalEp} prev={kpis.prevEp} icon={<PiggyBank size={14} />} />
        <KPICard label="Total Entrées" value={kpis.totalEntrees} icon={<ArrowUpCircle size={14} />} />
        <KPICard label="Total Sorties" value={kpis.totalSorties} icon={<ArrowDownCircle size={14} />} />
        <KPICard label="Total Recettes" value={kpis.totalRec} icon={<Landmark size={14} />} />
        <KPICard label="Ratio Épargne" value={kpis.ratio} format="pct" icon={<Percent size={14} />} />
        <KPICard label="Nb Transactions" customValue={String(kpis.nbTx)} icon={<Hash size={14} />} />
      </div>

      {/* Graphiques : ComposedChart + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ComposedChart */}
        <div className="card">
          <h2 className="text-text text-sm font-semibold mb-3">Évolution mensuelle</h2>
          <ResponsiveContainer width="100%" height={chartHeight(350)}>
            <ComposedChart
              data={chartData}
              onClick={(e: { activePayload?: Array<{ payload: { monthKey: string } }> }) => {
                if (e?.activePayload?.[0]) setSelEpMonth(e.activePayload[0].payload.monthKey);
              }}
            >
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtPct(v)} domain={[0, 1]} />
              <Tooltip content={<SavingsTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#6B7280" }} />
              <Bar yAxisId="left" dataKey="Épargne" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar yAxisId="left" dataKey="Recettes" fill="#F59E0B" opacity={0.6} radius={[4, 4, 0, 0]} barSize={20} />
              <Line yAxisId="right" type="monotone" dataKey="Ratio" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Donut */}
        <div className="card flex flex-col items-center">
          <h2 className="text-text text-sm font-semibold mb-3 self-start">
            Répartition par type{selEpMonth ? ` — ${mkLabel(selEpMonth)}` : ""}
          </h2>
          <div className={`relative ${isSmall ? "w-full" : ""}`}>
            {/* Lot 1.6 — `svg-img-alt` : `role="img"` en dur sur les secteurs
                Recharts, neutralisable seulement par `aria-hidden` sur un
                ancêtre. N'enveloppe que le graphique. */}
            <div aria-hidden="true">
            <ResponsiveContainer width={isSmall ? "100%" : 260} height={chartHeight(260)}>
              <PieChart tabIndex={-1}>
                <Pie rootTabIndex={-1}
                  data={donutData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={donut.inner} outerRadius={donut.outer}
                  label={donut.showRadialLabels ? renderDonutLabel : false} labelLine={false}
                  onClick={(_: unknown, idx: number) => setSelEpType(donutData[idx]?.name || null)}
                  className="cursor-pointer"
                >
                  {donutData.map((d) => (
                    <Cell key={d.name} fill={getTypeColor(d.name)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            </div>
            {/* Centre donut */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-text text-lg font-bold tabular-nums">{fmtShort(donutTotal)}</div>
            </div>
          </div>
          {/* Lot 1.2 — sous 430 px les libellés radiaux déborderaient de
              l'écran : légende rendue hors du graphique pour que le total
              reste centré sur le donut. */}
          {/* Lot 1.6 — toujours rendue, `sr-only` quand le donut porte ses
              propres libellés : ceux-ci sont désormais hors de l'arbre
              d'accessibilité. Aucun changement visuel. */}
          {donutData.length > 0 && (
            <ul className={donut.showRadialLabels ? "sr-only" : "flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 w-full"}>
              {donutData.map((d) => (
                <li key={d.name} className="flex items-center gap-1.5 text-xs text-text-sec">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: getTypeColor(d.name) }}
                    aria-hidden="true"
                  />
                  {d.name} ({donutTotal ? Math.round((d.value / donutTotal) * 100) : 0} %)
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Table détail */}
      <div className="card">
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="text-text text-sm font-semibold">Détail épargne</h2>
          <span className="text-text-sec text-xs">
            ({filteredTableData.length} transaction{filteredTableData.length > 1 ? "s" : ""})
          </span>
        </div>

        <DataTable
          data={tableRows}
          columns={TABLE_COLUMNS}
          pageSize={20}
          emptyMessage="Aucune transaction d'épargne."
        />

        {/* Footer total net */}
        {filteredTableData.length > 0 && (
          <div className="flex justify-between items-center px-3 py-2 border-t-2 border-border mt-1">
            <span className="text-text text-xs font-semibold">
              Total net ({filteredTableData.length} transaction{filteredTableData.length > 1 ? "s" : ""})
            </span>
            <span className={`text-sm font-bold tabular-nums ${tableTotal >= 0 ? "text-green" : "text-red"}`}>
              {fmt(tableTotal)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
