/**
 * useSalaryInflationData — Hook de la page Salaire vs Inflation (Session 4A, Phase 4).
 *
 * Analyse le pouvoir d'achat à partir de l'historique de salaire et des séries
 * INSEE (inflation) / SMIC issues de l'enrichissement Phase 1B.
 *
 * Conventions : aucune valeur d'inflation/SMIC en dur. Si ces séries manquent
 * (tables D1 non seedées), `hasData` passe à false et les séries dépendantes
 * restent vides — le hook ne fabrique JAMAIS de données. Indépendant du filtre
 * de période : l'analyse porte toujours sur l'historique complet.
 *
 * Consomme : useDataStore (salary + transactions).
 *
 * @returns status, hasData, le filtre employeur (employers/employer/setEmployer,
 *   état local), et les séries dérivées : yearly (net moyen annuel + drapeau
 *   incomplet), indices (base 100 net/inflation/SMIC), purchasing (net passé en
 *   euros courants), smicGap (écart net vs SMIC %), personalInflation (inflation
 *   pondérée 2024-2025), insights (synthèse dynamique), + métadonnées baseYear/refYear/inProgressYear.
 */

import { useMemo, useState, useCallback } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { fmt } from "@/utils/formatters";
import { couleurEmployeur } from "@/config/colors";
import type { InflationData, SmicData } from "@/types";

// ─── Constantes ──────────────────────────────────────────────────────────
export const EMPLOYER_ALL = "Tous";

/** Nombre minimal de mois pour qu'une année soit considérée complète. */
const MIN_MONTHS_COMPLETE = 11;

/** Secteurs INSEE disponibles dans `inflationByCategory`. */
type Sector =
  | "alimentation"
  | "services"
  | "energie"
  | "transports"
  | "produits_manufactures";

/**
 * Rattache une sous-catégorie de dépense (cat2) à un secteur INSEE.
 * Mapping volontairement explicite ; toute cat2 non reconnue est exclue du
 * calcul d'inflation personnalisée (et le poids est renormalisé sur le reste).
 */
function sectorOfCat2(cat2: string): Sector | null {
  const c = cat2.toLowerCase();
  if (!c) return null;
  if (c.includes("aliment") || c.includes("course") || c.includes("restau")) return "alimentation";
  if (c.includes("transport") || c.includes("carburant") || c.includes("essence") || c.includes("voiture") || c.includes("auto"))
    return "transports";
  if (c.includes("énerg") || c.includes("energ") || c.includes("électr") || c.includes("electr") || c.includes("gaz") || c.includes("chauffage"))
    return "energie";
  if (c.includes("logement") || c.includes("loisir") || c.includes("santé") || c.includes("sante") || c.includes("service") || c.includes("abonnement") || c.includes("télé") || c.includes("tele"))
    return "services";
  if (c.includes("équipement") || c.includes("equipement") || c.includes("vêtement") || c.includes("vetement") || c.includes("habillement") || c.includes("manufactur") || c.includes("électroménager") || c.includes("meuble"))
    return "produits_manufactures";
  return null;
}

/** Récupère le taux sectoriel d'une ligne InflationData (ou null). */
function rateOfSector(row: InflationData, sector: Sector): number | null {
  switch (sector) {
    case "alimentation": return row.rate_alimentation;
    case "services": return row.rate_services;
    case "energie": return row.rate_energie;
    case "transports": return row.rate_transports;
    case "produits_manufactures": return row.rate_produits_manufactures;
  }
}

// ─── Interfaces exportées ──────────────────────────────────────────────────
export interface YearlySalary {
  year: string;
  avgNet: number;       // Net moyen mensuel de l'année
  totalNet: number;     // Net cumulé de l'année
  months: number;       // Nombre de mois renseignés
  incomplet: boolean;   // true si months < 11
  enInferieur: boolean; // alias lisible (réservé futur)
}

export interface IndexPoint {
  year: string;
  salaryIndex: number | null;    // null = pas de données salaire (trous 2015-2017)
  inflationIndex: number | null;
  smicIndex: number | null;
}

export interface PurchasingPowerPoint {
  year: string;
  avgNet: number | null;        // Net moyen de l'année
  currentEuros: number | null;  // Équivalent en euros de l'année de référence
}

export interface SmicGapPoint {
  year: string;
  avgNet: number | null;
  smicNet: number | null;
  gapPct: number | null;        // (net − smic) / smic × 100
}

export interface PersonalInflationPoint {
  year: string;
  rate: number | null;          // null hors 2024-2025 ou si données insuffisantes
}

export interface EmployerOption {
  name: string;     // "Tous" ou nom d'employeur
  color: string;    // couleur de l'employeur (ou neutre pour "Tous")
}

export interface SalaryInflationInsights {
  baseYear: string | null;
  refYear: string | null;                 // dernière année complète (euros courants)
  cumInflationPct: number | null;          // inflation cumulée base→ref (%)
  realGrowthPct: number | null;            // net réel : salaryIndex − inflationIndex à ref
  powerLossYears: string[];                // années où l'indice net < indice inflation
  smicGapRefPct: number | null;            // écart SMIC à l'année de référence
  euroEquivalent: {                        // ex : "615 € de 2013 = 736 € en 2025"
    fromYear: string;
    fromNet: number;
    toYear: string;
    toEuros: number;
    text: string;
  } | null;
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useSalaryInflationData() {
  const { salary, transactions, status } = useDataStore();

  const months = useMemo(() => salary?.months ?? [], [salary]);
  const inflation = useMemo<InflationData[]>(() => salary?.inflation ?? [], [salary]);
  const smic = useMemo<SmicData[]>(() => salary?.smic ?? [], [salary]);
  const inflationByCategory = useMemo<InflationData[]>(
    () => salary?.inflationByCategory ?? [],
    [salary]
  );

  // ── Filtre employeur (état local, indépendant du filtre global) ──────────
  const [employer, setEmployer] = useState<string>(EMPLOYER_ALL);

  const employers = useMemo<EmployerOption[]>(() => {
    const names = [...new Set(months.map((m) => m.entreprise))];
    return [
      { name: EMPLOYER_ALL, color: "#94a3b8" },
      ...names.map((n) => ({ name: n, color: couleurEmployeur(n) })),
    ];
  }, [months]);

  // Mois retenus après filtre employeur
  const filteredMonths = useMemo(
    () => (employer === EMPLOYER_ALL ? months : months.filter((m) => m.entreprise === employer)),
    [months, employer]
  );

  // Garde-fou principal : indices/écarts nécessitent inflation + SMIC
  const hasData = months.length > 0 && inflation.length > 0 && smic.length > 0;

  // ── Année « en cours » = dernière année du dataset si incomplète ─────────
  const inProgressYear = useMemo(() => {
    if (!months.length) return null;
    const years = months.map((m) => m.mk.slice(0, 4));
    const maxYear = years.reduce((a, b) => (b > a ? b : a));
    const count = months.filter((m) => m.mk.slice(0, 4) === maxYear).length;
    return count < 12 ? maxYear : null;
  }, [months]);

  // ── 1. Agrégation annuelle du net moyen ──────────────────────────────────
  const yearly = useMemo<YearlySalary[]>(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const m of filteredMonths) {
      const y = m.mk.slice(0, 4);
      const cur = map.get(y) ?? { total: 0, count: 0 };
      cur.total += m.net;
      cur.count += 1;
      map.set(y, cur);
    }
    return Array.from(map.entries())
      .map(([year, v]) => ({
        year,
        avgNet: v.count ? v.total / v.count : 0,
        totalNet: v.total,
        months: v.count,
        incomplet: v.count < MIN_MONTHS_COMPLETE,
        enInferieur: v.count < MIN_MONTHS_COMPLETE,
      }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [filteredMonths]);

  // Index rapides pour inflation et SMIC par année
  const inflByYear = useMemo(() => {
    const m = new Map<string, InflationData>();
    for (const r of inflation) m.set(r.year, r);
    return m;
  }, [inflation]);

  const smicByYear = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of smic) if (r.net_monthly != null) m.set(r.year, r.net_monthly);
    return m;
  }, [smic]);

  const avgNetByYear = useMemo(() => {
    const m = new Map<string, number>();
    for (const y of yearly) m.set(y.year, y.avgNet);
    return m;
  }, [yearly]);

  // ── Année de base = 1re année (triée) ayant net + inflation + SMIC ────────
  const baseYear = useMemo(() => {
    if (!hasData) return null;
    for (const y of yearly) {
      if (y.year === inProgressYear) continue;
      if (avgNetByYear.has(y.year) && smicByYear.has(y.year) && inflByYear.has(y.year)) {
        return y.year;
      }
    }
    return null;
  }, [hasData, yearly, inProgressYear, avgNetByYear, smicByYear, inflByYear]);

  // Année de référence = dernière année complète disposant des 3 séries
  const refYear = useMemo(() => {
    if (!hasData) return null;
    for (let i = yearly.length - 1; i >= 0; i--) {
      const y = yearly[i];
      if (y.year === inProgressYear || y.incomplet) continue;
      if (smicByYear.has(y.year) && inflByYear.has(y.year)) return y.year;
    }
    return null;
  }, [hasData, yearly, inProgressYear, smicByYear, inflByYear]);

  // ── Indice de prix cumulé (base 100 à baseYear) par année ─────────────────
  // priceIndex(y) = priceIndex(y-1) × (1 + rate_annual(y)/100)
  const priceIndexByYear = useMemo(() => {
    const m = new Map<string, number>();
    if (!baseYear) return m;
    // Plage d'années couverte par l'inflation, triée
    const years = [...inflByYear.keys()].sort((a, b) => a.localeCompare(b)).filter((y) => y >= baseYear);
    let idx = 100;
    for (const y of years) {
      if (y === baseYear) {
        idx = 100;
      } else {
        const rate = inflByYear.get(y)?.rate_annual;
        if (rate == null) continue; // pas de taux → on saute (pas d'invention)
        idx = idx * (1 + rate / 100);
      }
      m.set(y, idx);
    }
    return m;
  }, [baseYear, inflByYear]);

  // ── 3. Indices cumulés base 100 (net / inflation / SMIC) ──────────────────
  const indices = useMemo<IndexPoint[]>(() => {
    if (!baseYear) return [];
    const baseNet = avgNetByYear.get(baseYear) ?? null;
    const baseSmic = smicByYear.get(baseYear) ?? null;

    // Axe temporel = UNION des années (salaire ∪ inflation ∪ SMIC), pas seulement
    // les années de salaire. L'inflation et le SMIC existent pour 2015-2017
    // (période d'études, sans revenu) et doivent rester visibles : on parcourt
    // donc une plage continue baseYear → dernière année réelle (hors année en cours).
    // salaryIndex reste null sur les années sans salaire (trou volontaire conservé).
    const allYears = new Set<string>([
      ...avgNetByYear.keys(),
      ...priceIndexByYear.keys(),
      ...smicByYear.keys(),
    ]);
    const baseY = parseInt(baseYear, 10);
    let maxY = baseY;
    for (const y of allYears) {
      if (y === inProgressYear) continue; // année en cours exclue des cumuls
      const n = parseInt(y, 10);
      if (n > maxY) maxY = n;
    }

    const out: IndexPoint[] = [];
    for (let y = baseY; y <= maxY; y++) {
      const ys = String(y);
      if (ys === inProgressYear) continue;
      const net = avgNetByYear.get(ys);
      const sm = smicByYear.get(ys);
      out.push({
        year: ys,
        salaryIndex: net != null && baseNet ? (net / baseNet) * 100 : null,
        inflationIndex: priceIndexByYear.get(ys) ?? null,
        smicIndex: sm != null && baseSmic ? (sm / baseSmic) * 100 : null,
      });
    }
    return out;
  }, [baseYear, inProgressYear, avgNetByYear, smicByYear, priceIndexByYear]);

  // ── 4. Pouvoir d'achat : net passé → euros de l'année de référence ────────
  const purchasing = useMemo<PurchasingPowerPoint[]>(() => {
    if (!refYear) return [];
    const refPrice = priceIndexByYear.get(refYear);
    if (!refPrice) return [];
    return yearly
      .filter((y) => y.year !== inProgressYear)
      .map((y) => {
        const net = avgNetByYear.get(y.year) ?? null;
        const price = priceIndexByYear.get(y.year);
        return {
          year: y.year,
          avgNet: net,
          currentEuros: net != null && price ? net * (refPrice / price) : null,
        };
      });
  }, [refYear, yearly, inProgressYear, avgNetByYear, priceIndexByYear]);

  // ── 5. Écart SMIC ─────────────────────────────────────────────────────────
  const smicGap = useMemo<SmicGapPoint[]>(() => {
    return yearly.map((y) => {
      const net = avgNetByYear.get(y.year) ?? null;
      const sm = smicByYear.get(y.year) ?? null;
      return {
        year: y.year,
        avgNet: net,
        smicNet: sm,
        gapPct: net != null && sm ? ((net - sm) / sm) * 100 : null,
      };
    });
  }, [yearly, avgNetByYear, smicByYear]);

  // ── 6. Inflation personnalisée (2024-2025 uniquement) ─────────────────────
  // Moyenne pondérée des taux sectoriels × part de chaque secteur dans les
  // dépenses réelles de l'année. Renvoie null hors 2024-2025 ou si données
  // insuffisantes (pas de détail sectoriel, ou aucune dépense rattachable).
  const personalInflation = useMemo<PersonalInflationPoint[]>(() => {
    const catByYear = new Map<string, InflationData>();
    for (const r of inflationByCategory) catByYear.set(r.year, r);

    // Dépenses réelles par année et par secteur
    const spendByYearSector = new Map<string, Map<Sector, number>>();
    for (const t of transactions) {
      if (t.dc !== "Débit") continue;
      const sector = sectorOfCat2(t.cat2);
      if (!sector) continue;
      const y = t.monthKey.slice(0, 4);
      let secMap = spendByYearSector.get(y);
      if (!secMap) { secMap = new Map(); spendByYearSector.set(y, secMap); }
      secMap.set(sector, (secMap.get(sector) ?? 0) + Math.abs(t.montant));
    }

    return yearly.map((y) => {
      // Restriction stricte 2024-2025 (décision B)
      if (y.year !== "2024" && y.year !== "2025") return { year: y.year, rate: null };
      const catRow = catByYear.get(y.year);
      const secMap = spendByYearSector.get(y.year);
      if (!catRow || !secMap) return { year: y.year, rate: null };

      // Total des dépenses rattachables à un secteur disposant d'un taux
      let total = 0;
      const usable: [Sector, number][] = [];
      for (const [sector, amount] of secMap) {
        if (rateOfSector(catRow, sector) == null) continue;
        total += amount;
        usable.push([sector, amount]);
      }
      if (total <= 0) return { year: y.year, rate: null };

      let rate = 0;
      for (const [sector, amount] of usable) {
        const r = rateOfSector(catRow, sector)!;
        rate += (amount / total) * r;
      }
      return { year: y.year, rate };
    });
  }, [yearly, inflationByCategory, transactions]);

  // ── 7. Insights dynamiques ────────────────────────────────────────────────
  const insights = useMemo<SalaryInflationInsights>(() => {
    if (!baseYear || !refYear) {
      return {
        baseYear, refYear,
        cumInflationPct: null, realGrowthPct: null,
        powerLossYears: [], smicGapRefPct: null, euroEquivalent: null,
      };
    }
    const refIdx = indices.find((p) => p.year === refYear);
    const cumInflationPct = refIdx?.inflationIndex != null ? refIdx.inflationIndex - 100 : null;
    const realGrowthPct =
      refIdx?.salaryIndex != null && refIdx?.inflationIndex != null
        ? refIdx.salaryIndex - refIdx.inflationIndex
        : null;

    // Années où l'indice net est resté sous l'indice inflation (perte réelle)
    const powerLossYears = indices
      .filter((p) => p.salaryIndex != null && p.inflationIndex != null && p.salaryIndex < p.inflationIndex)
      .map((p) => p.year);

    const smicGapRefPct = smicGap.find((p) => p.year === refYear)?.gapPct ?? null;

    // Équivalent euros : net moyen de baseYear exprimé en euros de refYear
    const baseNet = avgNetByYear.get(baseYear) ?? null;
    const refPrice = priceIndexByYear.get(refYear);
    const basePrice = priceIndexByYear.get(baseYear);
    let euroEquivalent: SalaryInflationInsights["euroEquivalent"] = null;
    if (baseNet != null && refPrice && basePrice) {
      const toEuros = baseNet * (refPrice / basePrice);
      euroEquivalent = {
        fromYear: baseYear,
        fromNet: baseNet,
        toYear: refYear,
        toEuros,
        text: `${fmt(baseNet)} de ${baseYear} = ${fmt(toEuros)} en euros ${refYear}`,
      };
    }

    return { baseYear, refYear, cumInflationPct, realGrowthPct, powerLossYears, smicGapRefPct, euroEquivalent };
  }, [baseYear, refYear, indices, smicGap, avgNetByYear, priceIndexByYear]);

  const setEmployerCb = useCallback((name: string) => setEmployer(name), []);

  return {
    status,
    hasData,
    // Filtre employeur
    employers,
    employer,
    setEmployer: setEmployerCb,
    // Données dérivées
    yearly,
    indices,
    purchasing,
    smicGap,
    personalInflation,
    insights,
    // Métadonnées
    baseYear,
    refYear,
    inProgressYear,
  };
}
