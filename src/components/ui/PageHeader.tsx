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
  /**
   * Une précision sur les chiffres, montrée AU TÉLÉPHONE seulement (le
   * sous-titre y est caché). Ex. « Chiffres à fin octobre 2026 ».
   */
  noteTelephone?: string;
}

function PageHeaderComponent({ title, subtitle, breadcrumbs, actions, noteTelephone }: PageHeaderProps) {
  return (
    // Au téléphone (< 768 px), le titre est dans l'en-tête (EnTeteTelephone) :
    // on ne le répète pas. Le bloc entier disparaît s'il n'a ni fil d'Ariane,
    // ni actions, ni note. Grand écran : inchangé.
    <div className={`flex items-start justify-between mb-5${breadcrumbs?.length || actions || noteTelephone ? "" : " max-md:hidden"}`}>
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
        <h1 className="text-lg font-title font-bold text-text max-md:hidden">{title}</h1>
        {subtitle && <p className="text-xs text-text-sec mt-0.5 max-md:hidden">{subtitle}</p>}
        {noteTelephone && <p className="text-[13px] text-text-sec md:hidden">{noteTelephone}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export const PageHeader = memo(PageHeaderComponent);
