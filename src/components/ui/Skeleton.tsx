// -- Skeleton Loaders -- Phase 5.3 UX Polish -----------------------------
// Composants de chargement animés pour KPI, graphiques et tables.
// Phase 6.2 -- React.memo sur les variantes composées.
import { memo } from "react";

// --- Primitives ---------------------------------------------------------

export function SkeletonBar({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`bg-border/60 rounded animate-pulse ${className}`}
      style={style}
    />
  );
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return (
    <div
      className="bg-border/60 rounded-full animate-pulse shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

// --- Variantes composees ------------------------------------------------

function SkeletonKPIInner() {
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-2">
        <SkeletonBar className="w-3 h-3 rounded" />
        <SkeletonBar className="h-3 w-20" />
      </div>
      <SkeletonBar className="h-6 w-24 mt-1" />
      <SkeletonBar className="h-3 w-16 mt-1" />
    </div>
  );
}
export const SkeletonKPI = memo(SkeletonKPIInner);

function SkeletonKPIGridInner({ count = 4, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonKPI key={i} />
      ))}
    </div>
  );
}
export const SkeletonKPIGrid = memo(SkeletonKPIGridInner);

function SkeletonChartInner({ height = 300 }: { height?: number }) {
  return (
    <div className="card">
      <SkeletonBar className="h-4 w-48 mb-4" />
      <div className="flex items-end gap-2 justify-center" style={{ height }}>
        {[40, 65, 50, 80, 55, 70, 45, 75, 60, 85, 50, 68].map((h, i) => (
          <SkeletonBar
            key={i}
            className="flex-1 max-w-[40px] rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
export const SkeletonChart = memo(SkeletonChartInner);

function SkeletonDonutInner({ size = 220 }: { size?: number }) {
  return (
    <div className="card flex flex-col items-center">
      <SkeletonBar className="h-4 w-48 mb-4 self-start" />
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <div
          className="rounded-full border-[20px] border-border/60 animate-pulse"
          style={{ width: size * 0.85, height: size * 0.85 }}
        />
        <div className="absolute flex flex-col items-center gap-1">
          <SkeletonBar className="h-3 w-10" />
          <SkeletonBar className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}
export const SkeletonDonut = memo(SkeletonDonutInner);

function SkeletonTableRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-3 py-2.5">
          <SkeletonBar className={`h-3 ${i === 0 ? "w-16" : i === cols - 1 ? "w-14 ml-auto" : "w-24"}`} />
        </td>
      ))}
    </tr>
  );
}

function SkeletonTableInner({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <SkeletonBar className="h-4 w-40 mb-4" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className="px-3 py-2 text-left">
                  <SkeletonBar className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => (
              <SkeletonTableRow key={i} cols={cols} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export const SkeletonTable = memo(SkeletonTableInner);

function SkeletonPageInner() {
  return (
    <div className="flex flex-col gap-6 animate-fade-slide">
      <div>
        <SkeletonBar className="h-5 w-32 mb-1" />
        <SkeletonBar className="h-3 w-56" />
      </div>
      <SkeletonKPIGrid count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkeletonChart />
        <SkeletonDonut />
      </div>
      <SkeletonTable />
    </div>
  );
}
export const SkeletonPage = memo(SkeletonPageInner);
