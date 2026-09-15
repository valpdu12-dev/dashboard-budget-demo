// ── Carte empilée — rendu d'une ligne de tableau sous 768 px ────────────
//
// Lot 1.3. Trois tableaux du projet débordaient horizontalement sur l'A56 :
// le `DataTable` partagé (4 pages, jusqu'à 522 px), le tableau budget de
// `BudgetMensuel` (213 px) et la synthèse annuelle de `SalaireInflation`
// (182 px). Un tableau à 5-8 colonnes ne tient pas dans 346 px de largeur
// utile ; l'`overflow-x-auto` ne faisait que déplacer le problème.
//
// Règle de conception de ce module, reprise de `useChartSize` :
// **ce composant n'est jamais rendu au-dessus de 768 px.** Les appelants
// gardent leur `<table>` d'origine intacte sur ce chemin, le rendu PC est
// donc inchangé par construction, sans relecture page par page.
//
// Point de mesure : `scripts/audit-mobile/audit.mjs:52-54` ne compte une
// zone de défilement que si l'`overflowX` calculé vaut `auto` ou `scroll`
// ET que le contenu déborde. Les appelants ne doivent donc **pas** rendre
// leur conteneur `overflow-x-auto` en mode carte — ne pas se contenter de
// supposer que le contenu ne débordera plus.
import { memo, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface CardField {
  /** Libellé de colonne, affiché en regard de la valeur. */
  label: string;
  /** Contenu rendu de la cellule. */
  value: React.ReactNode;
  /**
   * Champ prioritaire — affiché dans l'en-tête de carte, toujours visible.
   * Les autres passent derrière le repli « Détails ».
   */
  priority?: boolean;
}

interface StackedRowCardProps {
  fields: CardField[];
  /**
   * Rendu de l'en-tête si les champs prioritaires ne suffisent pas
   * (cas de `BudgetMensuel`, dont la première cellule porte une pastille
   * de couleur et un contrôle éditable).
   */
  header?: React.ReactNode;
}

/**
 * Une ligne de tableau rendue en carte : les champs prioritaires en tête,
 * le reste replié derrière un bouton « Détails ».
 *
 * Le repli est un état **par carte** : ouvrir une ligne n'ouvre pas les
 * autres, et l'état ne survit pas au changement de page de pagination —
 * comportement voulu, chaque page repart replié.
 */
function StackedRowCardInner({ fields, header }: StackedRowCardProps) {
  const [open, setOpen] = useState(false);

  const primary = fields.filter((f) => f.priority);
  const secondary = fields.filter((f) => !f.priority);

  return (
    <div className="border-b border-border/50 px-3 py-2.5 last:border-b-0">
      {header ?? (
        <div className="flex flex-col gap-1">
          {primary.map((f, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-text-sec text-xs shrink-0">{f.label}</span>
              <span className="text-text text-xs min-w-0 text-right break-words">{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {secondary.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            // Cible tactile ≥ 48 px dans les deux dimensions : `audit.mjs:59-62`
            // compte une cible dès que sa hauteur OU sa largeur passe sous 44 px.
            className="mt-1.5 flex min-h-tap w-full min-w-tap items-center gap-1 text-xs text-text-sec transition-colors hover:text-indigo-text"
          >
            <ChevronDown
              size={13}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
            {open ? "Masquer" : "Détails"}
          </button>

          {/* Rendu conditionnel, et non masquage par classe : les tests
              assertent l'absence des champs secondaires dans le DOM. */}
          {open && (
            <div className="mt-1 flex flex-col gap-1">
              {secondary.map((f, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3">
                  <span className="text-text-sec text-xs shrink-0">{f.label}</span>
                  <span className="text-text text-xs min-w-0 text-right break-words">{f.value}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const StackedRowCard = memo(StackedRowCardInner);
