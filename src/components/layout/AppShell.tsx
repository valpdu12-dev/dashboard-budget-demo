// -- AppShell : layout principal (Header + Sidebar/BottomNav + contenu) --
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { BandeauDemo } from "@/components/ui/BandeauDemo";
import { BandeauStockage } from "@/components/ui/BandeauStockage";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { SubNav } from "./SubNav";
import { DataUploader } from "@/components/upload/DataUploader";
import { useResponsive } from "@/hooks/useResponsive";

export function AppShell() {
  const { isMobile } = useResponsive();

  return (
    <div className="flex flex-col h-screen bg-bg">
      {/* En premier, avant l'en-tête : la nature du site se lit avant son
          contenu, pas après l'avoir parcouru. */}
      <BandeauDemo />
      {/* Lot C.6 — ce que la relecture du stockage a à dire. Avant l'en-tête,
          pour la même raison que le bandeau de démonstration : on apprend ce
          qu'on regarde avant de le regarder, pas après. */}
      <BandeauStockage />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {!isMobile && <Sidebar />}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {/* Sous-navigation contextuelle (pills) — rendue seulement si
              l'onglet courant a des pills ; visible desktop et mobile */}
          <SubNav />
          {/* pb-nav-safe remplace pb-20 : même marge qu'avant, plus le
              retrait de la barre de gestes Android (0 sur PC). */}
          <div className={isMobile ? "px-3 py-4 pb-nav-safe" : "p-6"}>
            <Outlet />
          </div>
        </main>
      </div>
      {isMobile && <BottomNav />}
      {/* Modal upload (portail global, rendu conditionnel via useUIStore) */}
      <DataUploader />
    </div>
  );
}
