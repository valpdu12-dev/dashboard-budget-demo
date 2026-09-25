// Lot A.4 — le bandeau de démonstration.
//
// Un tableau de bord budgétaire donne l'impression d'afficher les comptes de
// quelqu'un. Ce bandeau est la seule chose qui dit le contraire : il doit
// être présent, lisible, et impossible à refermer.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BandeauDemo } from "@/components/ui/BandeauDemo";

describe("BandeauDemo", () => {
  it("annonce que les données sont fictives", () => {
    render(<BandeauDemo />);
    expect(screen.getByText(/Démonstration — données fictives/)).toBeInTheDocument();
  });

  it("dit que rien ne sort du navigateur", () => {
    render(<BandeauDemo />);
    expect(screen.getByRole("note").textContent).toMatch(/rien n'est envoyé/i);
  });

  it("n'offre aucun bouton pour le fermer", () => {
    // Un bandeau masquable cesse d'informer les visiteurs suivants — et ce
    // sont eux qu'il protège.
    render(<BandeauDemo />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
