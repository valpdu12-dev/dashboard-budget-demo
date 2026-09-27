// -- Router centralise (remplace le switch/case de V1 App.jsx) -----------
// Phase 6.1 -- Lazy loading : chaque page est chargee a la demande.
// Phase 5A -- Routes imbriquées par type de flux + sous-navigation (pills).
// Le fallback <SkeletonPage> s'affiche pendant le chargement du chunk.
import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
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

/**
 * Lot D.4 — une adresse inconnue affichait l'écran Comptes sans un mot,
 * l'adresse fausse restant dans la barre. Un marque-page erroné passait pour
 * juste. Désormais : on le dit, et on propose le retour.
 */
export function PageIntrouvable() {
  const { pathname } = useLocation();
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-title font-bold text-text">Page introuvable</h1>
      <p className="text-text-sec mt-2">
        L'adresse « {pathname} » ne correspond à aucun écran du tableau de bord.
      </p>
      <Link
        to="/"
        className="inline-block mt-4 px-3.5 py-2 rounded-lg border border-indigo/40 bg-indigo/[0.08] text-indigo-text text-[13px] font-medium hover:bg-indigo/[0.15] transition-colors"
      >
        Revenir à l'accueil
      </Link>
    </div>
  );
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
          <Route path="*"        element={<PageIntrouvable />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
