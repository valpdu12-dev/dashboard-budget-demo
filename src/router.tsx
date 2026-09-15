// -- Router centralise (remplace le switch/case de V1 App.jsx) -----------
// Phase 6.1 -- Lazy loading : chaque page est chargee a la demande.
// Phase 5A -- Routes imbriquées par type de flux + sous-navigation (pills).
// Le fallback <SkeletonPage> s'affiche pendant le chargement du chunk.
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { SkeletonPage } from "@/components/ui/Skeleton";

const Comptes          = lazy(() => import("@/pages/Comptes"));
const Depenses         = lazy(() => import("@/pages/Depenses"));
const BudgetMensuel    = lazy(() => import("@/pages/BudgetMensuel"));
const Recettes         = lazy(() => import("@/pages/Recettes"));
const Salaire          = lazy(() => import("@/pages/Salaire"));
const SalaireInflation = lazy(() => import("@/pages/SalaireInflation"));
const Epargne          = lazy(() => import("@/pages/Epargne"));
const PretImmobilier   = lazy(() => import("@/pages/PretImmobilier"));
const Insights         = lazy(() => import("@/pages/Insights"));

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
          <Route path="revenus/salaire"   element={<Salaire />} />
          <Route path="revenus/inflation" element={<SalaireInflation />} />

          {/* Patrimoine : épargne + prêt */}
          <Route path="patrimoine"      element={<Epargne />} />
          <Route path="patrimoine/pret" element={<PretImmobilier />} />

          <Route path="insights" element={<Insights />} />
          <Route path="*"        element={<Comptes />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
