/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    globals: true,
    environment: "jsdom",
    // Fuseau épinglé sur celui de l'utilisation réelle. Le défaut de lecture
    // des dates corrigé le 11/08/2026 (décalage J-1 sur 100 % des lignes) ne
    // se manifeste QUE dans un fuseau à décalage positif : sous TZ=UTC, les
    // trois tests de `parseExcel.worker.test.ts` passaient même avec le code
    // fautif. Sans cette ligne, ils ne sont qu'un décor sur une machine d'CI.
    env: { TZ: "Europe/Paris" },
    // Chemin ABSOLU, volontairement. Avec un chemin relatif ("./vitest.setup.ts"),
    // Vitest passe par une resolution a la Node qui part du dossier PARENT du
    // projet : depuis ce dossier, il chargeait le vitest.setup.ts du projet
    // parent au lieu du notre. Invisible tant que la copie n'est pas imbriquee
    // dans un autre projet ; bloquant ici.
    setupFiles: [path.resolve(__dirname, "vitest.setup.ts")],
    include: ["src/**/__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/hooks/**", "src/components/ui/**"],
    },
  },
});
