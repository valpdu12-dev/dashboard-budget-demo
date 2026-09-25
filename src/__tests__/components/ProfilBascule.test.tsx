import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProfilBascule } from "@/components/layout/ProfilBascule";
import { useDataStore } from "@/stores/useDataStore";
import { CLE } from "@/services/jeuDonnees";

/**
 * Indicateur de profil — lot B.6.
 *
 * Avant ce lot, rien dans l'en-tête ne disait de qui étaient les chiffres
 * affichés : il fallait ouvrir la fenêtre d'import pour l'apprendre.
 */

const afficherDemo = vi.fn(() => Promise.resolve());
const afficherMesDonnees = vi.fn(() => Promise.resolve());

vi.mock("@/services/basculeProfil", () => ({
  afficherDemo: () => afficherDemo(),
  afficherMesDonnees: () => afficherMesDonnees(),
  effacerMesDonnees: () => Promise.resolve(),
}));

function jeuMemorise() {
  localStorage.setItem(CLE, JSON.stringify({ version: 2 }));
}

beforeEach(() => {
  localStorage.clear();
  useDataStore.getState().reset();
  afficherDemo.mockClear();
  afficherMesDonnees.mockClear();
});

describe("ProfilBascule", () => {
  it("annonce « Mes données » quand un fichier importé est affiché", () => {
    useDataStore.setState({ origin: "upload", status: "success" });
    render(<ProfilBascule />);
    expect(screen.getByRole("button")).toHaveTextContent("Mes données");
  });

  it("revient à la démonstration d'un clic", () => {
    useDataStore.setState({ origin: "upload", status: "success" });
    render(<ProfilBascule />);
    fireEvent.click(screen.getByRole("button"));
    expect(afficherDemo).toHaveBeenCalledTimes(1);
    expect(afficherMesDonnees).not.toHaveBeenCalled();
  });

  it("propose le retour aux données de la personne quand elles sont mémorisées", () => {
    jeuMemorise();
    useDataStore.setState({ origin: "static", status: "success" });
    render(<ProfilBascule />);
    const pastille = screen.getByRole("button");
    expect(pastille).toHaveTextContent("Démo");
    fireEvent.click(pastille);
    expect(afficherMesDonnees).toHaveBeenCalledTimes(1);
  });

  it("n'offre aucun choix quand rien n'a jamais été importé", () => {
    useDataStore.setState({ origin: "static", status: "success" });
    render(<ProfilBascule />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Démo")).toBeTruthy();
  });
});
