/**
 * useBudgetData — Hook de la page Budget Mensuel (Session 2A, Phase 2).
 *
 * Agrège les dépenses par sous-catégorie (Cat2) et les compare aux budgets
 * cibles. Ne retient pour la moyenne que les mois COMPARABLES au sens de
 * `utils/couverture.ts` — entièrement couverts par la source. Les sparklines
 * couvrent en revanche tous les mois de la plage.
 *
 * Sans aucun mois comparable, moyenne, écart, solde et conformité valent
 * `null` : « indisponible », jamais 0 ni 100 %.
 *
 * Consomme : useDataStore (budgets) + useFilteredData (transactions filtrées par période).
 *
 * @param topThreshold - Seuil €/mois au-dessus duquel un poste apparaît dans `topRows` (défaut 50).
 * @returns {UseBudgetDataReturn} rows (lignes Cat2 budget vs réel), kpis (totaux/conformité),
 *   topRows (postes au-dessus du seuil), isLoading, et updateBudget(cat2, target) qui persiste
 *   un objectif de budget : mémoire locale du navigateur, puis mise à jour
 *   du store (mode statique — voir services/budgetsLocaux.ts).
 */

import { useMemo, useCallback } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { enregistrerObjectifLocal } from "@/services/budgetsLocaux";
import { useFilteredData } from "@/hooks/useFilteredData";
import { moisComparables } from "@/utils/couverture";
import type { Transaction, BudgetTarget } from "@/types";

// ─── Types de retour ────────────────────────────────────────────────────

/** Ligne du tableau budget par Cat2 */
export interface BudgetCat2Row {
  cat2: string;
  /** Dépense réelle moyenne mensuelle (€), ou `null` si aucun mois comparable. */
  averageMonthly: number | null;
  target: number | null;       // Budget cible (€, null si non défini)
  ecartValue: number | null;   // Écart en € (positif = dépassement)
  ecartPct: number | null;     // Écart en % (positif = dépassement)
  /** ≤100%, 100-120%, >120%, pas de budget, ou rien de comparable. */
  status: "ok" | "warning" | "over" | "no-budget" | "indisponible";
  monthlyData: SparklinePoint[]; // Évolution mensuelle pour sparkline
}

/** Point de sparkline (1 mois) */
export interface SparklinePoint {
  mk: string;                 // "2025-01"
  actual: number;             // Dépense réelle du mois
  target: number | null;      // Budget cible (constant)
}

/** KPIs agrégés de la page Budget */
export interface BudgetKPIs {
  totalBudgeted: number;       // Somme des budgets cibles actifs
  /** Somme des dépenses réelles moyennes, ou `null` si rien n'est comparable. */
  totalActual: number | null;
  /** Nombre de Cat2 en dépassement, ou `null` si rien n'est comparable. */
  overrunCount: number | null;
  /**
   * % de Cat2 dans le budget (0-100), ou `null` quand AUCUNE catégorie n'est
   * comparable — faute de budget cible défini, ou faute de budgets chargés.
   *
   * Valait 100 dans ce cas jusqu'au 11/08/2026. Valeur par défaut défendable
   * pour un tableau vide, trompeuse en KPI : « Taux de conformité : 100 % »
   * se lit comme un succès alors qu'il ne repose sur rien.
   */
  complianceRate: number | null;
  /** totalBudgeted - totalActual, ou `null` si rien n'est comparable. */
  balance: number | null;
}

/** Retour complet du hook */
export interface UseBudgetDataReturn {
  rows: BudgetCat2Row[];
  kpis: BudgetKPIs;
  topRows: BudgetCat2Row[];    // Postes > seuil (défaut 50€/mois)
  isLoading: boolean;
  /**
   * Mois entièrement couverts ET dans la période affichée. Vide = aucune
   * moyenne calculable ; les pages doivent l'expliquer, pas afficher un tiret.
   */
  comparableMonths: string[];
  /** Renvoie `false` si le navigateur a refusé de mémoriser la valeur. */
  updateBudget: (cat2: string, target: number) => Promise<boolean>;
}

// ─── Constantes ─────────────────────────────────────────────────────────

// MIN_DAYS_FOR_MONTH = 15 a été SUPPRIMÉ au lot 0 (étape 0.6).
// Il mesurait la complétude d'un mois par le nombre de jours DISTINCTS
// portant une transaction — deux choses sans rapport. Un mois où l'on ne paie
// que trois prélèvements est un mois complet. Quand aucun mois ne passait le
// seuil, la moyenne tombait à 0, et une moyenne de 0 face à un objectif de
// 500 € se lisait « conforme » : 900 € dépensés s'affichaient à 100 % de
// conformité. La complétude vient désormais de `utils/couverture.ts`.
const DEFAULT_TOP_THRESHOLD = 50; // €/mois

// ─── Helpers purs (testables, hors hook) ────────────────────────────────

/**
 * Compte le nombre de jours distincts avec au moins une transaction dans un
 * mois donné.
 *
 * ⚠️ N'entre plus dans le calcul des moyennes : ce nombre ne dit rien de la
 * complétude d'un mois. Conservée comme statistique d'affichage.
 */
export function countDistinctDays(txInMonth: Transaction[]): number {
  const days = new Set<string>();
  for (const t of txInMonth) {
    days.add(t.date.slice(8, 10));
  }
  return days.size;
}

/**
 * Détermine le statut visuel d'un poste budget.
 */
export function getBudgetStatus(
  actual: number | null,
  target: number | null
): BudgetCat2Row["status"] {
  // L'indisponibilité prime : sans dépense connue, aucun statut budgétaire
  // n'a de sens, pas même « ok ».
  if (actual === null) return "indisponible";
  if (target === null || target === 0) return "no-budget";
  const ratio = actual / target;
  if (ratio <= 1) return "ok";
  if (ratio <= 1.2) return "warning";
  return "over";
}

// ─── Hook principal ─────────────────────────────────────────────────────

export function useBudgetData(
  topThreshold: number = DEFAULT_TOP_THRESHOLD
): UseBudgetDataReturn {
  const { budgets, status } = useDataStore();
  const { baseTx, allMonths, allMonthsInRange, periodRange } = useFilteredData();

  const isLoading = status === "loading";

  // Map des budgets cibles indexé par cat2
  const budgetMap = useMemo(() => {
    const map = new Map<string, BudgetTarget>();
    if (budgets?.budgets) {
      for (const b of budgets.budgets) {
        if (b.active) map.set(b.cat2, b);
      }
    }
    return map;
  }, [budgets]);

  // Toutes les transactions débit avec cat2 valide, dans la période
  const debitTx = useMemo(
    () => baseTx.filter((t) => t.dc === "Débit" && t.cat2 && t.cat2 !== "x"),
    [baseTx]
  );

  // Mois entièrement couverts par la source, puis restreints à la période
  // affichée. La couverture se calcule sur le jeu COMPLET (`allMonths`) :
  // la calculer sur la période ferait de chaque filtre ses propres bornes.
  const comparableMonths = useMemo(() => {
    const couverts = moisComparables(allMonths);
    if (!periodRange.from || !periodRange.to) return couverts;
    return couverts.filter(
      (mk) => mk >= periodRange.from && mk <= periodRange.to
    );
  }, [allMonths, periodRange]);

  // Dépenses par Cat2 par mois (tous les mois de la plage, pas seulement éligibles)
  const cat2MonthlyMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const t of debitTx) {
      if (!map.has(t.cat2)) map.set(t.cat2, new Map());
      const mMap = map.get(t.cat2)!;
      mMap.set(t.monthKey, (mMap.get(t.monthKey) ?? 0) + t.montant);
    }
    return map;
  }, [debitTx]);

  // Toutes les Cat2 distinctes (union transactions + budgets)
  const allCat2 = useMemo(() => {
    const set = new Set<string>();
    for (const cat2 of cat2MonthlyMap.keys()) set.add(cat2);
    for (const cat2 of budgetMap.keys()) set.add(cat2);
    return Array.from(set).sort();
  }, [cat2MonthlyMap, budgetMap]);

  // Construction des lignes
  const rows = useMemo<BudgetCat2Row[]>(() => {
    const nbComparables = comparableMonths.length;

    return allCat2.map((cat2) => {
      const monthlyMap = cat2MonthlyMap.get(cat2);
      const budget = budgetMap.get(cat2);
      const target = budget?.target ?? null;

      // Somme sur les seuls mois comparables. Un mois comparable sans
      // transaction compte pour 0 € : c'est une vraie valeur, et elle doit
      // peser au dénominateur.
      let totalComparable = 0;
      for (const mk of comparableMonths) {
        totalComparable += monthlyMap?.get(mk) ?? 0;
      }
      const averageMonthly = nbComparables > 0
        ? Math.round(totalComparable / nbComparables)
        : null;

      // Écarts — indisponibles tant que la moyenne l'est.
      const ecartValue = averageMonthly !== null && target !== null
        ? Math.round(averageMonthly - target)
        : null;
      const ecartPct = averageMonthly !== null && target !== null && target > 0
        ? Math.round(((averageMonthly - target) / target) * 100)
        : null;

      // Sparkline : tous les mois de la plage (éligibles ou non)
      const monthlyData: SparklinePoint[] = allMonthsInRange.map((mk) => ({
        mk,
        actual: Math.round(monthlyMap?.get(mk) ?? 0),
        target,
      }));

      return {
        cat2,
        averageMonthly,
        target,
        ecartValue,
        ecartPct,
        status: getBudgetStatus(averageMonthly, target),
        monthlyData,
      };
    });
  }, [allCat2, cat2MonthlyMap, budgetMap, comparableMonths, allMonthsInRange]);

  // KPIs agrégés
  const kpis = useMemo<BudgetKPIs>(() => {
    const withBudget = rows.filter((r) => r.target !== null && r.target > 0);
    const totalBudgeted = Math.round(
      withBudget.reduce((s, r) => s + (r.target ?? 0), 0)
    );

    // Sans mois comparable, il n'y a pas de dépense connue : ni total, ni
    // solde, ni taux. Renvoyer 0 laisserait croire à un budget tenu.
    if (comparableMonths.length === 0) {
      return {
        totalBudgeted,
        totalActual: null,
        // `null` et non 0 : « aucun dépassement » serait une bonne nouvelle
        // inventée. On ne sait pas.
        overrunCount: null,
        complianceRate: null,
        balance: null,
      };
    }

    const totalActual = withBudget.reduce((s, r) => s + (r.averageMonthly ?? 0), 0);
    const overrunCount = withBudget.filter((r) => r.status === "over" || r.status === "warning").length;
    // `null` et non 100 : sans catégorie comparable, il n'y a pas de taux —
    // ni bon, ni mauvais. L'affichage rend « — ».
    const complianceRate = withBudget.length > 0
      ? Math.round((withBudget.filter((r) => r.status === "ok").length / withBudget.length) * 100)
      : null;

    return {
      totalBudgeted,
      totalActual: Math.round(totalActual),
      overrunCount,
      complianceRate,
      balance: Math.round(totalBudgeted - totalActual),
    };
  }, [rows, comparableMonths]);

  // Top postes (au-dessus du seuil). Une moyenne indisponible n'est pas un
  // petit poste : elle est simplement hors classement.
  const topRows = useMemo(
    () => rows
      .filter((r) => r.averageMonthly !== null && r.averageMonthly >= topThreshold)
      .sort((a, b) => (b.averageMonthly ?? 0) - (a.averageMonthly ?? 0)),
    [rows, topThreshold]
  );

  /**
   * Mise à jour d'un objectif — mode statique.
   *
   * L'application réelle envoie un PUT à l'API D1. La démonstration n'a pas
   * de serveur : l'objectif est écrit dans le navigateur de la personne, et
   * le store est mis à jour dans la foulée pour que l'écran réagisse tout de
   * suite.
   *
   * Si le stockage refuse (navigation privée, quota), la modification reste
   * visible jusqu'à la fermeture de l'onglet et la fonction renvoie `false`.
   * Elle ne lève pas : un objectif non mémorisé n'est pas une panne.
   */
  const updateBudget = useCallback(async (cat2: string, target: number): Promise<boolean> => {
    const memorise = enregistrerObjectifLocal(cat2, target);
    const store = useDataStore.getState();
    const actuels = store.budgets?.budgets ?? [];
    const existe = actuels.some((b) => b.cat2 === cat2);
    const maj = existe
      ? actuels.map((b) => (b.cat2 === cat2 ? { ...b, target, active: true } : b))
      : [...actuels, { cat2, target, active: true, updated_at: null }];
    store.setBudgets({ budgets: maj });
    return memorise;
  }, []);

  return { rows, kpis, topRows, isLoading, updateBudget, comparableMonths };
}
