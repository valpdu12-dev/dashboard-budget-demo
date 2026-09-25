// ── Bandeau « aucun mois comparable » ────────────────────────────────────
//
// Une moyenne mensuelle suppose des mois entiers à comparer. Quand il n'y en
// a aucun, il n'y a pas de moyenne — ni 0 €, ni 100 % de conformité. Ce
// bandeau dit pourquoi, au lieu de laisser des tirets muets sur la page.
//
// Même principe que BandeauDonneesPartielles : ne rend RIEN quand tout va
// bien, pour ne pas devenir un élément de décor qu'on cesse de lire.

import { memo } from "react";
import { CalendarRange } from "lucide-react";
import { useDataStore } from "@/stores/useDataStore";

interface Props {
  /** Mois entièrement couverts ET dans la période affichée. */
  comparableMonths: string[];
  /** Nombre de mois porteurs de transactions, toutes périodes confondues. */
  totalMonths: number;
}

function BandeauMoisNonComparablesComponent({ comparableMonths, totalMonths }: Props) {
  const status = useDataStore((s) => s.status);

  // Pendant le chargement, aucun mois n'est comparable : l'annoncer serait un
  // faux positif systématique.
  if (status !== "success") return null;
  if (comparableMonths.length > 0) return null;

  const raison =
    totalMonths === 0
      ? "Aucune donnée n'est chargée."
      : totalMonths <= 2
        // « que un » est fautif : l'élision se fait sur le mot, pas sur le nombre.
        ? `Les données ne couvrent ${totalMonths === 1 ? "qu'un mois" : "que deux mois"}, et le premier comme le dernier peuvent être incomplets.`
        : "La période affichée ne contient aucun mois entièrement couvert.";

  return (
    <div
      role="status"
      className="flex items-start gap-2 px-3.5 py-2.5 mb-4 bg-amber/[0.08] border border-amber/25 rounded-lg text-[13px] text-amber"
    >
      <CalendarRange size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        Moyennes, écarts et taux de conformité sont indisponibles. {raison}{" "}
        <span className="text-text-sec">
          Le premier et le dernier mois des données sont écartés des moyennes :
          on ignore s'ils sont entiers. Le mois en cours n'y entre donc jamais.
          Il faut au moins trois mois de données pour qu'une moyenne ait un sens.
        </span>
      </span>
    </div>
  );
}

export const BandeauMoisNonComparables = memo(BandeauMoisNonComparablesComponent);
