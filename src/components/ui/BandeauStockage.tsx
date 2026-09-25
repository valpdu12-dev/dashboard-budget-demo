// ── Bandeau : ce que la relecture du stockage a à dire ───────────────────
//
// Lot C.6, décision D6.
//
// ⚠️ CE BANDEAU EXISTE PARCE QU'UN `console.warn` N'EST PAS UNE RÉPONSE.
// Jusqu'ici, un jeu mémorisé d'une version inconnue disparaissait en écrivant
// une ligne dans la console. Pour la personne devant l'écran, ça voulait dire
// RIEN DU TOUT : elle rouvrait le site et retrouvait la démonstration à la
// place de ses données, sans savoir pourquoi.
//
// Il se ferme, et ne revient pas : l'avis vit dans le store de l'interface,
// pas dans le jeu mémorisé. Un bandeau qui reviendrait à chaque ouverture
// finirait par ne plus être lu — c'est la leçon du lot B sur les valeurs par
// défaut, appliquée aux avertissements.

import { memo } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";

function BandeauStockageComponent() {
  const avis = useUIStore((s) => s.avisStockage);
  const fermer = useUIStore((s) => s.setAvisStockage);

  // Rien à dire : rien ne s'affiche. Un bandeau permanent devient du décor.
  if (!avis) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 px-3 py-2.5 xs:px-6 bg-amber/[0.10] border-b border-amber/25"
    >
      <AlertTriangle size={16} className="text-amber shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-text">{avis.titre}</p>
        <p className="text-[12px] text-text-sec leading-relaxed mt-0.5">{avis.message}</p>
      </div>
      <button
        onClick={() => fermer(null)}
        aria-label="Fermer cet avertissement"
        className="shrink-0 inline-flex items-center justify-center min-h-tap min-w-tap -my-1 text-text-sec hover:text-text transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export const BandeauStockage = memo(BandeauStockageComponent);
