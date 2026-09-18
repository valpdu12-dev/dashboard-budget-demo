// ── La migration du stockage v2 → v3 — lot C.6, décision D6 ──────────────
//
// Critère de sortie du C.6 : « Un jeu mémorisé par la version d'aujourd'hui,
// relu par la nouvelle, donne soit les mêmes chiffres, soit un message
// explicite. Vérifié en fabriquant un contenu `version: 2` à la main. »
//
// C'est exactement ce que fait ce fichier : il écrit dans `localStorage` un
// contenu au schéma 2 — celui que le lot B.5 produisait — et vérifie ce que la
// version d'après en fait.
//
// ⚠️ LE RISQUE NOMMÉ AU PLAN : migrer à moitié. Un jeu à demi converti
// remplirait le tableau de bord de chiffres partiellement faux, sans que rien
// ne le dise. La migration est donc TOUT OU RIEN, et le refus est VISIBLE.

import { describe, it, expect, beforeEach } from "vitest";
import {
  CLE, CLE_V2, VERSION_SCHEMA, lireJeuMemorise, memoriserJeu,
  type JeuDonnees,
} from "@/services/jeuDonnees";
import { encodeTransactions, decodeTransactions } from "@/utils/decode";
import { makeTx, makeSalaryData, makeConfig } from "../helpers/factories";

const TX = [
  makeTx({ date: "2026-01-05", montant: 42.15, label: "Courses" }),
  makeTx({ date: "2026-02-04", montant: 18, label: "Essence" }),
];

/** Un jeu tel que le lot B.5 le mémorisait : schéma 2, sans configuration. */
function jeuV2(over: Partial<JeuDonnees> = {}): unknown {
  return {
    version: 2,
    origine: "upload",
    importedAt: "2026-09-10T08:00:00.000Z",
    fileName: "mon-classeur.xlsx",
    transactions: encodeTransactions(TX),
    salary: makeSalaryData([]),
    config: { init: { "Caisse de bord": 1000 }, demo: false },
    budgets: [],
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════

describe("un jeu au schéma 2 est CONVERTI, pas jeté", () => {
  it("rend les mêmes chiffres, au schéma 3", () => {
    localStorage.setItem(CLE_V2, JSON.stringify(jeuV2()));
    const { jeu } = lireJeuMemorise();

    expect(jeu).not.toBeNull();
    expect(jeu!.version).toBe(VERSION_SCHEMA);
    expect(jeu!.version).toBe(3);
    expect(jeu!.fileName).toBe("mon-classeur.xlsx");
    expect(jeu!.importedAt).toBe("2026-09-10T08:00:00.000Z");
    expect(decodeTransactions(jeu!.transactions)).toHaveLength(2);
    expect(decodeTransactions(jeu!.transactions)[0].montant).toBe(42.15);
    expect(jeu!.config.init).toEqual({ "Caisse de bord": 1000 });
  });

  it("le dit à l'écran — pas dans la console", () => {
    localStorage.setItem(CLE_V2, JSON.stringify(jeuV2()));
    const { avis } = lireJeuMemorise();

    expect(avis).not.toBeNull();
    expect(avis!.code).toBe("migre");
    expect(avis!.titre).toMatch(/sans leur configuration/);
    expect(avis!.message).toMatch(/Réimportez/);
  });

  it("ne porte aucune configuration — et n'en invente aucune", () => {
    // Le schéma 2 ne la connaissait pas. L'inventer serait exactement le
    // mélange de deux jeux que le lot B.5 a supprimé.
    localStorage.setItem(CLE_V2, JSON.stringify(jeuV2()));
    const { jeu } = lireJeuMemorise();
    expect(jeu!.config.parametrage).toBeUndefined();
  });

  it("efface la clé du schéma 2 : on ne migre pas deux fois", () => {
    localStorage.setItem(CLE_V2, JSON.stringify(jeuV2()));
    lireJeuMemorise();

    expect(localStorage.getItem(CLE_V2)).toBeNull();
    expect(localStorage.getItem(CLE)).not.toBeNull();
  });

  it("la deuxième relecture ne redit plus rien : le jeu est au schéma courant", () => {
    localStorage.setItem(CLE_V2, JSON.stringify(jeuV2()));
    lireJeuMemorise();

    const seconde = lireJeuMemorise();
    expect(seconde.jeu).not.toBeNull();
    expect(seconde.avis).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("tout ou rien — un contenu qu'on ne sait pas convertir est refusé", () => {
  const tronques: Array<[string, unknown]> = [
    ["sans transactions", jeuV2({ transactions: undefined })],
    ["sans salaire", jeuV2({ salary: undefined })],
    ["sans configuration", jeuV2({ config: undefined })],
    ["transactions mal formées", jeuV2({ transactions: { s: "pas un tableau" } as never })],
  ];

  for (const [nom, contenu] of tronques) {
    it(`${nom} : rien n'est posé, et la clé n'est pas effacée`, () => {
      localStorage.setItem(CLE_V2, JSON.stringify(contenu));
      const { jeu } = lireJeuMemorise();

      expect(jeu).toBeNull();
      // Ne rien effacer laisse une chance de récupérer le contenu à la main.
      expect(localStorage.getItem(CLE_V2)).not.toBeNull();
      expect(localStorage.getItem(CLE)).toBeNull();
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════

describe("une version inconnue est refusée À VOIX HAUTE", () => {
  it("rend un avis, et n'efface rien", () => {
    localStorage.setItem(CLE, JSON.stringify(jeuV2({ version: 99 })));
    const { jeu, avis } = lireJeuMemorise();

    expect(jeu).toBeNull();
    expect(avis!.code).toBe("version-inconnue");
    expect(avis!.message).toMatch(/n'ont pas été effacées/);
    expect(localStorage.getItem(CLE)).not.toBeNull();
  });

  it("un contenu illisible rend un avis, lui aussi", () => {
    localStorage.setItem(CLE, "{ ceci n'est pas du JSON");
    const { jeu, avis } = lireJeuMemorise();

    expect(jeu).toBeNull();
    expect(avis!.code).toBe("illisible");
  });
});

// ═══════════════════════════════════════════════════════════════════════

describe("un jeu au schéma courant traverse sans un mot", () => {
  it("se relit à l'identique, sans avis", () => {
    const jeu: JeuDonnees = {
      version: VERSION_SCHEMA,
      origine: "upload",
      importedAt: "2026-09-17T08:00:00.000Z",
      fileName: "a.xlsx",
      transactions: encodeTransactions(TX),
      salary: makeSalaryData([]),
      config: makeConfig(),
      budgets: [],
    };
    expect(memoriserJeu(jeu)).toBe(true);

    const relu = lireJeuMemorise();
    expect(relu.avis).toBeNull();
    expect(relu.jeu!.config.parametrage).toBeDefined();
    expect(decodeTransactions(relu.jeu!.transactions)).toHaveLength(2);
  });
});
