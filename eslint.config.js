import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/**
 * ESLint 10, configuration « flat ».
 *
 * Mêmes règles qu'avant la migration (ancien `.eslintrc.cjs`, ESLint 8) :
 * les recommandations d'ESLint et de typescript-eslint, les deux règles
 * historiques des hooks React, et react-refresh. Seuls les fichiers
 * TypeScript sont examinés, comme avec l'ancien `--ext ts,tsx`.
 *
 * Les nouvelles règles « React Compiler » de eslint-plugin-react-hooks 7
 * ne sont pas activées ici : les adopter est un chantier à part, pas une
 * mise à jour d'outil.
 */
export default tseslint.config(
  // plan/ est ignoré par git (documents de pilotage, copies d'archive) :
  // il n'existe que sur le poste de travail, jamais dans le dépôt.
  { ignores: ["dist", "plan"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
);
