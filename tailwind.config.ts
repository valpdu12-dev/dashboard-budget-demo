import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
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
      colors: {
        bg:      "#0B0F19",
        surface: "#111827",
        border:  "#1F2937",
        text:    "#E5E7EB",
        // AVANT #6B7280 → 3,03 sur `border`, 3,66 sur `surface`, 3,96 sur `bg`.
        // Les trois échouaient, et ce seul token portait 206 des 237 nœuds en
        // échec, sur les 9 pages. APRÈS #9CA3AF → 5,78 / 6,99 / 7,53.
        // Le minimum vital était #8A919E (4,63 sur le pire fond) ; écarté pour
        // 3 % de marge seulement — tout ajustement futur d'un fond le ferait
        // retomber en rouge.
        "text-sec": "#9CA3AF",
        // Inchangé. `indigo` reste la couleur d'aplat de la marque : la
        // modifier aurait déplacé l'identité visuelle bien au-delà de l'audit.
        indigo:  "#6366F1",
        // Lot 1.6 — `indigo` était en conflit avec lui-même : l'éclaircir
        // corrige le texte indigo sur fond sombre (3,58 / 3,97) mais dégrade le
        // blanc sur aplat indigo (4,46, déjà sous le seuil) ; l'assombrir fait
        // l'inverse. Un seul token ne pouvait pas satisfaire les deux emplois.
        // D'où deux tokens dérivés, `indigo` restant intact pour tout le reste.
        //
        // `indigo-text` — indigo employé COMME TEXTE sur fond sombre.
        // #818CF8 → 5,95 sur `surface`, 5,37 sur le fond de puce #19203B.
        "indigo-text": "#818CF8",
        // `indigo-deep` — aplat indigo portant du TEXTE BLANC.
        // blanc sur #6366F1 = 4,46, sous les 4,5 de 0,04. blanc sur #4F46E5 = 6,29.
        "indigo-deep": "#4F46E5",
        green:   "#10B981",
        red:     "#EF4444",
        amber:   "#F59E0B",
      },
      fontFamily: {
        // Les fontes variables sont embarquées (src/assets/fonts). Les noms
        // non variables restent en repli pour une machine qui les aurait
        // déjà installées, puis la pile système.
        title: ["'DM Sans Variable'", "'DM Sans'", "system-ui", "sans-serif"],
        body:  ["'IBM Plex Sans Variable'", "'IBM Plex Sans'", "system-ui", "sans-serif"],
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
