// ── Lot D.4 à D.6 — ce que la recette de diffusion a trouvé ──────────────
//
// Chaque test verrouille un défaut vu dans un navigateur neuf (Chromium sans
// profil, clavier seul, fichiers piégés), et corrigé.

import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import * as XLSX from "xlsx";
import { BandeauDemo } from "@/components/ui/BandeauDemo";
import { Header } from "@/components/layout/Header";
import { DataUploader } from "@/components/upload/DataUploader";
import { PageIntrouvable } from "@/router";
import { useDataStore } from "@/stores/useDataStore";
import { useUIStore } from "@/stores/useUIStore";
import { detecterFormat } from "@/services/lectureClasseur";

const originDepart = useDataStore.getState().origin;
afterEach(() => {
  useDataStore.setState({ origin: originDepart });
  useUIStore.setState({ uploaderOpen: false });
});

describe("le bandeau et le titre suivent les données affichées (décision du 26/09)", () => {
  it("sur ses propres données : « Vos données », plus « données fictives »", () => {
    useDataStore.setState({ origin: "upload" });
    render(<BandeauDemo />);
    const note = screen.getByRole("note").textContent ?? "";
    expect(note).toMatch(/Vos données/);
    expect(note).not.toMatch(/fictives/);
    expect(note).toMatch(/rien n'est envoyé/);
  });
  it("sait échouer : sur la démonstration, le bandeau le dit toujours", () => {
    render(<BandeauDemo />);
    expect(screen.getByRole("note").textContent).toMatch(/Démonstration — données fictives/);
  });
  it("le titre de l'en-tête et de l'onglet perdent « Démo » sur ses propres données", () => {
    useDataStore.setState({ origin: "upload" });
    render(<MemoryRouter><Header /></MemoryRouter>);
    expect(document.title).toBe("Dashboard Budget — Mes données");
    expect(screen.queryByText(/— Démo/)).toBeNull();
  });
});

describe("la fenêtre d'import au clavier (D.5)", () => {
  it("est une fenêtre de dialogue nommée, et la zone de dépôt est un bouton", () => {
    useUIStore.setState({ uploaderOpen: true });
    render(<DataUploader />);
    expect(screen.getByRole("dialog", { name: "Charger un nouveau fichier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choisir un fichier \.xlsx/ })).toHaveAttribute("tabindex", "0");
  });
  it("Tab ne sort pas de la fenêtre", async () => {
    useUIStore.setState({ uploaderOpen: true });
    render(<><button>derrière</button><DataUploader /></>);
    const dialogue = screen.getByRole("dialog");
    for (let i = 0; i < 12; i++) {
      await userEvent.tab();
      expect(dialogue.contains(document.activeElement), `Tab n° ${i + 1}`).toBe(true);
    }
  });
  it("la promesse de confidentialité est lisible (plus en couleur de bordure)", () => {
    useUIStore.setState({ uploaderOpen: true });
    render(<DataUploader />);
    const p = screen.getByText(/Vos données ne quittent jamais votre navigateur/);
    expect(p.className).not.toMatch(/text-border/);
  });
});

describe("une adresse inconnue le dit (D.4)", () => {
  it("« Page introuvable », l'adresse, et un retour à l'accueil", () => {
    render(<MemoryRouter initialEntries={["/nimporte-quoi"]}><PageIntrouvable /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Page introuvable" })).toBeInTheDocument();
    expect(screen.getByText(/« \/nimporte-quoi »/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revenir à l'accueil" })).toHaveAttribute("href", "/");
  });
});

describe("une feuille Transactions sans ses colonnes : il nomme ce qui manque (D.6)", () => {
  const classeur = (entetes: string[]) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([entetes, entetes.map(() => "x")]), "Transactions");
    return wb;
  };
  it("sans Date : la colonne Date est nommée, et les colonnes trouvées", () => {
    expect(() => detecterFormat(classeur(["Compte", "Type", "Montant", "Sens"])))
      .toThrow(/« Transactions » est bien là, mais sa ligne 1 n'a pas la colonne Date\. Colonnes trouvées : Compte, Type, Montant, Sens/);
  });
  it("sait échouer : avec Date, Compte et Montant, le format est reconnu", () => {
    expect(detecterFormat(classeur(["Date", "Compte", "Montant"]))).toBe("public");
  });
});
