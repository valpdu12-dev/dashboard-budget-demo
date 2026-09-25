// ── Les règles du jeu affiché ────────────────────────────────────────────
//
// Lot C.4. Un seul endroit lit la configuration du store et la transforme en
// règles. Tous les calculs la reçoivent en paramètre — aucun ne va la
// chercher lui-même.

import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { construireRegles, type Regles } from "@/calculs/regles";

export function useRegles(): Regles {
  const config = useDataStore((s) => s.config);
  return useMemo(() => construireRegles(config), [config]);
}
