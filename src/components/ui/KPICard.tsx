// -- KPICard partage (eliminé ~5 copies dans V1) -------------------------
// Phase 6.2 -- React.memo : evite le re-render si les props sont identiques.
import { memo } from "react";
import { fmt, fmtPct, pctChange } from "@/utils/formatters";
// Lot 1.6 — accessibilité. Voir `utils/contrast.ts` : les couleurs passées en
// prop viennent de `config/colors.ts` et identifient un compte ou une
// catégorie. Quatre d'entre elles tombaient sous 4,5:1 en texte 18 px gras sur
// `surface`. Elles sont relevées à l'affichage, sans toucher `colors.ts`, qui
// sert aussi à colorer les graphiques (seuil non-texte 3:1, déjà tenu).
import { ensureContrast, FOND_SURFACE } from "@/utils/contrast";

interface KPICardProps {
  label: string;
  value?: number;
  prev?: number;
  format?: "euro" | "pct" | "raw";
  customValue?: string;
  customSub?: string;
  subColor?: string;
  icon?: React.ReactNode;
  color?: string;
}

function KPICardComponent({
  label, value, prev, format = "euro", customValue, customSub, subColor, icon, color,
}: KPICardProps) {
  const formatted = customValue
    ?? (value !== undefined
      ? (format === "euro" ? fmt(value) : format === "pct" ? fmtPct(value) : String(value))
      : "\u2014");

  const delta = customSub ?? (value !== undefined && prev !== undefined ? pctChange(value, prev) : "");
  const isPositive = delta.startsWith("+");

  return (
    // Lot 1.4 — densite. Les deux classes `max-xs:` (< 430 px) sont le seul
    // levier du lot : la grille reste a 2 colonnes, la largeur est regagnee
    // sur le padding et la police. Mesure a l'appui — a 412 px le pire
    // remplissage etait de 85 %, a 360 px il atteignait 101 % (valeur sur
    // 2 lignes). `p-3` rend 16 px de largeur utile, `text-lg` retire ~10 %
    // a la largeur du texte. Le rendu PC est inchange par construction :
    // `max-xs:` ne s'applique jamais au-dessus de 430 px.
    <div className="kpi-card max-xs:p-3">
      <div className="flex items-center gap-2 text-text-sec text-xs">
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </div>
      <div
        className="text-xl max-xs:text-lg font-title font-bold"
        style={{ color: color ? ensureContrast(color, FOND_SURFACE) : undefined }}
      >
        {formatted}
      </div>
      {delta && (
        <div
          className={`text-xs font-medium ${subColor ? "" : isPositive ? "text-green" : "text-red"}`}
          style={subColor ? { color: ensureContrast(subColor, FOND_SURFACE) } : undefined}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

export const KPICard = memo(KPICardComponent);
