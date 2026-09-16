import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RapportImportVue } from "@/components/upload/DataUploader";
import type { RapportImport } from "@/services/lectureClasseur";

/**
 * L'aperçu avant application.
 *
 * Ce qu'il doit absolument montrer : OÙ. Une ligne rejetée sans son
 * emplacement est inexploitable — la personne doit pouvoir ouvrir son
 * classeur et aller à la ligne.
 */

const base: RapportImport = {
  transactions: [],
  paie: [],
  parametres: { versionFormat: null, couverture: null, pret: null, soldes: {} },
  anomalies: [],
  anomaliesNonListees: 0,
  compteurs: { lignesLues: 3, acceptees: 2, rejetees: 1, ignorees: 0, avertissements: 1 },
  feuillesLues: ["Transactions"],
};

describe("aperçu du rapport d'import", () => {
  it("affiche les quatre compteurs", () => {
    render(<RapportImportVue r={base} />);
    expect(screen.getByText(/2 acceptées/)).toBeInTheDocument();
    expect(screen.getByText(/1 rejetée/)).toBeInTheDocument();
    expect(screen.getByText(/0 ignorée/)).toBeInTheDocument();
    expect(screen.getByText(/1 avertissement/)).toBeInTheDocument();
  });

  it("situe chaque anomalie par feuille, ligne et colonne", () => {
    render(
      <RapportImportVue
        r={{
          ...base,
          anomalies: [
            { gravite: "rejet", feuille: "Transactions 2026", ligne: 47, colonne: "Montant", message: "Montant illisible." },
          ],
        }}
      />
    );
    expect(screen.getByText(/Transactions 2026 — ligne 47 — colonne Montant/)).toBeInTheDocument();
    expect(screen.getByText("Montant illisible.")).toBeInTheDocument();
  });

  it("distingue un rejet d'un avertissement", () => {
    render(
      <RapportImportVue
        r={{
          ...base,
          anomalies: [
            { gravite: "rejet", feuille: "Transactions", ligne: 2, message: "a" },
            { gravite: "avertissement", feuille: "Transactions", ligne: 3, message: "b" },
          ],
        }}
      />
    );
    expect(screen.getByText("Rejetée")).toBeInTheDocument();
    expect(screen.getByText("Avertissement")).toBeInTheDocument();
  });

  it("annonce les anomalies comptées mais non listées", () => {
    render(<RapportImportVue r={{ ...base, anomaliesNonListees: 12 }} />);
    expect(screen.getByText(/12 autres anomalies comptées mais non listées/)).toBeInTheDocument();
  });

  it("prévient quand la feuille Paramètres a été lue sans être reprise", () => {
    // Tant que le jeu n'est pas remplacé d'un bloc, soldes, bornes et prêt sont
    // lus sans être appliqués. Le taire serait exactement le silence que ce
    // lot combat.
    render(
      <RapportImportVue r={{ ...base, parametres: { ...base.parametres, pret: { montant: 1, mensualite: 1, echeances: 1 } } }} />
    );
    expect(screen.getByText(/pas encore repris par le tableau de bord/)).toBeInTheDocument();
  });

  it("ne dit rien des paramètres quand il n'y en a pas", () => {
    render(<RapportImportVue r={base} />);
    expect(screen.queryByText(/pas encore repris/)).toBeNull();
  });
});
