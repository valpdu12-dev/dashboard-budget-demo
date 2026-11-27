// @vitest-environment node
// En Jour, sur fond blanc, les TEXTES des graphiques
// écrits en couleur doivent rester lisibles. axe ne voit pas ces textes SVG :
// ce test lit les pages. Règle : un texte de graphique (Label, label={{…}},
// tick) prend soit une couleur passée par `contraste(…)` (useApparence), soit
// un gris que src/index.css remplace par la couleur du thème.
// Plus : l'interrupteur de Soldes et les zones de tableau qui défilent.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assombrirPourContraste, contrastRatio, ensureContrast } from "@/utils/contrast";
import { DONUT_COLORS } from "@/config/colors";

const DOSSIER = fileURLToPath(new URL("../../pages/", import.meta.url));
const PAGES = readdirSync(DOSSIER).filter((f) => f.endsWith(".tsx")).map((f) => [f, readFileSync(DOSSIER + f, "utf8")] as const);
const CSS = readFileSync(fileURLToPath(new URL("../../index.css", import.meta.url)), "utf8");
// Gris remplacés par le thème (règles .recharts-wrapper [fill="…" i] de index.css).
const GRIS_DU_THEME = Array.from(CSS.matchAll(/\.recharts-wrapper \[fill="(#[0-9A-Fa-f]{6})" i\]/g)).map((m) => m[1].toUpperCase());

function couleurAcceptee(valeur: string): boolean {
  const v = valeur.trim();
  if (/contraste\(/.test(v)) return true;
  const hex = /^["'](#[0-9A-Fa-f]{6})["']$/.exec(v)?.[1];
  return !!hex && GRIS_DU_THEME.includes(hex.toUpperCase());
}

describe("textes colorés des graphiques (Jour et Nuit)", () => {
  it("les gris remplacés par le thème sont bien connus", () => {
    expect(GRIS_DU_THEME).toEqual(expect.arrayContaining(["#6B7280", "#9CA3AF", "#F3F4F6"]));
  });

  for (const [nom, src] of PAGES) {
    it(`${nom} : chaque texte de graphique en couleur passe par contraste() ou un gris du thème`, () => {
      const fautifs: string[] = [];
      for (const m of src.matchAll(/<Label\b[^>]*?\bfill=(\{[^}]*\}|"[^"]*")/g)) {
        const v = m[1].startsWith("{") ? m[1].slice(1, -1) : `"${m[1].slice(1, -1)}"`;
        if (!couleurAcceptee(v)) fautifs.push(`<Label fill=${m[1]}>`);
      }
      for (const m of src.matchAll(/\blabel=\{\{([\s\S]*?)\}\}/g)) {
        const f = /\bfill:\s*([^,\n}]+)/.exec(m[1]);
        if (f && !couleurAcceptee(f[1])) fautifs.push(`label fill: ${f[1].trim()}`);
      }
      for (const m of src.matchAll(/\btick=\{[^}]*?\bfill:\s*([^,\n}]+)/g)) {
        if (!couleurAcceptee(m[1])) fautifs.push(`tick fill: ${m[1].trim()}`);
      }
      expect(fautifs).toEqual([]);
    });
  }

  it("les couleurs d'employeur, une fois relevées, font au moins 4,5:1 en Jour et en Nuit", () => {
    for (const c of [...DONUT_COLORS, "#6B7280", "#ef4444"]) {
      expect(contrastRatio(assombrirPourContraste(c, "#ffffff"), "#ffffff")!).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ensureContrast(c, "#131519"), "#131519")!).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("interrupteur « Inclure l'immobilier » (Soldes)", () => {
  const src = PAGES.find(([n]) => n === "PatrimoineSoldes.tsx")![1];
  it("rail plein : aplat foncé de l'accent allumé, gris doux éteint (plus de gris à 40 %)", () => {
    expect(src).toContain('inclureImmobilier ? "bg-indigo-deep border-indigo-deep" : "bg-text-sec border-text-sec"');
    expect(src).not.toContain("bg-text-sec/40");
  });
  it("au moins 3:1 contre la carte et contre le rond blanc, en Jour et en Nuit", () => {
    // [rail, carte] : allumé #0f766e (les deux thèmes), éteint #5f646d (Jour) / #8d929c (Nuit).
    const cas: [string, string][] = [["#0f766e", "#ffffff"], ["#0f766e", "#131519"], ["#5f646d", "#ffffff"], ["#8d929c", "#131519"]];
    for (const [rail, carte] of cas) {
      expect(contrastRatio(rail, carte)!).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(rail, "#ffffff")!).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("zones de tableau qui défilent : atteignables au clavier", () => {
  for (const [nom, attendu] of [["BudgetMensuel.tsx", "Budget par catégorie (défilement horizontal)"], ["SalaireInflation.tsx", "Synthèse annuelle (défilement horizontal)"]] as const) {
    it(`${nom} : tabIndex 0, role region, nom`, () => {
      const src = PAGES.find(([n]) => n === nom)![1];
      const i = src.indexOf(attendu);
      expect(i).toBeGreaterThan(0);
      const autour = src.slice(Math.max(0, i - 400), i + 50);
      expect(autour).toMatch(/tabIndex(: 0|=\{0\})/);
      expect(autour).toMatch(/role(: "region"|="region")/);
    });
  }
});
