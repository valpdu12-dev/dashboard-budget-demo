// @vitest-environment node
// ── Listes déroulantes et validations du modèle — lot H.2 ─────────────────
//
// Décision H2 du lot H : une liste partout où la valeur se choisit, une
// validation (nombre, date) là où elle se tape, un refus en français. Ce test
// lit le modèle PUBLIÉ et vérifie :
//   - que chaque colonne à remplir porte sa règle, jusqu'à la dernière ligne
//     préparée, sauf le texte libre nommé ;
//   - que les listes disent la même chose que le lecteur de l'application
//     (`src/config/vocabulaire.ts`) : mêmes natures, mêmes couples refusés,
//     mêmes classes, mêmes sens répercutés ;
//   - que les données de la démonstration respectent leurs propres listes
//     (un modèle qui déclencherait ses propres alertes apprendrait à les
//     ignorer).
// Et il sait échouer.

import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import { octetsModele } from "../helpers/modelePublie";
import { NATURES, NATURES_INCOMPATIBLES, CLASSES, SENS_REPERCUTES } from "@/config/vocabulaire";

type Regle = {
  type: string; formulae?: unknown[]; operator?: string; errorStyle?: string;
  showErrorMessage?: boolean; errorTitle?: string; error?: string;
};
type Plage = { cle: string; de: ExcelJS.Cell; a: ExcelJS.Cell; regle: Regle };

const modele = (ws: ExcelJS.Worksheet) =>
  (ws as unknown as { dataValidations: { model: Record<string, Regle> } }).dataValidations.model;

/** Les plages validées d'une feuille. */
function plages(ws: ExcelJS.Worksheet): Plage[] {
  return Object.entries(modele(ws)).map(([cle, regle]) => {
    const [de, a = de] = cle.replace(/^range:/, "").split(":");
    return { cle, de: ws.getCell(de), a: ws.getCell(a), regle };
  });
}
/** La règle qui couvre une cellule, s'il y en a une. */
function regleDe(ws: ExcelJS.Worksheet, adr: string): Regle | undefined {
  const c = ws.getCell(adr);
  return plages(ws).find((p) =>
    Number(c.row) >= Number(p.de.row) && Number(c.row) <= Number(p.a.row) &&
    Number(c.col) >= Number(p.de.col) && Number(c.col) <= Number(p.a.col))?.regle;
}
const source = (r?: Regle) => String(r?.formulae?.[0] ?? "");
const texte = (c: ExcelJS.Cell) => (typeof c.value === "string" ? c.value : "");

/** Valeur comparable d'une cellule : texte, nombre, ou date AAAA-MM-JJ. */
function valeur(c: ExcelJS.Cell): string {
  let v: unknown = c.value;
  if (v && typeof v === "object" && "result" in v) v = (v as { result: unknown }).result;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && /y/.test(c.numFmt ?? "")) {
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  return v === null || v === undefined ? "" : String(v);
}
/**
 * Ce qu'une liste propose, comme Excel le lit : littérale ; tirée d'un
 * tableau (OFFSET + COUNTA : les N premières cases, N = cases remplies) ; ou
 * lue dans un nom défini. `trous` : une case vide dans ce qu'Excel lit — et
 * alors, mesuré au H.2, Excel accepte N'IMPORTE QUELLE valeur.
 */
function lireListe(wb: ExcelJS.Workbook, src: string): { valeurs: string[]; trous: boolean } | null {
  if (src.startsWith('"')) return { valeurs: src.slice(1, -1).split(","), trous: false };
  const lire = (feuille: string, col: string, de: number, a: number) => {
    const ws = wb.getWorksheet(feuille)!;
    return Array.from({ length: a - de + 1 }, (_, i) => valeur(ws.getCell(`${col}${de + i}`)));
  };
  const off = /^OFFSET\('?(.+?)'?!\$([A-Z]+)\$(\d+),0,0,MAX\(1,COUNTA\('?.+?'?!\$[A-Z]+\$\d+:\$[A-Z]+\$(\d+)\)\),1\)$/.exec(src);
  if (off) {
    const toutes = lire(off[1], off[2], Number(off[3]), Number(off[4]));
    const lues = toutes.slice(0, Math.max(1, toutes.filter((v) => v !== "").length));
    return { valeurs: lues.filter((v) => v !== ""), trous: lues.includes("") };
  }
  const plage = wb.definedNames.getRanges(src).ranges[0];
  const m = plage && /^'?(.+?)'?!\$([A-Z]+)\$(\d+):\$[A-Z]+\$(\d+)$/.exec(plage);
  if (!m) return null;
  const toutes = lire(m[1], m[2], Number(m[3]), Number(m[4]));
  return { valeurs: toutes.filter((v) => v !== ""), trous: toutes.includes("") };
}
const valeursDeListe = (wb: ExcelJS.Workbook, src: string) => lireListe(wb, src)?.valeurs ?? null;
/** Une borne de validation de date, en AAAA-MM-JJ. */
function borne(x: unknown): string {
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  const n = Number(x);
  return Number.isFinite(n) ? new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10) : String(x);
}
/** H.3 — la ligne des en-têtes de Paramètres (encadrés au-dessus). Vérifiée
 *  dans `ecarts` : si le script la change, ce test le dit. */
const PE = 9;
/** La source d'une liste tirée d'un tableau de Paramètres (comme le script). */
const TABLEAU = (col: string, n: number) =>
  `OFFSET('Paramètres'!$${col}$${PE + 1},0,0,MAX(1,COUNTA('Paramètres'!$${col}$${PE + 1}:$${col}$${PE + n})),1)`;

// Le contrat, par en-tête de colonne.
type Attendu = { type: string; source?: string; style?: "warning" };
const LISTE = (s: string, style?: "warning"): Attendu => ({ type: "list", source: s, style });
const DATE: Attendu = { type: "date" };
const NOMBRE: Attendu = { type: "decimal" };
const COULEUR: Attendu = { type: "custom" };
const CONTRAT: Record<string, Record<string, Attendu>> = {
  Transactions: {
    Date: DATE, Compte: LISTE(TABLEAU("D", 40)), Type: LISTE(TABLEAU("M", 120)), "Montant brut": NOMBRE,
    "Sens (si différent)": LISTE('"Débit,Crédit"'), Prévisionnel: LISTE('"x"'),
  },
  Paie: {
    Mois: LISTE("ListeMoisPaie"), Employeur: LISTE(TABLEAU("V", 40), "warning"),
    Brut: NOMBRE, "Cotisations salariales": NOMBRE, Indemnités: NOMBRE, "Autres retenues": NOMBRE,
  },
  Paramètres: {
    "Solde de départ": NOMBRE, "Porte un solde": LISTE('"oui,non"'), "Compte lié": LISTE(TABLEAU("D", 40)),
    "Sens répercuté": LISTE(`"${SENS_REPERCUTES.join(",")}"`), Participation: NOMBRE, Couleur: COULEUR,
    Nature: LISTE("ListeNatures", "warning"), "Classe par défaut": LISTE(`"${CLASSES.join(",")}"`),
    "Sens par défaut": LISTE('"Débit,Crédit"'), "Catégorie (budget)": LISTE(TABLEAU("S", 40), "warning"),
  },
};
// Le texte libre, nommé : ce sont les seules colonnes à remplir sans règle.
const LIBRE: Record<string, string[]> = {
  Transactions: ["Sous-catégorie", "Détail", "Libellé", "Ville"],
  Paie: [],
  Paramètres: ["Paramètre", "Valeur", "Compte", "Organisme", "Type", "Catégorie", "Employeur"],
};

const NUIT = "FF1F3864"; // en-tête d'une colonne à remplir (H.1)
const cleNature = (s: string) => s.split(",").map((x) => x.trim()).sort().join(" + ");

/** Tous les écarts au contrat, lisibles. Vide = modèle conforme. */
function ecarts(wb: ExcelJS.Workbook): string[] {
  const e: string[] = [];

  // 1. Chaque colonne à remplir porte sa règle, en ligne 2 ET en dernière
  //    ligne préparée — sauf le texte libre nommé.
  if (texte(wb.getWorksheet("Paramètres")!.getCell(`A${PE}`)) !== "Paramètre") {
    e.push(`Paramètres!A${PE} : l'en-tête « Paramètre » n'y est plus — mettre PE à jour`);
  }
  for (const [nom, contrat] of Object.entries(CONTRAT)) {
    const ws = wb.getWorksheet(nom)!;
    const vus = new Set<string>();
    const lEnTete = nom === "Paramètres" ? PE : 1;
    for (let col = 1; col <= ws.columnCount; col++) {
      const h = ws.getRow(lEnTete).getCell(col);
      const titre = texte(h);
      if (!titre || h.fill?.type !== "pattern" || h.fill.fgColor?.argb !== NUIT) continue;
      if (LIBRE[nom].includes(titre)) continue;
      const att = contrat[titre];
      if (!att) { e.push(`${nom} : colonne « ${titre} » à remplir, absente du contrat`); continue; }
      vus.add(titre);
      const derniere = nom !== "Paramètres" ? ws.rowCount : PE + (col >= 13 && col <= 17 ? 120 : 40);
      const lettre = h.address.replace(/\d+$/, "");
      for (const ligne of [lEnTete + 1, derniere]) {
        const r = regleDe(ws, `${lettre}${ligne}`);
        const ici = `${nom}!${lettre}${ligne} (${titre})`;
        if (!r) { e.push(`${ici} : aucune règle`); continue; }
        if (r.type !== att.type) e.push(`${ici} : type ${r.type}, attendu ${att.type}`);
        if (att.source && source(r) !== att.source) e.push(`${ici} : liste ${source(r)}, attendue ${att.source}`);
        if ((r.errorStyle ?? "stop") !== (att.style ?? "stop")) e.push(`${ici} : style ${r.errorStyle ?? "stop"}`);
      }
    }
    for (const t of Object.keys(contrat)) if (!vus.has(t)) e.push(`${nom} : colonne « ${t} » introuvable`);
  }
  const par = wb.getWorksheet("Paramètres")!;
  // Les réglages qui ont une règle, retrouvés par leur nom en colonne A.
  const ligneDe = (nom: string) => {
    for (let r = PE + 1; r <= PE + 40; r++) if (texte(par.getCell(`A${r}`)) === nom) return r;
    return 0;
  };
  for (const [nom, type, src] of [
    ["Début de relevé", "date"], ["Fin de relevé", "date"],
    ["Compte crédité par les sorties d'épargne", "list", TABLEAU("D", 40)],
  ]) {
    if (!ligneDe(nom)) { e.push(`Paramètres : réglage « ${nom} » introuvable`); continue; }
    const adr = `B${ligneDe(nom)}`;
    const r = regleDe(par, adr);
    if (r?.type !== type || (src && source(r) !== src)) e.push(`Paramètres!${adr} (${nom}) : règle ${r?.type ?? "absente"}`);
  }

  // 2. Chaque règle refuse avec un message ; chaque liste propose quelque chose.
  wb.eachSheet((ws) => {
    for (const p of plages(ws)) {
      const r = p.regle;
      if (!r.showErrorMessage || !r.errorTitle || !r.error) e.push(`${ws.name}!${p.cle} : refus sans message`);
      else if (r.error.length > 255 || r.errorTitle.length > 32) e.push(`${ws.name}!${p.cle} : message trop long pour Excel`);
      if (r.type === "list") {
        const l = lireListe(wb, source(r));
        if (!l?.valeurs.length) e.push(`${ws.name}!${p.cle} : liste ${source(r)} vide ou introuvable`);
        else if (l.trous) e.push(`${ws.name}!${p.cle} : case vide dans la source, Excel y accepterait n'importe quelle valeur`);
      }
      if (r.type === "date") {
        const b = (r.formulae ?? []).map(borne).join(" → ");
        if (b !== "2000-01-01 → 2099-12-31") e.push(`${ws.name}!${p.cle} : bornes de date ${b}`);
      }
    }
  });

  // 3. Les natures proposées = celles que le lecteur accepte : les seules, et
  //    tous les couples, moins les couples refusés. Ni plus, ni moins.
  const attendues = new Set<string>(NATURES);
  NATURES.forEach((a, i) => NATURES.slice(i + 1).forEach((b) => {
    if (!NATURES_INCOMPATIBLES.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
      attendues.add(cleNature(`${a},${b}`));
    }
  }));
  const proposees = (valeursDeListe(wb, "ListeNatures") ?? []).map(cleNature);
  if (new Set(proposees).size !== proposees.length) e.push("ListeNatures : doublon");
  for (const p of proposees) if (!attendues.has(p)) e.push(`ListeNatures : « ${p} » n'est pas acceptée par le lecteur`);
  for (const a of attendues) if (!proposees.includes(a)) e.push(`ListeNatures : manque « ${a} »`);

  // 4. Les données de la démonstration respectent leurs propres listes.
  wb.eachSheet((ws) => {
    for (const p of plages(ws)) {
      if (p.regle.type !== "list") continue;
      const vals = valeursDeListe(wb, source(p.regle));
      if (!vals) continue;
      let n = 0;
      for (let r = Number(p.de.row); r <= Number(p.a.row) && n < 3; r++) {
        for (let c = Number(p.de.col); c <= Number(p.a.col); c++) {
          const cellule = ws.getRow(r).getCell(c);
          const v = valeur(cellule);
          if (v !== "" && !vals.includes(v)) { e.push(`${ws.name}!${cellule.address} : « ${v} » hors de sa liste`); n++; }
        }
      }
    }
  });
  return e;
}

let wb: ExcelJS.Workbook;
beforeAll(async () => {
  wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(octetsModele()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
}, 120_000);

/** Applique des retouches, relève les écarts, annule tout. */
function avec(...retouches: (() => () => void)[]): string {
  const annuler = retouches.map((f) => f());
  try { return ecarts(wb).join("\n"); } finally { annuler.reverse().forEach((f) => f()); }
}
/** Retouche la règle qui couvre une cellule ; `null` la retire. */
const regle = (feuille: string, adr: string, patch: Partial<Regle> | null) => () => {
  const ws = wb.getWorksheet(feuille)!;
  const c = ws.getCell(adr);
  const p = plages(ws).find((x) =>
    Number(c.row) >= Number(x.de.row) && Number(c.row) <= Number(x.a.row) &&
    Number(c.col) >= Number(x.de.col) && Number(c.col) <= Number(x.a.col))!;
  const m = modele(ws);
  const avant = m[p.cle];
  if (patch === null) delete m[p.cle]; else m[p.cle] = { ...avant, ...patch };
  return () => { m[p.cle] = avant; };
};
const valeurDe = (feuille: string, adr: string, v: ExcelJS.CellValue) => () => {
  const c = wb.getWorksheet(feuille)!.getCell(adr);
  const avant = c.value;
  c.value = v;
  return () => { c.value = avant; };
};

describe("listes déroulantes et validations du modèle publié (lot H.2)", () => {
  it("chaque colonne à remplir a sa règle, dit la même chose que le lecteur : 0 écart", () => {
    expect(ecarts(wb)).toEqual([]);
  });

  it("la liste des natures compte 25 entrées : 7 seules, 18 couples", () => {
    expect(valeursDeListe(wb, "ListeNatures")).toHaveLength(25);
  });

  it("la liste des mois de paie couvre les 60 bulletins de la démonstration", () => {
    const mois = valeursDeListe(wb, "ListeMoisPaie")!;
    expect(mois).toHaveLength(120);
    expect(mois[0]).toBe("2016-10-01");
    expect(mois[119]).toBe("2026-09-01");
  });

  describe("sait échouer", () => {
    it("une colonne à remplir sans validation", () => {
      expect(avec(regle("Transactions", "E2", null))).toMatch(/Transactions!E2 \(Montant brut\) : aucune règle/);
    });
    it("un couple refusé glissé dans la liste des natures", () => {
      const e = avec(valeurDe("Référentiel", "M26", "epargne, sortie-epargne"));
      expect(e).toMatch(/« epargne \+ sortie-epargne » n'est pas acceptée par le lecteur/);
      expect(e).toMatch(/manque/);
    });
    it("la Nature passée en style « arrêt »", () => {
      expect(avec(regle("Paramètres", `N${PE + 1}`, { errorStyle: "stop" }))).toMatch(/Paramètres!N10 \(Nature\) : style stop/);
    });
    it("une valeur de la démonstration hors de sa liste", () => {
      expect(avec(valeurDe("Paramètres", `G${PE + 1}`, "peut-être"))).toMatch(/Paramètres!G10 : « peut-être » hors de sa liste/);
    });
    it("un refus sans message", () => {
      expect(avec(regle("Paie", "C2", { error: "" }))).toMatch(/Paie!.*C2.* : refus sans message/);
    });
    it("une liste qui lit une plage à cases vides (Excel accepterait tout)", () => {
      expect(avec(regle("Transactions", "C2", { formulae: ["ListeComptes"] })))
        .toMatch(/Transactions!.*C2.* : case vide dans la source/);
    });
    it("des bornes de date lues comme des millisecondes (le défaut du premier essai)", () => {
      expect(avec(regle("Transactions", "A2", { formulae: [new Date(36526), new Date(73050)] })))
        .toMatch(/Transactions!.*A2.* : bornes de date 1970-01-01 → 1970-01-01/);
    });
    it("une classe inventée dans la liste des classes", () => {
      expect(avec(regle("Paramètres", `O${PE + 1}`, { formulae: ['"Dépense Fixe,Dépense Courante,Loisir"'] })))
        .toMatch(/Paramètres!O10 \(Classe par défaut\) : liste/);
    });
  });
});
