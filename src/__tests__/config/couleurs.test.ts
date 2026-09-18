// ── Les couleurs : déclarées d'abord, repli stable toujours ──────────────
//
// Lot A.2 — l'application doit encaisser plus de comptes, d'organismes et
// d'employeurs que le jeu de démonstration n'en contient. Avant ce lot-là,
// trois pages cherchaient une couleur par accès direct à une table :
// `ORG_COLORS[org]`, `COMPTE_COLORS[compte]`, `ENT_COLORS[ent]`. Au-delà des
// valeurs connues, la valeur rendue était `undefined` — trait de graphique
// invisible, pastille transparente — sans erreur ni avertissement.
//
// Lot C.5 — les tables ont disparu. Une couleur vient de ce que la source
// DÉCLARE, sinon du repli stable. Ce fichier verrouille les deux moitiés :
// la déclaration est respectée, et le repli ne rend JAMAIS `undefined`.

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { couleurStable, DONUT_COLORS } from "@/config/colors";
import { useCouleurs, COULEUR_TOTAL } from "@/hooks/useCouleurs";
import { useDataStore } from "@/stores/useDataStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeConfig, makeSalaryData } from "../helpers/factories";
import { PARAMETRAGE_DEMO } from "../helpers/parametrageDemo";
import { COMPTE_LIBELLES, ORGANISMES_UTILISES } from "../helpers/comptesDemo";

const estCouleur = (v: string) => /^#[0-9a-fA-F]{3,6}$/.test(v);

function couleurs(declaree = true) {
  useDataStore
    .getState()
    .setData([], makeSalaryData([]), makeConfig(declaree ? {} : { parametrage: undefined }), "static");
  return renderHook(() => useCouleurs()).result.current;
}

beforeEach(() => {
  resetAllStores();
});

// ═══════════════════════════════════════════════════════════════════════

describe("couleurStable — le repli", () => {
  it("rend toujours une couleur de la palette", () => {
    for (const nom of ["", "a", "Banque Z", "Un nom très long avec des accents éàü"]) {
      expect(DONUT_COLORS).toContain(couleurStable(nom));
    }
  });

  it("rend LA MÊME couleur pour un nom donné, à chaque appel", () => {
    expect(couleurStable("Employeur Q")).toBe(couleurStable("Employeur Q"));
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("useCouleurs — ce que la source déclare est respecté", () => {
  it("un compte déclaré porte SA couleur", () => {
    const c = couleurs();
    for (const compte of PARAMETRAGE_DEMO.comptes) {
      expect(c.compte(compte.libelle)).toBe(compte.couleur);
    }
  });

  it("une catégorie déclarée porte SA couleur", () => {
    const c = couleurs();
    for (const cat of PARAMETRAGE_DEMO.categories) {
      expect(c.categorie(cat.libelle)).toBe(cat.couleur);
    }
  });

  it("un organisme prend la couleur de son premier compte déclaré", () => {
    const c = couleurs();
    const premier = PARAMETRAGE_DEMO.comptes.find((x) => x.organisme);
    expect(c.organisme(premier!.organisme!)).toBe(premier!.couleur);
  });

  it("« Total » n'est le compte de personne : sa couleur reste celle de l'application", () => {
    const c = couleurs();
    expect(c.compte("Total")).toBe(COULEUR_TOTAL);
    expect(c.organisme("Total")).toBe(COULEUR_TOTAL);
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("useCouleurs — rien n'est jamais sans couleur", () => {
  const inconnus = [
    "Compte jamais vu",
    "Organisme Zzz",
    "",
    "Un nom avec des accents éàü et un tiret - long",
  ];

  it("un nom inconnu reçoit une couleur, jamais undefined", () => {
    const c = couleurs();
    for (const nom of inconnus) {
      for (const f of [c.compte, c.organisme, c.categorie, c.type, c.employeur]) {
        expect(estCouleur(f(nom)), `« ${nom} »`).toBe(true);
      }
    }
  });

  it("sans AUCUNE configuration déclarée, tout reçoit encore une couleur", () => {
    const c = couleurs(false);
    for (const nom of [...COMPTE_LIBELLES, ...ORGANISMES_UTILISES, ...inconnus]) {
      expect(estCouleur(c.compte(nom)), `« ${nom} »`).toBe(true);
      expect(estCouleur(c.organisme(nom)), `« ${nom} »`).toBe(true);
    }
  });

  it("la couleur d'un nom donné ne change pas d'un rendu à l'autre", () => {
    const a = couleurs();
    const b = couleurs();
    for (const nom of [...COMPTE_LIBELLES, ...inconnus]) {
      expect(a.compte(nom)).toBe(b.compte(nom));
      expect(a.type(nom)).toBe(b.type(nom));
    }
  });

  it("deux comptes de la démonstration n'ont jamais la même couleur", () => {
    const c = couleurs();
    const vues = PARAMETRAGE_DEMO.comptes.map((x) => c.compte(x.libelle));
    expect(new Set(vues).size).toBe(vues.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("aucun nom réel ne peut entrer par une couleur", () => {
  it("les libellés déclarés par la démonstration restent neutres", () => {
    // Le garde-fou du lot A : une couleur se déclare à côté d'un LIBELLÉ, et
    // c'est par ce chemin qu'un vrai nom de banque est entré une fois.
    const tout = [...COMPTE_LIBELLES, ...ORGANISMES_UTILISES].join(" | ");
    expect(tout).toMatch(/^[\w\s\-|.éèêàçÉÈÀ]+$/u);
  });
});
