// -- Router centralise (remplace le switch/case de V1 App.jsx) -----------
// Phase 6.1 -- Lazy loading : chaque page est chargee a la demande.
// Phase 5A -- Routes imbriquées par type de flux + sous-navigation (pills).
// Le fallback <SkeletonPage> s'affiche pendant le chargement du chunk.
import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { useDataStore } from "@/stores/useDataStore";
import { useRubriques } from "@/hooks/useRubriques";

const Comptes          = lazy(() => import("@/pages/Comptes"));
const Depenses         = lazy(() => import("@/pages/Depenses"));
const BudgetMensuel    = lazy(() => import("@/pages/BudgetMensuel"));
const Recettes         = lazy(() => import("@/pages/Recettes"));
const Salaire          = lazy(() => import("@/pages/Salaire"));
const SalaireInflation = lazy(() => import("@/pages/SalaireInflation"));
const Epargne          = lazy(() => import("@/pages/Epargne"));
const PretImmobilier   = lazy(() => import("@/pages/PretImmobilier"));
const Insights         = lazy(() => import("@/pages/Insights"));
const Parametres       = lazy(() => import("@/pages/Parametres"));

/**
 * Route conditionnelle — lot B.4.
 *
 * Retirer une pill de la sous-navigation ne suffit pas : l'adresse directe
 * reste tapable, et un marque-page la rouvre. Une page Salaire sans paie
 * afficherait des graphiques vides ; une page Prêt sans prêt afficherait un
 * échéancier calculé sur des constantes de repli, c'est-à-dire un prêt
 * inventé présenté comme celui de la personne.
 *
 * ⚠️ La redirection n'a lieu qu'une fois les données CHARGÉES. Rediriger
 * pendant le chargement renverrait à l'accueil toute ouverture directe d'une
 * adresse profonde — le jeu n'est pas encore là, donc la rubrique paraît
 * absente. Le défaut serait intermittent, donc invisible en test rapide.
 */
export function RouteSiRubrique({
  rubrique,
  versSi,
  children,
}: {
  rubrique: "paie" | "pret" | "epargne";
  /**
   * Où aller quand la rubrique manque, si ce n'est pas l'accueil.
   *
   * ⚠️ Lot C.5. `/patrimoine` est la page d'accueil de son onglet. Sans
   * épargne, elle renvoyait à `/` — et quelqu'un qui a un prêt mais pas
   * d'épargne voyait l'onglet Patrimoine le ramener à l'accueil à chaque
   * clic, sans un mot. Il est désormais conduit à l'écran qui, lui, a
   * quelque chose à montrer.
   */
  versSi?: { rubrique: "paie" | "pret" | "epargne"; chemin: string };
  children: ReactNode;
}) {
  const status = useDataStore((s) => s.status);
  const rubriques = useRubriques();

  if (status === "success" && !rubriques[rubrique]) {
    const repli = versSi && rubriques[versSi.rubrique] ? versSi.chemin : "/";
    return <Navigate to={repli} replace />;
  }
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Comptes />} />

          {/* Dépenses : sorties + plafonds */}
          <Route path="depenses"        element={<Depenses />} />
          <Route path="depenses/budget" element={<BudgetMensuel />} />

          {/* Revenus : recettes + salaire + pouvoir d'achat */}
          <Route path="revenus"           element={<Recettes />} />
          <Route
            path="revenus/salaire"
            element={<RouteSiRubrique rubrique="paie"><Salaire /></RouteSiRubrique>}
          />
          <Route
            path="revenus/inflation"
            element={<RouteSiRubrique rubrique="paie"><SalaireInflation /></RouteSiRubrique>}
          />

          {/* Patrimoine : épargne + prêt */}
          <Route
            path="patrimoine"
            element={
              <RouteSiRubrique
                rubrique="epargne"
                versSi={{ rubrique: "pret", chemin: "/patrimoine/pret" }}
              >
                <Epargne />
              </RouteSiRubrique>
            }
          />
          <Route
            path="patrimoine/pret"
            element={<RouteSiRubrique rubrique="pret"><PretImmobilier /></RouteSiRubrique>}
          />

          <Route path="insights" element={<Insights />} />

          {/* Lot C.2 — ce que l'outil a lu dans le fichier source. Hors
              navigation principale : ce n'est pas un écran de chiffres, c'est
              un écran de vérification. Il s'atteint depuis l'en-tête. */}
          <Route path="parametres" element={<Parametres />} />
          <Route path="*"        element={<Comptes />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
