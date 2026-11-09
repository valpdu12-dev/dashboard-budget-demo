// DM-01 (A7) — le bouton CSV du tableau n'exporte pas de formule active.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, type Column } from "@/components/ui/DataTable";

interface Ligne extends Record<string, unknown> { label: string; montant: number }
const COLONNES: Column<Ligne>[] = [
  { key: "label", label: "Libellé" },
  { key: "montant", label: "Montant" },
];

afterEach(() => vi.restoreAllMocks());

async function exporter(data: Ligne[]): Promise<string> {
  const capture: Blob[] = [];
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (b: Blob) => { capture.push(b); return "blob:x"; },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<DataTable data={data} columns={COLONNES} title="Détail" />);
  fireEvent.click(screen.getByTitle("Exporter en CSV"));
  return new Promise<string>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.readAsText(capture[0]);
  });
}

describe("export CSV du tableau (DM-01 A7)", () => {
  it("un libellé « =… » sort en texte, le montant négatif reste un nombre", async () => {
    const csv = await exporter([{ label: "=HYPERLINK(\"http://x\")", montant: -42.5 }]);
    const ligne = csv.split("\n")[1];
    expect(ligne.startsWith('"\'=HYPERLINK(')).toBe(true);
    expect(ligne.endsWith(";-42.5")).toBe(true);
  });
});
