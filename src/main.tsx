import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { appliquerTheme, lireChoixTheme, suivreAppareil, suivreAutresOnglets } from "./theme";

// public/theme.js a déjà posé le thème avant l'affichage ; ici on le repose
// (même règle), on suit l'appareil en « Auto » et les choix faits dans un
// autre onglet.
appliquerTheme(lireChoixTheme());
suivreAppareil();
suivreAutresOnglets();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// ── Service Worker — PWA ───────────────────────────────────────────────────
// Enregistrement uniquement en production (le SW n'est pas servi par vite dev)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[SW] Enregistre :", reg.scope))
      .catch((err) => console.warn("[SW] Echec enregistrement :", err));
  });
}
