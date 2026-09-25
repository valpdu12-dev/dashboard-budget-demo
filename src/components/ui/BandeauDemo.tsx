// ── Bandeau de démonstration ─────────────────────────────────────────────
//
// Affiché en permanence, en haut de chaque écran.
//
// Ce n'est pas un élément de décor : un tableau de bord budgétaire donne
// l'impression d'afficher les comptes de quelqu'un. Sans cette ligne, un
// visiteur peut croire qu'il regarde de vraies finances — celles de l'auteur,
// ou les siennes après un import. Le bandeau dit les deux choses qui
// comptent : les chiffres sont inventés, et rien ne part d'ici.
//
// Il n'est PAS masquable. Un bandeau qu'on referme cesse d'informer les
// visiteurs suivants, et c'est justement eux qu'il protège.

import { memo } from "react";
import { FlaskConical } from "lucide-react";

function BandeauDemoComponent() {
  return (
    <div
      role="note"
      className="shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo/[0.12] border-b border-indigo/25 text-[12px] leading-tight text-text-sec text-center"
    >
      <FlaskConical size={13} className="shrink-0 text-indigo-text" aria-hidden="true" />
      <span>
        <strong className="font-semibold text-indigo-text">Démonstration — données fictives.</strong>{" "}
        <span className="max-xs:hidden">
          Aucun compte réel. Tout se calcule dans votre navigateur : rien n'est envoyé,
          rien n'est enregistré ailleurs.
        </span>
      </span>
    </div>
  );
}

export const BandeauDemo = memo(BandeauDemoComponent);
