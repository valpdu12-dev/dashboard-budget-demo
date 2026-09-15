// -- Bandeau « donnees partielles » ---------------------------------------
// Une page declare ce dont elle a besoin ; si quelque chose manque, elle le
// dit au lieu d'afficher des tirets sans explication (point ouvert n° 14).
//
// Ne rend RIEN quand tout est present : le bandeau ne doit jamais devenir un
// element de decor qu'on cesse de lire.

import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import { useDataStore } from "@/stores/useDataStore";
import {
  detecterManques, fmtManques, type BesoinDonnees,
} from "@/utils/dataCompleteness";

interface Props {
  /** Donnees necessaires pour que la page soit complete. */
  besoins: BesoinDonnees[];
}

function BandeauDonneesPartiellesComponent({ besoins }: Props) {
  const { salary, budgets, status } = useDataStore();

  // Pendant le chargement, tout est « manquant » : annoncer un manque a cet
  // instant serait un faux positif systematique.
  if (status !== "success") return null;

  const manques = detecterManques(besoins, { salary, budgets });
  if (manques.length === 0) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 px-3.5 py-2.5 mb-4 bg-amber/[0.08] border border-amber/25 rounded-lg text-[13px] text-amber"
    >
      <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        {fmtManques(manques)}{" "}
        <span className="text-text-sec">
          Ces donnees viennent du serveur et sont absentes du fichier de secours
          utilise hors connexion. Les autres chiffres de la page restent justes.
        </span>
      </span>
    </div>
  );
}

export const BandeauDonneesPartielles = memo(BandeauDonneesPartiellesComponent);
