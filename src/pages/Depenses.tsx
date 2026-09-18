// ── Page Dépenses V2 — Analyse détaillée des dépenses ────────────────────
// Migré depuis V1 (787 lignes → ~350 lignes)
// Améliorations V2 :
//   - Hook dédié useExpenseData (logique extraite, typée)
//   - Zustand stores pour filtres drill-down (selMonth, selCat2, selType, selOrg)
//   - Composants partagés (KPICard, ChartTooltip, Chip, DataTable)
//   - Tailwind (0 inline style sauf couleurs dynamiques)
//   - DataTable paginé (FIX V1 : pas de pagination)
//   - Courbe d avancement des depenses (remplace la heatmap, 11/08/2026)

import { useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  Receipt, Hash, CalendarRange, ArrowDownCircle,
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
import { useUIStore } from "@/stores/useUIStore";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useExpenseData } from "@/hooks/useExpenseData";
import { useBudgetData } from "@/hooks/useBudgetData";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useChartSize } from "@/hooks/useChartSize";
import { useInfobulleTactile } from "@/hooks/useInfobulleTactile";
import { BandeauMoisNonComparables } from "@/components/ui/BandeauMoisNonComparables";

import { fmt, fmtShort, fmtDate, mkLabel, pctChange, partDuTotal } from "@/utils/formatters";
import { TYPE_COLORS } from "@/config/colors";
import { useCouleurs, type Couleurs } from "@/hooks/useCouleurs";

/**
 * Coupe un libelle trop long en deux lignes equilibrees, au plus proche
 * espace du milieu (repli sur une coupure seche si aucun espace).
 */
function splitTwoLines(s: string): [string, string] {
  const mid = Math.floor(s.length / 2);
  let best = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === " " && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  if (best <= 0) return [s.slice(0, mid), s.slice(mid)];
  return [s.slice(0, best), s.slice(best + 1)];
}

/**
 * Libellé de barre horizontale ancré au bord gauche du graphique.
 *
 * `<LabelList position="top">` centre le texte sur la barre : sur une petite
 * barre, le libellé déborde des deux côtés et se fait rogner. Ici le texte
 * part toujours de la gauche du graphique, quelle que soit la longueur de la
 * barre.
 *
 * ⚠️ Le libellé est CENTRÉ VERTICALEMENT sur sa barre, et non posé au-dessus.
 * Le placement d'origine (`y - 6`) partait d'une bonne intention — ne jamais
 * laisser la barre recouvrir son libellé — mais `y` est le bord SUPÉRIEUR de
 * la barre sur un `layout="vertical"` : le texte flottait dans l'interstice
 * entre sa barre et la précédente, et le lecteur l'attribuait à celle du
 * dessus. Constaté sur A56 le 11/08/2026 (« Cantine » lu au niveau de
 * « Restaurant »), et le tout premier libellé sortait carrément du cadre,
 * faute de marge haute. Le contour sombre ci-dessous suffit à garder le texte
 * lisible par-dessus la barre.
 */
export function BarLeftLabel({
  x, y, height, value,
}: { x?: number; y?: number; height?: number; value?: string | number }) {
  if (value === undefined || y === undefined) return null;
  const centreY = typeof height === "number" ? y + height / 2 : y;
  const xPos = typeof x === "number" ? Math.min(x, 2) : 2;
  const label = String(value);
  const lines = label.length > 40 ? splitTwoLines(label) : [label];
  return (
    <text
      x={xPos}
      y={centreY}
      textAnchor="start"
      dominantBaseline="central"
      fill="#F3F4F6"
      fontSize={12}
      fontWeight={500}
      stroke="#0B1020"
      strokeWidth={3}
      paintOrder="stroke"
    >
      {lines.length === 1 ? (
        lines[0]
      ) : (
        lines.map((ln, i) => (
          <tspan key={i} x={xPos} dy={i === 0 ? "-0.55em" : "1.1em"}>
            {ln}
          </tspan>
        ))
      )}
    </text>
  );
}

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

/**
 * Infobulle de la courbe d'avancement.
 *
 * `ChartTooltip`, partagé par la dizaine d'autres graphiques, ne sait rendre
 * qu'une valeur par série. Ici il en faut deux de natures différentes — un
 * montant cumulé et la part du total atteinte — plus la dépense du jour seul.
 * Un composant dédié coûte moins qu'une option de plus sur le composant
 * partagé, dont chaque ajout retombe sur dix graphiques.
 */
function CumulTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: { payload?: { jour: number; montant: number; cumul: number; part: number } }[];
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="text-text font-medium mb-1">Jour {d.jour}</div>
      <div className="text-text tabular-nums">
        {fmt(d.cumul)} <span className="text-text-sec">cumulés</span>
      </div>
      <div className="text-indigo-text tabular-nums">{d.part} % du total</div>
      {d.montant > 0 && (
        <div className="text-text-sec tabular-nums mt-1">
          dont {fmt(d.montant)} ce jour-là
        </div>
      )}
    </div>
  );
}

// ─── Colonnes du DataTable ──────────────────────────────────────────────
// ⚠️ Lot C.5 — une FABRIQUE, plus une constante de module. La pastille de
// catégorie porte la couleur DÉCLARÉE par la source ; une constante figée au
// chargement du module ne pourrait pas la connaître.
const colonnesDetail = (couleurs: Couleurs) => [
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
    // La troncature est conditionnée à `md:` : en carte, la largeur n'est plus
    // contrainte par les colonnes voisines, tronquer y perdrait de l'information
    // sans rien gagner.
    render: (v: unknown) => (
      <span className="text-text md:max-w-[200px] md:truncate md:block" title={String(v || "—")}>
        {String(v || "—")}
      </span>
    ),
  },
  {
    key: "type" as const,
    label: "Type",
    sortable: true,
    render: (v: unknown) => (
      <span className="text-text-sec md:max-w-[160px] md:truncate md:block">{String(v)}</span>
    ),
  },
  {
    key: "cat2" as const,
    label: "Catégorie",
    sortable: true,
    render: (v: unknown) => (
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ background: couleurs.categorie(String(v)) }}
        />
        <span className="text-text">{String(v || "—")}</span>
      </span>
    ),
  },
  {
    key: "cat3" as const,
    label: "Marchand",
    sortable: true,
    render: (v: unknown) => (
      <span className="text-text-sec md:max-w-[140px] md:truncate md:block">{String(v || "—")}</span>
    ),
  },
  {
    key: "compte" as const,
    label: "Compte",
    sortable: true,
    render: (v: unknown) => <span className="text-text-sec text-[11px]">{String(v)}</span>,
  },
  {
    key: "montant" as const,
    label: "Montant",
    sortable: true,
    priority: true,
    align: "right" as const,
    render: (v: unknown) => (
      <span className="font-medium tabular-nums">{fmt(Number(v))}</span>
    ),
  },
];

// ─── Page Dépenses ──────────────────────────────────────────────────────
export default function Depenses() {
  const couleurs = useCouleurs();
  const { status } = useDataStore();
  useFilterSync({ month: "selMonth", cat2: "selCat2", type: "selType", org: "selOrg" });

  // ── Stores & hooks ────────────────────────────────────────────────────
  const {
    selMonth, setSelMonth,
    selCat2, setSelCat2,
    selType, setSelType,
    selOrg, setSelOrg,
    clearDepFilters,
  } = useFilterStore();

  // Lot 1.2 — dimensions de graphique pilotées par le palier d'affichage.
  // Sur les 3 graphiques à barres horizontales, l'axe Y figé et la marge
  // gauche mangeaient de 49 % à 64 % des 346 px disponibles ; sous 430 px le
  // libellé passe au-dessus de sa barre et rend toute la largeur aux barres.
  const { chartHeight, axisWidth, donutRadii, isSmall } = useChartSize();
  const donut = donutRadii(45, 95);
  // Infobulle : visible uniquement TANT QUE LE DOIGT TOUCHE l'ecran.
  //
  // Sur ecran tactile aucun `mouseleave` n'est emis quand le doigt se leve :
  // Recharts gardait l'infobulle collee. Un effacement differe declenche par
  // `touchend` a ete tente le 11/08 et n'a PAS tenu sur l'A56 — le navigateur
  // emet `touchcancel`, et non `touchend`, des qu'il reprend la main pour
  // faire defiler ; sur une page de dix ecrans, c'est le cas courant. La
  // regle retenue ne repose sur aucun delai (voir `useInfobulleTactile`).
  //
  // Le donut fait exception et n'a PAS d'infobulle sous 430 px : sa legende
  // porte deja montants et parts, et sur un `PieChart` Recharts ne sait de
  // toute facon rien afficher au glissement (pas d'axes, `getMouseInfo` rend
  // `null`).
  const infobulle = useInfobulleTactile();
  /** Hauteur de rangée d'un graphique à barres horizontales. */
  const barRow = (count: number, minPC: number, rowPC: number) =>
    isSmall ? count * 42 + 24 : Math.max(minPC, count * rowPC);

  const { showBudgetOverlay, toggleBudgetOverlay } = useUIStore();
  const { filteredTx, allMonths, allMonthsInRange, currentMonth, prevMonth } = useFilteredData();
  const { kpis: budgetKpis, comparableMonths } = useBudgetData();

  const {
    expMonthlyLines,
    expByCat2,
    expByType,
    detailRows,

    topMerchants,
    cumulParJour,
    compNvsN1,
    compNvsN1Years,
    compNvsN1Mois,
    organismes,
  } = useExpenseData();

  // ── Part de chaque catégorie, pour la légende du donut ─────────────────
  // Le donut ne peut pas afficher d'infobulle au doigt (voir le commentaire
  // de sa légende) : la part est donc écrite en clair à côté du montant.
  /** Total dépensé sur la période, lu au dernier jour de la courbe. */
  const cumulTotal = useMemo(
    () => (cumulParJour.length ? cumulParJour[cumulParJour.length - 1].cumul : 0),
    [cumulParJour]
  );

  const totalCat2 = useMemo(
    () => expByCat2.reduce((s, e) => s + e.value, 0),
    [expByCat2]
  );
  const partCat2 = useCallback(
    (v: number) => partDuTotal(v, totalCat2),
    [totalCat2]
  );

  // ── KPIs ──────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const debits = filteredTx.filter((t) => t.dc === "Débit");
    const total = debits.reduce((s, t) => s + t.montant, 0);
    const nb = debits.length;
    const moyMois = allMonthsInRange.length ? total / allMonthsInRange.length : 0;

    const curDeb = debits.filter((t) => t.monthKey === currentMonth);
    const prevDeb = debits.filter((t) => t.monthKey === prevMonth);
    const curTotal = curDeb.reduce((s, t) => s + t.montant, 0);
    const prevTotal = prevDeb.reduce((s, t) => s + t.montant, 0);

    return { total, nb, moyMois, curTotal, prevTotal };
  }, [filteredTx, allMonthsInRange, currentMonth, prevMonth]);

  const hasFilters = selMonth || selCat2 || selType || selOrg;

  if (status !== "success") return <SkeletonPage />;

  return (
    // Les écouteurs tactiles sont posés au niveau de la PAGE et non de chaque
    // graphique : `touchend` ne remonte pas depuis le SVG de Recharts vers un
    // conteneur intermédiaire de façon fiable, et un seul point d'écoute vaut
    // mieux que six posés en parallèle.
    <div className="flex flex-col gap-6" {...infobulle.handlers}>
      <PageHeader title="Dépenses" subtitle="Analyse détaillée de vos dépenses" />

      {/* Filtres actifs */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {selMonth && (
            <Chip label={mkLabel(selMonth)} active onClear={() => setSelMonth(null)} />
          )}
          {selOrg && (
            <Chip label={selOrg} active onClear={() => setSelOrg(null)} />
          )}
          {selCat2 && (
            <Chip label={selCat2} active onClear={() => setSelCat2(null)} />
          )}
          {selType && (
            <Chip label={selType} active onClear={() => setSelType(null)} />
          )}
          <button
            onClick={clearDepFilters}
            className="text-xs text-indigo-text hover:underline ml-1"
          >
            Effacer tout
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-grid">
        <KPICard
          label="Total Dépenses"
          value={kpis.total}
          customSub={pctChange(kpis.curTotal, kpis.prevTotal)}
          icon={<Receipt size={14} />}
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
        <KPICard
          label="Mois courant"
          value={kpis.curTotal}
          prev={kpis.prevTotal}
          icon={<ArrowDownCircle size={14} />}
        />
      </div>

      {/* Explique l'absence de badge budget quand rien n'est comparable :
          sans ce bandeau, le badge disparaîtrait sans un mot. */}
      <BandeauMoisNonComparables
        comparableMonths={comparableMonths}
        totalMonths={allMonths.length}
      />

      {/* Badge budget global — rendu seulement quand le solde est connu.
          Avec un solde null, l'ancien code comparait `null >= 0`, ce qui vaut
          `true` en JavaScript : la page annonçait « Dans le budget » sur une
          dépense inconnue. */}
      {budgetKpis.totalBudgeted > 0 && budgetKpis.balance !== null && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium w-fit ${
          budgetKpis.balance >= 0
            ? "bg-green/10 text-green"
            : "bg-red/10 text-red"
        }`}>
          <span>{budgetKpis.balance >= 0 ? "Dans le budget" : "Hors budget"}</span>
          <span className="tabular-nums">
            ({budgetKpis.balance >= 0 ? "−" : "+"}{fmt(Math.abs(budgetKpis.balance))})
          </span>
          {budgetKpis.complianceRate !== null && (
            <span className="text-text-sec">
              — {budgetKpis.complianceRate} % conformité
            </span>
          )}
        </div>
      )}

      {/* LineChart — Évolution mensuelle par organisme */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-text">
            Évolution mensuelle des dépenses
            {selCat2 && <span className="text-text-sec"> &bull; {selCat2}</span>}
            {selType && <span className="text-text-sec"> &bull; {selType}</span>}
          </div>
          <div className="flex items-center gap-3">
            {budgetKpis.totalBudgeted > 0 && (
              <button
                onClick={toggleBudgetOverlay}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  showBudgetOverlay
                    ? "border-red/40 bg-red/10 text-red"
                    : "border-border text-text-sec hover:text-text"
                }`}
              >
                {showBudgetOverlay ? "Budget ✕" : "Budget"}
              </button>
            )}
            <span className="text-[11px] text-text-sec">
              Cliquez un point = mois &middot; Cliquez une légende = organisme
            </span>
          </div>
        </div>
        {expMonthlyLines.length === 0 ? (
          <EmptyState title="Aucune donnée sur cette période" />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight(300)}>
            <LineChart
              data={expMonthlyLines}
              onClick={(e) => {
                const mk = e?.activePayload?.[0]?.payload?.mk as string | undefined;
                if (mk) setSelMonth(selMonth === mk ? null : mk);
              }}
            >
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => fmtShort(v)}
              />
              {/* `showPrev={false}` — la comparaison au mois précédent doublait
                  la hauteur de l'étiquette pour une information peu exploitée. */}
              <Tooltip active={infobulle.active} content={<ChartTooltip formatter={(v) => fmt(v)} showPrev={false} />} />
              <Legend
                wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
                onClick={(e) => {
                  const org = e.value as string;
                  if (organismes.includes(org)) {
                    setSelOrg(selOrg === org ? null : org);
                  }
                }}
              />
              {organismes.map((org) => (
                <Line
                  key={org}
                  type="monotone"
                  dataKey={org}
                  stroke={couleurs.organisme(org)}
                  strokeWidth={selOrg && selOrg !== org ? 1 : 2.5}
                  strokeOpacity={selOrg && selOrg !== org ? 0.25 : 1}
                  dot={{ r: selOrg === org ? 4 : 2.5, strokeWidth: 0, fill: couleurs.organisme(org) }}
                  activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
                  style={{ cursor: "pointer" }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="Total"
                stroke={couleurs.organisme("Total")}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                strokeOpacity={selOrg ? 0.15 : 0.6}
              />
              {showBudgetOverlay && budgetKpis.totalBudgeted > 0 && (
                <ReferenceLine
                  y={budgetKpis.totalBudgeted}
                  stroke="#ef4444"
                  strokeDasharray="8 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Budget ${fmtShort(budgetKpis.totalBudgeted)}`,
                    position: "right",
                    fill: "#ef4444",
                    fontSize: 12,
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Grille : Donut Cat2 + BarChart Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Donut — Répartition par catégorie */}
        <div className="card flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-3">
            <div className="text-sm font-medium text-text">Répartition par Catégorie</div>
            <span className="text-[11px] text-text-sec">Cliquez pour filtrer</span>
          </div>
          {expByCat2.length === 0 ? (
            <EmptyState title="Aucune dépense" />
          ) : (
            /* Lot 1.6 — `svg-img-alt` : `role="img"` est écrit en dur par
               Recharts sur chaque secteur, seul `aria-hidden` sur un ancêtre
               le neutralise. `w-full` est indispensable ici : le parent est un
               `flex flex-col items-center`, un div nu s'y réduirait à la
               largeur de son contenu et le `width="100%"` du graphique
               s'effondrerait. */
            <div className="w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height={chartHeight(300)}>
              <PieChart tabIndex={-1}>
                <Pie rootTabIndex={-1}
                  data={expByCat2}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  innerRadius={donut.inner}
                  outerRadius={donut.outer}
                  paddingAngle={2}
                  label={donut.showRadialLabels ? renderDonutLabel : false}
                  labelLine={false}
                  onClick={(_, idx) => {
                    const name = expByCat2[idx]?.name;
                    if (name) setSelCat2(selCat2 === name ? null : name);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {expByCat2.map((e, i) => (
                    <Cell
                      key={i}
                      fill={couleurs.categorie(e.name)}
                      stroke={selCat2 === e.name ? "#fff" : "none"}
                      strokeWidth={selCat2 === e.name ? 3 : 0}
                    />
                  ))}
                </Pie>
                {!isSmall && <Tooltip active={infobulle.active} content={<ChartTooltip formatter={(v) => fmt(v)} />} />}
                {donut.showRadialLabels && <Legend wrapperStyle={{ fontSize: 12 }} />}
              </PieChart>
            </ResponsiveContainer>
            </div>
          )}
          {/* Lot 1.2 — sous 430 px, la légende Recharts consommait la hauteur du
              conteneur et écrasait le camembert. Rendue ici en HTML, hors du
              graphique, elle laisse au donut toute la hauteur disponible.
              Lot 1.6 — elle n'est plus conditionnée à `!showRadialLabels` : le
              graphique étant sorti de l'arbre d'accessibilité, la légende
              Recharts interne l'est aussi, et le PC aurait perdu toute
              restitution textuelle. `sr-only` au-dessus de 430 px — aucun
              changement visuel, à aucune largeur. */}
          {/* La légende porte le MONTANT et la PART, et non le seul libellé.
              Motif mesuré le 11/08/2026 dans `recharts@2.15.4` : sur un
              `PieChart`, l'infobulle est déclenchée par les événements souris
              des secteurs, et `getMouseInfo` (`generateCategoricalChart.js:1684`)
              rend `null` faute d'axes — `handleTouchMove` n'a donc rien à
              activer. Un glissement du doigt sur le donut ne peut RIEN
              afficher, là où le `BarChart` voisin fonctionne parce qu'il passe
              par ses axes. Plutôt que de réimplémenter la détection tactile,
              l'information est rendue lisible en permanence : sur téléphone
              c'est de toute façon préférable à une infobulle qu'il faut
              maintenir au doigt — d'autant que sous 430 px l'infobulle n'est
              plus rendue du tout (voir `useInfobulleTactile`). */}
          {expByCat2.length > 0 && (
            donut.showRadialLabels ? (
              /* Au-dessus de 430 px : restitution textuelle pour les lecteurs
                 d'écran uniquement, NON interactive. Des boutons `sr-only`
                 seraient tabulables tout en étant invisibles — dix cibles de
                 clavier fantômes, exactement le genre de régression que le
                 lot 1.6 a passé une session à éliminer. */
              <ul className="sr-only">
                {expByCat2.map((e) => (
                  <li key={e.name}>
                    {e.name} : {fmtShort(e.value)}, {partCat2(e.value)}
                  </li>
                ))}
              </ul>
            ) : (
              /* Sous 430 px : la légende EST la commande. Une catégorie à 2 %
                 occupe ~7° du donut, soit quelques millimètres — invisable au
                 pouce. Ces lignes font 48 px de haut et couvrent toutes les
                 catégories, y compris les plus petites. Les secteurs restent
                 cliquables par ailleurs : rien n'est retiré.

                 UNE seule colonne. Deux colonnes tenaient sur moins de
                 180 px chacune, dont ~100 px déjà pris par la pastille, le
                 montant et la part : il ne restait qu'une soixantaine de
                 pixels au libellé, d'où « Immo… » et « Alimen… ». Un nom de
                 catégorie tronqué ne remplit pas son office. Sur toute la
                 largeur, il reste ~260 px, largement de quoi écrire le nom
                 en entier. Le coût est en hauteur, sur une page déjà longue
                 (point n° 18) — assumé : cette légende porte à la fois la
                 lecture des montants et le filtrage. */
              <ul className="flex flex-col mt-3 w-full">
                {expByCat2.map((e) => {
                  const actif = selCat2 === e.name;
                  return (
                    <li key={e.name} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelCat2(actif ? null : e.name)}
                        aria-pressed={actif}
                        className={`flex items-center gap-2 w-full min-h-[44px] px-1.5 rounded text-xs text-left min-w-0 transition-colors ${
                          actif ? "bg-indigo/15" : ""
                        }`}
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: couleurs.categorie(e.name) }}
                          aria-hidden="true"
                        />
                        <span className={actif ? "text-text" : "text-text-sec"}>{e.name}</span>
                        <span className="ml-auto shrink-0 tabular-nums text-text">
                          {fmtShort(e.value)}
                        </span>
                        <span className="shrink-0 tabular-nums text-text-sec w-10 text-right">
                          {partCat2(e.value)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>

        {/* BarChart horizontal — Détail par type de dépense */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-text">Détail par Type de Dépense</div>
            <span className="text-[11px] text-text-sec">Cliquez pour filtrer</span>
          </div>
          {expByType.length === 0 ? (
            <EmptyState title="Aucune dépense" />
          ) : (
            <ResponsiveContainer width="100%" height={isSmall ? expByType.length * 42 + 24 : Math.max(280, expByType.length * 24 + 40)}>
              <BarChart data={expByType} layout="vertical" margin={isSmall ? { left: 0, right: 8 } : { left: 10, right: 20 }}>
                <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => fmtShort(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={isSmall ? false : { fill: "#9CA3AF", fontSize: 12 }}
                  width={axisWidth(160)}
                  axisLine={false} tickLine={false}
                />
                <Tooltip active={infobulle.active} content={<ChartTooltip formatter={(v) => fmt(v)} />} />
                <Bar
                  dataKey="value"
                  name="Montant"
                  radius={[0, 4, 4, 0]}
                  onClick={(d) => {
                    if (d) setSelType(selType === d.fullName ? null : d.fullName);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {isSmall && (
                    <LabelList dataKey="fullName" content={<BarLeftLabel />} />
                  )}
                  {expByType.map((e, i) => (
                    <Cell
                      key={i}
                      fill={selType === e.fullName ? "#818cf8" : TYPE_COLORS[i % TYPE_COLORS.length]}
                      fillOpacity={selType && selType !== e.fullName ? 0.25 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table détail des dépenses (paginée — FIX V1) */}
      <DataTable
        data={detailRows as unknown as Record<string, unknown>[]}
        columns={colonnesDetail(couleurs)}
        pageSize={25}
        title={"Détail des dépenses" + (hasFilters ? " (filtré)" : "")}
        emptyMessage="Aucune dépense trouvée"
      />

      {/* Top 10 marchands */}
      <div className="card">
        <div className="text-sm font-medium text-text mb-3">Top 10 marchands</div>
        {topMerchants.length === 0 ? (
          <EmptyState title="Aucune donnée" />
        ) : (
          <ResponsiveContainer width="100%" height={barRow(topMerchants.length, 200, 30)}>
            <BarChart data={topMerchants} layout="vertical" margin={isSmall ? { left: 0, right: 8 } : { left: 90 }}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis
                type="number"
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => fmtShort(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={isSmall ? false : { fill: "#9CA3AF", fontSize: 12 }}
                width={axisWidth(90)}
                axisLine={false} tickLine={false}
              />
              <Tooltip active={infobulle.active} content={<ChartTooltip formatter={(v) => fmt(v)} />} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} name="Montant">
                {/* Même traitement que les deux autres barres horizontales :
                    `position="top"` souffrait du même décalage d'attribution,
                    le haut d'une barre étant visuellement le bas de la
                    précédente. */}
                {isSmall && (
                  <LabelList dataKey="name" content={<BarLeftLabel />} />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Avancement des dépenses dans le mois.
          Remplace la heatmap par jour (11/08/2026) : elle disait l'intensité
          de chaque case sans dire où l'on en est. Le cumul croissant répond
          directement à « quand se font les dépenses dans le mois ».
          « Top 10 villes » occupait la seconde colonne de cette grille et a
          été retiré faute de donnée exploitable (point n° 13) : la grille
          disparaît avec lui, sinon une colonne vide subsisterait sur PC. */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-text">
            Avancement des dépenses dans le mois
            <span className="block text-[11px] font-normal text-text-sec mt-0.5">
              Cumul par jour, sur la période et les filtres en cours
            </span>
          </div>
        </div>
        {cumulTotal === 0 ? (
          <EmptyState title="Aucune dépense sur cette période" />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight(300)}>
            <LineChart data={cumulParJour} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="jour"
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false} tickLine={false}
                /* Un jour sur cinq : 31 étiquettes se chevauchent sur 346 px. */
                interval={isSmall ? 4 : 1}
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false} tickLine={false}
                width={axisWidth(60)}
                tickFormatter={(v: number) => fmtShort(v)}
              />
              <Tooltip active={infobulle.active} content={<CumulTooltip />} />
              {/* Repère de mi-parcours : au-dessus de la ligne, la moitié du
                  budget est consommée avant la moitié du mois. */}
              <ReferenceLine
                y={cumulTotal / 2}
                stroke="#6B7280"
                strokeDasharray="4 4"
                label={{ value: "50 %", position: "insideTopLeft", fill: "#9CA3AF", fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="cumul"
                name="Cumulé"
                stroke="#818cf8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Comparaison N vs N-1 par catégorie */}
      <div className="card">
        <div className="text-sm font-medium text-text mb-3">
          Comparaison {compNvsN1Years.curYear} vs {compNvsN1Years.prevYear} par catégorie
          <span className="block text-[11px] font-normal text-text-sec mt-0.5">
            Sur période équivalente : {compNvsN1Mois} mois de part et d'autre
          </span>
        </div>
        {compNvsN1.length === 0 ? (
          <EmptyState title="Aucune donnée" />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight(300)}>
            <BarChart data={compNvsN1}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false} tickLine={false}
                angle={-30}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => fmtShort(v)}
              />
              <Tooltip active={infobulle.active} content={<ChartTooltip formatter={(v) => fmt(v)} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey={compNvsN1Years.prevYear} fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey={compNvsN1Years.curYear} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
