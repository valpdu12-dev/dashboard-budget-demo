import { describe, it, expect } from "vitest";
import { toOrganisme, organismesPresents } from "@/utils/organisme";
import { makeTx } from "../helpers/factories";
import { REGLES_DEMO } from "../helpers/parametrageDemo";

/**
 * Défaut trouvé le 16/09/2026 sur un VRAI fichier importé.
 *
 * Tous les comptes de la personne tombaient sur « Autre », qui ne figure dans
 * aucune liste affichée. Le graphique « Évolution mensuelle des dépenses »
 * s'affichait donc entièrement vide — axes, légende, et pas une courbe —
 * alors que le total des dépenses, lui, était juste.
 *
 * La cause n'était pas le calcul : c'était la liste des séries à tracer, figée
 * sur le vocabulaire du jeu de démonstration.
 */

describe("organisme d'un compte", () => {
  it("rend l'organisme connu d'un compte connu", () => {
    expect(toOrganisme("Banque A - Courant")).toBe("Banque A");
  });

  it("extrait l'organisme d'un compte inconnu écrit « Organisme - Usage »", () => {
    expect(toOrganisme("Banque Z - Courant")).toBe("Banque Z");
    expect(toOrganisme("Cagnotte - Part commune")).toBe("Cagnotte");
  });

  it("garde le nom entier quand il n'y a pas de tiret", () => {
    expect(toOrganisme("Sortie Epargne")).toBe("Sortie Epargne");
  });

  it("ne fait jamais apparaître un nom de la démonstration sur un compte inconnu", () => {
    // « Sortie Epargne » était rattaché en dur à l'organisme du compte
    // principal de la DÉMO : la légende d'un fichier importé affichait
    // « Banque A », un nom qui n'appartient pas à la personne.
    expect(toOrganisme("Sortie Epargne")).not.toBe("Banque A");
  });

  it("ne rend « Autre » que pour un compte sans nom", () => {
    expect(toOrganisme("")).toBe("Autre");
  });
});

describe("organismes présents dans un jeu", () => {
  it("ne retient que ceux qui portent des dépenses", () => {
    const tx = [
      makeTx({ compte: "Banque A - Courant", dc: "Débit" }),
      makeTx({ compte: "Banque B - Courant", dc: "Crédit" }),
    ];
    expect(organismesPresents(tx)).toEqual(["Banque A"]);
  });

  it("regroupe les comptes d'un même organisme en une seule série", () => {
    const tx = [
      makeTx({ compte: "Banque Z - Courant", dc: "Débit", montant: 10 }),
      makeTx({ compte: "Banque Z - Part commune", dc: "Débit", montant: 10 }),
      makeTx({ compte: "Cagnotte - Titres restaurant", dc: "Débit", montant: 5 }),
    ];
    expect(organismesPresents(tx)).toEqual(["Banque Z", "Cagnotte"]);
  });

  it("classe les organismes inconnus du plus lourd au plus léger", () => {
    // L'ordre de la légende suit celui des courbes à l'écran. L'ordre
    // alphabétique ne s'expliquait par rien.
    const tx = [
      makeTx({ compte: "Petite banque - Courant", dc: "Débit", montant: 10 }),
      makeTx({ compte: "Grosse banque - Courant", dc: "Débit", montant: 900 }),
      makeTx({ compte: "Moyenne banque - Courant", dc: "Débit", montant: 100 }),
    ];
    expect(organismesPresents(tx)).toEqual(["Grosse banque", "Moyenne banque", "Petite banque"]);
  });

  it("garde les organismes DÉCLARÉS en tête, dans l'ordre du fichier", () => {
    // Lot C.4 : l'ordre ne vient plus d'une liste écrite dans le code, mais de
    // celui dans lequel la personne a écrit ses comptes.
    const tx = [
      makeTx({ compte: "Zzz compte inconnu", dc: "Débit", montant: 1 }),
      makeTx({ compte: "Banque B - Courant", dc: "Débit" }),
      makeTx({ compte: "Banque A - Courant", dc: "Débit" }),
    ];
    const presents = organismesPresents(tx, REGLES_DEMO);
    expect(presents.slice(0, 2)).toEqual(["Banque A", "Banque B"]);
    expect(presents[presents.length - 1]).toBe("Zzz compte inconnu");
  });

  it("sans configuration, aucun organisme n'est privilégié : le poids seul décide", () => {
    const tx = [
      makeTx({ compte: "Banque A - Courant", dc: "Débit", montant: 1 }),
      makeTx({ compte: "Zzz compte inconnu", dc: "Débit", montant: 500 }),
    ];
    expect(organismesPresents(tx)).toEqual(["Zzz compte inconnu", "Banque A"]);
  });

  it("ne rend rien sur un jeu vide", () => {
    expect(organismesPresents([])).toEqual([]);
  });

  it("ne produit jamais de liste vide quand il y a des dépenses", () => {
    // C'est exactement ce qui vidait le graphique : des dépenses d'un côté,
    // aucune série à tracer de l'autre.
    const tx = [makeTx({ compte: "Compte totalement inconnu", dc: "Débit" })];
    expect(organismesPresents(tx).length).toBeGreaterThan(0);
  });
});
