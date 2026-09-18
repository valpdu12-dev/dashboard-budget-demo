// ── Les onglets que le jeu rend légitimes ────────────────────────────────
//
// Lot C.5. Un onglet dont AUCUNE rubrique n'existe n'ouvre qu'une page qui
// renvoie aussitôt à l'accueil. Il disparaît donc — pas grisé, pas vide :
// absent. C'est la règle du lot B.4, appliquée un cran plus haut.

import { useMemo } from "react";
import { NAV_TABS } from "@/config/constants";
import { useRubriques } from "@/hooks/useRubriques";

export function useOngletsVisibles(): typeof NAV_TABS[number][] {
  const rubriques = useRubriques();
  return useMemo(
    () =>
      NAV_TABS.filter(
        (t) => !("rubriques" in t) || t.rubriques.some((r) => rubriques[r])
      ),
    [rubriques]
  );
}
