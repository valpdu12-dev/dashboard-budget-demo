// ── La configuration de la démonstration, pour les tests ─────────────────
//
// Lot C.4. Jusqu'ici, les règles de solde et les listes de types étaient
// écrites dans le code : un test n'avait rien à déclarer, il héritait du
// vocabulaire de l'auteur. Maintenant qu'elles viennent du fichier, un test
// qui veut les vérifier doit les DÉCLARER — et c'est précisément ce qui rend
// la généralisation visible.
//
// ⚠️ Ce fichier LIT la configuration réellement publiée, il ne la recopie
// pas. Une copie aurait dérivé du générateur au premier changement, et les
// tests auraient continué de passer en vérifiant autre chose que ce que la
// démonstration montre.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { construireRegles, type Regles } from "@/calculs/regles";
import type { BudgetConfig } from "@/types/budgetConfig";
import type { Config } from "@/types";

const configDemo: Config = JSON.parse(
  readFileSync(resolve(__dirname, "../../../public/data/config.json"), "utf8")
);

/** La configuration que le jeu de démonstration déclare. */
export const PARAMETRAGE_DEMO: BudgetConfig = configDemo.parametrage!;

/** Les règles qui en découlent. */
export const REGLES_DEMO: Regles = construireRegles(PARAMETRAGE_DEMO);
