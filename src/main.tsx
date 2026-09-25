import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

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
