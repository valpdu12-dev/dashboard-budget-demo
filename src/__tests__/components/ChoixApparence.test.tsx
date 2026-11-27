// Les pilules Auto · Jour · Nuit (boutons radio), et leur place au téléphone (panneau Filtres).
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChoixApparence } from "@/components/ui/ChoixApparence";
import { FiltresTelephone } from "@/components/layout/FiltresTelephone";
import { CLE_APPARENCE } from "@/theme";

beforeEach(() => localStorage.clear());
afterEach(() => document.documentElement.removeAttribute("data-theme"));

describe("ChoixApparence", () => {
  it("trois boutons radio, Auto coché au départ", () => {
    render(<ChoixApparence />);
    expect(screen.getByRole("radiogroup", { name: "Apparence" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Auto", "Jour", "Nuit"]);
    expect(screen.getByRole("radio", { name: "Auto" })).toHaveAttribute("aria-checked", "true");
  });

  it("un clic choisit, garde le choix, pose le thème ; deux boutons restent d'accord", () => {
    render(<><ChoixApparence /><ChoixApparence grand /></>);
    fireEvent.click(screen.getAllByRole("radio", { name: "Nuit" })[0]);
    expect(localStorage.getItem(CLE_APPARENCE)).toBe("nuit");
    expect(document.documentElement.getAttribute("data-theme")).toBe("nuit");
    for (const r of screen.getAllByRole("radio", { name: "Nuit" })) expect(r).toHaveAttribute("aria-checked", "true");
    for (const r of screen.getAllByRole("radio", { name: "Auto" })) expect(r).toHaveAttribute("aria-checked", "false");
  });

  it("reprend le choix gardé", () => {
    localStorage.setItem(CLE_APPARENCE, "jour");
    render(<ChoixApparence />);
    expect(screen.getByRole("radio", { name: "Jour" })).toHaveAttribute("aria-checked", "true");
  });

  it("au téléphone : dans le panneau Filtres, section Apparence", () => {
    render(<MemoryRouter><FiltresTelephone /></MemoryRouter>);
    expect(screen.queryByRole("radiogroup", { name: "Apparence" })).toBeNull(); // fermé au départ
    fireEvent.click(screen.getByRole("button", { name: /Filtres/ }));
    const groupe = screen.getByRole("radiogroup", { name: "Apparence" });
    // A8 : nommé par le titre visible (un seul nom, pas de fieldset + aria-label en double).
    expect(groupe).toHaveAttribute("aria-labelledby", "titre-apparence");
    expect(groupe).not.toHaveAttribute("aria-label");
    expect(document.getElementById("titre-apparence")?.textContent).toBe("Apparence");
  });

  it("clavier des boutons radio : un seul arrêt de Tab, flèches et Début / Fin", () => {
    render(<ChoixApparence />);
    const [auto, jour, nuit] = screen.getAllByRole("radio");
    expect([auto, jour, nuit].map((b) => b.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    auto.focus();
    fireEvent.keyDown(auto, { key: "ArrowRight" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("jour");
    expect(jour).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(jour);
    expect([auto, jour, nuit].map((b) => b.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    fireEvent.keyDown(jour, { key: "End" });
    expect(nuit).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(nuit, { key: "ArrowRight" }); // revient au début
    expect(auto).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(auto, { key: "ArrowLeft" });
    expect(nuit).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem(CLE_APPARENCE)).toBe("nuit");
  });
});
