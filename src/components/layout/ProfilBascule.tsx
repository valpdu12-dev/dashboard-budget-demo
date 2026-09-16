// ── Indicateur de profil : Démo / Mes données ────────────────────────────
//
// Lot B.6. Avant, rien dans l'en-tête ne disait de QUI étaient les chiffres
// affichés : il fallait ouvrir la fenêtre d'import pour l'apprendre. Un
// tableau de bord qui ne dit pas quelles données il montre est un piège, et
// c'était le même défaut, encore, qu'aux étapes précédentes.
//
// La pastille dit ce qui est affiché, et bascule vers l'autre profil. Elle
// n'efface jamais rien — l'effacement vit dans la fenêtre d'import, avec sa
// confirmation.

import { useCallback, useEffect, useState } from "react";
import { FlaskConical, UserRound } from "lucide-react";
import { useDataStore } from "@/stores/useDataStore";
import { afficherDemo, afficherMesDonnees } from "@/services/basculeProfil";
import { jeuPersonnelDisponible } from "@/services/profil";
import { useResponsive } from "@/hooks/useResponsive";

export function ProfilBascule() {
  const origin = useDataStore((s) => s.origin);
  const status = useDataStore((s) => s.status);
  const { isSmall } = useResponsive();

  // La présence d'un jeu mémorisé se lit dans le stockage, qui ne prévient
  // personne quand il change. On la relit à chaque fois que le jeu affiché
  // bouge — c'est le seul moment où elle peut avoir changé.
  const [personnelDispo, setPersonnelDispo] = useState(false);
  useEffect(() => {
    setPersonnelDispo(jeuPersonnelDisponible());
  }, [origin, status]);

  const mesDonnees = origin === "upload";
  const [enCours, setEnCours] = useState(false);

  const basculer = useCallback(() => {
    setEnCours(true);
    const action = mesDonnees ? afficherDemo() : afficherMesDonnees();
    void action.finally(() => setEnCours(false));
  }, [mesDonnees]);

  // Rien d'importé, rien de mémorisé : il n'y a pas de choix à offrir. Sur
  // petit écran la pastille disparaît alors complètement — la première ligne
  // de l'en-tête porte déjà le titre, les filtres et le bouton d'import.
  if (!mesDonnees && !personnelDispo) {
    if (isSmall) return null;
    return (
      <span
        title="Aucun fichier importé sur cet appareil"
        className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-lg border border-border bg-border/30 text-[13px] font-medium text-text-sec"
      >
        <FlaskConical size={15} />
        Démo
      </span>
    );
  }

  return (
    <button
      onClick={basculer}
      disabled={enCours}
      aria-label={
        mesDonnees
          ? "Données affichées : les vôtres. Revenir à la démonstration"
          : "Données affichées : la démonstration. Afficher mes données"
      }
      title={
        mesDonnees
          ? "Cliquez pour revenir à la démonstration — rien n'est effacé"
          : "Cliquez pour réafficher le fichier importé sur cet appareil"
      }
      className={`inline-flex items-center gap-1.5 px-3 py-[7px] max-md:min-h-tap rounded-lg border text-[13px] font-medium transition-all disabled:opacity-60 ${
        mesDonnees
          ? "border-green/30 bg-green/10 text-green"
          : "border-border bg-border/30 text-text-sec hover:text-text"
      }`}
    >
      {mesDonnees ? <UserRound size={15} /> : <FlaskConical size={15} />}
      {mesDonnees ? "Mes données" : "Démo"}
    </button>
  );
}
