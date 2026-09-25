// Lot E, décision E8 — les salaires inventés le disent.
//
// La démonstration montre des employeurs et des salaires INVENTÉS. L'écran
// Salaire doit l'annoncer, visiblement — mais seulement pour les données du
// site : un fichier importé porte de vrais salaires, et les dire « inventés »
// serait un mensonge dans l'autre sens.

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Salaire from "@/pages/Salaire";
import { useDataStore } from "@/stores/useDataStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeSalaryData, makeConfig } from "../helpers/factories";

const MENTION = /employeurs et montants inventés/i;

function afficher(origine: "static" | "upload") {
  useDataStore.getState().setData([makeTx({})], makeSalaryData(), makeConfig(), origine);
  render(
    <MemoryRouter>
      <Salaire />
    </MemoryRouter>
  );
}

beforeEach(() => resetAllStores());

describe("écran Salaire — mention « montants inventés » (E8)", () => {
  it("s'affiche sur les données de démonstration du site", () => {
    afficher("static");
    expect(screen.getByText(MENTION)).toBeInTheDocument();
  });

  it("ne s'affiche jamais sur un fichier importé", () => {
    afficher("upload");
    expect(screen.queryByText(MENTION)).toBeNull();
  });
});
