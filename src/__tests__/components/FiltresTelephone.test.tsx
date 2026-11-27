// Le bouton « Filtres (n) » au téléphone. Il pilote le
// MÊME magasin de filtres qu'avant (useFilterStore) : les chiffres ne changent pas.
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FiltresTelephone } from "@/components/layout/FiltresTelephone";
import { useFilterStore } from "@/stores/useFilterStore";
import { renderWithRouter } from "../helpers/renderWithProviders";

beforeEach(() => {
  useFilterStore.setState({ period: "YTD", cat1Filter: "all", showTransfers: false });
});

describe("FiltresTelephone", () => {
  it("est fermé au départ, avec la période et la classe écrites à côté", () => {
    renderWithRouter(<FiltresTelephone />);

    const bouton = screen.getByRole("button", { name: "Filtres (0)" });
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Depuis janvier · toutes classes")).toBeTruthy();
    expect(screen.queryByText("Occasionnelle")).toBeNull();
  });

  it("s'ouvre et se referme au bouton", async () => {
    renderWithRouter(<FiltresTelephone />);
    const bouton = screen.getByRole("button", { name: "Filtres (0)" });

    await userEvent.click(bouton);
    expect(bouton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Occasionnelle")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Paramètres/ })).toBeTruthy();

    await userEvent.click(bouton);
    expect(screen.queryByText("Occasionnelle")).toBeNull();
  });

  it("change les mêmes filtres que l'en-tête du grand écran", async () => {
    renderWithRouter(<FiltresTelephone />);
    await userEvent.click(screen.getByRole("button", { name: "Filtres (0)" }));

    await userEvent.click(screen.getByRole("radio", { name: "3M" }));
    await userEvent.click(screen.getByRole("radio", { name: "Fixe" }));
    await userEvent.click(screen.getByRole("button", { name: "Avec les transferts" }));

    const etat = useFilterStore.getState();
    expect(etat.period).toBe("3M");
    expect(etat.cat1Filter).toBe("Dépense Fixe");
    expect(etat.showTransfers).toBe(true);
    expect(screen.getByRole("button", { name: "Filtres (2)" })).toBeTruthy();
    expect(screen.getByText("3 mois · Fixe · transferts")).toBeTruthy();
  });

  it("période et classe : boutons radio ; transferts : bascule", async () => {
    renderWithRouter(<FiltresTelephone />);
    const bouton = screen.getByRole("button", { name: "Filtres (0)" });
    expect(bouton.getAttribute("aria-controls")).toBeNull();
    await userEvent.click(bouton);
    expect(bouton.getAttribute("aria-controls")).toBe("filtres-telephone");
    expect(document.getElementById("filtres-telephone")).not.toBeNull();

    expect(screen.getByRole("radiogroup", { name: "Période" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "YTD" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "12M" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Avec les transferts" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("boutons radio au clavier : un seul arrêt de Tab, flèches et Début / Fin ; un seul nom", async () => {
    renderWithRouter(<FiltresTelephone />);
    await userEvent.click(screen.getByRole("button", { name: "Filtres (0)" }));

    const groupe = screen.getByRole("radiogroup", { name: "Période" });
    expect(groupe.getAttribute("aria-label")).toBeNull();
    const ytd = screen.getByRole("radio", { name: "YTD" });
    expect(ytd.tabIndex).toBe(0);
    expect(screen.getByRole("radio", { name: "12M" }).tabIndex).toBe(-1);

    ytd.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(useFilterStore.getState().period).toBe("12M");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "12M" }));
    await userEvent.keyboard("{Home}");
    expect(useFilterStore.getState().period).toBe("1M");
    await userEvent.keyboard("{ArrowLeft}");
    expect(useFilterStore.getState().period).toBe("all");
  });

  it("Plus : sans fichier importé ni mémorisé, pas d'étiquette « Démo » inerte (la pastille le dit)", async () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 412 });
    renderWithRouter(<FiltresTelephone />);
    await userEvent.click(screen.getByRole("button", { name: "Filtres (0)" }));
    expect(screen.queryByText("Démo")).toBeNull();
    expect(screen.getByRole("link", { name: /Paramètres/ })).toBeTruthy();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
  });
});
