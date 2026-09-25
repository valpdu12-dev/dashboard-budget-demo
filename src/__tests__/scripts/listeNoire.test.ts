// Lot G — la liste noire lue hors du dépôt. Ces tests n'utilisent JAMAIS la
// vraie liste : ils fabriquent la leur, avec des noms inventés, pour prouver
// que le chargeur sait échouer.

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lireListeNoire, trouverInterdit, MIN_MOTIFS } from "../../../scripts/listeNoire.mjs";

const vide = () => mkdtempSync(join(tmpdir(), "liste-noire-"));
const liste = (n: number) =>
  Array.from({ length: n }, (_, i) => `/\\bzorglub${i}\\b/i`).join("\n");

const envAvant = process.env.LISTE_NOIRE;
afterEach(() => {
  if (envAvant === undefined) delete process.env.LISTE_NOIRE;
  else process.env.LISTE_NOIRE = envAvant;
});

describe("lireListeNoire", () => {
  it("sans variable ni fichier : aucune liste, et une erreur qui le dit", () => {
    delete process.env.LISTE_NOIRE;
    const r = lireListeNoire(vide());
    expect(r.motifs).toBeNull();
    expect(r.erreurs.join(" ")).toMatch(/introuvable/);
  });

  it("une liste trop courte est déclarée tronquée", () => {
    process.env.LISTE_NOIRE = liste(3);
    const r = lireListeNoire(vide());
    expect(r.motifs).toHaveLength(3);
    expect(r.erreurs.join(" ")).toMatch(/tronquée/);
  });

  it("une ligne mal écrite est signalée, pas ignorée", () => {
    process.env.LISTE_NOIRE = `${liste(MIN_MOTIFS)}\nzorglub-sans-barres`;
    const r = lireListeNoire(vide());
    expect(r.erreurs.join(" ")).toMatch(/format attendu/);
  });

  it("une liste complète se charge sans erreur ; commentaires et lignes vides ignorés", () => {
    process.env.LISTE_NOIRE = `# commentaire\n\n${liste(MIN_MOTIFS)}`;
    const r = lireListeNoire(vide());
    expect(r.erreurs).toEqual([]);
    expect(r.motifs).toHaveLength(MIN_MOTIFS);
    expect(r.origine).toBe("variable LISTE_NOIRE");
  });
});

describe("trouverInterdit", () => {
  const motifs = [/\bzorglub\b/i, /\bgrand\s+frisson\b/i];

  it("trouve un nom, rend sa ligne et le numéro du motif — pas le texte", () => {
    const r = trouverInterdit("ligne un\nchez ZORGLUB ici", motifs);
    expect(r).toEqual({ ligne: 2, numero: 1 });
    expect(JSON.stringify(r)).not.toMatch(/zorglub/i);
  });

  it("respecte les bornes de mot", () => {
    expect(trouverInterdit("zorglubien", motifs)).toBeNull();
    expect(trouverInterdit("un grand   frisson", motifs)).toEqual({ ligne: 1, numero: 2 });
  });
});
