// -- Chip / Tag partage ---------------------------------------------------
// Phase 6.2 -- React.memo
import { memo } from "react";

interface ChipProps {
  label: string;
  active?: boolean;
  color?: string;
  onClick?: () => void;
  onClear?: () => void;
}

function ChipComponent({ label, active = false, color, onClick, onClear }: ChipProps) {
  return (
    <button
      onClick={onClick}
      // max-md: cible tactile ≥ 48 px dans les DEUX dimensions sous 768 px
      // (le script d'audit compte une cible dès que height OU width < 44).
      // Rendu desktop inchangé.
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 max-md:min-h-tap max-md:min-w-tap max-md:px-4 rounded-full text-xs font-medium transition-all cursor-pointer border ${
        active
          ? "border-indigo bg-indigo/20 text-text"
          : "border-border bg-surface text-text-sec hover:border-indigo/50"
      }`}
      style={color && active ? { borderColor: color, backgroundColor: color + "20" } : undefined}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      {label}
      {onClear && active && (
        <span
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="ml-1 hover:text-red"
        >
          x
        </span>
      )}
    </button>
  );
}

export const Chip = memo(ChipComponent);
