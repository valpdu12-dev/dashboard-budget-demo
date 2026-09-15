// ── Page Prêt Immobilier V2 (Phase 3A) ──────────────────────────────────
// Sections : 6 KPI Cards + barre de progression + LineChart projection
// + Donut remboursé/restant + StackedBar historique + simulateur what-if.

import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Home, Wallet, TrendingDown, CheckCircle2, CalendarCheck, CalendarClock,
  Percent, Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonPage } from "@/components/ui/Skeleton";

import { useMortgageData } from "@/hooks/useMortgageData";
import { useChartSize } from "@/hooks/useChartSize";
import { fmt, fmtShort, fmtPct, mkLabel } from "@/utils/formatters";

const C_CAPITAL = "#3b82f6";   // capital — bleu
const C_INTERET = "#f59e0b";   // intérêts — ambre
const C_REMB = "#22c55e";      // remboursé — vert
const C_RESTANT = "#64748b";   // restant — gris

// ─── Page ────────────────────────────────────────────────────────────────
export default function PretImmobilier() {
  // Lot 1.2 — dimensions de graphique pilotées par le palier d'affichage.
  const { chartHeight, donutRadii, isSmall } = useChartSize();
  const donut = donutRadii(60, 100);
  const {
    status, hasData, kpis, historyData, projectionData, donutData,
    dateFin, simulate,
  } = useMortgageData();

  const [extra, setExtra] = useState(0);

  // Projection séparée en deux séries (historique plein / projection pointillé),
  // reliées au point de bascule pour une courbe continue.
  const chartProjection = useMemo(() => {
    return projectionData.map((p, i) => {
      const prev = projectionData[i - 1];
      const isBoundary = p.isProjection && prev && !prev.isProjection;
      return {
        label: p.label,
        monthKey: p.monthKey,
        Historique: p.isProjection ? null : p.capitalRestant,
        Projection: p.isProjection || isBoundary ? p.capitalRestant : null,
      };
    });
  }, [projectionData]);

  const sim = useMemo(() => simulate(extra), [simulate, extra]);

  if (status !== "success") return <SkeletonPage />;

  if (!hasData) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Prêt Immobilier" subtitle="Suivi du crédit immobilier" />
        <div className="card">
          <EmptyState
            icon={<Home size={36} />}
            title="Aucune donnée de prêt"
            description="Aucune transaction « Crédit Immobilier » ou « Intérêt du prêt » trouvée."
          />
        </div>
      </div>
    );
  }

  const avancementPct = Math.round(kpis.avancement * 1000) / 10;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Prêt Immobilier" subtitle="Suivi du crédit immobilier" />

      {/* KPI Cards (2×3) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 stagger-grid">
        <KPICard label="Montant initial" value={kpis.principal} icon={<Home size={14} />} />
        <KPICard label="Capital restant" value={kpis.capitalRestant} color={C_RESTANT} icon={<Wallet size={14} />} />
        <KPICard label="Capital remboursé" value={kpis.capitalRembourse} color={C_REMB} icon={<TrendingDown size={14} />} />
        <KPICard label="Avancement" value={kpis.avancement} format="pct" icon={<CheckCircle2 size={14} />} />
        <KPICard label="Échéances payées" customValue={`${kpis.echeancesPayees} / ${kpis.echeancesPayees + kpis.echeancesRestantes}`} icon={<CalendarCheck size={14} />} />
        <KPICard label="Échéances restantes" customValue={String(kpis.echeancesRestantes)} customSub={`fin ${dateFin ? mkLabel(dateFin) : "—"}`} icon={<CalendarClock size={14} />} />
      </div>

      {/* Barre de progression */}
      <div className="card">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-text text-sm font-semibold">Avancement du remboursement</h2>
          <span className="text-text-sec text-xs tabular-nums">
            {fmt(kpis.capitalRembourse)} / {fmt(kpis.principal)}
          </span>
        </div>
        <div className="w-full h-4 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, avancementPct)}%`, background: C_REMB }}
          />
        </div>
        <div className="text-text text-xs font-semibold mt-1 tabular-nums">{fmtPct(kpis.avancement)}</div>
      </div>

      {/* LineChart : projection capital restant dû */}
      <div className="card">
        <h2 className="text-text text-sm font-semibold mb-3">
          Capital restant dû — historique &amp; projection
        </h2>
        <ResponsiveContainer width="100%" height={chartHeight(320)}>
          <LineChart data={chartProjection}>
            <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="label" tick={{ fill: "#6B7280", fontSize: 12 }}
              axisLine={false} tickLine={false} interval={11} minTickGap={20}
            />
            <YAxis
              tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => fmtShort(v)}
            />
            <Tooltip content={<ChartTooltip formatter={fmt} />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#6B7280" }} />
            <Line type="monotone" dataKey="Historique" stroke={C_CAPITAL} strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="Projection" stroke={C_RESTANT} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Donut + StackedBar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut remboursé / restant */}
        <div className="card flex flex-col items-center">
          <h2 className="text-text text-sm font-semibold mb-3 self-start">Répartition du capital</h2>
          {/* Lot 1.6 — `svg-img-alt` : `role="img"` en dur sur les 2 secteurs
              Recharts. Ce donut est le seul des cinq à n'avoir AUCUNE légende ;
              la liste `sr-only` ci-dessous lui en tient lieu. Elle est
              redondante avec les cartes KPI « Capital restant », « Capital
              remboursé » et « Avancement » de la même page — c'est justement ce
              qui rend le graphique décoratif au sens strict. */}
          <div className={`relative ${isSmall ? "w-full" : ""}`} aria-hidden="true">
            <ResponsiveContainer width={isSmall ? "100%" : 260} height={chartHeight(260)}>
              <PieChart tabIndex={-1}>
                <Pie rootTabIndex={-1} data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={donut.inner} outerRadius={donut.outer}>
                  <Cell fill={C_REMB} />
                  <Cell fill={C_RESTANT} />
                </Pie>
                <Tooltip content={<ChartTooltip formatter={fmt} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-text-sec text-xs">remboursé</div>
              <div className="text-text text-lg font-bold tabular-nums">{fmtPct(kpis.avancement)}</div>
            </div>
          </div>
          <ul className="sr-only">
            {donutData.map((d) => (
              <li key={d.name}>{d.name} : {fmt(d.value)}</li>
            ))}
            <li>Avancement : {fmtPct(kpis.avancement)}</li>
          </ul>
        </div>

        {/* StackedBar historique mensuel */}
        <div className="card">
          <h2 className="text-text text-sm font-semibold mb-3">Historique mensuel — capital &amp; intérêts</h2>
          <ResponsiveContainer width="100%" height={chartHeight(260)}>
            <BarChart data={historyData}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
              <Tooltip content={<ChartTooltip formatter={fmt} />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#6B7280" }} />
              <Bar dataKey="capital" name="Capital" stackId="m" fill={C_CAPITAL} radius={[0, 0, 0, 0]} />
              <Bar dataKey="interets" name="Intérêts" stackId="m" fill={C_INTERET} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Simulateur remboursement anticipé */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-indigo-text" />
          <h2 className="text-text text-sm font-semibold">Simulateur — remboursement anticipé</h2>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-text-sec">
            <span>Versement mensuel supplémentaire</span>
            <span className="text-text font-semibold tabular-nums">+{fmt(extra)}/mois</span>
          </div>
          <input
            type="range" min={0} max={500} step={10} value={extra}
            onChange={(e) => setExtra(Number(e.target.value))}
            className="w-full accent-indigo cursor-pointer"
            aria-label="Remboursement anticipé mensuel"
          />
          <div className="flex justify-between text-[11px] text-text-sec">
            <span>0 €</span><span>500 €</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="kpi-card">
            <div className="text-text-sec text-xs">Nouvelle fin de prêt</div>
            <div className="text-xl font-title font-bold">{sim.dateFin ? mkLabel(sim.dateFin) : "—"}</div>
            {sim.moisGagnes > 0 && (
              <div className="text-xs font-medium text-green">
                −{sim.moisGagnes} mois ({(sim.moisGagnes / 12).toFixed(1).replace(".", ",")} ans)
              </div>
            )}
          </div>
          <div className="kpi-card">
            <div className="text-text-sec text-xs">Économie d'intérêts</div>
            <div className="text-xl font-title font-bold" style={{ color: C_REMB }}>{fmt(sim.economieInterets)}</div>
          </div>
          <div className="kpi-card">
            <div className="text-text-sec text-xs">Échéances restantes</div>
            <div className="text-xl font-title font-bold">{sim.echeancesRestantes}</div>
          </div>
        </div>

        {extra > 0 && sim.moisGagnes > 0 && (
          <p className="text-text-sec text-xs mt-3">
            En versant <span className="text-text font-medium">{fmt(extra)}/mois</span> de plus, le prêt
            se termine en <span className="text-text font-medium">{mkLabel(sim.dateFin)}</span> au lieu de{" "}
            <span className="text-text font-medium">{mkLabel(dateFin)}</span>, soit{" "}
            <span className="text-green font-medium">{fmt(sim.economieInterets)}</span> d'intérêts économisés.
          </p>
        )}
      </div>

      {/* KPI coût total intérêts payés vs restant */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard label="Intérêts payés" value={kpis.interetsPayes} color={C_INTERET} icon={<Percent size={14} />} />
        <KPICard label="Intérêts restants" value={kpis.interetsRestants} color={C_RESTANT} icon={<Percent size={14} />} />
        <KPICard label="Coût total des intérêts" value={kpis.coutTotalInterets} customSub={`taux ${fmtPct(kpis.tauxAnnuel)} / an`} icon={<Percent size={14} />} />
      </div>
    </div>
  );
}
