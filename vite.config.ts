import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { CSP_META, fichierEnTetes } from "./src/config/csp";

/**
 * Sécurité de la page publiée — lot B.7.
 *
 * Deux sorties, une seule source (`src/config/csp.ts`) :
 *   • la balise `<meta http-equiv="Content-Security-Policy">` dans le HTML,
 *     qui protège aussi `npm run preview` et n'importe quel hébergeur ;
 *   • le fichier `_headers`, que Cloudflare Pages sert en en-tête HTTP —
 *     seule forme où `frame-ancestors` est prise en compte.
 *
 * `apply: "build"` est essentiel : en développement, Vite injecte ses propres
 * scripts en ligne (rafraîchissement React), qu'une politique stricte
 * bloquerait. Le serveur de développement resterait blanc.
 */
function securitePublication(): Plugin {
  return {
    name: "securite-publication",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP_META}" />`
      );
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: fichierEnTetes() });
    },
  };
}

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
  plugins: [react(), securitePublication()],
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
