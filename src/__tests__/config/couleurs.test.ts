// Lot A.2 — l'application doit encaisser plus de comptes, d'organismes et
// d'employeurs que le jeu de démonstration n'en contient.
//
// Avant ce lot, trois pages cherchaient une couleur par accès direct à une
// table : `ORG_COLORS[org]`, `COMPTE_COLORS[compte]`, `ENT_COLORS[ent]`.
// Au-delà des valeurs connues, la valeur rendue était `undefined` — trait de
// graphique invisible, pastille transparente — sans erreur ni avertissement.
// Personne ne l'avait vu parce que le jeu réel contenait exactement les
// valeurs des tables.
//
// Ces tests verrouillent le repli.

import { describe, it, expect } from "vitest";
import {
  couleurStable,
  couleurCompte,
  couleurOrganisme,
  couleurEmployeur,
  couleurEpargne,
  DONUT_COLORS,
} from "@/config/colors";
import { COMPTES, COMPTE_LIBELLES, ORGANISMES_UTILISES } from "@/config/accounts";

const estCouleur = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

describe("couleurStable", () => {
  it("rend toujours une couleur de la palette", () => {
    for (const nom of ["", "a", "Banque Z", "Un nom très long avec des accents éàü"]) {
      expect(DONUT_COLORS).toContain(couleurStable(nom));
    }
  });

  it("rend la MÊME couleur pour le même nom", () => {
    expect(couleurStable("Employeur Q")).toBe(couleurStable("Employeur Q"));
  });

  it("ne renvoie jamais undefined, quel que soit le nom", () => {
    for (let i = 0; i < 500; i++) {
      expect(estCouleur(couleurStable(`nom-${i}`))).toBe(true);
    }
  });
});

describe("6 organismes", () => {
  const six = ["Banque A", "Banque B", "Banque C", "Banque D", "Banque E", "Titres-restaurant"];

  it("chacun reçoit une couleur définie", () => {
    for (const org of six) {
      expect(estCouleur(couleurOrganisme(org))).toBe(true);
    }
  });

  it("les organismes du jeu de démonstration gardent leur couleur dédiée", () => {
    for (const org of ORGANISMES_UTILISES) {
      expect(estCouleur(couleurOrganisme(org))).toBe(true);
    }
  });
});

describe("30 employeurs", () => {
  const trente = Array.from({ length: 30 }, (_, i) => `Employeur ${i + 1}`);

  it("chacun reçoit une couleur définie", () => {
    for (const ent of trente) {
      expect(estCouleur(couleurEmployeur(ent))).toBe(true);
    }
  });

  it("deux employeurs différents ne partagent pas systématiquement la couleur", () => {
    const distinctes = new Set(trente.map(couleurEmployeur));
    expect(distinctes.size).toBeGreaterThan(5);
  });
});

describe("comptes et supports d'épargne au-delà du jeu connu", () => {
  it("un compte inconnu reçoit une couleur", () => {
    expect(estCouleur(couleurCompte("Banque D - Livret"))).toBe(true);
  });

  it("un support d'épargne inconnu reçoit une couleur", () => {
    expect(estCouleur(couleurEpargne("Plan de retraite"))).toBe(true);
  });

  it("tous les comptes déclarés reçoivent une couleur", () => {
    for (const c of COMPTE_LIBELLES) {
      expect(estCouleur(couleurCompte(c))).toBe(true);
    }
  });
});

describe("accounts.ts — cohérence du vocabulaire", () => {
  it("les identifiants sont uniques", () => {
    const ids = COMPTES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("les libellés sont uniques", () => {
    expect(new Set(COMPTE_LIBELLES).size).toBe(COMPTE_LIBELLES.length);
  });

  it("aucun libellé ne porte de nom d'établissement réel", () => {
    const interdits = [
      "Crédit Agricole", "Caisse d", "Bourso", "Edenred", "Tricount", "Lydia", "AFER",
    ];
    const tout = [...COMPTE_LIBELLES, ...ORGANISMES_UTILISES].join(" | ");
    for (const mot of interdits) {
      expect(tout).not.toContain(mot);
    }
  });
});
