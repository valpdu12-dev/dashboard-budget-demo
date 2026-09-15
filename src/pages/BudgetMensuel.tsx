// ── Page Budget Mensuel — Session 2B (Phase 2) ──────────────────────────
// Vue par Cat2 : budget cible vs dépense réelle moyenne, écarts, sparklines.
// Saisie inline des budgets cibles → sauvegarde via API D1.

import { useState, useCallback, useMemo } from "react";
import {
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Cell,
  LineChart, Line as SparkLine,
} from "recharts";
import {
  Wallet, TrendingDown, PiggyBank, ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { BandeauDonneesPartielles } from "@/components/ui/BandeauDonneesPartielles";
import { KPICard } from "@/components/ui/KPICard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { StackedRowCard } from "@/components/ui/StackedRowCard";

import { useDataStore } from "@/stores/useDataStore";
import { useBudgetData } from "@/hooks/useBudgetData";
import { useChartSize } from "@/hooks/useChartSize";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useResponsive } from "@/hooks/useResponsive";
import type { BudgetCat2Row } from "@/hooks/useBudgetData";
import { BandeauMoisNonComparables } from "@/components/ui/BandeauMoisNonComparables";

import { fmt, fmtShort, mkLabel } from "@/utils/formatters";
import { CAT2_COLORS, DONUT_COLORS } from "@/config/colors";

// ─── Status badge ───────────────────────────────────────────────────────

const STATUS_STYLES: Record<BudgetCat2Row["status"], { bg: string; text: string; label: string }> = {
  ok:        { bg: "bg-green/10", text: "text-green",   label: "OK" },
  warning:   { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Attention" },
  over:      { bg: "bg-red/10",   text: "text-red",     label: "Dépassé" },
  "no-budget": { bg: "bg-surface", text: "text-text-sec", label: "—" },
  // Pas de jugement : sans mois comparable, il n'y a pas de dépense connue.
  indisponible: { bg: "bg-surface", text: "text-text-sec", label: "Indisponible" },
};

function StatusBadge({ status }: { status: BudgetCat2Row["status"] }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ─── Sparkline mini (par Cat2) ──────────────────────────────────────────

function MiniSparkline({ data, target }: { data: BudgetCat2Row["monthlyData"]; target: number | null }) {
  if (data.length < 2) return <span className="text-text-sec text-[11px]">—</span>;

  return (
    <div className="w-[100px] h-[28px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <SparkLine
            type="monotone"
            dataKey="actual"
            stroke="#6366f1"
            strokeWidth={1.5}
            dot={false}
          />
          {target !== null && (
            <SparkLine
              type="monotone"
              dataKey="target"
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Cellule saisie budget ──────────────────────────────────────────────

function BudgetInput({
  cat2,
  value,
  onSave,
}: {
  cat2: string;
  value: number | null;
  /** Renvoie `false` si le navigateur a refusé de mémoriser la valeur. */
  onSave: (cat2: string, target: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  // Un objectif modifié mais non mémorisé disparaît au rechargement. Le
  // taire produirait exactement la fausse bonne nouvelle que ce tableau de
  // bord s'attache à éviter : on le dit.
  const [nonMemorise, setNonMemorise] = useState(false);

  const handleSave = useCallback(async () => {
    const n = parseFloat(draft.replace(",", "."));
    if (isNaN(n) || n < 0) {
      setDraft(String(value ?? ""));
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      setNonMemorise((await onSave(cat2, Math.round(n))) === false);
    } catch (e) {
      console.error("Erreur sauvegarde budget:", e);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, cat2, onSave, value]);

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        className="w-[80px] max-md:min-h-tap bg-surface border border-indigo/40 rounded px-1.5 py-0.5 text-right text-sm text-text tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo"
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") { setDraft(String(value ?? "")); setEditing(false); }
        }}
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(String(value ?? "")); setEditing(true); }}
      // Lot 1.3 — cible tactile ≥ 48 px dans les deux dimensions sous 768 px.
      // `audit.mjs:59-62` compte une cible dès que sa hauteur OU sa largeur
      // passe sous 44 px : ces boutons formaient les 24 cibles de la page.
      // Rendu desktop inchangé (`max-md:` seulement).
      className="text-right tabular-nums text-sm hover:text-indigo-text transition-colors cursor-pointer max-md:inline-flex max-md:min-h-tap max-md:min-w-tap max-md:items-center max-md:justify-end"
      title="Cliquez pour modifier"
    >
      {value !== null ? fmt(value) : <span className="text-text-sec italic text-xs">Définir</span>}
      {nonMemorise && (
        <span className="ml-1 text-amber text-[10px]" title="Ce navigateur refuse le stockage local : la valeur sera perdue au rechargement.">
          non mémorisé
        </span>
      )}
    </button>
  );
}

// ─── Page principale ────────────────────────────────────────────────────

export default function BudgetMensuel() {
  const { status } = useDataStore();
  const { rows, kpis, topRows, isLoading, updateBudget, comparableMonths } = useBudgetData();
  const { allMonths } = useFilteredData();

  // Lot 1.2 — hauteur de graphique pilotée par le palier d'affichage.
  const { chartHeight } = useChartSize();

  // Lot 1.3 — sous 768 px le tableau budget passe en cartes empilées : à
  // 7 colonnes il débordait de 213 px, et ses cellules « Définir » formaient
  // les 24 cibles tactiles sous 44 px relevées à l'audit (le plus fort du projet).
  const { isMobile } = useResponsive();

  // Top 10 pour le BarChart (triés par dépense desc)
  const chartData = useMemo(
    () => topRows.slice(0, 10).map((r) => ({
      name: r.cat2.length > 14 ? r.cat2.slice(0, 12) + "…" : r.cat2,
      fullName: r.cat2,
      // topRows écarte déjà les moyennes indisponibles.
      actual: r.averageMonthly ?? 0,
      target: r.target ?? 0,
    })),
    [topRows]
  );

  if (status !== "success" || isLoading) return <SkeletonPage />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Budget Mensuel" subtitle="Suivi des dépenses par catégorie vs objectifs" />

      {/* Sans budgets cibles, « Budget total » vaut 0 € : le bandeau explique
          pourquoi. « Taux de conformité » affichait 100 % dans ce cas jusqu'au
          11/08/2026 ; il rend désormais « — », faute de taux à calculer.
          C'était la seule page du dashboard qui se dégradait sans le dire —
          les deux zones de « Salaire vs Inflation » annoncent leur manque. */}
      <BandeauDonneesPartielles besoins={["budgets"]} />
      <BandeauMoisNonComparables
        comparableMonths={comparableMonths}
        totalMonths={allMonths.length}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-grid">
        <KPICard
          label="Budget total mensuel"
          value={kpis.totalBudgeted}
          icon={<Wallet size={14} />}
        />
        <KPICard
          label="Dépenses réelles"
          value={kpis.totalActual ?? undefined}
          customValue={kpis.totalActual === null ? "Indisponible" : undefined}
          icon={<TrendingDown size={14} />}
          color={kpis.balance !== null && kpis.balance < 0 ? "#ef4444" : undefined}
        />
        <KPICard
          label="Solde restant"
          value={kpis.balance ?? undefined}
          customValue={kpis.balance === null ? "Indisponible" : undefined}
          icon={<PiggyBank size={14} />}
          // Aucune couleur sans solde : un vert ou un rouge porterait un
          // jugement sur une valeur qui n'existe pas.
          color={kpis.balance === null ? undefined : kpis.balance >= 0 ? "#22c55e" : "#ef4444"}
        />
        <KPICard
          label="Taux de conformité"
          customValue={kpis.complianceRate === null ? "—" : kpis.complianceRate + " %"}
          icon={<ShieldCheck size={14} />}
          // Aucune couleur quand il n'y a pas de taux : un vert ou un rouge
          // porterait un jugement sur une valeur inexistante.
          color={kpis.complianceRate === null ? undefined
            : kpis.complianceRate >= 80 ? "#22c55e"
            : kpis.complianceRate >= 50 ? "#f59e0b" : "#ef4444"}
        />
      </div>

      {/* Tableau par Cat2 — mode carte sous 768 px (lot 1.3).
          Le `overflow-x-auto` n'est rendu que sur le chemin tableau : le
          décompte de `audit.mjs:52-54` porte sur l'`overflowX` calculé, ne
          pas rendre le conteneur est le seul moyen d'en sortir à coup sûr. */}
      <div className={`card ${isMobile ? "" : "overflow-x-auto"}`}>
        <div className="text-sm font-medium text-text mb-3">Budget par catégorie</div>
        {rows.length === 0 ? (
          <EmptyState title="Aucune catégorie trouvée" />
        ) : isMobile ? (
          <div className="-mx-3">
            {rows.map((r) => (
              <StackedRowCard
                key={r.cat2}
                fields={[
                  {
                    label: "Catégorie",
                    priority: true,
                    value: (
                      <span className="flex items-center justify-end gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: CAT2_COLORS[r.cat2] || "#64748b" }}
                        />
                        <span className="text-text font-medium">{r.cat2 || "—"}</span>
                      </span>
                    ),
                  },
                  {
                    label: "Moyenne/mois",
                    priority: true,
                    value: <span className="tabular-nums text-text">{r.averageMonthly === null ? "—" : fmt(r.averageMonthly)}</span>,
                  },
                  {
                    label: "Budget cible",
                    priority: true,
                    // Contrôle éditable : même composant qu'en tableau, donc
                    // même cycle focus / blur / Échap. Rien n'est réécrit ici.
                    value: <BudgetInput cat2={r.cat2} value={r.target} onSave={updateBudget} />,
                  },
                  {
                    label: "Écart €",
                    value: (
                      <span className={`tabular-nums font-medium ${
                        r.ecartValue === null ? "text-text-sec"
                        : r.ecartValue > 0 ? "text-red" : "text-green"
                      }`}>
                        {r.ecartValue !== null
                          ? (r.ecartValue > 0 ? "+" : "") + fmt(r.ecartValue)
                          : "—"}
                      </span>
                    ),
                  },
                  {
                    label: "Écart %",
                    value: (
                      <span className={`tabular-nums ${
                        r.ecartPct === null ? "text-text-sec"
                        : r.ecartPct > 0 ? "text-red" : "text-green"
                      }`}>
                        {r.ecartPct !== null
                          ? (r.ecartPct > 0 ? "+" : "") + r.ecartPct + " %"
                          : "—"}
                      </span>
                    ),
                  },
                  { label: "Statut", value: <StatusBadge status={r.status} /> },
                  {
                    label: "Tendance",
                    value: <MiniSparkline data={r.monthlyData} target={r.target} />,
                  },
                ]}
              />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-sec text-xs border-b border-border">
                <th className="text-left py-2 pr-3 font-medium">Catégorie</th>
                <th className="text-right py-2 px-3 font-medium">Moyenne/mois</th>
                <th className="text-right py-2 px-3 font-medium">Budget cible</th>
                <th className="text-right py-2 px-3 font-medium">Écart €</th>
                <th className="text-right py-2 px-3 font-medium">Écart %</th>
                <th className="text-center py-2 px-3 font-medium">Statut</th>
                <th className="text-center py-2 pl-3 font-medium">Tendance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cat2} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  {/* Catégorie */}
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: CAT2_COLORS[r.cat2] || "#64748b" }}
                      />
                      <span className="text-text font-medium">{r.cat2 || "—"}</span>
                    </span>
                  </td>
                  {/* Moyenne */}
                  <td className="text-right py-2.5 px-3 tabular-nums text-text">
                    {r.averageMonthly === null ? "—" : fmt(r.averageMonthly)}
                  </td>
                  {/* Budget cible (éditable) */}
                  <td className="text-right py-2.5 px-3">
                    <BudgetInput cat2={r.cat2} value={r.target} onSave={updateBudget} />
                  </td>
                  {/* Écart € */}
                  <td className={`text-right py-2.5 px-3 tabular-nums font-medium ${
                    r.ecartValue === null ? "text-text-sec"
                    : r.ecartValue > 0 ? "text-red" : "text-green"
                  }`}>
                    {r.ecartValue !== null
                      ? (r.ecartValue > 0 ? "+" : "") + fmt(r.ecartValue)
                      : "—"}
                  </td>
                  {/* Écart % */}
                  <td className={`text-right py-2.5 px-3 tabular-nums text-xs ${
                    r.ecartPct === null ? "text-text-sec"
                    : r.ecartPct > 0 ? "text-red" : "text-green"
                  }`}>
                    {r.ecartPct !== null
                      ? (r.ecartPct > 0 ? "+" : "") + r.ecartPct + " %"
                      : "—"}
                  </td>
                  {/* Statut */}
                  <td className="text-center py-2.5 px-3">
                    <StatusBadge status={r.status} />
                  </td>
                  {/* Sparkline */}
                  <td className="text-center py-2.5 pl-3">
                    <MiniSparkline data={r.monthlyData} target={r.target} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* BarChart — Top postes vs budget */}
      <div className="card">
        <div className="text-sm font-medium text-text mb-3">
          Top postes — Réel vs Budget
        </div>
        {chartData.length === 0 ? (
          <EmptyState title="Aucune donnée" />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight(320)}>
            <ComposedChart data={chartData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                angle={-25}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmtShort(v)}
              />
              <Tooltip content={<ChartTooltip formatter={(v) => fmt(v)} showPrev={false} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="actual"
                name="Dépense réelle"
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((e, i) => {
                  const color = CAT2_COLORS[e.fullName] || DONUT_COLORS[i % DONUT_COLORS.length];
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
              <Line
                type="monotone"
                dataKey="target"
                name="Budget cible"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sparklines détaillées — Évolution mensuelle par catégorie */}
      <div className="card">
        <div className="text-sm font-medium text-text mb-4">
          Évolution mensuelle par catégorie
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topRows.map((r) => (
            <div key={r.cat2} className="bg-surface/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: CAT2_COLORS[r.cat2] || "#64748b" }}
                  />
                  <span className="text-xs font-medium text-text">{r.cat2}</span>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="h-[60px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={r.monthlyData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <XAxis
                      dataKey="mk"
                      tick={false}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0]?.payload;
                        return (
                          <div className="bg-surface border border-border rounded p-2 shadow-lg text-[11px]">
                            <div className="text-text-sec mb-1">{mkLabel(p.mk)}</div>
                            <div className="text-text">Réel : {fmt(p.actual)}</div>
                            {p.target !== null && (
                              <div className="text-red">Budget : {fmt(p.target)}</div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <SparkLine
                      type="monotone"
                      dataKey="actual"
                      stroke={CAT2_COLORS[r.cat2] || "#6366f1"}
                      strokeWidth={2}
                      dot={{ r: 2, strokeWidth: 0, fill: CAT2_COLORS[r.cat2] || "#6366f1" }}
                    />
                    {r.target !== null && (
                      <SparkLine
                        type="monotone"
                        dataKey="target"
                        stroke="#ef4444"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        dot={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between mt-1 text-[11px] text-text-sec">
                <span>Moy. {r.averageMonthly === null ? "—" : fmt(r.averageMonthly)}</span>
                {r.target !== null && <span>Budget {fmt(r.target)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
