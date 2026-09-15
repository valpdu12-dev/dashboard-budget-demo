// ── Sidebar desktop avec React Router NavLink ───────────────────────────
import { NavLink } from "react-router-dom";
import {
  BarChart3, TrendingDown, TrendingUp, PiggyBank, Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { NAV_TABS } from "@/config/constants";

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3, TrendingDown, TrendingUp, PiggyBank, Lightbulb,
};

export function Sidebar() {
  return (
    <nav className="w-52 bg-surface border-r border-border flex flex-col py-4 shrink-0">
      {NAV_TABS.map((tab) => {
        const Icon = ICON_MAP[tab.icon];
        return (
          <NavLink
            key={tab.id}
            to={tab.path}
            end={tab.path === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-5 py-3 text-sm transition-all border-l-[3px] ${
                isActive
                  ? "border-indigo text-text font-semibold"
                  : "border-transparent text-text-sec hover:text-text"
              }`
            }
          >
            {Icon && <Icon size={16} className="shrink-0" />}
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
