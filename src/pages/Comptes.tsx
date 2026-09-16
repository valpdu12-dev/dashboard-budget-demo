// ── Page Comptes V2 — Vue d'ensemble des soldes et flux ──────────────────
// Migré depuis V1 Comptes.jsx (392 lignes → ~200 lignes)
// Améliorations V2 :
//   - Zustand stores (0 props drilling)
//   - Composants partagés (KPICard, ChartTooltip)
//   - Tailwind (0 inline style sauf couleurs dynamiques)
//   - TypeScript strict

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Wallet, TrendingDown, TrendingUp, Scale, Banknote,
  PiggyBank, CreditCard, BadgeEuro, BarChart3,
  CalendarClock, AlertTriangle,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonKPIGrid, SkeletonChart, SkeletonDonut } from "@/components/ui/Skeleton";

import { useDataStore } from "@/stores/useDataStore";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useBalances } from "@/hooks/useBalances";
import { useKPIs } from "@/hooks/useKPIs";
import { useBudgetData } from "@/hooks/useBudgetData";
import { useChartSize } from "@/hooks/useChartSize";

import { fmt, fmtShort, mkLabel } from "@/utils/formatters";
import { projectMonthEnd, daysInMonthOf, lastTxDayOfMonth } from "@/utils/projection";
import { COMPTES_REELS } from "@/config/constants";
import { couleurCompte } from "@/config/colors";

/** monthKey "YYYY-MM" → même mois l'année précédente. */
function prevYearKey(mk: string): string {
  const year = parseInt(mk.slice(0, 4), 10);
  return `${year - 1}${mk.slice(4)}`;
}

/**
 * Icône par compte. Table de préférence, pas de contrainte : un compte absent
 * reçoit l'icône générique ci-dessous plutôt qu'un trou dans la carte.
 */
const ICONE_PAR_DEFAUT = <Wallet size={14} />;
const COMPTE_ICONS: Record<string, React.ReactNode> = {
  "Banque A - Courant":       <CreditCard size={14} />,
  "Banque B - Compte joint":       <Banknote size={14} />,
  "Banque C - Compte joint": <PiggyBank size={14} />,
  "Titres-restaurant":     <BadgeEuro size={14} />,
  "Banque B - Courant":            <Wallet size={14} />,
};

// ─── Donut outer label ──────────────────────────────────────────────────
function renderDonutLabel({
  cx, cy, midAngle, outerRadius, name, percent,
}: { cx: number; cy: number; midAngle: number; outerRadius: number; name: string; percent: number }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 22;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#6B7280" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={12}>
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

// ─── Page Comptes ───────────────────────────────────────────────────────
export default function Comptes() {
  const { config, salary, status, budgets } = useDataStore();
  const { allMonths, allMonthsInRange, currentMonth, prevMonth, baseTx } = useFilteredData();

  const initBalances = config?.init ?? {};
  const salaryMonths = salary?.months ?? [];

  const {
    balancesByMonth, currentBalances, balanceChartData,
    comptesNonInitialises, aucunSoldeConnu, comptesPresents, variationsByMonth,
  } = useBalances(
    useDataStore.getState().transactions,
    allMonths,
    initBalances,
  );

  const kpis = useKPIs(baseTx, balancesByMonth, salaryMonths, currentMonth, prevMonth);

  // Les comptes effectivement affichables : ceux dont on connaît le départ.
  const COMPTES_AVEC_SOLDE_CONNU = useMemo(
    () => COMPTES_REELS.filter((c) => !comptesNonInitialises.includes(c)),
    [comptesNonInitialises]
  );

  // Lot 1.2 — dimensions de graphique pilotées par le palier d'affichage.
  const { chartHeight, donutRadii, isSmall } = useChartSize();
  const donut = donutRadii(70, 110);

  // Badge alertes budget (QW4) — postes en dépassement (warning + over)
  const { kpis: budgetKpis } = useBudgetData();

  // Aucun objectif défini n'est PAS « aucun dépassement ». Constaté le
  // 16/09/2026 sur un fichier importé : sans le moindre plafond, la carte
  // annonçait « Aucun dépassement » en vert — une bonne nouvelle inventée,
  // exactement le défaut que la règle du « tiret plutôt qu'un 100 % » avait
  // chassé ailleurs.
  const aucunObjectif = (budgets?.budgets?.length ?? 0) === 0;

  // Données du graphe soldes + comparatif N-1 (prev_Total) pour le tooltip (QW2)
  const lineData = useMemo(
    () =>
      balanceChartData(allMonthsInRange).map((row) => {
        const prevTotal = balancesByMonth[prevYearKey(row.monthKey as string)]?.["Total"];
        return prevTotal !== undefined
          ? { ...row, prev_Total: Math.round(prevTotal) }
          : row;
      }),
    [balanceChartData, allMonthsInRange, balancesByMonth],
  );

  // Variations cumulées, pour la période affichée.
  const variationChartData = useMemo(
    () =>
      allMonthsInRange.map((mk) => {
        const ligne: Record<string, number | string> = { monthKey: mk };
        for (const c of comptesPresents) ligne[c] = Math.round(variationsByMonth[mk]?.[c] ?? 0);
        return ligne;
      }),
    [allMonthsInRange, comptesPresents, variationsByMonth]
  );

  // Projection fin de mois (QW3) — extrapolation linéaire sur le mois en cours
  const projection = useMemo(() => {
    if (!currentMonth) return null;
    const daysElapsed = lastTxDayOfMonth(baseTx, currentMonth);
    const daysInMonth = daysInMonthOf(currentMonth);
    return projectMonthEnd(kpis.depCur, kpis.recCur, daysElapsed, daysInMonth);
  }, [baseTx, currentMonth, kpis.depCur, kpis.recCur]);

  const donutData = useMemo(() => {
    return COMPTES_REELS
      .map((name) => ({ name, value: Math.max(0, Math.round(currentBalances[name] || 0)) }))
      .filter((d) => d.value > 0);
  }, [currentBalances]);

  const donutTotal = useMemo(
    () => donutData.reduce((s, d) => s + d.value, 0),
    [donutData],
  );

  const soldeTotalCur = kpis.curBal.Total || 0;
  const soldeTotalPrev = kpis.prevBal.Total || 0;

  if (status !== "success") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Comptes" subtitle="Vue d'ensemble de vos soldes et flux" />

        <SkeletonKPIGrid count={11} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonChart height={chartHeight(380)} />
          <SkeletonDonut size={300} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Comptes" subtitle="Vue d'ensemble de vos soldes et flux" />

      {/*
        Lot B.5 — un compte sans solde de départ déclaré n'est pas à zéro : on
        ignore son point de départ. Le compter pour 0 dans le total revenait à
        présenter la somme des mouvements comme un patrimoine. Ces comptes sont
        donc retirés des soldes, et nommés ici.
      */}
      {comptesNonInitialises.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-2 px-3.5 py-2.5 bg-amber/[0.08] border border-amber/25 rounded-lg text-[13px] text-amber"
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {aucunSoldeConnu
              ? "Aucun solde de départ n'est déclaré par votre source : les soldes ne sont pas calculables."
              : `Solde de départ non déclaré pour ${comptesNonInitialises.join(", ")}.`}{" "}
            <span className="text-text-sec">
              {aucunSoldeConnu
                ? "Cette page montre donc la VARIATION cumulée de chaque compte — crédits moins débits depuis la première transaction. Une variation n'est pas un solde : le point de départ reste inconnu. Déclarez-le dans la feuille « Paramètres » de votre fichier pour obtenir de vrais soldes."
                : "Ces comptes sont exclus des soldes et du total : ils ne valent pas zéro, leur point de départ est inconnu. Renseignez-le dans la feuille « Paramètres » de votre fichier."}
            </span>
          </span>
        </div>
      )}

      {/* ═══ Bandeau KPI (11 cards) ════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 stagger-grid">
        {!aucunSoldeConnu && (
          <KPICard label="Solde Total" value={soldeTotalCur} prev={soldeTotalPrev} color="#6366F1" icon={<Wallet size={14} />} />
        )}

        {aucunSoldeConnu
          ? comptesPresents.map((compte) => (
              <KPICard
                key={compte}
                label={`${compte} · variation`}
                value={variationsByMonth[currentMonth ?? ""]?.[compte] ?? 0}
                prev={variationsByMonth[prevMonth ?? ""]?.[compte]}
                color={couleurCompte(compte)}
                icon={COMPTE_ICONS[compte] ?? ICONE_PAR_DEFAUT}
              />
            ))
          : COMPTES_AVEC_SOLDE_CONNU.map((compte) => (
              <KPICard
                key={compte}
                label={compte}
                value={kpis.curBal[compte] || 0}
                prev={kpis.prevBal[compte] || 0}
                color={couleurCompte(compte)}
                icon={COMPTE_ICONS[compte] ?? ICONE_PAR_DEFAUT}
              />
            ))}

        <KPICard label="Dépenses mois" value={kpis.depCur} prev={kpis.depPrev} color="#EF4444" icon={<TrendingDown size={14} />} />
        <KPICard label="Recettes mois" value={kpis.recCur} prev={kpis.recPrev} color="#10B981" icon={<TrendingUp size={14} />} />
        <KPICard label="Net du mois" value={kpis.netMonth} color={kpis.netMonth >= 0 ? "#10B981" : "#EF4444"} icon={<Scale size={14} />} />

        <KPICard
          label="Salaire net"
          customValue={kpis.lastSal ? fmt(kpis.lastSal.net) : "—"}
          customSub={
            kpis.lastSal && kpis.prevSal
              ? `${(((kpis.lastSal.net - kpis.prevSal.net) / Math.abs(kpis.prevSal.net)) * 100).toFixed(1).replace(".", ",")} % vs préc.`
              : ""
          }
          icon={<Banknote size={14} />}
        />

        <KPICard
          label="Taux épargne"
          value={kpis.tauxEpargne ?? undefined}
          format="pct"
          color={kpis.tauxEpargne === null ? undefined : kpis.tauxEpargne >= 0 ? "#10B981" : "#EF4444"}
          icon={<PiggyBank size={14} />}
        />

        <KPICard
          label="Fixe / Occasionnelle"
          customValue={kpis.occ > 0 ? (kpis.fixe / kpis.occ).toFixed(1).replace(".", ",") : "—"}
          customSub={`${fmt(kpis.fixe)} / ${fmt(kpis.occ)}`}
          subColor="#6B7280"
          icon={<BarChart3 size={14} />}
        />
      </div>

      {/* ═══ Projection fin de mois + Alertes budget ═══════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* QW3 — Projection fin de mois */}
        <div className="card flex items-center gap-4">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo/15 flex items-center justify-center text-indigo-text">
            <CalendarClock size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-text-sec text-xs">Projection fin de mois</span>
            {projection && projection.reliable ? (
              <>
                <span
                  className="text-xl font-title font-bold tabular-nums"
                  style={{ color: projection.projectedNet >= 0 ? "#10B981" : "#EF4444" }}
                >
                  {projection.projectedNet >= 0 ? "+" : ""}{fmt(projection.projectedNet)}
                </span>
                <span className="text-text-sec text-xs">
                  À ce rythme · {projection.daysElapsed}/{projection.daysInMonth} j ·
                  réalisé {projection.currentNet >= 0 ? "+" : ""}{fmt(projection.currentNet)}
                </span>
              </>
            ) : (
              <>
                <span className="text-xl font-title font-bold tabular-nums text-text">
                  {projection ? `${projection.currentNet >= 0 ? "+" : ""}${fmt(projection.currentNet)}` : "—"}
                </span>
                <span className="text-text-sec text-xs">Mois complet — net réalisé</span>
              </>
            )}
          </div>
        </div>

        {/* QW4 — Badge alertes budget */}
        <Link
          to="/depenses/budget"
          className={`card flex items-center gap-4 transition-colors hover:border-indigo/50 ${
            budgetKpis.overrunCount !== null && budgetKpis.overrunCount > 0 ? "border-red/40" : ""
          }`}
        >
          <div
            className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
              aucunObjectif || budgetKpis.overrunCount === null
                ? "bg-surface text-text-sec"
                : budgetKpis.overrunCount > 0
                  ? "bg-red/15 text-red"
                  : "bg-green/15 text-green"
            }`}
          >
            <AlertTriangle size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-text-sec text-xs">Alertes budget</span>
            {/* Sans mois comparable, « Aucun dépassement » en vert serait une
                bonne nouvelle inventée : on ne sait pas. */}
            <span
              className="text-xl font-title font-bold tabular-nums"
              style={{
                color: aucunObjectif || budgetKpis.overrunCount === null
                  ? undefined
                  : budgetKpis.overrunCount > 0 ? "#EF4444" : "#10B981",
              }}
            >
              {aucunObjectif
                ? "Aucun objectif défini"
                : budgetKpis.overrunCount === null
                ? "Indisponible"
                : budgetKpis.overrunCount > 0
                  ? `${budgetKpis.overrunCount} poste${budgetKpis.overrunCount > 1 ? "s" : ""} en dépassement`
                  : "Aucun dépassement"}
            </span>
            <span className="text-text-sec text-xs">Voir le budget mensuel →</span>
          </div>
        </Link>
      </div>

      {/* ═══ Graphiques ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card chart-enter">
          <div className="text-sm font-medium text-text mb-4">
            {aucunSoldeConnu
              ? "Évolution mensuelle des variations cumulées"
              : "Évolution mensuelle des soldes"}
          </div>
          {/*
            Sans aucun solde de départ, la courbe n'a rien à tracer : elle
            affichait une grille vide graduée de 2 à 4 €, ce qui ressemble à
            un bug plutôt qu'à une absence.
          */}
          {aucunSoldeConnu ? (
            <ResponsiveContainer width="100%" height={chartHeight(380)}>
              <LineChart data={variationChartData}>
                <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
                <XAxis dataKey="monthKey" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(mk: string) => mkLabel(mk)} />
                <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
                <Tooltip content={<ChartTooltip formatter={(v) => fmt(v)} />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                {comptesPresents.map((compte) => (
                  <Line key={compte} type="monotone" dataKey={compte} stroke={couleurCompte(compte)} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
          <ResponsiveContainer width="100%" height={chartHeight(380)}>
            <LineChart data={lineData}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis dataKey="monthKey" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(mk: string) => mkLabel(mk)} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
              <Tooltip content={<ChartTooltip formatter={(v) => fmt(v)} />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              {COMPTES_AVEC_SOLDE_CONNU.map((compte) => (
                <Line key={compte} type="monotone" dataKey={compte} stroke={couleurCompte(compte)} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              ))}
              <Line type="monotone" dataKey="Total" stroke={couleurCompte("Total")} strokeWidth={2.5} strokeDasharray="6 3" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="card flex flex-col items-center">
          <div className="text-sm font-medium text-text mb-4 self-start">
            Répartition actuelle des soldes
          </div>
          {donutData.length === 0 ? (
            <EmptyState title="Aucune donnée de solde disponible" />
          ) : (
            <div className={isSmall ? "w-full" : ""}>
              <div className={`relative ${isSmall ? "w-full" : ""}`}>
                {/* Lot 1.6 — `svg-img-alt`. Recharts écrit `role="img"` EN DUR
                    sur chaque `<path class="recharts-sector">` (Sector.js:211,
                    après le spread de `filterProps`) : ni `<Pie>` ni
                    `<PieChart>` ne permettent de le neutraliser par une prop,
                    et `filterProps` ne laisse passer que `data-*` et les
                    attributs SVG. Le seul levier est donc `aria-hidden` sur un
                    ancêtre. Ce div n'enveloppe QUE le graphique : la légende
                    ci-dessous reste dans l'arbre d'accessibilité et porte les
                    mêmes libellés et pourcentages. */}
                <div aria-hidden="true">
                  <ResponsiveContainer width={isSmall ? "100%" : 300} height={chartHeight(300)}>
                    <PieChart tabIndex={-1}>
                      <Pie rootTabIndex={-1} data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={donut.inner} outerRadius={donut.outer} label={donut.showRadialLabels ? renderDonutLabel : false} labelLine={false} style={{ cursor: "default" }}>
                        {donutData.map((d) => (
                          <Cell key={d.name} fill={couleurCompte(d.name)} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip formatter={(v) => fmt(v)} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <div className="text-text-sec text-xs mb-0.5">Total</div>
                  <div className="text-text text-xl font-bold tabular-nums">{fmtShort(donutTotal)}</div>
                </div>
              </div>
              {/* Lot 1.2 — sous 430 px les libellés radiaux déborderaient de
                  l'écran : ils sont remplacés par cette légende, rendue hors
                  du graphique pour que le total reste centré sur le donut. */}
              {/* Lot 1.6 — cette légende était conditionnée à `!showRadialLabels`,
                  donc absente au-dessus de 430 px, où les libellés radiaux du
                  donut prenaient le relais. Or ces libellés viennent d'être
                  sortis de l'arbre d'accessibilité avec le graphique : sans ce
                  changement, le rendu PC aurait perdu toute restitution
                  textuelle. Elle est désormais toujours rendue, en `sr-only`
                  quand le donut porte ses propres libellés. Aucun changement
                  visuel, à aucune largeur. */}
              {donutData.length > 0 && (
                <ul className={donut.showRadialLabels ? "sr-only" : "flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 w-full"}>
                  {donutData.map((d) => (
                    <li key={d.name} className="flex items-center gap-1.5 text-xs text-text-sec">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: couleurCompte(d.name) }}
                        aria-hidden="true"
                      />
                      {d.name} ({donutTotal ? Math.round((d.value / donutTotal) * 100) : 0} %)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
