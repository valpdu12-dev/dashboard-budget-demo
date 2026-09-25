// ── Le filtrage des données, sorti de React ──────────────────────────────
//
// Lot C.3. Déplacé depuis `hooks/useFilteredData.ts`, sans qu'une seule règle
// change. Les `useMemo` ont disparu — une fonction pure n'en a pas besoin,
// c'est le hook qui mémoïse le tout.
//
// Lot C.4 : ce sont les types de nature `transfert-interne` qui sortent des
// recettes et des dépenses — plus une liste de quatre libellés écrite dans le
// code. Aucun type déclaré comme tel ⇒ aucun transfert exclu, et l'import le
// dit, chiffré (D7).

import { extractAllMonths } from "@/utils/decode";
import { toOrganisme } from "@/utils/organisme";
import type { PeriodKey, Transaction } from "@/types";
import type { Regles } from "@/calculs/regles";

/** L'état des filtres, tel que `useFilterStore` le porte. */
export interface EtatFiltres {
  period: PeriodKey;
  cat1Filter: string;
  showTransfers: boolean;
  selMonth: string | null;
  selCat2: string | null;
  selType: string | null;
  selOrg: string | null;
}

export interface DonneesFiltrees {
  allMonths: string[];
  allMonthsInRange: string[];
  currentMonth: string | null;
  prevMonth: string | null;
  periodRange: { from: string; to: string };
  rawPeriodTx: Transaction[];
  baseTx: Transaction[];
  filteredTx: Transaction[];
}

export function filtrerDonnees(
  transactions: Transaction[],
  f: EtatFiltres,
  regles: Regles
): DonneesFiltrees {
  const { period, cat1Filter, showTransfers, selMonth, selCat2, selType, selOrg } = f;

  // ─── Liste triée de tous les mois disponibles ──────────────────
  const allMonths = extractAllMonths(transactions);

  // ─── Mois courant et précédent (basés sur l'ensemble des données) ──
  const currentMonth = allMonths.length ? allMonths[allMonths.length - 1] : null;
  const prevMonth = allMonths.length > 1 ? allMonths[allMonths.length - 2] : null;

  // ─── Calcul de la plage de période ─────────────────────────────
  const periodRange = ((): { from: string; to: string } => {
    if (!allMonths.length) return { from: "", to: "" };
    const last = allMonths[allMonths.length - 1];
    const ly = parseInt(last.slice(0, 4));
    const lm = parseInt(last.slice(5, 7));
    let from: string;
    const to = last;

    switch (period) {
      case "1M":
        from = last;
        break;
      case "3M": {
        const d = new Date(ly, lm - 3, 1);
        from = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        break;
      }
      case "6M": {
        const d = new Date(ly, lm - 6, 1);
        from = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        break;
      }
      case "YTD":
        from = ly + "-01";
        break;
      case "12M": {
        const d = new Date(ly, lm - 12, 1);
        from = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        break;
      }
      case "all":
        from = allMonths[0];
        break;
      default:
        from = ly + "-01";
    }

    // Ne pas dépasser le premier mois disponible
    if (from < allMonths[0]) from = allMonths[0];

    return { from, to };
  })();

  // ─── Mois dans la plage active ─────────────────────────────────
  const allMonthsInRange = allMonths.filter(
    (m) => m >= periodRange.from && m <= periodRange.to
  );

  // ─── Transactions de la période (sans filtre transferts/cat1) ──
  // Utilisé par la page Épargne qui a besoin des transactions de type transfert
  const rawPeriodTx = transactions.filter(
    (t) => t.monthKey >= periodRange.from && t.monthKey <= periodRange.to
  );

  // ─── Transactions de base (filtre période + transferts + cat1) ─
  const baseTx = rawPeriodTx.filter((t) => {
    if (!showTransfers && regles.aNature(t.type, "transfert-interne")) return false;
    if (cat1Filter !== "all" && t.cat1 && t.cat1 !== cat1Filter) return false;
    return true;
  });

  // ─── Transactions filtrées (baseTx + drill-downs dépenses) ─────
  let filteredTx: Transaction[] = baseTx;
  if (selMonth) filteredTx = filteredTx.filter((t) => t.monthKey === selMonth);
  if (selCat2) filteredTx = filteredTx.filter((t) => t.cat2 === selCat2);
  if (selType) filteredTx = filteredTx.filter((t) => t.type === selType);
  if (selOrg) filteredTx = filteredTx.filter((t) => toOrganisme(t.compte, regles) === selOrg);

  return {
    allMonths,
    allMonthsInRange,
    currentMonth,
    prevMonth,
    periodRange,
    rawPeriodTx,
    baseTx,
    filteredTx,
  };
}
