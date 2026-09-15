// ── Page Insights V2 (V1: 227 lignes → V2: ~130 lignes) ─────────────────
// Sections : Header contextuel + Top Hausses/Baisses + Table Récurrents
// Améliorations V2 : Tailwind, Lucide icons, DataTable partagé, 0 inline style

import { useMemo } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonPage } from "@/components/ui/Skeleton";

import { useDataStore } from "@/stores/useDataStore";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useInsights } from "@/hooks/useInsights";

import { fmt, mkLabel } from "@/utils/formatters";
import type { Insight } from "@/types";

// ─── Sous-composant : Item hausse/baisse ─────────────────────────────────
function ChangeItem({
  item, maxAbsDiff, isHausse, currentMonth, prevMonth,
}: {
  item: Insight; maxAbsDiff: number; isHausse: boolean;
  currentMonth: string | null; prevMonth: string | null;
}) {
  const barWidth = maxAbsDiff > 0 ? (Math.abs(item.diff) / maxAbsDiff) * 100 : 0;
  const diffSign = isHausse ? "+" : "";
  const colorClass = isHausse ? "text-red" : "text-green";
  const barBg = isHausse ? "bg-red" : "bg-green";

  return (
    <div className="py-3 border-b border-border last:border-b-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="font-semibold text-text text-sm">{item.cat}</span>
        <span className={`font-bold text-sm tabular-nums ${colorClass}`}>
          {diffSign}{fmt(item.diff)}
        </span>
      </div>
      <div className="text-xs text-text-sec mb-2">
        {prevMonth ? mkLabel(prevMonth) : "—"} : {fmt(item.prev)}
        {"  →  "}
        {currentMonth ? mkLabel(currentMonth) : "—"} : {fmt(item.cur)}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full ${barBg} rounded-full transition-all duration-500`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className={`text-[11px] font-semibold tabular-nums min-w-[52px] text-right ${colorClass}`}>
          {item.pct !== 0
            ? (item.pct >= 0 ? "+" : "") + (item.pct * 100).toFixed(1).replace(".", ",") + " %"
            : "—"}
        </span>
      </div>
    </div>
  );
}

// ─── Colonnes table récurrents ───────────────────────────────────────────
const RECURRING_COLUMNS = [
  {
    key: "name" as const,
    label: "Nom",
    sortable: true,
    // Lot 1.3 — colonne prioritaire du mode carte (< 768 px). Sans effet sur PC.
    priority: true,
    render: (v: unknown) => <span className="text-text font-medium">{String(v)}</span>,
  },
  {
    key: "montant" as const,
    label: "Montant",
    sortable: true,
    priority: true,
    align: "right" as const,
    render: (v: unknown) => (
      <span className="text-amber font-semibold tabular-nums">{fmt(Number(v))}</span>
    ),
  },
  {
    key: "freq" as const,
    label: "Fréquence",
    sortable: false,
    render: (v: unknown) => <span className="text-text-sec">{String(v)}</span>,
  },
  {
    key: "last" as const,
    label: "Dernier mois",
    sortable: true,
    render: (v: unknown) => <span className="text-text-sec">{mkLabel(String(v))}</span>,
  },
];

// ─── Page Insights ───────────────────────────────────────────────────────
export default function Insights() {
  const { status } = useDataStore();
  const { currentMonth, prevMonth, rawPeriodTx } = useFilteredData();

  const insights = useInsights(rawPeriodTx, currentMonth, prevMonth);
  const { hausse, baisse, recurring } = insights;

  const maxHausse = useMemo(
    () => (hausse.length ? Math.max(...hausse.map((h) => Math.abs(h.diff))) : 0),
    [hausse]
  );
  const maxBaisse = useMemo(
    () => (baisse.length ? Math.max(...baisse.map((b) => Math.abs(b.diff))) : 0),
    [baisse]
  );

  const noComparison = hausse.length === 0 && baisse.length === 0;
  const recurringRows = recurring as unknown as Record<string, unknown>[];

  if (status !== "success") return <SkeletonPage />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Insights" subtitle="Tendances et alertes automatiques" />

      <p className="text-text-sec text-sm">
        Analyse : {currentMonth ? mkLabel(currentMonth) : "—"} vs{" "}
        {prevMonth ? mkLabel(prevMonth) : "—"}
      </p>

      {noComparison ? (
        <EmptyState title="Pas assez de données pour comparer deux mois." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Top Hausses */}
          <div className="card">
            <div className="flex items-center gap-2 text-base font-bold text-text mb-4">
              <TrendingUp size={18} className="text-red" />
              Top {hausse.length} Hausses
            </div>
            {hausse.length === 0 ? (
              <p className="text-text-sec text-sm text-center py-4">Aucune hausse détectée</p>
            ) : (
              hausse.map((h, i) => (
                <ChangeItem
                  key={i} item={h} maxAbsDiff={maxHausse}
                  isHausse currentMonth={currentMonth} prevMonth={prevMonth}
                />
              ))
            )}
          </div>

          {/* Top Baisses */}
          <div className="card">
            <div className="flex items-center gap-2 text-base font-bold text-text mb-4">
              <TrendingDown size={18} className="text-green" />
              Top {baisse.length} Baisses
            </div>
            {baisse.length === 0 ? (
              <p className="text-text-sec text-sm text-center py-4">Aucune baisse détectée</p>
            ) : (
              baisse.map((b, i) => (
                <ChangeItem
                  key={i} item={b} maxAbsDiff={maxBaisse}
                  isHausse={false} currentMonth={currentMonth} prevMonth={prevMonth}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Table Récurrents */}
      <div className="card">
        <div className="flex items-center gap-2 text-base font-bold text-text mb-1">
          <RefreshCw size={18} className="text-indigo-text" />
          Dépenses Récurrentes Détectées
        </div>
        <p className="text-text-sec text-xs mb-4">
          Transactions au montant identique répétées sur 3+ mois
        </p>
        {recurring.length === 0 ? (
          <EmptyState title="Aucune dépense récurrente détectée." />
        ) : (
          <DataTable
            data={recurringRows}
            columns={RECURRING_COLUMNS}
            pageSize={10}
            emptyMessage="Aucune dépense récurrente détectée."
          />
        )}
      </div>
    </div>
  );
}
