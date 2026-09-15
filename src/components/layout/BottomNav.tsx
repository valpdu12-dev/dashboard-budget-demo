// ── Bottom nav mobile avec React Router NavLink ─────────────────────────
import { NavLink } from "react-router-dom";
import {
  BarChart3, TrendingDown, TrendingUp, PiggyBank, Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { NAV_TABS } from "@/config/constants";

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3, TrendingDown, TrendingUp, PiggyBank, Lightbulb,
};

export function BottomNav() {
  return (
    // pb-safe-b : retrait sous la barre de gestes Android / l'encoche iOS.
    // Vaut 0 sur un navigateur de bureau, la nav reste donc collée en bas.
    <nav className="flex fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border pb-safe-b">
      {NAV_TABS.map((tab) => {
        const Icon = ICON_MAP[tab.icon];
        return (
          <NavLink
            key={tab.id}
            to={tab.path}
            end={tab.path === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center min-h-tap py-2 text-[11px] gap-0.5 border-t-2 transition-all ${
                isActive ? "border-indigo text-indigo-text" : "border-transparent text-text-sec"
              }`
            }
          >
            {Icon && <Icon size={18} className="shrink-0" />}
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
