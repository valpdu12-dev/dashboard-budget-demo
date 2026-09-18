// ── Page Salaire V2 (V1: 568 lignes → V2: ~320 lignes) ──────────────────
// Sections : Chips entreprise + Bandeau KPI + LineChart historique
//   + KPIs mois + AreaChart anatomie + Comparateur M vs M-1 + Projection
// Améliorations V2 : Tailwind, hook dédié, composants partagés, 0 inline style

import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Label,
} from "recharts";
import {
  Banknote, BadgeEuro, CalendarRange, Percent,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonPage } from "@/components/ui/Skeleton";

import { useFilterStore } from "@/stores/useFilterStore";
import { useDataStore } from "@/stores/useDataStore";
import { useSalaryPageData } from "@/hooks/useSalaryPageData";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useChartSize } from "@/hooks/useChartSize";

import { fmt, fmtShort, mkLabel, pctChange } from "@/utils/formatters";
import { couleurStable, DONUT_COLORS } from "@/config/colors";

// Lot C.5 — les employeurs n'ont plus de table de couleurs : le repli stable
// donne toujours une couleur, et toujours la même pour un nom donné.
const couleurEmployeurStable = (nom: string) => couleurStable(nom, DONUT_COLORS);

// ─── AreaChart Tooltip (affiche % du brut par poste) ─────────────────────
function AreaTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{
    name: string; value: number; color: string; dataKey: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  // Le brut ne fait l'objet d'aucune série sur ce graphique — les aires sont
  // `net`, `cotSal` et `retenues`. La version précédente le cherchait par
  // `payload.find(p => p.dataKey === "brut")`, qui ne trouvait jamais rien :
  // tous les pourcentages retombaient sur « — ». Il est lu sur la ligne de
  // données, où `stackedData` le porte bien.
  const brutValue = Number(payload[0]?.payload?.brut ?? 0);

  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg text-xs">
      <div className="text-text font-semibold mb-1.5">{label}</div>
      {payload.filter((p) => p.dataKey !== "brut").map((p, i) => {
        const pct = brutValue > 0 ? ((p.value / brutValue) * 100).toFixed(1) : "—";
        return (
          <div key={i} className="flex justify-between gap-4 text-text py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold tabular-nums">
              {fmt(p.value)} <span className="text-text-sec font-normal">({pct}%)</span>
            </span>
          </div>
        );
      })}
      {brutValue > 0 && (
        <div className="border-t border-border mt-1 pt-1 flex justify-between text-text font-semibold">
          <span>Brut</span>
          <span className="tabular-nums">{fmt(brutValue)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Page Salaire ────────────────────────────────────────────────────────
export default function Salaire() {
  const { status } = useDataStore();
  useFilterSync({ ent: "selEntreprise" });

  // Lot 1.2 — hauteurs de graphique pilotées par le palier d'affichage.
  const { chartHeight } = useChartSize();
  const {
    selEntreprise, setSelEntreprise,
  } = useFilterStore();

  const {
    entreprises, filteredHistData, entrepriseChanges,
    entKPIs, monthKPIs, stackedData, projection, lastSal,
    selSal,
    hasFilters, clearRevFilters,
  } = useSalaryPageData();

  if (status !== "success") return <SkeletonPage />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Salaire" subtitle="Analyse de votre rémunération" />

      {/* ═══ Chips entreprise ════════════════════════════════════ */}
      <div className="flex flex-wrap gap-2 items-center">
        {entreprises.map((ent) => (
          <Chip
            key={ent}
            label={ent}
            active={selEntreprise === ent}
            color={couleurEmployeurStable(ent)}
            onClick={() => setSelEntreprise(selEntreprise === ent ? null : ent)}
          />
        ))}
        {hasFilters && (
          <button onClick={clearRevFilters} className="text-xs text-indigo-text hover:underline ml-2">
            Effacer filtres
          </button>
        )}
      </div>

      {/* ═══ Bandeau KPI entreprise ══════════════════════════════ */}
      {entKPIs && (
        <div className="card">
          <div className="flex items-center gap-2 text-sm font-semibold text-text mb-3">
            {selEntreprise && (
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: couleurEmployeurStable(selEntreprise) }} />
            )}
            {entKPIs.label}
            <span className="text-text-sec font-normal text-xs">— {entKPIs.months} mois</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-grid">
            <KPICard label="Net cumulé" customValue={fmtShort(entKPIs.totalNet)} icon={<Banknote size={14} />} />
            <KPICard label="Brut cumulé" customValue={fmtShort(entKPIs.totalBrut)} icon={<BadgeEuro size={14} />} />
            <KPICard label="Net moyen / mois" value={Math.round(entKPIs.avgNet)} icon={<CalendarRange size={14} />} />
            <KPICard label="Ratio net/brut" value={entKPIs.ratio} format="pct" icon={<Percent size={14} />} />
          </div>
        </div>
      )}

      {/* ═══ LineChart historique ════════════════════════════════ */}
      <div className="card">
        <h2 className="text-text text-sm font-semibold mb-4">
          Historique salaire {selEntreprise ? `— ${selEntreprise}` : "(carrière)"}
        </h2>
        <ResponsiveContainer width="100%" height={chartHeight(320)}>
          <LineChart data={filteredHistData}>
            <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="mk" tick={{ fill: "#6B7280", fontSize: 12 }}
              axisLine={false} tickLine={false}
              tickFormatter={(mk: string) => mkLabel(mk)}
              interval={Math.max(0, Math.floor(filteredHistData.length / 12))}
            />
            <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Line type="monotone" dataKey="Net" stroke="#10B981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="Brut" stroke="#6366F1" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} opacity={0.6} />
            {!selEntreprise && entrepriseChanges.map((ch, i) => (
              <ReferenceLine key={i} x={ch.mk} stroke={couleurEmployeurStable(ch.entreprise)} strokeDasharray="4 3" strokeWidth={1.5}>
                {/* Lot 1.6 — point ouvert n° 20. `fontSize` était à 10 : ce
                    seul nœud faisait manquer la cible n° 4 de l'audit
                    (« police minimale ≥ 11 px ») sur toute la page Salaire, en
                    5 occurrences (les noms d'employeurs). Le balayage du lot
                    1.2 avait traité les `tick={{fontSize}}` et les
                    `wrapperStyle`, mais pas les `<Label>` — forme syntaxique
                    différente, occurrence unique. */}
                <Label value={ch.entreprise} position="top" fill={couleurEmployeurStable(ch.entreprise)} fontSize={11} />
              </ReferenceLine>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ═══ KPIs dynamiques du mois sélectionné ════════════════ */}
      {monthKPIs && selSal && (
        <div className="card">
          <div className="text-sm font-semibold text-text mb-3">
            Synthèse — {mkLabel(selSal.mk)}
            {selSal.entreprise && <span className="text-text-sec font-normal"> chez {selSal.entreprise}</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-grid">
            <KPICard
              label="Net du mois"
              value={selSal.net}
              customSub={monthKPIs.deltaNet || undefined}
              subColor={monthKPIs.deltaNet?.startsWith("+") ? "#10B981" : monthKPIs.deltaNet?.startsWith("-") ? "#EF4444" : undefined}
              icon={<Banknote size={14} />}
            />
            <KPICard label="Taux cotisations" value={monthKPIs.tauxCot} format="pct" customSub="cotisations / brut" icon={<Percent size={14} />} />
            <KPICard
              label={selSal.mk === lastSal?.mk ? "Coût employeur" : "Brut"}
              value={selSal.mk === lastSal?.mk ? monthKPIs.coutTotal : selSal.brut}
              customSub={selSal.mk === lastSal?.mk ? "brut + patronales" : undefined}
              icon={<BadgeEuro size={14} />}
            />
            <KPICard
              label={`Net cumulé ${monthKPIs.year}`}
              customValue={fmtShort(monthKPIs.cumNet)}
              customSub={
                monthKPIs.prevCumNet > 0
                  ? `${pctChange(monthKPIs.cumNet, monthKPIs.prevCumNet)} vs ${monthKPIs.prevYear} (${monthKPIs.nbMoisPrevYear}m)`
                  : undefined
              }
              subColor={monthKPIs.prevCumNet > 0 && monthKPIs.cumNet >= monthKPIs.prevCumNet ? "#10B981" : "#EF4444"}
              icon={<CalendarRange size={14} />}
            />
          </div>
        </div>
      )}

      {/* ═══ Stacked Area — anatomie du salaire ═════════════════ */}
      <div className="card">
        <div className="mb-4">
          <h2 className="text-text text-sm font-semibold">Anatomie du salaire</h2>
          <p className="text-text-sec text-xs mt-0.5">
            Décomposition du brut dans le temps {selEntreprise ? `— ${selEntreprise}` : ""}
          </p>
        </div>
        {stackedData.length === 0 ? (
          <EmptyState title="Aucune donnée" />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight(300)}>
            <AreaChart data={stackedData}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="label" tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false} tickLine={false}
                interval={Math.max(0, Math.floor(stackedData.length / 12))}
              />
              <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
              <Tooltip content={<AreaTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area type="monotone" dataKey="net" name="Net" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.3} strokeWidth={1.5} />
              <Area type="monotone" dataKey="cotSal" name="Cotisations" stackId="1" stroke="#6366F1" fill="#6366F1" fillOpacity={0.25} strokeWidth={1.5} />
              <Area type="monotone" dataKey="retenues" name="Retenues" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.2} strokeWidth={1.5} />
              {stackedData.some((d) => d.indem > 0) && (
                <Line type="monotone" dataKey="indem" name="Indemnités" stroke="#8B5CF6" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Le « Comparateur mensuel » (navigation M vs M-1 + barres CompareBar)
          a été retiré le 29/07/2026 sur demande : redondant avec la synthèse
          du mois et le bilan annuel, et coûteux en hauteur sur mobile. */}

      {/* ═══ Bilan annuel sur période comparable ════════════════ */}
      {projection && (
        <div className="card">
          {/* Le titre porte la plage réellement comparée : « janv.–mai 2026 vs
              janv.–mai 2025 ». Sans elle, « 2026 vs 2025 » laissait croire à
              une comparaison d'années pleines alors que l'année en cours est
              partielle. */}
          <h2 className="text-text text-sm font-semibold mb-4">
            {projection.periodLabel
              ? `${projection.periodLabel} ${projection.year} vs ${projection.periodLabel} ${projection.prevYear}`
              : `Bilan annuel — ${projection.year} vs ${projection.prevYear}`}
          </h2>

          <div className="grid grid-cols-2 gap-5">
            {/* Année courante */}
            <div>
              <div className="text-text-sec text-xs mb-1">Net cumulé {projection.year}</div>
              <div className="text-text text-xl font-bold tabular-nums">{fmtShort(projection.netY)}</div>
              <div className="text-text-sec text-[11px] mt-0.5">{projection.nbY} mois — brut : {fmtShort(projection.brutY)}</div>
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-green rounded-full" style={{ width: `${Math.min((projection.nbY / 12) * 100, 100)}%` }} />
              </div>
              <div className="text-[11px] text-text-sec mt-1">{projection.nbY}/12 mois</div>
            </div>

            {/* Année précédente */}
            <div>
              <div className="text-text-sec text-xs mb-1">Net cumulé {projection.prevYear}</div>
              <div className="text-text text-xl font-bold tabular-nums">{fmtShort(projection.netPY)}</div>
              <div className="text-text-sec text-[11px] mt-0.5">{projection.nbPY} mois — brut : {fmtShort(projection.brutPY)}</div>
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-indigo/50 rounded-full" style={{ width: `${Math.min((projection.nbPY / 12) * 100, 100)}%` }} />
              </div>
              <div className="text-[11px] text-text-sec mt-1">{projection.nbPY}/12 mois</div>
            </div>
          </div>

          {/* Delta */}
          {projection.deltaNet && (
            <div className={`mt-4 pt-3 border-t border-border flex items-center gap-2 text-sm ${Number(projection.deltaNet) >= 0 ? "text-green" : "text-red"}`}>
              <span className="text-base">{Number(projection.deltaNet) >= 0 ? "▲" : "▼"}</span>
              <span className="font-semibold tabular-nums">
                {Number(projection.deltaNet) >= 0 ? "+" : ""}{fmt(projection.netY - projection.netPY)}
              </span>
              <span className="text-text-sec">
                ({Number(projection.deltaNet) >= 0 ? "+" : ""}{projection.deltaNet}% net)
              </span>
              <span className="text-text-sec">vs {projection.prevYear}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
