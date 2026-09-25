// -- En-tete de page avec breadcrumb (nouveau V2) ------------------------
// Phase 6.2 -- React.memo
import { memo } from "react";

interface Crumb {
  label: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
}

function PageHeaderComponent({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-text-sec mb-1">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="mx-1">&rsaquo;</span>}
                {crumb.onClick ? (
                  <button onClick={crumb.onClick} className="hover:text-indigo-text transition-colors">
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-text">{crumb.label}</span>
                )}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-lg font-title font-bold text-text">{title}</h1>
        {subtitle && <p className="text-xs text-text-sec mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export const PageHeader = memo(PageHeaderComponent);
