// -- DataTable pagine, triable, exportable CSV ---------------------------
// Phase 6.2 -- React.memo : pattern cast necessaire pour les generiques.
import { memo, useState, useMemo, useCallback, useId } from "react";
import { Download } from "lucide-react";
import { useResponsive } from "@/hooks/useResponsive";
import { StackedRowCard, type CardField } from "./StackedRowCard";

export interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  /**
   * Lot 1.3 — colonne prioritaire du mode carte (< 768 px). Les colonnes
   * prioritaires forment l'en-tête de chaque carte, les autres passent
   * derrière le repli « Détails ».
   *
   * **Sans effet au-dessus de 768 px** : le tableau reste identique.
   * Si aucune colonne du jeu n'est marquée, on retombe sur les
   * `DEFAULT_PRIORITY_COUNT` premières — les appels existants restent donc
   * valides sans modification.
   */
  priority?: boolean;
}

/** Nombre de colonnes promues en en-tête de carte faute de `priority` déclarée. */
const DEFAULT_PRIORITY_COUNT = 3;

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  emptyMessage?: string;
  title?: string;
  exportFilename?: string;
}

function DataTableInner<T extends Record<string, unknown>>({
  data,
  columns,
  pageSize = 20,
  emptyMessage = "Aucune donnée",
  title,
  exportFilename = "export",
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Lot 1.3 — sous 768 px, le tableau est remplacé par des cartes empilées.
  // Au-dessus, `isMobile` est faux et le rendu ci-dessous est celui d'avant
  // le lot, à l'identique.
  const { isMobile } = useResponsive();

  /** Colonnes promues en en-tête de carte. Repli si aucune n'est déclarée. */
  const priorityCols = useMemo(() => {
    const declared = columns.filter((c) => c.priority);
    return declared.length > 0 ? declared : columns.slice(0, DEFAULT_PRIORITY_COUNT);
  }, [columns]);

  // Le tri vit dans les en-têtes `<th>`, qui n'existent pas en mode carte :
  // il est reporté sur un `<select>` + un bouton de sens. Sans cela, le mode
  // carte retirerait une fonction au lieu de corriger un affichage.
  const sortableCols = useMemo(() => columns.filter((c) => c.sortable), [columns]);
  const sortSelectId = useId();

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") {
        return sortAsc ? va - vb : vb - va;
      }
      const sa = String(va ?? "");
      const sb = String(vb ?? "");
      return sortAsc ? sa.localeCompare(sb, "fr") : sb.localeCompare(sa, "fr");
    });
  }, [data, sortKey, sortAsc]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  const exportCSV = useCallback(() => {
    if (sorted.length === 0) return;
    const sep = ";";
    const header = columns.map((c) => c.label).join(sep);
    const rows = sorted.map((row) =>
      columns
        .map((c) => {
          const v = row[c.key];
          const s = v == null ? "" : String(v);
          return s.includes(sep) || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(sep)
    );
    const bom = "\uFEFF";
    const blob = new Blob([bom + header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, columns, exportFilename]);

  return (
    <div className="card overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-3 py-2">
          <div className="text-sm font-medium text-text">
            {title}
            <span className="text-text-sec font-normal text-xs ml-2">
              ({sorted.length} transaction{sorted.length > 1 ? "s" : ""})
            </span>
          </div>
          {sorted.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center justify-center gap-1.5 text-xs text-text-sec hover:text-indigo-text transition-colors px-2 py-1 max-md:min-h-tap max-md:min-w-tap rounded hover:bg-border/30"
              title="Exporter en CSV"
            >
              <Download size={13} />
              CSV
            </button>
          )}
        </div>
      )}
      {!title && sorted.length > 0 && (
        <div className="flex justify-end px-3 py-1">
          <button
            onClick={exportCSV}
            className="flex items-center justify-center gap-1.5 text-xs text-text-sec hover:text-indigo-text transition-colors px-2 py-1 max-md:min-h-tap max-md:min-w-tap rounded hover:bg-border/30"
            title="Exporter en CSV"
          >
            <Download size={13} />
            CSV
          </button>
        </div>
      )}
      {/* ── Mode carte (< 768 px) ────────────────────────────────────────
          Le conteneur `overflow-x-auto` n'est délibérément PAS rendu sur ce
          chemin. `audit.mjs:52-54` ne compte une zone de défilement que si
          l'`overflowX` calculé vaut `auto`/`scroll` ET que le contenu
          déborde : ne pas rendre le conteneur fait sortir la page du
          décompte par construction, sans parier sur la largeur du contenu. */}
      {isMobile ? (
        <div>
          {sortableCols.length > 0 && sorted.length > 0 && (
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <label htmlFor={sortSelectId} className="shrink-0 text-xs text-text-sec">
                Trier
              </label>
              <select
                id={sortSelectId}
                value={sortKey === null ? "" : String(sortKey)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSortKey(v === "" ? null : (v as keyof T));
                  setPage(0);
                }}
                className="min-h-tap min-w-tap flex-1 rounded bg-border/40 px-2 text-xs text-text"
              >
                <option value="">Ordre d'origine</option>
                {sortableCols.map((col) => (
                  <option key={String(col.key)} value={String(col.key)}>
                    {col.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortAsc((a) => !a)}
                disabled={sortKey === null}
                aria-label={sortAsc ? "Tri croissant" : "Tri décroissant"}
                className="min-h-tap min-w-tap rounded bg-border/40 px-2 text-xs text-text-sec disabled:opacity-30"
              >
                {sortAsc ? "↑" : "↓"}
              </button>
            </div>
          )}

          {paged.length === 0 ? (
            <div className="px-3 py-8 text-center text-text-sec">{emptyMessage}</div>
          ) : (
            paged.map((row, i) => (
              <StackedRowCard
                key={i}
                fields={columns.map<CardField>((col) => ({
                  label: col.label,
                  value: col.render ? col.render(row[col.key], row) : String(row[col.key] ?? ""),
                  priority: priorityCols.includes(col),
                }))}
              />
            ))
          )}
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-3 py-2 text-text-sec font-medium text-${col.align ?? "left"} ${
                    col.sortable ? "cursor-pointer hover:text-text" : ""
                  }`}
                  onClick={() => {
                    if (!col.sortable) return;
                    if (sortKey === col.key) setSortAsc(!sortAsc);
                    else { setSortKey(col.key); setSortAsc(true); }
                    setPage(0);
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (sortAsc ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-text-sec">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-border/20">
                  {columns.map((col) => (
                    <td key={String(col.key)} className={`px-3 py-2 text-${col.align ?? "left"}`}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs text-text-sec">
          <span>{data.length} résultats</span>
          <div className="flex gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-2 py-1 max-md:min-h-tap max-md:min-w-tap rounded bg-border/50 disabled:opacity-30"
            >
              &#8592;
            </button>
            <span className="px-2 py-1">{page + 1} / {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="px-2 py-1 max-md:min-h-tap max-md:min-w-tap rounded bg-border/50 disabled:opacity-30"
            >
              &#8594;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// React.memo ne preserve pas les types generiques nativement -- cast explicite.
export const DataTable = memo(DataTableInner) as typeof DataTableInner;
