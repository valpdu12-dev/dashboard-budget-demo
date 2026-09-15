// ── App.tsx V3 — Point d'entrée ──────────────────────────────────────────
// La cascade de sources vit dans `services/loadDashboardData` : elle doit
// pouvoir être rejouée depuis `DataUploader` quand l'utilisateur revient aux
// données du serveur (point ouvert n° 27).

import { useEffect } from "react";
import { AppRouter } from "./router";
import { loadDashboardData } from "@/services/loadDashboardData";

export default function App() {
  // Chargement initial : fichiers du site (/data/*.json). Pas d'API.
  useEffect(() => {
    void loadDashboardData();
  }, []);

  return <AppRouter />;
}
