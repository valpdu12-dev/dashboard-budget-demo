// ── Bottom nav mobile avec React Router NavLink ─────────────────────────
import { NavLink } from "react-router-dom";
import {
  BarChart3, TrendingDown, TrendingUp, PiggyBank, Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { useOngletsVisibles } from "@/hooks/useOngletsVisibles";

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3, TrendingDown, TrendingUp, PiggyBank, Lightbulb,
};

export function BottomNav() {
  const onglets = useOngletsVisibles();
  return (
    // Cases égales (autant que de rubriques présentes), la page active sur un
    // fond doux de l'accent. Mêmes boutons, même ordre. Cette barre n'existe
    // qu'au petit écran. Le bas reprend le retrait de la barre de gestes
    // Android / de l'encoche iOS.
    <nav
      aria-label="Rubriques"
      className="fixed bottom-0 left-0 right-0 z-50 grid gap-0.5 bg-surface px-1.5 pt-1.5 pb-[calc(8px+env(safe-area-inset-bottom,0px))] shadow-[0_-1px_0_rgb(var(--c-border))]"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, onglets.length)}, minmax(0, 1fr))` }}
    >
      {onglets.map((tab) => {
        const Icon = ICON_MAP[tab.icon];
        return (
          <NavLink
            key={tab.id}
            to={tab.path}
            end={tab.path === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-[14px] text-[11px] font-semibold transition-colors ${
                isActive ? "bg-accent-doux text-indigo-text" : "text-text-sec"
              }`
            }
          >
            {Icon && <Icon size={22} className="shrink-0" aria-hidden="true" />}
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
