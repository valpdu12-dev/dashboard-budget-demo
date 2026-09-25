// ── Page Salaire vs Inflation (Phase 4 — Session 4B) ─────────────────────
// Analyse du pouvoir d'achat : indices cumulés base 100 (net / inflation /
// SMIC), évolution annuelle comparée, synthèse, inflation personnalisée et
// insights dynamiques. La page ne fait que CONSOMMER `useSalaryInflationData`
// (Session 4A) : aucune donnée d'inflation/SMIC en dur, aucun mock.
//
// Particularité données : l'historique de salaire comporte des trous
// (2015-2017) qui n'apparaissent pas dans `indices`. On reconstruit un axe
// d'années continu (lignes coupées via connectNulls=false) et on grise les
// plages sans données. L'inflation annuelle n'est dérivée que lorsqu'une année
// antérieure consécutive est disponible (sinon « — »).

import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea,
} from "recharts";
import {
  Banknote, Scale, TrendingUp, Wallet,
  Coins, Rocket, AlertTriangle, ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { StackedRowCard } from "@/components/ui/StackedRowCard";

import { useSalaryInflationData } from "@/hooks/useSalaryInflationData";
import { useChartSize } from "@/hooks/useChartSize";
import { useResponsive } from "@/hooks/useResponsive";
import { fmt } from "@/utils/formatters";

// ─── Couleurs des séries ──────────────────────────────────────────────────
const C_SAL = "#22c55e";   // salaire net
const C_INF = "#ef4444";   // inflation
const C_SMIC = "#f59e0b";  // SMIC
const C_NEUTRAL = "#94a3b8";

// ─── Formatage local ──────────────────────────────────────────────────────
/** Points d'indice : 119.34 → "119,3" */
function pp(v: number): string {
  return v.toFixed(1).replace(".", ",");
}
/** Pourcentage signé : 8.12 → "+8,1 %" */
function signPct(v: number): string {
  return (v >= 0 ? "+" : "") + v.toFixed(1).replace(".", ",") + " %";
}

// ─── Types locaux ─────────────────────────────────────────────────────────
interface LineRow {
  year: string;
  salaryIndex: number | null;
  inflationIndex: number | null;
  smicIndex: number | null;
}
interface BarRow {
  year: string;
  dSalary: number | null;
  dInflation: number | null;
  dSmic: number | null;
}
interface InsightItem {
  key: string;
  icon: React.ReactNode;
  text: string;
  tone: "pos" | "neg" | "neutral";
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function SalaireInflation() {
  // Lot 1.2 — hauteurs de graphique pilotées par le palier d'affichage.
  const { chartHeight } = useChartSize();

  // Lot 1.3 — la synthèse annuelle (8 colonnes) passe en cartes sous 768 px.
  const { isMobile } = useResponsive();
  const {
    status, hasData,
    employers, employer, setEmployer,
    yearly, indices, purchasing, smicGap, personalInflation, insights,
    baseYear, refYear, inProgressYear,
  } = useSalaryInflationData();

  // ── Axe d'années continu + plages « sans données » (trous 2015-2017) ────
  const { lineData, gapRanges } = useMemo(() => {
    if (indices.length === 0) return { lineData: [] as LineRow[], gapRanges: [] as { x1: string; x2: string }[] };
    const byYear = new Map(indices.map((p) => [p.year, p]));
    const minY = parseInt(indices[0].year, 10);
    const maxY = parseInt(indices[indices.length - 1].year, 10);

    const rows: LineRow[] = [];
    const gaps: { x1: string; x2: string }[] = [];
    let runStart: number | null = null;
    for (let y = minY; y <= maxY; y++) {
      const ys = String(y);
      const pt = byYear.get(ys);
      const row: LineRow = pt
        ? { year: ys, salaryIndex: pt.salaryIndex, inflationIndex: pt.inflationIndex, smicIndex: pt.smicIndex }
        : { year: ys, salaryIndex: null, inflationIndex: null, smicIndex: null };
      rows.push(row);
      // La bande grise matérialise l'absence de SALAIRE (et non l'absence d'année) :
      // l'inflation et le SMIC traversent désormais la zone en continu.
      if (row.salaryIndex === null) {
        if (runStart === null) runStart = y;
      } else if (runStart !== null) {
        gaps.push({ x1: String(runStart), x2: String(y - 1) });
        runStart = null;
      }
    }
    if (runStart !== null) gaps.push({ x1: String(runStart), x2: String(maxY) });
    return { lineData: rows, gapRanges: gaps };
  }, [indices]);

  // ── Inflation nationale annuelle (dérivée des indices cumulés) ──────────
  // Définie seulement si l'année N-1 est présente : taux = idx(N)/idx(N-1) − 1.
  const annualInflByYear = useMemo(() => {
    const m = new Map<string, number>();
    const idxByYear = new Map(indices.map((p) => [p.year, p.inflationIndex]));
    for (const p of indices) {
      const prev = idxByYear.get(String(parseInt(p.year, 10) - 1));
      if (prev != null && p.inflationIndex != null && prev > 0) {
        m.set(p.year, (p.inflationIndex / prev - 1) * 100);
      }
    }
    return m;
  }, [indices]);

  // ── Données BarChart : évolution annuelle comparée (Δ N vs N-1) ─────────
  const barData = useMemo<BarRow[]>(() => {
    const salByYear = new Map(indices.map((p) => [p.year, p.salaryIndex]));
    const smicByYear = new Map(indices.map((p) => [p.year, p.smicIndex]));
    const rows: BarRow[] = [];
    for (const p of indices) {
      const yPrev = String(parseInt(p.year, 10) - 1);
      const salPrev = salByYear.get(yPrev);
      const smicPrev = smicByYear.get(yPrev);
      const dSalary = p.salaryIndex != null && salPrev != null && salPrev > 0 ? (p.salaryIndex / salPrev - 1) * 100 : null;
      const dSmic = p.smicIndex != null && smicPrev != null && smicPrev > 0 ? (p.smicIndex / smicPrev - 1) * 100 : null;
      const dInflation = annualInflByYear.get(p.year) ?? null;
      if (dSalary != null || dInflation != null || dSmic != null) {
        rows.push({ year: p.year, dSalary, dInflation, dSmic });
      }
    }
    return rows;
  }, [indices, annualInflByYear]);

  // ── Maps utilitaires pour le tableau ────────────────────────────────────
  const purchasingByYear = useMemo(() => new Map(purchasing.map((p) => [p.year, p.currentEuros])), [purchasing]);
  const smicGapByYear = useMemo(() => new Map(smicGap.map((p) => [p.year, p])), [smicGap]);
  const yearSet = useMemo(() => new Set(yearly.map((y) => y.year)), [yearly]);
  const avgNetByYear = useMemo(() => new Map(yearly.map((y) => [y.year, y.avgNet])), [yearly]);

  // ── Inflation personnalisée (2024-2025) : perso vs national ─────────────
  const personalRows = useMemo(
    () =>
      personalInflation
        .filter((p) => p.rate != null)
        .map((p) => ({ year: p.year, perso: p.rate as number, national: annualInflByYear.get(p.year) ?? null })),
    [personalInflation, annualInflByYear]
  );

  // ── Insights dynamiques (alignés sur la sémantique du hook) ─────────────
  const insightItems = useMemo<InsightItem[]>(() => {
    const items: InsightItem[] = [];
    if (!hasData) return items;

    if (insights.euroEquivalent) {
      items.push({ key: "euro", icon: <Coins size={16} />, text: insights.euroEquivalent.text, tone: "neutral" });
    }

    if (insights.realGrowthPct != null) {
      const g = insights.realGrowthPct;
      items.push({
        key: "real",
        icon: <TrendingUp size={16} />,
        text:
          g >= 0
            ? `Sur ${insights.baseYear}–${insights.refYear}, ton salaire net a gagné ${pp(g)} pts de pouvoir d'achat (indice net au-dessus de l'inflation cumulée).`
            : `Sur ${insights.baseYear}–${insights.refYear}, ton salaire net a perdu ${pp(Math.abs(g))} pts face à l'inflation cumulée.`,
        tone: g >= 0 ? "pos" : "neg",
      });
    }

    // powerLossYears = années où l'indice net cumulé < indice inflation cumulé
    if (insights.powerLossYears.length > 0) {
      items.push({
        key: "loss",
        icon: <AlertTriangle size={16} />,
        text: `Pouvoir d'achat sous le niveau de ${insights.baseYear} (indice net cumulé < inflation) : ${insights.powerLossYears.join(", ")}.`,
        tone: "neg",
      });
    } else if (insights.baseYear) {
      items.push({
        key: "noloss",
        icon: <ShieldCheck size={16} />,
        text: `Aucune année sous le pouvoir d'achat de ${insights.baseYear} : ton indice net est toujours resté au-dessus de l'inflation cumulée.`,
        tone: "pos",
      });
    }

    // Progression nette vs SMIC à l'année de référence
    const ref = indices.find((p) => p.year === refYear);
    if (ref?.salaryIndex != null && ref?.smicIndex != null && ref.smicIndex > 100 && ref.salaryIndex > 100) {
      const factor = (ref.salaryIndex - 100) / (ref.smicIndex - 100);
      if (isFinite(factor) && factor > 0) {
        items.push({
          key: "smic",
          icon: <Rocket size={16} />,
          text: `Depuis ${insights.baseYear}, ton salaire net a progressé ${factor.toFixed(1).replace(".", ",")}× plus vite que le SMIC.`,
          tone: "pos",
        });
      }
    }
    return items;
  }, [hasData, insights, indices, refYear]);

  // ── Garde-fous ──────────────────────────────────────────────────────────
  if (status !== "success") return <SkeletonPage />;
  if (!hasData) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Salaire vs Inflation" subtitle="Pouvoir d'achat, inflation INSEE et SMIC" />
        <div className="card">
          <EmptyState
            title="Données d'inflation indisponibles"
            description="Les séries INSEE (inflation) et SMIC ne sont pas chargées. L'analyse du pouvoir d'achat nécessite ces données enrichies."
          />
        </div>
      </div>
    );
  }

  // KPI : net moyen le plus récent
  const lastYearly = yearly[yearly.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Salaire vs Inflation" subtitle="Pouvoir d'achat, inflation INSEE et SMIC" />

      {/* ═══ Chips filtre employeur ══════════════════════════════ */}
      <div className="flex flex-wrap gap-2 items-center">
        {employers.map((emp) => (
          <Chip
            key={emp.name}
            label={emp.name}
            active={employer === emp.name}
            color={emp.color}
            onClick={() => setEmployer(emp.name)}
          />
        ))}
      </div>

      {/* ═══ 4 KPI Cards ═════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-grid">
        <KPICard
          label="Net moyen actuel"
          value={lastYearly ? Math.round(lastYearly.avgNet) : undefined}
          customSub={lastYearly ? `moyenne ${lastYearly.year}${lastYearly.incomplet ? " (incompl.)" : ""}` : undefined}
          subColor={C_NEUTRAL}
          icon={<Banknote size={14} />}
        />
        <KPICard
          label="Écart SMIC"
          customValue={insights.smicGapRefPct != null ? signPct(insights.smicGapRefPct) : "—"}
          customSub={refYear ? `vs SMIC net ${refYear}` : undefined}
          subColor={insights.smicGapRefPct != null ? (insights.smicGapRefPct >= 0 ? C_SAL : C_INF) : C_NEUTRAL}
          icon={<Scale size={14} />}
        />
        <KPICard
          label="Inflation cumulée"
          customValue={insights.cumInflationPct != null ? `+${pp(insights.cumInflationPct)} %` : "—"}
          customSub={baseYear && refYear ? `${baseYear} → ${refYear}` : undefined}
          subColor={C_NEUTRAL}
          icon={<TrendingUp size={14} />}
        />
        <KPICard
          label="Pouvoir d'achat réel"
          customValue={insights.realGrowthPct != null ? signPct(insights.realGrowthPct) : "—"}
          customSub="salaire net vs inflation"
          subColor={insights.realGrowthPct != null ? (insights.realGrowthPct >= 0 ? C_SAL : C_INF) : C_NEUTRAL}
          icon={<Wallet size={14} />}
        />
      </div>

      {/* ═══ LineChart — indices cumulés base 100 ════════════════ */}
      <div className="card">
        <div className="mb-4">
          <h2 className="text-text text-sm font-semibold">Indices cumulés (base 100 en {baseYear ?? "—"})</h2>
          <p className="text-text-sec text-xs mt-0.5">
            Salaire net, inflation INSEE et SMIC ramenés à une base commune. Zones grisées : années sans salaire.
          </p>
        </div>
        {lineData.length === 0 ? (
          <EmptyState title="Aucune donnée d'indice" />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight(320)}>
            <LineChart data={lineData}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              {gapRanges.map((g, i) => (
                <ReferenceArea key={i} x1={g.x1} x2={g.x2} fill="#6B7280" fillOpacity={0.12} ifOverflow="extendDomain" />
              ))}
              <XAxis dataKey="year" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              {/* Lot 1.6 — point ouvert n° 19. Sans `tickFormatter`, Recharts
                  rend les bornes de `domain` telles quelles : le tick du bas
                  affichait « 484.2111607747528 », 16 décimales sur 118 px de
                  large, débordant de 61 px hors du graphique et de 28 px hors
                  de l'écran à 412 px. Défaut antérieur au chantier responsive
                  (`git log -S` → `5bf21a5`, session 5A) ; invisible pour
                  `hScrollZones`, trouvé par le compteur miroir du lot 1.5. */}
              <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} tickFormatter={(v: number) => v.toFixed(0)} />
              <Tooltip content={<ChartTooltip formatter={(v: number) => pp(v)} showPrev={false} />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line type="monotone" dataKey="salaryIndex" name="Salaire net" stroke={C_SAL} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
              <Line type="monotone" dataKey="inflationIndex" name="Inflation" stroke={C_INF} strokeWidth={2} dot={false} activeDot={{ r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="smicIndex" name="SMIC" stroke={C_SMIC} strokeWidth={2} dot={false} activeDot={{ r: 3 }} connectNulls={false} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ═══ BarChart — évolution annuelle comparée ══════════════ */}
      <div className="card">
        <div className="mb-4">
          <h2 className="text-text text-sm font-semibold">Évolution annuelle comparée</h2>
          <p className="text-text-sec text-xs mt-0.5">Variation année / année précédente — salaire net, inflation et SMIC.</p>
        </div>
        {barData.length === 0 ? (
          <EmptyState title="Pas assez d'années consécutives" />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight(300)}>
            <BarChart data={barData}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
              <Tooltip content={<ChartTooltip formatter={(v: number) => signPct(v)} showPrev={false} />} cursor={{ fill: "#ffffff08" }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="dSalary" name="Δ Salaire net" fill={C_SAL} radius={[2, 2, 0, 0]} />
              <Bar dataKey="dInflation" name="Δ Inflation" fill={C_INF} radius={[2, 2, 0, 0]} />
              <Bar dataKey="dSmic" name="Δ SMIC" fill={C_SMIC} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ═══ Tableau — synthèse annuelle ═════════════════════════ */}
      <div className="card overflow-hidden">
        <h2 className="text-text text-sm font-semibold mb-3">Synthèse annuelle</h2>
        {/* Lot 1.3 — mode carte sous 768 px. À 8 colonnes, ce tableau
            débordait de 182 px. Le conteneur `overflow-x-auto` n'est rendu
            que sur le chemin tableau : `audit.mjs:52-54` teste l'`overflowX`
            calculé, le retirer est la seule sortie certaine du décompte. */}
        {isMobile ? (
          <div className="-mx-3">
            {yearly.map((y) => {
              const prevYear = String(parseInt(y.year, 10) - 1);
              const hasPrev = yearSet.has(prevYear);
              const prevNet = avgNetByYear.get(prevYear);
              const evol = hasPrev && prevNet ? (y.avgNet / prevNet - 1) * 100 : null;
              const infl = annualInflByYear.get(y.year) ?? null;
              const sg = smicGapByYear.get(y.year);
              const paReel = purchasingByYear.get(y.year) ?? null;
              const isInProgress = y.year === inProgressYear;
              return (
                <StackedRowCard
                  key={y.year}
                  fields={[
                    {
                      label: "Année",
                      priority: true,
                      value: (
                        <span className="text-text font-medium">
                          {y.year}
                          {isInProgress && (
                            <span className="text-text-sec font-normal text-[11px] ml-1">en cours</span>
                          )}
                        </span>
                      ),
                    },
                    {
                      label: "Net moy.",
                      priority: true,
                      value: <span className="text-text tabular-nums">{fmt(y.avgNet)}</span>,
                    },
                    {
                      label: "Évol.",
                      priority: true,
                      value: (
                        <span className={`tabular-nums ${evol == null ? "text-text-sec" : evol >= 0 ? "text-green" : "text-red"}`}>
                          {evol == null ? "—" : signPct(evol)}
                        </span>
                      ),
                    },
                    {
                      label: "Mois",
                      value: (
                        <span className="text-text-sec">
                          {y.incomplet ? <span className="text-amber" title="Année incomplète">⚠ {y.months}</span> : y.months}
                        </span>
                      ),
                    },
                    {
                      label: "Inflation",
                      value: (
                        <span className="text-text-sec tabular-nums">{infl == null ? "—" : signPct(infl)}</span>
                      ),
                    },
                    {
                      label: "SMIC net",
                      value: (
                        <span className="text-text-sec tabular-nums">{sg?.smicNet != null ? fmt(sg.smicNet) : "—"}</span>
                      ),
                    },
                    {
                      label: "PA réel",
                      value: (
                        <span className="text-text-sec tabular-nums">{paReel != null ? fmt(paReel) : "—"}</span>
                      ),
                    },
                    {
                      label: "Écart SMIC",
                      value: (
                        <span className={`tabular-nums ${sg?.gapPct == null ? "text-text-sec" : sg.gapPct >= 0 ? "text-green" : "text-red"}`}>
                          {sg?.gapPct == null ? "—" : signPct(sg.gapPct)}
                        </span>
                      ),
                    },
                  ]}
                />
              );
            })}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-sec">
                <th className="px-3 py-2 text-left font-medium">Année</th>
                <th className="px-3 py-2 text-center font-medium">Mois</th>
                <th className="px-3 py-2 text-right font-medium">Net moy.</th>
                <th className="px-3 py-2 text-right font-medium">Évol.</th>
                <th className="px-3 py-2 text-right font-medium">Inflation</th>
                <th className="px-3 py-2 text-right font-medium">SMIC net</th>
                <th className="px-3 py-2 text-right font-medium">PA réel</th>
                <th className="px-3 py-2 text-right font-medium">Écart SMIC</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((y) => {
                const prevYear = String(parseInt(y.year, 10) - 1);
                const hasPrev = yearSet.has(prevYear);
                const prevNet = avgNetByYear.get(prevYear);
                const evol = hasPrev && prevNet ? (y.avgNet / prevNet - 1) * 100 : null;
                const infl = annualInflByYear.get(y.year) ?? null;
                const sg = smicGapByYear.get(y.year);
                const paReel = purchasingByYear.get(y.year) ?? null;
                const isInProgress = y.year === inProgressYear;
                return (
                  <tr key={y.year} className="border-b border-border/50 hover:bg-border/20">
                    <td className="px-3 py-2 text-left text-text font-medium">
                      {y.year}
                      {isInProgress && <span className="text-text-sec font-normal text-[11px] ml-1">en cours</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-text-sec">
                      {y.incomplet ? <span className="text-amber" title="Année incomplète">⚠ {y.months}</span> : y.months}
                    </td>
                    <td className="px-3 py-2 text-right text-text tabular-nums">{fmt(y.avgNet)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${evol == null ? "text-text-sec" : evol >= 0 ? "text-green" : "text-red"}`}>
                      {evol == null ? "—" : signPct(evol)}
                    </td>
                    <td className="px-3 py-2 text-right text-text-sec tabular-nums">{infl == null ? "—" : signPct(infl)}</td>
                    <td className="px-3 py-2 text-right text-text-sec tabular-nums">{sg?.smicNet != null ? fmt(sg.smicNet) : "—"}</td>
                    <td className="px-3 py-2 text-right text-text-sec tabular-nums">{paReel != null ? fmt(paReel) : "—"}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${sg?.gapPct == null ? "text-text-sec" : sg.gapPct >= 0 ? "text-green" : "text-red"}`}>
                      {sg?.gapPct == null ? "—" : signPct(sg.gapPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
        <p className="text-text-sec text-[11px] mt-2">
          PA réel = net moyen exprimé en euros de {refYear ?? "l'année de référence"}. ⚠ = année incomplète (&lt; 11 mois).
        </p>
      </div>

      {/* ═══ Inflation personnalisée (2024-2025) ═════════════════ */}
      {personalRows.length > 0 ? (
        <div className="card">
          <div className="mb-3">
            <h2 className="text-text text-sm font-semibold">📊 Inflation personnalisée</h2>
            <p className="text-text-sec text-xs mt-0.5">
              Taux pondéré par tes catégories de dépenses réelles (détail sectoriel disponible 2024-2025 uniquement).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {personalRows.map((r) => {
              const diff = r.national != null ? r.perso - r.national : null;
              return (
                <div key={r.year} className="rounded-lg border border-border p-3">
                  <div className="text-text-sec text-xs mb-1">Année {r.year}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-text text-xl font-title font-bold tabular-nums">{pp(r.perso)} %</span>
                    {r.national != null && (
                      <span className="text-text-sec text-xs">vs {pp(r.national)} % national</span>
                    )}
                  </div>
                  {diff != null && (
                    <div className={`text-xs font-medium mt-1 ${diff >= 0 ? "text-red" : "text-green"}`}>
                      {diff >= 0 ? "+" : ""}{pp(diff)} pts {diff >= 0 ? "au-dessus" : "en-dessous"} de l'inflation nationale
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card opacity-60">
          <h2 className="text-text-sec text-sm font-semibold">📊 Inflation personnalisée</h2>
          <p className="text-text-sec text-xs mt-1">
            Indisponible : le détail sectoriel des dépenses n'est exploitable que pour 2024-2025.
          </p>
        </div>
      )}

      {/* ═══ Insights dynamiques ═════════════════════════════════ */}
      {insightItems.length > 0 && (
        <div className="card">
          <h2 className="text-text text-sm font-semibold mb-3">💡 Insights</h2>
          <div className="flex flex-col gap-2">
            {insightItems.map((it) => {
              const tone =
                it.tone === "pos" ? { border: C_SAL, text: "text-green" } :
                it.tone === "neg" ? { border: C_INF, text: "text-red" } :
                { border: C_NEUTRAL, text: "text-text" };
              return (
                <div
                  key={it.key}
                  className="flex items-start gap-2.5 rounded-lg bg-white/[0.02] border-l-2 pl-3 pr-3 py-2"
                  style={{ borderLeftColor: tone.border }}
                >
                  <span className={`mt-0.5 ${tone.text}`}>{it.icon}</span>
                  <span className="text-text text-sm">{it.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
