// -- ChartTooltip Recharts partage (eliminé ~4 copies) -------------------
// V2.1 : support comparaison N-1 via champs prev_<dataKey> dans les donnees
// Phase 6.2 -- React.memo
import { memo } from "react";

interface PayloadEntry {
  name: string;
  value: number;
  color: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: PayloadEntry[];
  label?: string;
  formatter?: (value: number) => string;
  showPrev?: boolean;
  /**
   * Ajoute une ligne « Total » (somme des séries affichées) sous un séparateur.
   *
   * Désactivé par défaut : le composant est partagé par une dizaine de
   * graphiques, dont des séries non additionnables (indices, pourcentages,
   * réel vs budget) où une somme n'aurait aucun sens. À n'activer que sur les
   * graphiques dont les séries sont des montants d'une même unité.
   */
  showTotal?: boolean;
  /** Libellé de la ligne de total. */
  totalLabel?: string;
}

function fmtDelta(
  cur: number,
  prev: number,
  fmtVal: (v: number) => string,
): { text: string; cls: string } {
  const diff = cur - prev;
  const signEur = diff >= 0 ? "+" : "\u2212"; // signe moins typographique
  const eur = `${signEur}${fmtVal(Math.abs(diff))}`;
  if (!prev || prev === 0) return { text: eur, cls: diff >= 0 ? "text-red" : "text-green" };
  const pct = (diff / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return {
    text: `${eur} (${sign}${pct.toFixed(1).replace(".", ",")} %)`,
    cls: pct >= 0 ? "text-red" : "text-green",
  };
}

function ChartTooltipComponent({
  active,
  payload,
  label,
  formatter,
  showPrev = true,
  showTotal = false,
  totalLabel = "Total",
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const fmtVal = formatter ?? ((v: number) => v.toLocaleString("fr-FR") + " \u20ac");

  // Somme des s\u00e9ries affich\u00e9es. Les valeurs manquantes valent 0 : un mois sans
  // remboursement ne doit pas rendre le total indisponible.
  const total = showTotal
    ? payload.reduce((sum, e) => sum + (Number.isFinite(e.value) ? e.value : 0), 0)
    : 0;

  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg text-xs min-w-[180px]">
      <div className="text-text-sec mb-1.5 font-medium">{label}</div>
      {payload.map((entry, i) => {
        const row = entry.payload ?? {};
        const prevKey = `prev_${entry.dataKey ?? entry.name}`;
        const prevVal = showPrev ? (row[prevKey] as number | undefined) : undefined;
        const hasPrev = prevVal !== undefined && prevVal !== null;
        const delta = hasPrev ? fmtDelta(entry.value, prevVal, fmtVal) : null;

        return (
          <div key={i} className="py-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
              <span className="text-text-sec">{entry.name}</span>
              <span className="ml-auto text-text font-medium tabular-nums">{fmtVal(entry.value)}</span>
            </div>
            {delta && (
              <div className="flex items-center gap-1 ml-4 mt-0.5">
                <span className="text-text-sec">vs prec.</span>
                <span className="text-text-sec tabular-nums">{fmtVal(prevVal!)}</span>
                <span className={`font-medium tabular-nums ${delta.cls}`}>{delta.text}</span>
              </div>
            )}
          </div>
        );
      })}
      {showTotal && (
        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border">
          <span className="text-text font-medium">{totalLabel}</span>
          <span className="ml-auto text-indigo-text font-medium tabular-nums">{fmtVal(total)}</span>
        </div>
      )}
    </div>
  );
}

export const ChartTooltip = memo(ChartTooltipComponent);
