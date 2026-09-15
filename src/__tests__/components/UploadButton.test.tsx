// Lot 1.4, point ouvert n° 16 — cible tactile du bouton « Importer .xlsx ».
//
// Ce bouton est le composant le plus present du projet : `Header` le rend sur
// les 9 pages. La mesure Chrome du lot 1.3 l'a releve a 135 x 36 px, seule
// cible tactile sous 44 px restante apres le lot 1.1. La largeur etant deja
// conforme (135 >= 44), seule la hauteur etait en cause — d'ou `min-h-tap`
// (48 px) sans `min-w-tap`, contrairement aux autres cibles du projet.
//
// Rappel du critere mesure (audit.mjs:53, constat ③ du lot 1.1) : une cible
// est comptee des que sa hauteur OU sa largeur passe sous 44 px.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UploadButton } from "@/components/upload/DataUploader";

describe("UploadButton — cible tactile (lot 1.4, point n° 16)", () => {
  it("porte une hauteur minimale de cible sous 768 px", () => {
    render(<UploadButton />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("max-md:min-h-tap");
  });

  it("ne contraint pas la largeur : elle est deja conforme a 135 px", () => {
    // Ajouter `min-w-tap` ici serait inutile et elargirait l'en-tete, que le
    // lot 1.1 a ramene de 194 a ~52 px replie. On verrouille cette absence.
    render(<UploadButton />);
    expect(screen.getByRole("button").className).not.toContain("min-w-tap");
  });

  it("laisse le rendu bureau intact (levier derriere max-md uniquement)", () => {
    render(<UploadButton />);
    const cls = screen.getByRole("button").className;
    expect(cls).not.toMatch(/(^|\s)min-h-tap(\s|$)/);
  });
});
