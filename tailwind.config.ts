import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Lot 1.1 — palier « petit mobile ». 430 px et non 400 : le Samsung
      // A56 fait 412 px de large, un seuil à 400 px ratait la cible.
      // `xs:` = ≥ 430 px, `max-xs:` = < 430 px. Aucun impact sur `sm`/`md`/`lg`.
      screens: {
        xs: "430px",
      },
      spacing: {
        // Retrait bas imposé par la barre de gestes Android / l'encoche iOS.
        // Vaut 0 partout ailleurs — donc sans effet sur le rendu PC.
        "safe-b": "env(safe-area-inset-bottom, 0px)",
        // Padding bas du contenu : reprend le `pb-20` (5rem) d'avant le lot
        // 1.1 — la BottomNav mesure ~54 px, le reste est de la marge — et y
        // ajoute le retrait système. Sans cet ajout, le bas de page passait
        // sous la barre de gestes.
        "nav-safe": "calc(5rem + env(safe-area-inset-bottom, 0px))",
      },
      // Cible tactile minimale (WCAG 2.2 AA « Target Size » = 24 px,
      // recommandation Material / HIG = 48 px). Appliquée en `max-md:` seulement.
      minHeight: {
        tap: "48px",
      },
      minWidth: {
        tap: "48px",
      },
      // Lot 1.6 — accessibilité. Trois valeurs changent ici, et c'est le SEUL
      // endroit du lot qui modifie le rendu PC. La règle « rendu PC strictement
      // inchangé » des lots 1.1-1.5 a été levée explicitement pour ce lot, et
      // pour ce seul fichier : `color-contrast` n'est pas un défaut mobile, les
      // mêmes couples échouent à l'identique sur PC. Corriger sous `max-*`
      // aurait donné deux gris selon la largeur d'écran et laissé l'audit
      // desktop rouge sur les mêmes 206 nœuds.
      //
      // Ratios mesurés par Lighthouse/axe-core le 04/08 (seuil AA = 4,5:1 —
      // aucun de ces textes n'est « large » au sens WCAG : 18px/bold reste
      // sous les 14pt gras = 18,66px).
      // Chaque couleur passe par une variable CSS (src/index.css) : Jour ou
      // Nuit selon data-theme. `<alpha-value>` garde les opacités (`bg-indigo/20`).
      // `indigo` = l'accent (aplat) ; `indigo-text` = l'accent EN TEXTE ;
      // `indigo-deep` = aplat qui porte du texte blanc.
      colors: {
        bg:      "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        border:  "rgb(var(--c-border) / <alpha-value>)",
        text:    "rgb(var(--c-text) / <alpha-value>)",
        "text-sec": "rgb(var(--c-text-sec) / <alpha-value>)",
        indigo:  "rgb(var(--c-indigo) / <alpha-value>)",
        "indigo-text": "rgb(var(--c-indigo-text) / <alpha-value>)",
        "indigo-deep": "rgb(var(--c-indigo-deep) / <alpha-value>)",
        green:   "rgb(var(--c-green) / <alpha-value>)",
        red:     "rgb(var(--c-red) / <alpha-value>)",
        amber:   "rgb(var(--c-amber) / <alpha-value>)",
        "accent-doux": "rgb(var(--c-accent-doux) / <alpha-value>)",
        "surface-2":   "rgb(var(--c-surface-2) / <alpha-value>)",
      },
      // Polices par une variable (src/index.css) : Inter, servie par le site.
      fontFamily: {
        title: ["var(--f-title)"],
        body:  ["var(--f-body)"],
      },
      animation: {
        "fade-slide": "fadeSlideIn 0.4s ease-out both",
        "scale-in":   "scaleIn 0.35s ease-out both",
        "pulse-bar":  "pulse 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeSlideIn: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%":   { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      transitionDuration: {
        "400": "400ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
