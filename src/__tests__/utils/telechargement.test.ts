import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { telechargerOctets, MIME_XLSX } from "@/utils/telechargement";

/**
 * jsdom ne fournit pas `URL.createObjectURL`. Sans ces doublures, le test ne
 * mesurerait que l'absence de l'API du navigateur.
 */
describe("telechargerOctets", () => {
  let creees: string[];
  let liberees: string[];
  let clics: { href: string; download: string }[];

  beforeEach(() => {
    creees = [];
    liberees = [];
    clics = [];
    URL.createObjectURL = vi.fn(() => {
      const u = `blob:faux/${creees.length}`;
      creees.push(u);
      return u;
    });
    URL.revokeObjectURL = vi.fn((u: string) => { liberees.push(u); });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clics.push({ href: this.href, download: this.download });
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it("propose le fichier sous le nom demandé", () => {
    telechargerOctets(new Uint8Array([1, 2, 3]), "Budget_modele.xlsx", MIME_XLSX);
    expect(clics).toHaveLength(1);
    expect(clics[0].download).toBe("Budget_modele.xlsx");
  });

  it("libère l'URL temporaire après le clic", () => {
    // Sans cela les octets restent en mémoire jusqu'à la fermeture de l'onglet.
    telechargerOctets(new Uint8Array([1]), "x.xlsx");
    expect(liberees).toEqual(creees);
  });

  it("libère l'URL même si le clic échoue", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("clic refusé");
    });
    expect(() => telechargerOctets(new Uint8Array([1]), "x.xlsx")).toThrow();
    expect(liberees).toEqual(creees);
  });
});
