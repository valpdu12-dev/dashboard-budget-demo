// ── Hook dédié aux données de la page Dépenses ──────────────────────────
// Migré depuis V1 (8 useMemo inline dans Dashboard → hook isolé + typé)
// Consomme : useFilteredData (baseTx, filteredTx, allMonthsInRange)
//            useFilterStore  (selCat2, selType)
//            useDataStore    (transactions brutes pour comparaison N vs N-1)

import { useMemo } from "react";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useFilterStore } from "@/stores/useFilterStore";
import { useDataStore } from "@/stores/useDataStore";
import { toOrganisme, organismesPresents } from "@/utils/organisme";
import { TRANSFER_TYPES } from "@/config/constants";
import { mkLabel } from "@/utils/formatters";


// ─── Types de retour ────────────────────────────────────────────────────

export interface MonthlyLineRow {
  name: string;       // Label du mois ("janv. 25")
  mk: string;         // MonthKey ("2025-01")
  Total: number;
  [org: string]: string | number;  // une clé par organisme
}

export interface Cat2Slice {
  name: string;
  value: number;
}

export interface TypeSlice {
  name: string;       // Tronqué à 40 chars
  fullName: string;   // Nom complet (pour le filtre)
  value: number;
}

export interface DetailRow {
  date: string;
  label: string;
  type: string;
  cat2: string;
  cat3: string;
  compte: string;
  montant: number;
}

/** Un jour du mois dans la courbe d'avancement des dépenses. */
export interface CumulJourRow {
  /** Jour du mois, de 1 à 31. */
  jour: number;
  /** Dépense du jour seul, tous mois de la période confondus. */
  montant: number;
  /** Dépense cumulée du 1er jusqu'à ce jour inclus. */
  cumul: number;
  /** Part du total atteinte à ce jour, en pourcentage entier. */
  part: number;
}

export interface CompNvsN1Row {
  name: string;
  [year: string]: string | number;  // "2025", "2024"
}

export interface TopItem {
  name: string;
  value: number;
}

// ─── Hook principal ─────────────────────────────────────────────────────

export function useExpenseData() {
  const { baseTx, filteredTx, allMonthsInRange } = useFilteredData();
  const { selCat2, selType, selOrg } = useFilterStore();
  const { transactions: allTransactions } = useDataStore();

  // Les organismes à tracer viennent des DONNÉES, pas d'une liste figée.
  // Calculés sur le jeu complet : une série ne doit pas apparaître et
  // disparaître au gré du filtre de période.
  const organismes = useMemo(
    () => organismesPresents(allTransactions),
    [allTransactions]
  );

  // ── 1. Évolution mensuelle par organisme (LineChart) ──────────────
  // Note : ne filtre PAS par selOrg (chaque organisme = une série)
  const expMonthlyLines = useMemo<MonthlyLineRow[]>(() => {
    let tx = baseTx;
    if (selCat2) tx = tx.filter((t) => t.cat2 === selCat2);
    if (selType) tx = tx.filter((t) => t.type === selType);

    const rows = allMonthsInRange.map((mk) => {
      const mTx = tx.filter((t) => t.monthKey === mk && t.dc === "Débit");
      const row: MonthlyLineRow = { name: mkLabel(mk), mk, Total: 0 };
      organismes.forEach((org) => {
        row[org] = Math.round(
          mTx
            .filter((t) => toOrganisme(t.compte) === org)
            .reduce((s, t) => s + t.montant, 0)
        );
      });
      row.Total = organismes.reduce((s, o) => s + ((row[o] as number) || 0), 0);
      return row;
    });
    // Ajouter prev_* pour comparaison N-1 dans les tooltips
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      organismes.forEach((org) => { rows[i][`prev_${org}`] = prev[org]; });
      rows[i]["prev_Total"] = prev.Total;
    }
    return rows;
  }, [allMonthsInRange, baseTx, selCat2, selType, organismes]);

  // ── 2. Répartition par Cat2 (Donut) ───────────────────────────────
  const expByCat2 = useMemo<Cat2Slice[]>(() => {
    const map: Record<string, number> = {};
    filteredTx
      .filter((t) => t.dc === "Débit" && t.cat2 && t.cat2 !== "x")
      .forEach((t) => {
        map[t.cat2] = (map[t.cat2] || 0) + t.montant;
      });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTx]);

  // ── 3. Détail par Type de dépense (BarChart horizontal) ───────────
  const expByType = useMemo<TypeSlice[]>(() => {
    const map: Record<string, number> = {};
    filteredTx
      .filter((t) => t.dc === "Débit" && t.type)
      .forEach((t) => {
        map[t.type] = (map[t.type] || 0) + t.montant;
      });
    return Object.entries(map)
      .map(([name, value]) => ({
        name: name.length > 40 ? name.slice(0, 37) + "…" : name,
        fullName: name,
        value: Math.round(value),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTx]);

  // ── 4. Tableau détail (toutes les lignes débit) ────────────────────
  // Le tri est géré par le composant DataTable (V2 FIX : pagination ajoutée)
  const detailRows = useMemo<DetailRow[]>(() => {
    return filteredTx
      .filter((t) => t.dc === "Débit")
      .map((t) => ({
        date: t.date,
        label: t.label,
        type: t.type,
        cat2: t.cat2,
        cat3: t.cat3,
        compte: t.compte,
        montant: t.montant,
      }));
  }, [filteredTx]);

  const detailTotal = useMemo(
    () => detailRows.reduce((s, r) => s + r.montant, 0),
    [detailRows]
  );

  // ── 5. Top 10 marchands (Cat3) ────────────────────────────────────
  const topMerchants = useMemo<TopItem[]>(() => {
    const map: Record<string, number> = {};
    filteredTx
      .filter((t) => t.dc === "Débit" && t.cat3 && t.cat3 !== "x")
      .forEach((t) => {
        map[t.cat3] = (map[t.cat3] || 0) + t.montant;
      });
    return Object.entries(map)
      .map(([name, value]) => ({
        name: name.length > 25 ? name.slice(0, 22) + "…" : name,
        value: Math.round(value),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredTx]);

  // ── 7. Avancement des dépenses dans le mois ───────────────────────
  // Remplace la heatmap par jour (11/08/2026) : elle montrait l'intensite
  // par case sans dire OU l'on en est. La question posee est « quand se font
  // les depenses dans le mois », a laquelle un cumul croissant repond
  // directement.
  //
  // L'abscisse est le JOUR DU MOIS (1 a 31), et non une date : quand la
  // periode couvre plusieurs mois, les jours de meme rang s'additionnent et
  // la courbe donne le rythme moyen. Une periode d'un seul mois donne donc
  // exactement la courbe de ce mois, sans traitement particulier.
  //
  // ⚠️ Les jours 29 a 31 n'existent pas dans tous les mois : la courbe s'y
  // aplatit mecaniquement. C'est une propriete du calendrier, pas un defaut.
  const cumulParJour = useMemo<CumulJourRow[]>(() => {
    const parJour = new Array<number>(32).fill(0);
    filteredTx
      .filter((t) => t.dc === "Débit")
      .forEach((t) => {
        const j = parseInt(t.date.slice(8, 10), 10);
        if (j >= 1 && j <= 31) parJour[j] += t.montant;
      });

    const total = parJour.reduce((s, v) => s + v, 0);
    let cumul = 0;
    return Array.from({ length: 31 }, (_, i) => {
      const jour = i + 1;
      cumul += parJour[jour];
      return {
        jour,
        montant: Math.round(parJour[jour]),
        cumul: Math.round(cumul),
        // `total > 0` : sans depense sur la periode, une part vaudrait NaN.
        part: total > 0 ? Math.round((cumul / total) * 100) : 0,
      };
    });
  }, [filteredTx]);

  // ── 8. Comparaison N vs N-1 par catégorie ─────────────────────────
  // Utilise allTransactions (non filtrées) pour accéder à l'année N-1.
  // Années calculées dynamiquement à partir des données (plus de hardcode 2025/2024).
  const { curYear, prevYear } = useMemo(() => {
    // Derivees de la PERIODE AFFICHEE, et non du jeu complet : sinon, en
    // consultant une periode de 2025, le graphique comparait toujours
    // 2026 a 2025 et se retrouvait vide d'un cote.
    const annees = allMonthsInRange
      .map((mk) => parseInt(mk.slice(0, 4), 10))
      .filter((y) => !Number.isNaN(y));
    const maxYear = annees.length
      ? Math.max(...annees)
      : new Date().getFullYear();
    return { curYear: String(maxYear), prevYear: String(maxYear - 1) };
  }, [allMonthsInRange]);

  const compNvsN1 = useMemo<CompNvsN1Row[]>(() => {
    // ⚠️ Ce calcul etait FAUX jusqu'au 11/08/2026, et de deux facons.
    //
    //   ① L'annee en cours respectait le filtre de periode, l'annee
    //      precedente prenait ses DOUZE mois. En YTD sur huit mois, huit mois
    //      de N etaient compares a douze mois de N-1 : le graphique affichait
    //      une baisse qui n'existait pas, systematiquement.
    //   ② Les virements internes etaient exclus d'un seul cote, ce qui
    //      gonflait les categories concernees pour N seulement.
    //
    // Les deux cotes passent desormais par le MEME crible : meme fenetre de
    // mois, memes exclusions, memes filtres de selection. Meme principe que
    // `samePeriod` sur la page Salaire (session du 29/07).
    const transferSet = new Set<string>(TRANSFER_TYPES as unknown as string[]);
    const estDepense = (t: { dc: string; cat2: string; type: string }) =>
      t.dc === "Débit" && !!t.cat2 && t.cat2 !== "x" && !transferSet.has(t.type);

    // Mois reellement couverts par la periode courante, en « MM ».
    const fenetre = new Set(
      allMonthsInRange
        .filter((mk) => mk.startsWith(curYear))
        .map((mk) => mk.slice(5, 7))
    );

    const yCur = filteredTx.filter(
      (t) =>
        estDepense(t) &&
        t.date.startsWith(curYear) &&
        fenetre.has(t.date.slice(5, 7))
    );

    // `filteredTx` ne porte que l'annee en cours : l'annee precedente est
    // reprise depuis les donnees completes, et les filtres de selection y
    // sont rejoues a l'identique.
    const yPrev = allTransactions.filter(
      (t) =>
        estDepense(t) &&
        t.date.startsWith(prevYear) &&
        fenetre.has(t.date.slice(5, 7)) &&
        (!selCat2 || t.cat2 === selCat2) &&
        (!selType || t.type === selType) &&
        (!selOrg || toOrganisme(t.compte) === selOrg)
    );

    const mCur: Record<string, number> = {};
    const mPrev: Record<string, number> = {};
    yCur.forEach((t) => { mCur[t.cat2] = (mCur[t.cat2] || 0) + t.montant; });
    yPrev.forEach((t) => { mPrev[t.cat2] = (mPrev[t.cat2] || 0) + t.montant; });

    return Object.keys({ ...mCur, ...mPrev })
      .map((k) => ({
        name: k,
        [curYear]: Math.round(mCur[k] || 0),
        [prevYear]: Math.round(mPrev[k] || 0),
      }))
      .sort((a, b) => (b[curYear] as number) - (a[curYear] as number));
  }, [filteredTx, allTransactions, allMonthsInRange, curYear, prevYear, selCat2, selType, selOrg]);

  /** Nombre de mois sur lesquels porte la comparaison N / N-1. */
  const compNvsN1Mois = useMemo(
    () => allMonthsInRange.filter((mk) => mk.startsWith(curYear)).length,
    [allMonthsInRange, curYear]
  );

  return {
    organismes,
    expMonthlyLines,
    expByCat2,
    expByType,
    detailRows,
    detailTotal,
    topMerchants,
    cumulParJour,
    compNvsN1,
    compNvsN1Years: { curYear, prevYear },
    compNvsN1Mois,
  };
}
