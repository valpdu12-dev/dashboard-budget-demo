// @vitest-environment node
// À toutes les largeurs, les couleurs Jour / Nuit (--ds-*) et Inter. Jour = :root ;
// Nuit = :root[data-theme="nuit"] ; aucune couleur réservée à une largeur.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const JOUR: Record<string, string> = {
  "--c-bg": "#f6f5f2", "--c-surface": "#ffffff", "--c-border": "#e4e1da", "--c-text": "#17181b",
  "--c-text-sec": "#5f646d", "--c-indigo": "#0f766e", "--c-indigo-text": "#115e59", "--c-indigo-deep": "#0f766e",
  "--c-green": "#166534", "--c-red": "#b42318", "--c-amber": "#92400e", "--c-accent-doux": "#e1f1ee", "--c-surface-2": "#f1efea",
};
const NUIT: Record<string, string> = {
  "--c-bg": "#0b0c0f", "--c-surface": "#131519", "--c-border": "#23262e", "--c-text": "#f2f3f5",
  "--c-text-sec": "#8d929c", "--c-indigo": "#2dd4bf", "--c-indigo-text": "#2dd4bf", "--c-indigo-deep": "#0f766e",
  "--c-green": "#7ee2b8", "--c-red": "#f4a3b4", "--c-amber": "#f2c48d", "--c-accent-doux": "#16292a", "--c-surface-2": "#1a1d23",
};

const css = readFileSync(fileURLToPath(new URL("../../index.css", import.meta.url)), "utf8");
const blocJour = /^:root\s*\{([\s\S]*?)^\}/m.exec(css)?.[1] ?? "";
const blocNuit = /^:root\[data-theme="nuit"\]\s*\{([\s\S]*?)^\}/m.exec(css)?.[1] ?? "";

function hexVersRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

describe("couleurs du thème (toutes largeurs)", () => {
  it("les blocs Jour et Nuit existent, hors de tout @media", () => {
    expect(blocJour).toContain("--c-bg");
    expect(blocNuit).toContain("--c-bg");
    for (const bloc of [blocJour, blocNuit]) expect(css.slice(0, css.indexOf(bloc)).lastIndexOf("@media")).toBeLessThan(0);
  });

  it("aucune variable de couleur dans un @media de largeur (même couleur à toutes les largeurs)", () => {
    for (const m of css.matchAll(/@media([^{]*)\{([\s\S]*?)\n\}/g)) {
      if (m[1].includes("prefers-color-scheme")) continue; // le repli, testé à part
      expect(m[2]).not.toMatch(/--c-[a-z-]+\s*:/);
    }
  });

  it("repli si theme.js n'a pas tourné (appareil sombre, pas de data-theme) = EXACTEMENT le bloc Nuit", () => {
    const repli = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme\]\)\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
    const valeurs = (bloc: string) => Array.from(bloc.matchAll(/(--c-[a-z0-9-]+|color-scheme):\s*([^;]+);/g)).map((m) => `${m[1]}=${m[2].trim()}`);
    expect(valeurs(repli).length).toBeGreaterThan(10);
    expect(valeurs(repli)).toEqual(valeurs(blocNuit));
  });

  it("cartes : ombre douce en Jour, aucune en Nuit ; color-scheme suit le thème", () => {
    expect(css).toMatch(/\.card\s*\{[\s\S]*?border-radius:\s*20px;[\s\S]*?box-shadow:\s*0 1px 2px/);
    expect(css).toMatch(/:root\[data-theme="nuit"\] \.card\s*\{\s*box-shadow:\s*none;\s*\}/);
    expect(blocJour).toMatch(/color-scheme:\s*light;/);
    expect(blocNuit).toMatch(/color-scheme:\s*dark;/);
  });

  it("plus que la police Inter (DM Sans et IBM Plex retirées)", () => {
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sansCommentaires).not.toMatch(/DM Sans|IBM Plex|dm-sans|ibm-plex/);
    expect(Array.from(css.matchAll(/font-family:\s*"([^"]+)"/g)).every((m) => m[1] === "Inter Variable")).toBe(true);
  });

  for (const [variable, hex] of Object.entries(JOUR)) {
    it(`Jour ${variable} = ${hex}`, () => {
      expect(new RegExp(`${variable}:\\s*([0-9 ]+);`).exec(blocJour)?.[1].trim()).toBe(hexVersRgb(hex));
    });
  }
  for (const [variable, hex] of Object.entries(NUIT)) {
    it(`Nuit ${variable} = ${hex}`, () => {
      expect(new RegExp(`${variable}:\\s*([0-9 ]+);`).exec(blocNuit)?.[1].trim()).toBe(hexVersRgb(hex));
    });
  }

  it("Inter partout (titres et texte)", () => {
    expect(blocJour).toMatch(/--f-title:\s*"Inter Variable"/);
    expect(blocJour).toMatch(/--f-body:\s*"Inter Variable"/);
  });

  it("les règles des graphiques (grille, axes, légendes) valent à toutes les largeurs", () => {
    const i = css.indexOf('.recharts-wrapper [stroke="#1F2937" i]');
    expect(i).toBeGreaterThan(0);
    const avant = css.slice(0, i);
    expect(avant.lastIndexOf("@media")).toBeLessThan(avant.lastIndexOf("Les graphiques au thème"));
  });
});
