// ── Le patrimoine suit le jeu de données — Patrimoine D-4a (plan 33) ─────
//
// D-4a ne calcule rien et n'affiche rien : il fait VOYAGER les soldes.
//
//   Profil Démo   : `public/data/patrimoine.json` est chargé avec les autres
//                   fichiers du site. Facultatif : sans lui, la démo est
//                   exactement celle d'avant.
//   Mes données   : `rapport.patrimoine` (classeur importé) est gardé dans le
//                   jeu, posé dans le store et mémorisé avec lui.
//   Avant D-4a    : un jeu mémorisé au schéma 3, sans patrimoine, se relit
//                   sans perte. Le schéma reste 3 (décision du 28/10/2026).
//   Sans feuille  : pas de clé `patrimoine` — jamais un patrimoine vide inventé.
//   Bascule       : le patrimoine d'un profil n'apparaît jamais dans l'autre.
//
// Chiffres de référence (faits à la main, voir patrimoineDemo.test.ts et
// modelePatrimoine.test.ts) :
//   démo    : 184 relevés, 8 comptes, dernier mois 2026-08,
//             compteurs 208 lus = 184 gardés + 16 futurs + 8 non saisis + 0 ;
//   modèle  : lu au 28/10/2026 → 13 relevés, dernier mois 2026-09,
//             compteurs 31 = 13 + 15 + 3 + 0.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { renderHook, act } from "@testing-library/react";
import {
  CLE,
  VERSION_SCHEMA,
  construireJeuDepuisRapport,
  construireJeuStatique,
  lireJeuMemorise,
  lirePatrimoineStocke,
} from "@/services/jeuDonnees";
import { loadDashboardData } from "@/services/loadDashboardData";
import { afficherDemo, afficherMesDonnees, effacerMesDonnees } from "@/services/basculeProfil";
import { ecrireProfil } from "@/services/profil";
import { lireClasseurPublic, type PatrimoineLu, type RapportImport } from "@/services/lectureClasseur";
import { useExcelWorker } from "@/hooks/useExcelWorker";
import { useDataStore } from "@/stores/useDataStore";
import { encodeTransactions } from "@/utils/decode";
import { resetAllStores } from "../helpers/storeReset";
import { octetsModele } from "../helpers/modelePublie";

const DATA = resolve(__dirname, "../../../public/data");

/** Un fichier du site, relu à neuf à chaque appel (aucun partage d'objet). */
function fichierSite(nom: string): unknown {
  return JSON.parse(readFileSync(resolve(DATA, nom), "utf8"));
}

type Remplacement = 404 | "json-casse" | { corps: unknown };

/**
 * `fetch` qui sert les VRAIS fichiers de `public/data/`. Un nom peut être
 * remplacé : 404, JSON illisible, ou un autre contenu.
 */
function fetchSite(remplacer: Record<string, Remplacement> = {}) {
  return vi.fn((url: string) => {
    const nom = url.replace(/^\/data\//, "");
    const r = remplacer[nom];
    if (r === 404) {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error("pas de corps")) });
    }
    if (r === "json-casse") {
      return Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError("JSON illisible")) });
    }
    const corps = r ? r.corps : fichierSite(nom);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(corps) });
  });
}

// ── Faux Web Worker (même principe que useExcelWorker.test.ts) ──────────

type FauxWorker = { simuler: (data: unknown) => void };
let worker: FauxWorker | null = null;

class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    worker = { simuler: (data: unknown) => this.onmessage?.({ data } as MessageEvent) };
  }
}

const VALIDATION = {
  ok: true, nbTransactions: 0, dateMin: "", dateMax: "", nbMois: 0, comptes: [],
  totalDebits: 0, totalCredits: 0, net: 0, nbSalaryMonths: 0, lastSalaryMonth: "", lastNetSalary: 0,
};

/** Importe un rapport par le vrai `useExcelWorker`, comme l'écran d'import. */
function importer(rapport: RapportImport, fileName = "Budget_modele.xlsx", memoriser = true) {
  const { result } = renderHook(() => useExcelWorker());
  act(() => { result.current.parse(new ArrayBuffer(4)); });
  act(() => {
    worker!.simuler({
      type: "result",
      transactions: encodeTransactions(rapport.transactions),
      salary: { months: rapport.paie, cotLast: [], patronLast: [] },
      validation: VALIDATION,
      rapport,
      format: "public",
    });
  });
  act(() => { result.current.apply(fileName, memoriser); });
  return result;
}

// ── Le modèle publié, lu avec et sans sa feuille Patrimoine ─────────────

let AVEC_FEUILLE: RapportImport;
let SANS_FEUILLE: RapportImport;

beforeAll(() => {
  const lire = () => XLSX.read(octetsModele(), { type: "array", cellDates: false });
  AVEC_FEUILLE = lireClasseurPublic(lire(), { aujourdhui: "2026-10-28" });
  const wb = lire();
  for (const nom of wb.SheetNames.filter((n) => n === "Patrimoine")) delete wb.Sheets[nom];
  wb.SheetNames = wb.SheetNames.filter((n) => n !== "Patrimoine");
  SANS_FEUILLE = lireClasseurPublic(wb, { aujourdhui: "2026-10-28" });
}, 120_000);

const originalWorker = globalThis.Worker;
beforeEach(() => {
  localStorage.clear();
  resetAllStores();
  worker = null;
  // @ts-expect-error — faux Worker global
  globalThis.Worker = MockWorker;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  globalThis.Worker = originalWorker;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const patrimoineStore = () => useDataStore.getState().patrimoine;

// ═══════════════════════════════════════════════════════════════════════

describe("le modèle publié sert de classeur d'essai", () => {
  it("avec sa feuille : 13 relevés au 28/10/2026 ; sans elle : pas de clé", () => {
    expect(AVEC_FEUILLE.patrimoine!.releves).toHaveLength(13);
    expect(AVEC_FEUILLE.patrimoine!.compteurs)
      .toEqual({ lignesLues: 31, gardees: 13, futures: 15, nonSaisies: 3, ignorees: 0 });
    expect("patrimoine" in SANS_FEUILLE).toBe(false);
    // Le reste du classeur est le même dans les deux cas.
    expect(SANS_FEUILLE.transactions).toHaveLength(AVEC_FEUILLE.transactions.length);
  });
});

describe("profil Démo — patrimoine.json chargé avec les autres fichiers", () => {
  it("pose les 184 relevés de la démo : 8 comptes, dernier mois 2026-08", async () => {
    vi.stubGlobal("fetch", fetchSite());
    await loadDashboardData();

    const p = patrimoineStore()!;
    expect(useDataStore.getState().origin).toBe("static");
    expect(p.releves).toHaveLength(184);
    expect(p.nbComptes).toBe(8);
    expect(p.dernierMois).toBe("2026-08");
    expect(p.compteurs).toEqual({ lignesLues: 208, gardees: 184, futures: 16, nonSaisies: 8, ignorees: 0 });
    // Le premier relevé, recopié du fichier.
    expect(p.releves[0]).toEqual({
      ordre: 1, compte: "Banque A - Courant", nature: "Liquidité", banque: "Banque A",
      mk: "2024-09", date: "2024-09-30", montant: 2350.4,
    });
  });

  it("retire la clé _lisez_moi au chargement", async () => {
    expect(Object.keys(fichierSite("patrimoine.json") as object)).toContain("_lisez_moi");
    vi.stubGlobal("fetch", fetchSite());
    await loadDashboardData();
    expect(Object.keys(patrimoineStore()!)).toEqual(["releves", "nbComptes", "dernierMois", "compteurs"]);
  });

  it("demande le fichier sous /data/, comme les autres", async () => {
    const espion = fetchSite();
    vi.stubGlobal("fetch", espion);
    await loadDashboardData();
    const appelees = espion.mock.calls.map((c) => String(c[0]));
    expect(appelees).toContain("/data/patrimoine.json");
    for (const url of appelees) expect(url.startsWith("/data/")).toBe(true);
  });

  /** L'état de la démo hors patrimoine, pour comparer avec et sans le fichier. */
  const instantane = () => {
    const s = useDataStore.getState();
    return {
      status: s.status, error: s.error, origin: s.origin, transactions: s.transactions,
      salary: s.salary, config: s.config, budgets: s.budgets,
    };
  };

  const pannes: Array<[string, Remplacement]> = [
    ["absent (404)", 404],
    ["illisible (JSON cassé)", "json-casse"],
    ["d'une autre forme", { corps: { comptes: [] } }],
  ];
  for (const [nom, panne] of pannes) {
    it(`fichier ${nom} : démo identique, sans patrimoine, sans erreur`, async () => {
      vi.stubGlobal("fetch", fetchSite());
      await loadDashboardData();
      const reference = instantane();
      expect(reference.status).toBe("success");

      resetAllStores();
      vi.stubGlobal("fetch", fetchSite({ "patrimoine.json": panne }));
      await expect(loadDashboardData()).resolves.toBeUndefined();

      expect(patrimoineStore()).toBeNull();
      // Les 5 autres fichiers ont donné exactement la même démo.
      expect(instantane()).toEqual(reference);
    });
  }

  it("un seul relevé mal formé : tout le patrimoine est refusé (tout ou rien)", async () => {
    const abime = fichierSite("patrimoine.json") as { releves: Array<Record<string, unknown>> };
    delete abime.releves[100].montant;
    vi.stubGlobal("fetch", fetchSite({ "patrimoine.json": { corps: abime } }));
    await loadDashboardData();
    expect(useDataStore.getState().status).toBe("success");
    expect(patrimoineStore()).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("Mes données — import d'un classeur", () => {
  it("avec feuille Patrimoine : gardé dans le jeu, posé dans le store", () => {
    const jeu = construireJeuDepuisRapport(AVEC_FEUILLE, "Budget_modele.xlsx");
    expect(jeu.patrimoine).toEqual(AVEC_FEUILLE.patrimoine);

    importer(AVEC_FEUILLE);
    expect(patrimoineStore()).toEqual(AVEC_FEUILLE.patrimoine);
    expect(patrimoineStore()!.releves).toHaveLength(13);
  });

  it("mémorisé avec le jeu, et relu à l'identique", () => {
    importer(AVEC_FEUILLE);

    const ecrit = JSON.parse(localStorage.getItem(CLE)!);
    expect(ecrit.version).toBe(3);
    expect(ecrit.patrimoine).toEqual(AVEC_FEUILLE.patrimoine);

    const relu = lireJeuMemorise();
    expect(relu.avis).toBeNull();
    expect(relu.jeu!.patrimoine).toEqual(AVEC_FEUILLE.patrimoine);
    expect(relu.jeu).toEqual(ecrit);
  });

  it("à la réouverture du site, ce sont SES soldes qui reviennent (13), pas ceux de la démo (184)", async () => {
    importer(AVEC_FEUILLE);
    resetAllStores();

    vi.stubGlobal("fetch", fetchSite());
    await loadDashboardData();

    expect(useDataStore.getState().origin).toBe("upload");
    expect(patrimoineStore()).toEqual(AVEC_FEUILLE.patrimoine);
  });

  it("sans feuille Patrimoine : pas de clé patrimoine, jamais un patrimoine vide", () => {
    const jeu = construireJeuDepuisRapport(SANS_FEUILLE, "Budget.xlsx");
    expect("patrimoine" in jeu).toBe(false);

    importer(SANS_FEUILLE, "Budget.xlsx");
    expect(patrimoineStore()).toBeNull();
    expect("patrimoine" in JSON.parse(localStorage.getItem(CLE)!)).toBe(false);
  });

  it("un classeur sans feuille après un classeur avec : les soldes du précédent disparaissent", () => {
    importer(AVEC_FEUILLE);
    expect(patrimoineStore()!.releves).toHaveLength(13);

    importer(SANS_FEUILLE, "Budget.xlsx");
    expect(patrimoineStore()).toBeNull();
    expect(lireJeuMemorise().jeu!.patrimoine).toBeUndefined();
  });

  it("feuille présente mais illisible : la clé reste, avec 0 relevé (ce que le lecteur a constaté)", () => {
    const vide: PatrimoineLu = {
      releves: [], nbComptes: 0, dernierMois: "",
      compteurs: { lignesLues: 0, gardees: 0, futures: 0, nonSaisies: 0, ignorees: 0 },
    };
    importer({ ...SANS_FEUILLE, patrimoine: vide });
    expect(patrimoineStore()).toEqual(vide);
    expect(lireJeuMemorise().jeu!.patrimoine).toEqual(vide);
  });
});

// ═══════════════════════════════════════════════════════════════════════

/**
 * Un jeu tel que la version d'AVANT D-4a l'écrivait — tapé en dur, au
 * caractère près : schéma 3, aucune clé `patrimoine`.
 */
const JEU_V3_AVANT_D4A =
  '{"version":3,"origine":"upload","importedAt":"2026-10-27T18:30:00.000Z",' +
  '"fileName":"Budget_hier.xlsx",' +
  '"transactions":{"fields":["compte","type","date","montant","cat1","cat2","cat3","cat4","ville","dc","label"],' +
  '"s":["Banque A - Courant","CB","Débit","Courses","Essence"],' +
  '"t":[[0,1,"2026-10-03",42.15,-1,-1,-1,-1,-1,2,3],[0,1,"2026-10-04",18,-1,-1,-1,-1,-1,2,4]]},' +
  '"salary":{"months":[],"cotLast":[],"patronLast":[],"lastMonth":""},' +
  '"config":{"init":{"Banque A - Courant":1000},"demo":false},' +
  '"budgets":[]}';

describe("jeu mémorisé AVANT D-4a", () => {
  it("se relit sans aucune perte, sans avis, patrimoine simplement absent", () => {
    localStorage.setItem(CLE, JEU_V3_AVANT_D4A);
    const relu = lireJeuMemorise();

    expect(VERSION_SCHEMA).toBe(3);
    expect(relu.avis).toBeNull();
    expect(relu.jeu).toEqual(JSON.parse(JEU_V3_AVANT_D4A));
    expect(relu.jeu!.patrimoine).toBeUndefined();
    // Rien n'a été réécrit ni effacé.
    expect(localStorage.getItem(CLE)).toBe(JEU_V3_AVANT_D4A);
  });

  it("au démarrage : ses transactions et sa configuration, et pas de patrimoine (pas celui de la démo)", async () => {
    localStorage.setItem(CLE, JEU_V3_AVANT_D4A);
    vi.stubGlobal("fetch", fetchSite());
    await loadDashboardData();

    const s = useDataStore.getState();
    expect(s.origin).toBe("upload");
    expect(s.importFileName).toBe("Budget_hier.xlsx");
    expect(s.transactions.map((t) => t.montant)).toEqual([42.15, 18]);
    expect(s.config).toEqual({ init: { "Banque A - Courant": 1000 }, demo: false });
    expect(s.patrimoine).toBeNull();
  });

  it("un patrimoine mémorisé abîmé : le jeu est gardé, sans lui", () => {
    const abime = { ...JSON.parse(JEU_V3_AVANT_D4A), patrimoine: { releves: "pas un tableau" } };
    localStorage.setItem(CLE, JSON.stringify(abime));

    const relu = lireJeuMemorise();
    expect(relu.avis).toBeNull();
    expect(relu.jeu).not.toBeNull();
    expect("patrimoine" in relu.jeu!).toBe(false);
    expect(relu.jeu!.fileName).toBe("Budget_hier.xlsx");
    expect(relu.jeu!.transactions.t).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("bascule de profil — aucune fuite", () => {
  it("Mes données SANS patrimoine ↔ Démo : 184 en démo, rien sous Mes données", async () => {
    localStorage.setItem(CLE, JEU_V3_AVANT_D4A);
    vi.stubGlobal("fetch", fetchSite());

    await loadDashboardData();
    expect(patrimoineStore()).toBeNull();

    await afficherDemo();
    expect(patrimoineStore()!.releves).toHaveLength(184);

    await afficherMesDonnees();
    expect(useDataStore.getState().origin).toBe("upload");
    expect(patrimoineStore()).toBeNull();
  });

  it("Mes données AVEC patrimoine ↔ Démo : chacun retrouve les siens (13 / 184)", async () => {
    importer(AVEC_FEUILLE);
    vi.stubGlobal("fetch", fetchSite());

    await afficherDemo();
    expect(patrimoineStore()!.releves).toHaveLength(184);
    expect(patrimoineStore()!.releves.some((r) => r.compte === "Appartement - capital remboursé" && r.mk === "2026-09"))
      .toBe(false);

    await afficherMesDonnees();
    expect(patrimoineStore()).toEqual(AVEC_FEUILLE.patrimoine);

    await afficherDemo();
    expect(patrimoineStore()!.dernierMois).toBe("2026-08");
  });

  it("effacer mes données : retour à la démo et à ses 184 relevés", async () => {
    importer(AVEC_FEUILLE);
    ecrireProfil("personnel");
    vi.stubGlobal("fetch", fetchSite());

    await effacerMesDonnees();
    expect(localStorage.getItem(CLE)).toBeNull();
    expect(patrimoineStore()!.releves).toHaveLength(184);
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("store et contrôle de forme", () => {
  it("setData et reset remettent le patrimoine à null", () => {
    const jeu = construireJeuStatique([], { months: [], cotLast: [], patronLast: [] }, { init: {} }, [],
      AVEC_FEUILLE.patrimoine!);
    useDataStore.getState().poserJeu(jeu);
    expect(patrimoineStore()).not.toBeNull();

    useDataStore.getState().setData([], { months: [], cotLast: [], patronLast: [] }, { init: {} }, "static");
    expect(patrimoineStore()).toBeNull();

    useDataStore.getState().poserJeu(jeu);
    useDataStore.getState().reset();
    expect(patrimoineStore()).toBeNull();
  });

  it("un jeu statique sans patrimoine n'a pas de clé", () => {
    const jeu = construireJeuStatique([], { months: [], cotLast: [], patronLast: [] }, { init: {} }, []);
    expect("patrimoine" in jeu).toBe(false);
  });

  it("refuse un relevé dont le mois ne correspond pas à la date, ou d'une nature inconnue", () => {
    const base = fichierSite("patrimoine.json") as { releves: Array<Record<string, unknown>> };
    expect(lirePatrimoineStocke(base)!.releves).toHaveLength(184);

    const moisFaux = fichierSite("patrimoine.json") as typeof base;
    moisFaux.releves[0].mk = "2024-10";
    expect(lirePatrimoineStocke(moisFaux)).toBeNull();

    const natureInconnue = fichierSite("patrimoine.json") as typeof base;
    natureInconnue.releves[0].nature = "Crypto";
    expect(lirePatrimoineStocke(natureInconnue)).toBeNull();

    expect(lirePatrimoineStocke(null)).toBeNull();
    expect(lirePatrimoineStocke([])).toBeNull();
  });
});
