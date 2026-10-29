// ── Page Patrimoine (suivi des soldes) — Patrimoine D-4c (plan 33) ────────
//
// Recopie de la page du site privé APRÈS son étape P6 — recopiée, jamais
// importée : la DEMO est un dépôt à part.
//
// Source : la feuille « Patrimoine » du jeu affiché (un solde par compte et
// par mois). AUCUN calcul ici : tout vient de `useSoldesPatrimoine` (fonctions
// pures de `calculs/calculPatrimoine.ts`, testées à part). La page met en forme.
//
// Indépendante du sous-onglet Épargne (flux, `useSavingsData`) : rien n'y est
// lu ni modifié.
//
// Sections : interrupteur immobilier · bandeau du filtre · messages (soldes
// repris, saisie en cours) · 6 KPI · Évolution (aires empilées + total,
// légende = filtre de toute la page) · Détail par compte (page filtrée) ·
// Répartition (donut ; clic = filtre du tableau) · Variation mois par mois ·
// Détail des comptes.
//
// Ce qui diffère du privé, et pourquoi :
//   1. Couleurs : aucune table par nom. Banque = couleur déclarée par la
//      source pour cet organisme, sinon repli stable (`useCouleurs`) ; nature
//      = repli stable ; compte = rang dans la palette (deux comptes d'une même
//      sélection ne partagent jamais une couleur).
//   2. État « vide » : la DEMO ne garde pas le texte des avertissements de la
//      feuille ; la page cite les compteurs de lecture à la place.

import { useMemo, useState } from "react";
import {
  ComposedChart, Area, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Landmark, PiggyBank, Wallet, CalendarRange, TrendingUp, ShieldCheck,
  FileSpreadsheet, AlertTriangle, Info,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { Chip } from "@/components/ui/Chip";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonPage } from "@/components/ui/Skeleton";

import { useDataStore } from "@/stores/useDataStore";
import { useSoldesPatrimoine } from "@/hooks/useSoldesPatrimoine";
import { moisPrecedent, type SelectionPatrimoine } from "@/calculs/calculPatrimoine";
import type { CompteursPatrimoine } from "@/services/lectureClasseur";
import { useChartSize } from "@/hooks/useChartSize";
import { useInfobulleTactile } from "@/hooks/useInfobulleTactile";
import { useCouleurs, COULEUR_TOTAL } from "@/hooks/useCouleurs";

import { fmt, fmtShort, fmtPct, mkLabel, partDuTotal } from "@/utils/formatters";
import { DONUT_COLORS } from "@/config/colors";

// ─── Couleurs de l'application (aucune ne nomme un compte) ──────────────
const C_HAUSSE = "#22c55e";       // vert
const C_BAISSE = "#ef4444";       // rouge
const C_NEUTRE = "#9CA3AF";       // sous-titre de KPI sans signe

// ─── Outils d'affichage (locaux : règle react-refresh) ──────────────────
const MOIS_LONGS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** "2026-08" → "août 2026". */
function moisLong(mk: string): string {
  return `${MOIS_LONGS[Number(mk.slice(5, 7)) - 1]} ${mk.slice(0, 4)}`;
}

/** Montant signé : +580,00 € / −120,00 €. */
function fmtSigne(v: number): string {
  return (v >= 0 ? "+" : "−") + fmt(Math.abs(v));
}

/** Ratio signé : +62,5 % / −3,1 %. */
function pctSigne(v: number): string {
  return (v >= 0 ? "+" : "−") + fmtPct(Math.abs(v));
}

/** 1.51 → "1,5 mois" (une décimale à l'écran). */
function fmtMois(n: number): string {
  return `${n.toFixed(1).replace(".", ",")} mois`;
}

/** Libellé affiché d'une série : "Epargne" → "Épargne". */
function libelleSerie(s: string): string {
  return s === "Epargne" ? "Épargne" : s;
}

/** Liste lisible : "a", "a et b", "a, b et c". */
function enumerer(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

/** "1 ligne" / "3 lignes". */
function lignes(n: number): string {
  return `${n} ligne${n > 1 ? "s" : ""}`;
}

/**
 * État « vide » : ce que disent les compteurs de lecture, seulement les
 * nombres non nuls. Exemple : 12 lues, 9 non saisies, 3 futures →
 * « 12 lignes lues : 9 pas encore saisies (montant vide), 3 datées après aujourd'hui. »
 */
function phrasesCompteurs(c: CompteursPatrimoine | null): string[] {
  if (!c || c.lignesLues === 0) {
    return ["Aucune ligne lue : vérifiez que la feuille a les colonnes Transaction, Epargne/Liquidité, Banque, Date et Montant."];
  }
  const parts: string[] = [];
  if (c.nonSaisies > 0) parts.push(`${c.nonSaisies} pas encore saisie${c.nonSaisies > 1 ? "s" : ""} (montant vide)`);
  if (c.futures > 0) parts.push(`${c.futures} datée${c.futures > 1 ? "s" : ""} après aujourd'hui`);
  if (c.ignorees > 0) parts.push(`${c.ignorees} écartée${c.ignorees > 1 ? "s" : ""}`);
  const out = [`${lignes(c.lignesLues)} lue${c.lignesLues > 1 ? "s" : ""}${parts.length ? ` : ${parts.join(", ")}` : ""}.`];
  if (c.ignorees > 0) {
    out.push("Le détail des lignes écartées est dans l'aperçu d'import : rechargez le fichier pour le revoir.");
  }
  return out;
}

// ─── Mini-courbe du tableau (SVG simple, pas de Recharts par ligne) ─────
function MiniCourbe({ valeurs }: { valeurs: number[] }) {
  if (valeurs.length < 2) return <span className="text-text-sec">—</span>;
  const L = 80;
  const H = 24;
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const ecart = max - min || 1;
  const points = valeurs
    .map((v, i) => {
      const x = (i / (valeurs.length - 1)) * L;
      const y = H - 2 - ((v - min) / ecart) * (H - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const hausse = valeurs[valeurs.length - 1] >= valeurs[0];
  return (
    <svg
      width={L} height={H} viewBox={`0 0 ${L} ${H}`}
      role="img" aria-label={hausse ? "Tendance en hausse" : "Tendance en baisse"}
      className="inline-block align-middle"
    >
      <polyline points={points} fill="none" stroke={hausse ? C_HAUSSE : C_BAISSE} strokeWidth={1.5} />
    </svg>
  );
}

// ─── Colonnes du tableau des comptes ────────────────────────────────────
type Ligne = Record<string, unknown>;

function couleurSigne(v: number): string {
  return v > 0 ? "text-green" : v < 0 ? "text-red" : "text-text-sec";
}

const COLONNES: Column<Ligne>[] = [
  {
    key: "compte", label: "Compte", sortable: true, priority: true,
    render: (v) => <span className="text-text md:max-w-[220px] md:truncate md:block" title={String(v)}>{String(v)}</span>,
  },
  {
    key: "banque", label: "Banque", sortable: true,
    render: (v) => <span className="text-text-sec">{String(v)}</span>,
  },
  {
    key: "nature", label: "Nature", sortable: true,
    render: (v) => <span className="text-text-sec">{libelleSerie(String(v))}</span>,
  },
  {
    key: "solde", label: "Solde", sortable: true, priority: true, align: "right",
    render: (v) => <span className="font-semibold tabular-nums text-text">{fmt(Number(v))}</span>,
  },
  {
    key: "variation1Mois", label: "Var. 1 mois", sortable: true, priority: true, align: "right",
    render: (v) => <span className={`tabular-nums ${couleurSigne(Number(v))}`}>{fmtSigne(Number(v))}</span>,
  },
  {
    key: "variationDepuisJanvier", label: "Depuis janvier", sortable: true, align: "right",
    render: (v) => <span className={`tabular-nums ${couleurSigne(Number(v))}`}>{fmtSigne(Number(v))}</span>,
  },
  {
    key: "poids", label: "Poids", sortable: true, align: "right",
    render: (v) => <span className="tabular-nums text-text-sec">{v == null ? "—" : fmtPct(Number(v))}</span>,
  },
  {
    key: "tendance", label: "Tendance", align: "center",
    render: (v) => <MiniCourbe valeurs={v as number[]} />,
  },
];

// ─── Page ────────────────────────────────────────────────────────────────
export default function PatrimoineSoldes() {
  const { status } = useDataStore();
  const couleurs = useCouleurs();
  const { chartHeight, donutRadii, isSmall } = useChartSize();
  const donut = donutRadii(60, 100);
  const infobulle = useInfobulleTactile();

  // Interrupteur « Inclure l'immobilier » : état local, activé par défaut.
  const [inclureImmobilier, setInclureImmobilier] = useState(true);
  const [vue, setVue] = useState<"banque" | "nature">("banque");
  // Libellés choisis dans la légende de l'Évolution (filtre de la page).
  const [choixLegende, setChoixLegende] = useState<string[]>([]);
  // Mois cliqué dans l'Évolution (donut seulement) ; null = dernier mois complet.
  const [moisDonut, setMoisDonut] = useState<string | null>(null);
  // Clic dans la répartition : filtre du tableau (banque, ou compte si la page est filtrée).
  const [selBanque, setSelBanque] = useState<string | null>(null);

  const selection = useMemo<SelectionPatrimoine | null>(
    () => (choixLegende.length ? { par: vue, valeurs: choixLegende } : null),
    [vue, choixLegende],
  );
  const p = useSoldesPatrimoine(inclureImmobilier, selection, moisDonut);
  const filtre = p.selection; // valeurs réellement appliquées
  const pageFiltree = filtre.length > 0;

  const changerVue = (v: "banque" | "nature") => {
    setVue(v);
    setChoixLegende([]);
    setSelBanque(null);
  };
  const basculerLibelle = (s: string) => {
    setChoixLegende((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
    setSelBanque(null);
  };
  const toutAfficher = () => {
    setChoixLegende([]);
    setSelBanque(null);
  };

  // Couleur d'un compte : son rang dans la sélection, pour que deux comptes
  // affichés ensemble n'aient jamais la même couleur.
  const couleurCompte = useMemo(() => {
    const m = new Map<string, string>();
    p.comptesSerie.forEach((c, i) => m.set(c, DONUT_COLORS[i % DONUT_COLORS.length]));
    return (c: string) => m.get(c) ?? DONUT_COLORS[0];
  }, [p.comptesSerie]);

  const series: string[] = vue === "banque" ? p.banques : p.natures;
  const couleurSerie = (s: string) => (vue === "banque" ? couleurs.organisme(s) : couleurs.type(s));

  const donneesG1 = useMemo(
    () => (vue === "banque" ? p.serieParBanque : p.serieParNature).map((l) => ({ ...l, label: mkLabel(l.mk) })),
    [vue, p.serieParBanque, p.serieParNature],
  );
  const donneesG3 = useMemo(
    () => p.variations.map((v) => ({ ...v, label: mkLabel(v.mk) })),
    [p.variations],
  );
  const donneesComptes = useMemo(
    () => p.serieParCompte.map((l) => ({ ...l, label: mkLabel(l.mk) })),
    [p.serieParCompte],
  );
  // Donut : par banque, ou par compte quand la page est filtrée.
  const partsDonut = useMemo(
    () => (pageFiltree
      ? p.repartitionParCompte.map((r) => ({ cle: r.compte, montant: r.montant }))
      : p.repartition.map((r) => ({ cle: r.banque, montant: r.montant }))),
    [pageFiltree, p.repartitionParCompte, p.repartition],
  );
  const couleurDonut = (cle: string) => (pageFiltree ? couleurCompte(cle) : couleurs.organisme(cle));
  const totalDonut = useMemo(() => partsDonut.reduce((s, r) => s + r.montant, 0), [partsDonut]);

  // Tableau : filtre par banque ou par compte (clic sur le donut) ; la valeur
  // choisie peut disparaître (immobilier coupé, filtre changé) → ignorée.
  const cleTableau = (c: { banque: string; compte: string }) => (pageFiltree ? c.compte : c.banque);
  const banqueActive = selBanque && p.comptes.some((c) => cleTableau(c) === selBanque) ? selBanque : null;
  const lignesTableau = useMemo(
    () => p.comptes
      .filter((c) => !banqueActive || (pageFiltree ? c.compte : c.banque) === banqueActive)
      .map((c) => ({ ...c, tendance: c.historique.map((h) => h.solde) })) as unknown as Ligne[],
    [p.comptes, banqueActive, pageFiltree],
  );
  const totalTableau = useMemo(() => lignesTableau.reduce((s, l) => s + Number(l.solde), 0), [lignesTableau]);

  // Mois de la période où des soldes ont été repris.
  const reprises = useMemo(
    () => p.serieParBanque.filter((l) => l.soldesRepris > 0),
    [p.serieParBanque],
  );

  if (status !== "success") return <SkeletonPage />;

  const titre = "Patrimoine";
  const sousTitreBase = "Soldes de vos comptes, mois par mois";

  // ── État « absent » : pas de feuille Patrimoine ─────────────────────
  // Normalement inatteignable (la route renvoie ailleurs) ; gardé par sûreté.
  if (p.etat === "absent") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={titre} subtitle={sousTitreBase} />
        <div className="card">
          <EmptyState
            icon={<FileSpreadsheet size={36} />}
            title="Pas encore de feuille Patrimoine"
            description="Ajoutez une feuille « Patrimoine » à votre classeur (un solde par compte et par mois), puis importez-le de nouveau."
          />
        </div>
      </div>
    );
  }

  // ── État « vide » : feuille présente, aucun relevé lisible ──────────
  if (p.etat === "vide") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={titre} subtitle={sousTitreBase} />
        <div className="card">
          <EmptyState
            icon={<AlertTriangle size={36} />}
            title="La feuille Patrimoine n'a aucun relevé lisible"
          />
          <ul className="text-xs text-text-sec flex flex-col gap-1 mt-2 px-2 text-center" aria-label="Lecture de la feuille Patrimoine">
            {phrasesCompteurs(p.compteurs).map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </div>
    );
  }

  const k = p.kpis;
  const moisKpi = p.dernierMoisComplet;

  // ── Interrupteur (seulement s'il y a de l'immobilier) ───────────────
  const interrupteur = p.aDeLImmobilier && (
    <label className="inline-flex items-center gap-2 text-xs text-text-sec cursor-pointer select-none max-md:min-h-tap">
      <button
        type="button"
        role="switch"
        aria-checked={inclureImmobilier}
        aria-label="Inclure l'immobilier"
        onClick={() => setInclureImmobilier((v) => !v)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors ${
          inclureImmobilier ? "bg-indigo border-indigo" : "bg-border border-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${
            inclureImmobilier ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
      <span aria-hidden="true">Inclure l'immobilier</span>
    </label>
  );

  // ── Messages : soldes repris, mois incomplets ───────────────────────
  const messages: string[] = [];
  for (const l of reprises) {
    const n = l.soldesRepris;
    messages.push(`${n} solde${n > 1 ? "s" : ""} repris du mois précédent en ${moisLong(l.mk)} (relevé manquant : dernier solde connu utilisé).`);
  }
  if (p.moisIncomplets.length) {
    const liste = enumerer(p.moisIncomplets.map(moisLong));
    const pluriel = p.moisIncomplets.length > 1;
    messages.push(
      moisKpi
        ? `Saisie en cours pour ${liste} : ${pluriel ? "ces mois ne sont" : "ce mois n'est"} pas encore complet${pluriel ? "s" : ""}, les chiffres s'arrêtent à ${moisLong(moisKpi)}.`
        : `Saisie en cours pour ${liste} : aucun mois n'est encore complet (un compte sans relevé bloque le mois).`,
    );
  }

  const blocMessages = messages.length > 0 && (
    <div className="card flex gap-2 items-start text-xs text-text-sec" role="status">
      <Info size={14} className="text-amber shrink-0 mt-0.5" aria-hidden="true" />
      <ul className="flex flex-col gap-1">
        {messages.map((m) => <li key={m}>{m}</li>)}
      </ul>
    </div>
  );

  // ── Aucun mois complet : rien à chiffrer ────────────────────────────
  if (!k || !moisKpi) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={titre} subtitle={sousTitreBase} />
        {interrupteur}
        {blocMessages}
        <div className="card">
          <EmptyState
            icon={<CalendarRange size={36} />}
            title="Aucun mois complet"
            description="Un mois est complet quand chaque compte déjà ouvert a son relevé. Un compte clôturé doit recevoir un relevé à 0."
          />
        </div>
      </div>
    );
  }

  // ── KPI : sous-titres ───────────────────────────────────────────────
  const subKpi1 = k.variationMois != null && k.totalMoisPrecedent != null
    ? `${k.variationMois >= 0 ? "▲" : "▼"} ${fmtSigne(k.variationMois)} vs ${mkLabel(moisPrecedent(moisKpi))}`
    : "premier mois";
  const colKpi1 = k.variationMois == null ? C_NEUTRE : k.variationMois >= 0 ? C_HAUSSE : C_BAISSE;

  const evo = k.evolutionAnnee;
  const subKpi4 = evo
    ? `${evo.ratio != null ? `${pctSigne(evo.ratio)} ` : ""}depuis ${mkLabel(evo.reference)}`
    : "pas de relevé en décembre";
  const colKpi4 = !evo ? C_NEUTRE : evo.montant >= 0 ? C_HAUSSE : C_BAISSE;

  const gain = k.gainMensuelMoyen;
  const moisDuDonut = p.moisRepartition ?? moisKpi;

  // Bandeau du filtre de la page (clic sur la légende de l'Évolution).
  const bandeauFiltre = pageFiltree && (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtre de la page">
      <span className="text-xs text-text-sec">Page filtrée sur :</span>
      {filtre.map((v) => (
        <Chip key={v} label={libelleSerie(v)} active onClear={() => basculerLibelle(v)} onClick={() => basculerLibelle(v)} />
      ))}
      <Chip label="Tout afficher" onClick={toutAfficher} />
    </div>
  );
  const mat = k.matelas;

  return (
    <div className="flex flex-col gap-6" {...infobulle.handlers}>
      <PageHeader
        title={titre}
        subtitle={`${sousTitreBase} — chiffres à fin ${moisLong(moisKpi)} (dernier mois complet)`}
      />

      {interrupteur}
      {bandeauFiltre}
      {blocMessages}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 stagger-grid" data-testid="kpis-patrimoine">
        <KPICard
          label={pageFiltree ? "Total de la sélection" : inclureImmobilier ? "Patrimoine total" : "Patrimoine financier"}
          value={k.total} customSub={subKpi1} subColor={colKpi1} icon={<Landmark size={14} />}
        />
        <KPICard label="Épargne placée" value={k.epargne} icon={<PiggyBank size={14} />} />
        <KPICard
          label="Liquidités" value={k.liquidites}
          customSub={k.partLiquidites != null ? `${fmtPct(k.partLiquidites)} du total` : "—"}
          subColor={C_NEUTRE} icon={<Wallet size={14} />}
        />
        <KPICard
          label="Depuis le 1er janvier"
          customValue={evo ? fmtSigne(evo.montant) : "—"}
          customSub={subKpi4} subColor={colKpi4} icon={<CalendarRange size={14} />}
        />
        <KPICard
          label="Gain mensuel moyen"
          customValue={gain ? fmtSigne(gain.montant) : "—"}
          customSub={gain ? `sur ${gain.nbMois} mois de la période` : "période trop courte"}
          subColor={C_NEUTRE} icon={<TrendingUp size={14} />}
        />
        <KPICard
          label="Matelas de sécurité"
          customValue={mat ? fmtMois(mat.nbMois) : "—"}
          customSub={mat
            ? `dépenses moy. ${fmt(mat.depensesMensuelles)}/mois (${mat.nbMoisDepenses} mois)`
            : "aucune dépense sur la période"}
          subColor={C_NEUTRE} icon={<ShieldCheck size={14} />}
        />
      </div>

      {/* Évolution (aires empilées + total) */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-text text-sm font-semibold">Évolution du patrimoine</h2>
          <div className="flex gap-2" role="group" aria-label="Regrouper par">
            <Chip label="Par banque" active={vue === "banque"} onClick={() => changerVue("banque")} />
            <Chip label="Par nature" active={vue === "nature"} onClick={() => changerVue("nature")} />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={chartHeight(320)}>
          <ComposedChart
            data={donneesG1}
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              // Clic sur un mois → le donut montre ce mois (seulement le donut).
              const i = e?.activeTooltipIndex;
              const mk = typeof i === "number" ? donneesG1[i]?.mk : undefined;
              if (mk) setMoisDonut(mk === moisKpi ? null : mk);
            }}
          >
            <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
            <Tooltip active={infobulle.active} content={<ChartTooltip formatter={fmt} showPrev={false} />} />
            {series.map((s) => (
              <Area
                key={s} type="monotone" dataKey={s} name={libelleSerie(s)} stackId="patrimoine"
                hide={pageFiltree && !filtre.includes(s)}
                stroke={couleurSerie(s)} fill={couleurSerie(s)} fillOpacity={0.35}
              />
            ))}
            <Line type="monotone" dataKey="total" name={pageFiltree ? "Total sélection" : "Total"} stroke={COULEUR_TOTAL} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        {/* Légende = commande. Chaque libellé ajoute / retire un filtre
            appliqué à TOUTE la page ; plusieurs libellés se cumulent. */}
        <ul className="flex flex-wrap gap-1 mt-2" aria-label="Légende — filtrer la page">
          {series.map((s) => {
            const actif = filtre.includes(s);
            const eteint = pageFiltree && !actif;
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => basculerLibelle(s)}
                  aria-pressed={actif}
                  className={`inline-flex items-center gap-1.5 min-h-[32px] max-md:min-h-tap px-2 rounded text-xs transition-colors ${
                    actif ? "bg-indigo/15 text-text" : eteint ? "text-text-sec/60 hover:bg-border/20" : "text-text-sec hover:bg-border/20"
                  }`}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: couleurSerie(s), opacity: eteint ? 0.35 : 1 }}
                    aria-hidden="true"
                  />
                  {libelleSerie(s)}
                </button>
              </li>
            );
          })}
          <li className="inline-flex items-center gap-1.5 px-2 text-xs text-text-sec">
            <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: COULEUR_TOTAL }} aria-hidden="true" />
            {pageFiltree ? "Total sélection" : "Total"}
          </li>
        </ul>
        <p className="text-[11px] text-text-sec mt-1">
          Touchez un libellé pour filtrer toute la page (plusieurs possibles). Touchez un mois pour voir sa répartition.
        </p>
      </div>

      {/* Détail par compte (page filtrée seulement) */}
      {pageFiltree && (
        <div className="card" data-testid="detail-par-compte">
          <h2 className="text-text text-sm font-semibold mb-3">
            Détail par compte — {enumerer(filtre.map(libelleSerie))}
          </h2>
          <ResponsiveContainer width="100%" height={chartHeight(300)}>
            <ComposedChart data={donneesComptes}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
              <Tooltip active={infobulle.active} content={<ChartTooltip formatter={fmt} showPrev={false} />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#6B7280" }} />
              {p.comptesSerie.map((c) => (
                <Area
                  key={c} type="monotone" dataKey={(l: Record<string, unknown>) => l[c]} name={c} stackId="comptes"
                  stroke={couleurCompte(c)} fill={couleurCompte(c)} fillOpacity={0.35}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Répartition + Variation mois par mois */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card flex flex-col items-center min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3 self-start">
            <h2 className="text-text text-sm font-semibold">
              Répartition par {pageFiltree ? "compte" : "banque"} — {mkLabel(moisDuDonut)}
            </h2>
            {moisDuDonut !== moisKpi && (
              <Chip label={`Revenir à ${mkLabel(moisKpi)}`} onClick={() => setMoisDonut(null)} />
            )}
          </div>
          <div className={`relative ${isSmall ? "w-full" : ""}`}>
            {/* Même motif que Dépenses / Épargne (lot 1.6) : le graphique est
                décoratif, la liste ci-dessous porte montants, parts et filtre. */}
            <div aria-hidden="true">
              <ResponsiveContainer width={isSmall ? "100%" : 260} height={chartHeight(260)}>
                <PieChart tabIndex={-1}>
                  <Pie
                    rootTabIndex={-1}
                    data={partsDonut} dataKey="montant" nameKey="cle"
                    cx="50%" cy="50%" innerRadius={donut.inner} outerRadius={donut.outer} paddingAngle={2}
                    onClick={(_: unknown, idx: number) => {
                      const b = partsDonut[idx]?.cle;
                      if (b) setSelBanque(banqueActive === b ? null : b);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {partsDonut.map((r) => (
                      <Cell
                        key={r.cle} fill={couleurDonut(r.cle)}
                        stroke={banqueActive === r.cle ? "#fff" : "none"}
                        strokeWidth={banqueActive === r.cle ? 3 : 0}
                      />
                    ))}
                  </Pie>
                  {!isSmall && <Tooltip active={infobulle.active} content={<ChartTooltip formatter={fmt} showPrev={false} />} />}
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-text text-lg font-bold tabular-nums">{fmtShort(totalDonut)}</div>
            </div>
          </div>
          {/* Légende = commande : sur un PieChart, le doigt ne peut pas
              afficher d'infobulle ; montant et part sont donc écrits en
              clair, et chaque ligne filtre le tableau. */}
          <ul className="flex flex-col mt-3 w-full" aria-label={`Répartition par ${pageFiltree ? "compte" : "banque"}`}>
            {partsDonut.map((r) => {
              const actif = banqueActive === r.cle;
              return (
                <li key={r.cle} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelBanque(actif ? null : r.cle)}
                    aria-pressed={actif}
                    className={`flex items-center gap-2 w-full min-h-[36px] max-md:min-h-[44px] px-1.5 rounded text-xs text-left min-w-0 transition-colors ${
                      actif ? "bg-indigo/15" : "hover:bg-border/20"
                    }`}
                  >
                    <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: couleurDonut(r.cle) }} aria-hidden="true" />
                    <span className={`min-w-0 truncate ${actif ? "text-text" : "text-text-sec"}`} title={r.cle}>{r.cle}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-text">{fmtShort(r.montant)}</span>
                    <span className="shrink-0 tabular-nums text-text-sec w-10 text-right">{partDuTotal(r.montant, totalDonut)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card min-w-0">
          <h2 className="text-text text-sm font-semibold mb-3">Variation mois par mois</h2>
          {donneesG3.length === 0 ? (
            <EmptyState title="Pas assez de mois sur la période" />
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight(260)}>
              <BarChart data={donneesG3}>
                <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
                <Tooltip active={infobulle.active} content={<ChartTooltip formatter={fmtSigne} showPrev={false} />} />
                <Bar dataKey="variation" name="Variation" radius={[4, 4, 0, 0]}>
                  {donneesG3.map((v) => (
                    <Cell key={v.mk} fill={v.hausse ? C_HAUSSE : C_BAISSE} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Détail des comptes */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="text-text text-sm font-semibold">Détail des comptes — {mkLabel(moisKpi)}</h2>
          <span className="text-text-sec text-xs">
            ({lignesTableau.length} compte{lignesTableau.length > 1 ? "s" : ""})
          </span>
          {banqueActive && (
            <Chip label={banqueActive} active onClear={() => setSelBanque(null)} onClick={() => setSelBanque(null)} />
          )}
        </div>

        <DataTable
          data={lignesTableau}
          columns={COLONNES}
          pageSize={30}
          emptyMessage="Aucun compte."
          exportFilename="patrimoine"
        />

        {lignesTableau.length > 0 && (
          <div className="flex justify-between items-center px-3 py-2 border-t-2 border-border mt-1">
            <span className="text-text text-xs font-semibold">
              Total ({lignesTableau.length} compte{lignesTableau.length > 1 ? "s" : ""})
            </span>
            <span className="text-sm font-bold tabular-nums text-text">{fmt(totalTableau)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
