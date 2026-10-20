// Repris du site privé (20/10/2026), avec des noms inventés.
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListeRecherche } from "@/components/ui/ListeRecherche";
import type { OptionCategorie } from "@/calculs/optionsCategorie";

const OPTIONS: OptionCategorie[] = [
  { valeur: "Boulangerie", nombre: 3 },
  { valeur: "Cinéma", nombre: 2 },
  { valeur: "PRIMEUR", nombre: 12 },
  { valeur: "Zoo", nombre: 5 },
];

/** Version contrôlée, comme sur la page Dépenses. */
function Controlee({ depart = [], onChange }: { depart?: string[]; onChange?: (v: string[]) => void }) {
  const [v, setV] = useState<string[]>(depart);
  return (
    <ListeRecherche
      libelle="Enseigne"
      libelleTous="Toutes"
      options={OPTIONS}
      valeurs={v}
      onChange={(x) => { setV(x); onChange?.(x); }}
    />
  );
}

/** Dernière valeur transmise à `onChange`. */
const dernier = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]?.[0];

describe("ListeRecherche — base", () => {
  it("fermée : un bouton « Enseigne » qui annonce une liste", () => {
    render(<Controlee />);
    const b = screen.getByRole("button", { name: "Enseigne" });
    expect(b).toHaveAttribute("aria-haspopup", "listbox");
    expect(b).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("ouverte : combobox + liste multiple + « Toutes » + valeurs avec leur nombre", async () => {
    const user = userEvent.setup();
    render(<Controlee />);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    expect(screen.getByRole("combobox", { name: "Rechercher : Enseigne" })).toHaveFocus();
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
    const opts = screen.getAllByRole("option");
    expect(opts.map((o) => o.textContent)).toEqual(["Toutes22", "Boulangerie3", "Cinéma2", "PRIMEUR12", "Zoo5"]);
  });

  it("la recherche réduit la liste (sans tenir compte des accents)", async () => {
    const user = userEvent.setup();
    render(<Controlee />);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.type(screen.getByRole("combobox"), "cine");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Toutes22", "Cinéma2"]);
  });

  it("« Aucun résultat » quand rien ne correspond", async () => {
    const user = userEvent.setup();
    render(<Controlee />);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
  });
});

describe("ListeRecherche — choix multiples", () => {
  it("deux clics cochent deux valeurs, la liste reste ouverte", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlee onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.click(screen.getByRole("option", { name: /Zoo/ }));
    await user.click(screen.getByRole("option", { name: /Boulangerie/ }));
    expect(dernier(onChange)).toEqual(["Zoo", "Boulangerie"]);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Zoo/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Boulangerie/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Toutes/ })).toHaveAttribute("aria-selected", "false");
  });

  it("un second clic décoche", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlee depart={["Zoo", "Boulangerie"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /Enseigne : Zoo \+1/ }));
    await user.click(screen.getByRole("option", { name: /Zoo/ }));
    expect(dernier(onChange)).toEqual(["Boulangerie"]);
  });

  it("bouton : « Enseigne : Zoo +1 », liste complète en infobulle", () => {
    render(<Controlee depart={["Zoo", "Boulangerie"]} />);
    const b = screen.getByRole("button", { name: /Enseigne : Zoo \+1/ });
    expect(b).toHaveAttribute("title", "Zoo, Boulangerie");
  });

  it("« Toutes » vide la sélection et ferme", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlee depart={["Zoo", "Boulangerie"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /Enseigne : Zoo/ }));
    await user.click(screen.getByRole("option", { name: /Toutes/ }));
    expect(dernier(onChange)).toEqual([]);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Enseigne" })).toHaveFocus();
  });

  it("« Valider » ferme la liste, les choix restent, le focus revient au bouton", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlee onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.click(screen.getByRole("option", { name: /PRIMEUR/ }));
    expect(screen.getByText("1 choix")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Valider" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: /Enseigne : PRIMEUR/ })).toHaveFocus();
    expect(dernier(onChange)).toEqual(["PRIMEUR"]);
  });

  it("la croix efface tous les choix et rend le focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlee depart={["Zoo", "Boulangerie"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Effacer le filtre Enseigne" }));
    expect(dernier(onChange)).toEqual([]);
    expect(screen.getByRole("button", { name: "Enseigne" })).toHaveFocus();
  });

  it("clic en dehors : ferme, les choix restent", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<div><Controlee onChange={onChange} /><p>dehors</p></div>);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.click(screen.getByRole("option", { name: /Zoo/ }));
    await user.click(screen.getByText("dehors"));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(dernier(onChange)).toEqual(["Zoo"]);
  });
});

describe("ListeRecherche — clavier", () => {
  it("↓ ouvre ; ↓ ↓ Entrée coche Cinéma ; ↓ Entrée coche PRIMEUR", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlee onChange={onChange} />);
    screen.getByRole("button", { name: "Enseigne" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(dernier(onChange)).toEqual(["Cinéma"]);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(dernier(onChange)).toEqual(["Cinéma", "PRIMEUR"]);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("Espace coche quand rien n'est saisi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlee onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.keyboard("{ArrowDown} ");
    expect(dernier(onChange)).toEqual(["Boulangerie"]);
  });

  it("Espace dans une recherche reste un caractère", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlee onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.type(screen.getByRole("combobox"), "pr ");
    expect(screen.getByRole("combobox")).toHaveValue("pr ");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("↑ remonte, aria-activedescendant suit la ligne active", async () => {
    const user = userEvent.setup();
    render(<Controlee />);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");
    const champ = screen.getByRole("combobox");
    const actif = document.getElementById(champ.getAttribute("aria-activedescendant") ?? "");
    expect(actif?.textContent).toBe("Boulangerie3");
  });

  it("Échap ferme et rend le focus au bouton (indigo après un choix)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlee onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.keyboard("{ArrowDown}{Enter}{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(dernier(onChange)).toEqual(["Boulangerie"]);
    expect(screen.getByRole("button", { name: /Enseigne : Boulangerie/ })).toHaveFocus();
  });

  it("taper puis Entrée coche le premier résultat", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlee onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Enseigne" }));
    await user.type(screen.getByRole("combobox"), "prim{Enter}");
    expect(dernier(onChange)).toEqual(["PRIMEUR"]);
  });
});
