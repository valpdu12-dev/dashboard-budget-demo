// Le thème Auto · Jour · Nuit (src/theme.ts) et le script qui le pose
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { appliquerTheme, choisirTheme, CLE_APPARENCE, EVENEMENT_APPARENCE, lireChoixTheme, suivreAppareil, suivreAutresOnglets, type ChoixTheme } from "@/theme";

const RACINE = path.resolve(__dirname, "../../..");
const SCRIPT = fs.readFileSync(path.join(RACINE, "public/theme.js"), "utf8");
const INDEX = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");

type Rappel = () => void;
function appareil(sombre: { v: boolean }) {
  const rappels = new Set<Rappel>();
  vi.stubGlobal("matchMedia", (q: string) => ({
    get matches() { return q.includes("dark") ? sombre.v : false; },
    media: q,
    addEventListener: (_: string, r: Rappel) => rappels.add(r),
    removeEventListener: (_: string, r: Rappel) => rappels.delete(r),
    addListener: (r: Rappel) => rappels.add(r),
    removeListener: (r: Rappel) => rappels.delete(r),
  }));
  return { rappels, changer: (v: boolean) => { sombre.v = v; rappels.forEach((r) => r()); } };
}

const racine = () => document.documentElement;
beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = '<meta name="theme-color" content="#f6f5f2">';
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks(); // ici, pas en fin de test (un échec laissait le stockage cassé)
  racine().removeAttribute("data-theme");
  racine().removeAttribute("data-choix-theme");
});

describe("src/theme.ts", () => {
  it("Auto au départ, et pour une valeur inconnue", () => {
    expect(lireChoixTheme()).toBe("auto");
    localStorage.setItem(CLE_APPARENCE, "violet");
    expect(lireChoixTheme()).toBe("auto");
  });

  it("Auto suit l'appareil ; Jour et Nuit l'ignorent", () => {
    const sombre = { v: true };
    appareil(sombre);
    appliquerTheme("auto");
    expect(racine().getAttribute("data-theme")).toBe("nuit");
    appliquerTheme("jour");
    expect(racine().getAttribute("data-theme")).toBe("jour");
    sombre.v = false;
    appliquerTheme("nuit");
    expect(racine().getAttribute("data-theme")).toBe("nuit");
    expect(racine().getAttribute("data-choix-theme")).toBe("nuit");
  });

  it("choisirTheme garde le choix, pose le thème, la barre du téléphone, et prévient les boutons", () => {
    appareil({ v: false });
    const recu: string[] = [];
    const ecoute = (e: Event) => recu.push((e as CustomEvent<ChoixTheme>).detail);
    window.addEventListener(EVENEMENT_APPARENCE, ecoute);
    choisirTheme("nuit");
    window.removeEventListener(EVENEMENT_APPARENCE, ecoute);
    expect(localStorage.getItem(CLE_APPARENCE)).toBe("nuit");
    expect(racine().getAttribute("data-theme")).toBe("nuit");
    expect(recu).toEqual(["nuit"]);
    expect(document.querySelector("meta[name=theme-color]")?.getAttribute("content")).toBe("#0b0c0f");
  });

  it("en Auto, suit l'appareil qui passe en sombre ; plus en Jour ; se désabonne", () => {
    const sombre = { v: false };
    const app = appareil(sombre);
    appliquerTheme("auto");
    const arreter = suivreAppareil();
    app.changer(true);
    expect(racine().getAttribute("data-theme")).toBe("nuit");
    choisirTheme("jour");
    app.changer(false);
    app.changer(true);
    expect(racine().getAttribute("data-theme")).toBe("jour");
    arreter();
    expect(app.rappels.size).toBe(0);
  });
});

describe("stockage refusé, autres onglets, appareil", () => {
  it("un choix fait dans un autre onglet s'applique ici, boutons compris", () => {
    appareil({ v: false });
    appliquerTheme("auto");
    const arreter = suivreAutresOnglets();
    const recu: string[] = [];
    const ecoute = (e: Event) => recu.push((e as CustomEvent<ChoixTheme>).detail);
    window.addEventListener(EVENEMENT_APPARENCE, ecoute);
    localStorage.setItem(CLE_APPARENCE, "nuit"); // fait par l'autre onglet
    window.dispatchEvent(new StorageEvent("storage", { key: CLE_APPARENCE, newValue: "nuit" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "autre-cle", newValue: "x" })); // ignoré
    window.removeEventListener(EVENEMENT_APPARENCE, ecoute);
    arreter();
    expect(racine().getAttribute("data-theme")).toBe("nuit");
    expect(recu).toEqual(["nuit"]);
  });

  it("Auto suit l'appareil selon le choix de CETTE page, même si un autre onglet a changé le stockage", () => {
    const sombre = { v: false };
    const app = appareil(sombre);
    appliquerTheme("auto");
    const arreter = suivreAppareil();
    localStorage.setItem(CLE_APPARENCE, "jour"); // autre onglet, pas encore suivi ici
    app.changer(true);
    expect(racine().getAttribute("data-theme")).toBe("nuit");
    arreter();
  });

  it("stockage refusé : le choix fait sur la page tient (lecture, appareil qui change)", () => {
    const sombre = { v: false };
    const app = appareil(sombre);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("refusé"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("refusé"); });
    const arreter = suivreAppareil();
    choisirTheme("nuit");
    expect(lireChoixTheme()).toBe("nuit");
    app.changer(false);
    expect(racine().getAttribute("data-theme")).toBe("nuit");
    arreter();
  });
});

describe("public/theme.js (avant l'affichage)", () => {
  const cas: [string | null, boolean][] = [];
  for (const choix of [null, "auto", "jour", "nuit", "violet"]) for (const sombre of [false, true]) cas.push([choix, sombre]);
  it.each(cas)("choix %s, appareil sombre %s : même thème que src/theme.ts", (choix, sombre) => {
    appareil({ v: sombre });
    if (choix !== null) localStorage.setItem(CLE_APPARENCE, choix);
    new Function(SCRIPT)();
    const parScript = [racine().getAttribute("data-theme"), racine().getAttribute("data-choix-theme"), document.querySelector("meta[name=theme-color]")?.getAttribute("content")];
    racine().removeAttribute("data-theme");
    appliquerTheme(lireChoixTheme());
    expect(parScript).toEqual([racine().getAttribute("data-theme"), racine().getAttribute("data-choix-theme"), document.querySelector("meta[name=theme-color]")?.getAttribute("content")]);
  });

  it("stockage refusé : Auto, sans erreur", () => {
    appareil({ v: true });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("refusé"); });
    expect(() => new Function(SCRIPT)()).not.toThrow();
    expect(racine().getAttribute("data-theme")).toBe("nuit");
    expect(lireChoixTheme()).toBe("auto");
  });

  it("index.html le charge dans <head>, après la balise de la barre, avant l'appli ; aucun script en ligne", () => {
    const tete = INDEX.slice(0, INDEX.indexOf("</head>"));
    expect(tete).toContain('<script src="/theme.js"></script>');
    expect(tete.indexOf('<script src="/theme.js">')).toBeGreaterThan(tete.indexOf('name="theme-color"'));
    expect(tete.match(/name="theme-color"/g)).toHaveLength(1);
    expect(INDEX.indexOf("/theme.js")).toBeLessThan(INDEX.indexOf("/src/main.tsx"));
    for (const m of INDEX.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) expect(m[2].trim()).toBe("");
  });

  it("le service worker le garde pour le hors ligne (dans PRECACHE_URLS, réseau d'abord)", () => {
    const sw = fs.readFileSync(path.join(RACINE, "public/sw.js"), "utf8");
    const precache = /const PRECACHE_URLS = \[([\s\S]*?)\];/.exec(sw)?.[1] ?? "";
    expect(precache).toMatch(/'\/theme\.js'/);
    expect(sw).toMatch(/url\.pathname === '\/theme\.js'[\s\S]{0,80}networkFirst/);
    // Le repli hors ligne attend bien la promesse du cache.
    expect(sw).toMatch(/\(await cache\.match\('\/'\)\) \?\?/);
  });

  it("main.tsx pose le thème et suit l'appareil et les autres onglets au démarrage", () => {
    const main = fs.readFileSync(path.join(RACINE, "src/main.tsx"), "utf8");
    expect(main).toMatch(/appliquerTheme\(lireChoixTheme\(\)\);\s*suivreAppareil\(\);\s*suivreAutresOnglets\(\);/);
  });
});
