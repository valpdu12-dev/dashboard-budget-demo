import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Configuration Vite — démonstration STATIQUE.
 *
 * Il n'y a plus de proxy de développement vers `/api`. L'application ne fait
 * plus aucun appel serveur : tout vient de `public/data/`. Garder le proxy
 * aurait entretenu l'illusion d'un back-end qui n'existe pas dans ce dépôt,
 * et laissé traîner un jeton d'authentification dans la configuration.
 *
 * Aucune variable d'environnement n'est lue ici, donc aucun fichier `.env`
 * n'est nécessaire pour développer ou construire.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // NB : xlsx retiré de manualChunks car importé dans le Web Worker
        // (le worker a son propre bundle, pas de partage de chunks)
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
