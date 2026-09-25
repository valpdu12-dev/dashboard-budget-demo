import { describe, it, expect } from "vitest";
import { CSP_META, CSP_ENTETE, EN_TETES, fichierEnTetes } from "@/config/csp";

/**
 * Politique de sécurité du contenu — lot B.7.
 *
 * L'application affiche « vos données ne quittent jamais votre navigateur ».
 * `connect-src 'self'` est ce qui transforme cette phrase en règle appliquée
 * par le navigateur. Ces tests verrouillent ce qui la viderait de son sens.
 */

/** Découpe une politique en dictionnaire directive → valeur. */
function directives(politique: string): Record<string, string> {
  const table: Record<string, string> = {};
  for (const bout of politique.split(";")) {
    const [nom, ...valeur] = bout.trim().split(/\s+/);
    if (nom) table[nom] = valeur.join(" ");
  }
  return table;
}

describe("politique de sécurité du contenu", () => {
  it("n'autorise aucune destination extérieure", () => {
    expect(directives(CSP_META)["connect-src"]).toBe("'self'");
    expect(directives(CSP_ENTETE)["connect-src"]).toBe("'self'");
  });

  it("n'autorise ni script en ligne ni eval", () => {
    for (const politique of [CSP_META, CSP_ENTETE]) {
      expect(directives(politique)["script-src"]).toBe("'self'");
      expect(politique).not.toContain("unsafe-eval");
    }
  });

  it("ne relâche `unsafe-inline` que sur les styles", () => {
    // Recharts pose ses dimensions en attribut `style`. Un style en ligne
    // n'exécute pas de code ; c'est le seul relâchement, et il est nommé.
    for (const [nom, valeur] of Object.entries(directives(CSP_ENTETE))) {
      if (nom === "style-src") continue;
      expect(valeur).not.toContain("unsafe-inline");
    }
    expect(directives(CSP_ENTETE)["style-src"]).toContain("'unsafe-inline'");
  });

  it("ferme ce qui n'a aucun usage ici", () => {
    const d = directives(CSP_ENTETE);
    expect(d["object-src"]).toBe("'none'");
    expect(d["frame-src"]).toBe("'none'");
    expect(d["form-action"]).toBe("'none'");
    expect(d["base-uri"]).toBe("'self'");
  });

  it("laisse le worker de lecture des classeurs fonctionner", () => {
    // Sans cette directive, l'import entier tombe : c'est le worker qui lit
    // le fichier. Le risque annoncé du lot B.7, verrouillé par un test.
    expect(directives(CSP_ENTETE)["worker-src"]).toBe("'self'");
  });

  it("réserve `frame-ancestors` à l'en-tête HTTP", () => {
    // Le navigateur IGNORE cette directive dans une balise <meta> et le dit
    // dans la console. La poser là ne protégerait de rien et ferait du bruit.
    expect(CSP_META).not.toContain("frame-ancestors");
    expect(CSP_ENTETE).toContain("frame-ancestors 'none'");
  });

  it("dit exactement la même chose dans les deux sorties", () => {
    const meta = directives(CSP_META);
    const entete = directives(CSP_ENTETE);
    delete entete["frame-ancestors"];
    expect(entete).toEqual(meta);
  });
});

describe("fichier _headers", () => {
  it("s'applique à toutes les adresses du site", () => {
    expect(fichierEnTetes().startsWith("/*\n")).toBe(true);
  });

  it("porte chaque en-tête, indenté, un par ligne", () => {
    const lignes = fichierEnTetes().trim().split("\n").slice(1);
    expect(lignes).toHaveLength(Object.keys(EN_TETES).length);
    for (const ligne of lignes) {
      expect(ligne.startsWith("  ")).toBe(true);
      expect(ligne).toContain(": ");
    }
  });

  it("interdit l'encadrement du site dans une page tierce", () => {
    const contenu = fichierEnTetes();
    expect(contenu).toContain("X-Frame-Options: DENY");
    expect(contenu).toContain("frame-ancestors 'none'");
  });

  it("empêche le navigateur de deviner les types de contenu", () => {
    expect(fichierEnTetes()).toContain("X-Content-Type-Options: nosniff");
  });
});
