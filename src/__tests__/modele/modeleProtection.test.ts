// @vitest-environment node
// ── Le verrou du modèle — lot H.5 ─────────────────────────────────────────
//
// Décision H4 du lot H : cellules calculées verrouillées, protection de
// feuille SANS mot de passe — à condition que cela ne crée aucun problème
// pour l'application. Ce test lit le XML brut du modèle PUBLIÉ, tel qu'Excel
// le lira, et vérifie :
//   - que le fichier est un zip ordinaire, jamais un classeur chiffré à
//     l'ouverture (SheetJS ne le lirait pas) ;
//   - que chaque feuille est protégée, sans empreinte de mot de passe ;
//   - ce que la protection laisse faire (décision Q3) : sélectionner,
//     filtrer, élargir une colonne, trier (Transactions et Paie seulement,
//     H.5b) — et ce qu'elle interdit : insérer ou supprimer des lignes ;
//   - que l'application relit le modèle protégé sans une alerte.
// Et il sait échouer.

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { octetsModele } from "../helpers/modelePublie";
import { lireClasseurPublic } from "@/services/lectureClasseur";

type Cfb = { FileIndex: { name: string; content: Uint8Array }[]; FullPaths: string[] };

/** Le XML de chaque feuille, par son nom, lu dans le zip. */
function feuillesXml(octets: Uint8Array): Record<string, string> {
  const cfb = (XLSX as unknown as { CFB: { read: (d: Uint8Array, o: object) => Cfb } }).CFB
    .read(octets, { type: "buffer" });
  const fichier = (nom: string) => {
    const i = cfb.FullPaths.findIndex((p) => p.endsWith(nom));
    if (i < 0) throw new Error(`${nom} absent du zip`);
    return new TextDecoder().decode(cfb.FileIndex[i].content);
  };
  const classeur = fichier("xl/workbook.xml");
  const liens = fichier("xl/_rels/workbook.xml.rels");
  const out: Record<string, string> = { "(classeur)": classeur };
  for (const m of classeur.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const cible = new RegExp(`Id="${m[2]}"[^>]*Target="([^"]+)"`).exec(liens)?.[1]
      ?? new RegExp(`Target="([^"]+)"[^>]*Id="${m[2]}"`).exec(liens)?.[1];
    out[m[1]] = fichier(cible!.replace(/^\/?(xl\/)?/, "xl/"));
  }
  return out;
}

const attribut = (balise: string, nom: string) => new RegExp(`\\s${nom}="([^"]*)"`).exec(balise)?.[1];

/** Tous les écarts à la règle du verrou, lisibles. Vide = conforme. */
function ecarts(octets: Uint8Array, xml: Record<string, string>): string[] {
  const e: string[] = [];
  // Un .xlsx ordinaire est un zip (« PK »). Un classeur chiffré à l'ouverture
  // est un conteneur OLE (D0 CF 11 E0) : l'application ne le lirait pas.
  if (octets[0] !== 0x50 || octets[1] !== 0x4b) e.push("le fichier n'est pas un zip : classeur chiffré ?");
  if (/<workbookProtection|<fileSharing/.test(xml["(classeur)"])) e.push("classeur protégé ou partagé par mot de passe");

  for (const [nom, contenu] of Object.entries(xml)) {
    if (nom === "(classeur)") continue;
    const p = /<sheetProtection\b[^>]*\/>/.exec(contenu)?.[0];
    if (!p) { e.push(`${nom} : pas protégée`); continue; }
    if (attribut(p, "sheet") !== "1") e.push(`${nom} : protection inactive`);
    for (const a of ["password", "hashValue", "saltValue", "algorithmName"]) {
      if (attribut(p, a) !== undefined) e.push(`${nom} : mot de passe (${a})`);
    }
    // En OOXML, « 0 » veut dire PERMIS ; absent ou « 1 », interdit.
    const permis = (a: string) => attribut(p, a) === "0";
    // H.5b — le tri, permis là où l'on saisit des lignes datées (Transactions,
    // Paie) ; il n'y porte que sur des cellules déverrouillées (le filtre).
    const trier = nom === "Transactions" || nom === "Paie";
    for (const a of ["formatColumns", "autoFilter", ...(trier ? ["sort"] : [])]) {
      if (!permis(a)) e.push(`${nom} : ${a} interdit`);
    }
    for (const a of ["insertRows", "deleteRows", "insertColumns", "deleteColumns", "formatCells", ...(trier ? [] : ["sort"])]) {
      if (permis(a)) e.push(`${nom} : ${a} permis`);
    }
    if (attribut(p, "selectLockedCells") === "1" || attribut(p, "selectUnlockedCells") === "1") {
      e.push(`${nom} : sélection interdite`);
    }
  }
  // Le filtre (et donc le tri) couvre les colonnes à remplir, pas une de plus :
  // une cellule verrouillée dans la zone, et Excel refuserait de trier.
  if (!/<autoFilter ref="A1:J5000"\s*\/>/.test(xml.Transactions ?? "")) e.push("Transactions : pas de filtre A1:J5000");
  if (!/<autoFilter ref="A1:F301"\s*\/>/.test(xml.Paie ?? "")) e.push("Paie : pas de filtre A1:F301");
  return e;
}

const octets = octetsModele();
const xml = feuillesXml(octets);
/** Une copie du XML où une feuille est retouchée. */
const retouche = (feuille: string, de: RegExp | string, vers: string) =>
  ({ ...xml, [feuille]: xml[feuille].replace(de, vers) });

describe("le verrou du modèle publié (lot H.5)", () => {
  it("six feuilles, toutes protégées sans mot de passe ; filtre et tri là où il faut : 0 écart", () => {
    expect(Object.keys(xml).filter((n) => n !== "(classeur)")).toHaveLength(6);
    expect(ecarts(octets, xml)).toEqual([]);
  });

  it("l'application relit le modèle protégé sans une alerte", () => {
    const rapport = lireClasseurPublic(XLSX.read(octets, { type: "array", cellDates: false }));
    expect(rapport.anomalies).toEqual([]);
    expect(rapport.transactions).toHaveLength(1053);
  });

  describe("sait échouer", () => {
    it("une empreinte de mot de passe", () => {
      const x = retouche("Paie", "<sheetProtection ", '<sheetProtection hashValue="abc" ');
      expect(ecarts(octets, x)).toContain("Paie : mot de passe (hashValue)");
    });
    it("une feuille laissée sans protection", () => {
      const x = retouche("Paramètres", /<sheetProtection\b[^>]*\/>/, "");
      expect(ecarts(octets, x)).toContain("Paramètres : pas protégée");
    });
    it("le tri permis là où il ne sert pas (Paramètres)", () => {
      const x = retouche("Paramètres", /<sheetProtection /, '<sheetProtection sort="0" ');
      expect(ecarts(octets, x)).toContain("Paramètres : sort permis");
    });
    it("le filtre étendu aux colonnes calculées (Excel refuserait de trier)", () => {
      const x = retouche("Transactions", /<autoFilter [^>]*\/>/, '<autoFilter ref="A1:V5000"/>');
      expect(ecarts(octets, x)).toContain("Transactions : pas de filtre A1:J5000");
    });
    it("un classeur chiffré (en-tête OLE)", () => {
      const chiffre = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, ...octets.slice(4, 16)]);
      expect(ecarts(chiffre, xml)).toContain("le fichier n'est pas un zip : classeur chiffré ?");
    });
  });
});
