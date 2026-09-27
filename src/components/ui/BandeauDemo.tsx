// ── Bandeau de démonstration ─────────────────────────────────────────────
//
// Affiché en permanence, en haut de chaque écran.
//
// Ce n'est pas un élément de décor : un tableau de bord budgétaire donne
// l'impression d'afficher les comptes de quelqu'un. Sans cette ligne, un
// visiteur peut croire qu'il regarde de vraies finances — celles de l'auteur.
// Le bandeau dit les deux choses qui comptent : ce qui est affiché, et que
// rien ne part d'ici.
//
// Il n'est PAS masquable. Un bandeau qu'on referme cesse d'informer les
// visiteurs suivants, et c'est justement eux qu'il protège.
//
// Lot D (décision du 26/09) — il SUIT les données affichées. Après un import,
// « données fictives » devenait faux : ce sont celles de la personne. Il dit
// alors que ce sont les siennes, et qu'elles ne quittent pas le navigateur.

import { memo } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { useDataStore } from "@/stores/useDataStore";

function BandeauDemoComponent() {
  const mesDonnees = useDataStore((s) => s.origin) === "upload";
  // `section` nommée : le bandeau est une zone de la page à part entière
  // (lecteurs d'écran), et non un texte flottant hors de toute zone.
  return (
    <section aria-label="Données affichées" className="shrink-0">
    <div
      role="note"
      className="shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo/[0.12] border-b border-indigo/25 text-[12px] leading-tight text-text-sec text-center"
    >
      {mesDonnees ? (
        <>
          <ShieldCheck size={13} className="shrink-0 text-indigo-text" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-indigo-text">Vos données.</strong>{" "}
            <span className="max-xs:hidden">
              Elles restent dans ce navigateur : rien n'est envoyé, rien n'est
              enregistré ailleurs.
            </span>
          </span>
        </>
      ) : (
        <>
          <FlaskConical size={13} className="shrink-0 text-indigo-text" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-indigo-text">Démonstration — données fictives.</strong>{" "}
            <span className="max-xs:hidden">
              Aucun compte réel. Tout se calcule dans votre navigateur : rien n'est envoyé,
              rien n'est enregistré ailleurs.
            </span>
          </span>
        </>
      )}
    </div>
    </section>
  );
}

export const BandeauDemo = memo(BandeauDemoComponent);
