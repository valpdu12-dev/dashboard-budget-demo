// @vitest-environment node
// ── Les soldes du profil Démo — Patrimoine D-3 (plan 33) ─────────────────
//
// Ces tests vérifient le FICHIER publié `public/data/patrimoine.json`, pas le
// générateur : un générateur juste dont on aurait oublié de rejouer la sortie
// laisserait passer un fichier périmé.
//
// Le jeu (scripts/generate-demo-data.mjs, section 8 ter), refait à la main.
// k = rang du mois, 0 = septembre 2024 ; 23 = août 2026, dernier mois gardé.
//
//   ordre | compte                          | nature     | relevés | solde
//   ------|---------------------------------|------------|---------|---------------------------
//     1   | Banque A - Courant              | Liquidité  |   24    | 2 350,40 + 45 × (k mod 6)
//     2   | Banque B - Courant              | Liquidité  |   24    | 1 820 + 30 × (k mod 4)
//     3   | Banque A - Livret               | Epargne    |   23    | 6 000 + 150 × k  (nov. 2025 vide)
//     4   | Banque C - Livret               | Epargne    |   24    | 3 500 + 200 × k
//    4.1  | Banque B - Compte titres        | Epargne    |   24    | 1 000 + 80 × k
//     5   | Assurance-vie Banque B          | Epargne    |   17    | 5 000 + 120 × (k − 7), dès avril 2025
//     6   | Retraite Banque C               | Epargne    |   24    | 2 000 + 100 × k
//     7   | Appartement - capital remboursé | Immobilier |   24    | capital remboursé du prêt de la démo
//
//   Relevés gardés : 6 × 24 + 23 + 17 = 184.
//   Pas encore saisis : septembre 2026 pour les 7 comptes ordinaires + l'oubli = 8.
//   Futurs : l'appartement, prérempli de septembre 2026 à décembre 2027 = 16.
//   Lignes lues : 184 + 8 + 16 = 208.
//
//   Août 2026 (k = 23) : 2 575,40 + 1 910 + 9 450 + 8 100 + 2 840 + 6 920 + 4 300
//                        + 30 345,45 = 66 440,85 €.
//   Septembre 2024 (k = 0, sans l'assurance-vie) : 2 350,40 + 1 820 + 6 000 + 3 500
//                        + 1 000 + 2 000 + 15 228,41 = 31 898,81 €.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { lireClasseurPublic, type PatrimoineLu, type ReleveSoldeLu } from "@/services/lectureClasseur";
import type { Config } from "@/types";
import { lireListeNoire, trouverInterdit, listeFacultative } from "../../../scripts/listeNoire.mjs";

const DATA = resolve(__dirname, "../../../public/data");
const texteFichier = readFileSync(resolve(DATA, "patrimoine.json"), "utf8");
const fichier = JSON.parse(texteFichier) as PatrimoineLu & { _lisez_moi: string };
const config = JSON.parse(readFileSync(resolve(DATA, "config.json"), "utf8")) as Config;
const releves = fichier.releves;

const arrondi = (v: number) => Math.round(v * 100) / 100;
const totalDuMois = (mk: string, f: (r: ReleveSoldeLu) => boolean = () => true) =>
  arrondi(releves.filter((r) => r.mk === mk && f(r)).reduce((s, r) => s + r.montant, 0));
const duCompte = (compte: string) => releves.filter((r) => r.compte === compte);
const soldeDe = (compte: string, mk: string) => duCompte(compte).find((r) => r.mk === mk)?.montant;

const LIVRET_A = "Banque A - Livret";
const ASSURANCE_VIE = "Assurance-vie Banque B";
const APPARTEMENT = "Appartement - capital remboursé";

// ═══════════════════════════════════════════════════════════════════════

describe("patrimoine.json — la forme du rapport du lecteur D-1", () => {
  it("porte les clés du rapport, plus le lisez-moi", () => {
    expect(Object.keys(fichier)).toEqual(["_lisez_moi", "releves", "nbComptes", "dernierMois", "compteurs"]);
    expect(fichier._lisez_moi).toMatch(/fictifs/);
  });

  it("chaque relevé a exactement les champs du lecteur, dans son ordre", () => {
    for (const r of releves) {
      expect(Object.keys(r)).toEqual(["ordre", "compte", "nature", "banque", "mk", "date", "montant"]);
      expect(typeof r.ordre).toBe("number");
      expect(r.compte).not.toBe("");
      expect(r.banque).not.toBe("");
    }
  });

  it("se relit à l'identique par le lecteur D-1, sans une alerte", () => {
    // Une feuille « Patrimoine » écrite depuis les relevés, relue par le vrai
    // lecteur à la fin de relevé de la démo : il doit rendre les mêmes relevés.
    const serie = (iso: string) => {
      const [a, m, j] = iso.split("-").map(Number);
      return (Date.UTC(a, m - 1, j) - Date.UTC(1899, 11, 30)) / 86_400_000;
    };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Date", "Compte", "Type", "Montant", "Sens"],
      ["03/01/2026", "Banque A - Courant", "Virement extérieur", 1000, "Crédit"],
    ]), "Transactions");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Ordre", "Transaction", "Epargne/Liquidité", "Banque", "Date", "Montant"],
      ...releves.map((r) => [r.ordre, r.compte, r.nature, r.banque, serie(r.date), r.montant]),
    ]), "Patrimoine");
    const relu = XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "array" }), { type: "array" });
    const rapport = lireClasseurPublic(relu, { aujourdhui: config.couverture!.fin });

    expect(rapport.anomalies.filter((a) => /patrimoine/i.test(a.feuille))).toEqual([]);
    expect(rapport.patrimoine!.releves).toEqual(releves);
    expect(rapport.patrimoine!.nbComptes).toBe(fichier.nbComptes);
    expect(rapport.patrimoine!.dernierMois).toBe(fichier.dernierMois);
    expect(rapport.patrimoine!.compteurs).toEqual({ lignesLues: 184, gardees: 184, futures: 0, nonSaisies: 0, ignorees: 0 });
  });
});

describe("les règles du lecteur sont respectées", () => {
  it("trois natures seulement, et les trois sont présentes", () => {
    expect(new Set(releves.map((r) => r.nature))).toEqual(new Set(["Epargne", "Liquidité", "Immobilier"]));
  });

  it("un seul relevé par compte et par mois", () => {
    const cles = releves.map((r) => `${r.compte}|${r.mk}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("toutes les dates sont en fin de mois, et le mois est celui de la date", () => {
    for (const r of releves) {
      const [a, m, j] = r.date.split("-").map(Number);
      expect(j, r.date).toBe(new Date(Date.UTC(a, m, 0)).getUTCDate());
      expect(r.mk).toBe(r.date.slice(0, 7));
    }
  });

  it("aucun relevé à la fin de relevé de la démo ou après — jamais l'horloge", () => {
    // Fin de relevé : 15/09/2026. Le relevé du 30/09/2026 n'est pas passé.
    expect(config.couverture!.fin).toBe("2026-09-15");
    expect(releves.every((r) => r.date < config.couverture!.fin)).toBe(true);
    expect(fichier.dernierMois).toBe("2026-08");
  });

  it("triés comme le lecteur : mois, puis ordre", () => {
    const tries = [...releves].sort((a, b) => a.mk.localeCompare(b.mk) || a.ordre! - b.ordre!);
    expect(releves).toEqual(tries);
  });

  it("montants au centime", () => {
    for (const r of releves) expect(arrondi(r.montant)).toBe(r.montant);
  });

  it("les compteurs se tiennent entre eux", () => {
    const c = fichier.compteurs;
    expect(c.lignesLues).toBe(c.gardees + c.futures + c.nonSaisies + c.ignorees);
    expect(c.gardees).toBe(releves.length);
    expect(fichier.nbComptes).toBe(new Set(releves.map((r) => r.compte)).size);
  });
});

describe("les cas obligatoires du plan", () => {
  it("un bien en nature Immobilier : le capital remboursé du prêt de la démo", () => {
    const immo = duCompte(APPARTEMENT);
    expect(immo).toHaveLength(24);
    expect(immo.every((r) => r.nature === "Immobilier" && r.banque === "Immobilier")).toBe(true);
    expect(soldeDe(APPARTEMENT, "2024-09")).toBe(15228.41);
    expect(soldeDe(APPARTEMENT, "2026-08")).toBe(30345.45);
    // Le capital remboursé ne fait que monter.
    for (let i = 1; i < immo.length; i++) expect(immo[i].montant).toBeGreaterThan(immo[i - 1].montant);
  });

  it("un compte qui démarre tard : l'assurance-vie, en avril 2025", () => {
    const av = duCompte(ASSURANCE_VIE);
    expect(av).toHaveLength(17);
    expect(av[0].mk).toBe("2025-04");
    expect(av[0].montant).toBe(5000);
    expect(releves.filter((r) => r.mk < "2025-04" && r.compte === ASSURANCE_VIE)).toEqual([]);
    // Avant avril 2025 : 7 comptes par mois ; ensuite 8.
    expect(releves.filter((r) => r.mk === "2025-03")).toHaveLength(7);
    expect(releves.filter((r) => r.mk === "2025-04")).toHaveLength(8);
  });

  it("un oubli de saisie : le livret de la banque A manque en novembre 2025", () => {
    expect(duCompte(LIVRET_A)).toHaveLength(23);
    expect(soldeDe(LIVRET_A, "2025-10")).toBe(7950);
    expect(soldeDe(LIVRET_A, "2025-11")).toBeUndefined();
    expect(soldeDe(LIVRET_A, "2025-12")).toBe(8250);
    expect(releves.filter((r) => r.mk === "2025-11")).toHaveLength(7);
  });

  it("un prêt prérempli dans le futur : 16 lignes comptées, aucune gardée", () => {
    // Septembre 2026 → décembre 2027 = 16 fins de mois, toutes ≥ 15/09/2026.
    expect(fichier.compteurs.futures).toBe(16);
    expect(releves.some((r) => r.mk >= "2026-09")).toBe(false);
  });

  it("un ordre décimal : 4.1, entre 4 et 5", () => {
    const ordres = releves.filter((r) => r.mk === "2026-08").map((r) => r.ordre);
    expect(ordres).toEqual([1, 2, 3, 4, 4.1, 5, 6, 7]);
  });

  it("septembre 2026 pas encore saisi : 7 comptes, plus l'oubli = 8 non saisis", () => {
    expect(fichier.compteurs.nonSaisies).toBe(8);
  });
});

describe("compteurs et totaux, calculés à la main", () => {
  it("208 lignes lues = 184 gardées + 16 futures + 8 non saisies, 8 comptes", () => {
    expect(fichier.compteurs).toEqual({ lignesLues: 208, gardees: 184, futures: 16, nonSaisies: 8, ignorees: 0 });
    expect(fichier.nbComptes).toBe(8);
  });

  it("le nombre de relevés de chaque compte", () => {
    const n = new Map<string, number>();
    for (const r of releves) n.set(r.compte, (n.get(r.compte) ?? 0) + 1);
    expect(Object.fromEntries(n)).toEqual({
      "Banque A - Courant": 24,
      "Banque B - Courant": 24,
      [LIVRET_A]: 23,
      "Banque C - Livret": 24,
      "Banque B - Compte titres": 24,
      [ASSURANCE_VIE]: 17,
      "Retraite Banque C": 24,
      [APPARTEMENT]: 24,
    });
  });

  it("août 2026 : 66 440,85 €", () => {
    expect(totalDuMois("2026-08")).toBe(66440.85);
    expect(totalDuMois("2026-08", (r) => r.nature === "Liquidité")).toBe(4485.4);
    expect(totalDuMois("2026-08", (r) => r.nature === "Epargne")).toBe(31610);
    expect(totalDuMois("2026-08", (r) => r.nature === "Immobilier")).toBe(30345.45);
  });

  it("septembre 2024 : 31 898,81 €, sans l'assurance-vie", () => {
    expect(totalDuMois("2024-09")).toBe(31898.81);
    expect(releves.filter((r) => r.mk === "2024-09")).toHaveLength(7);
  });

  it("24 mois, de septembre 2024 à août 2026", () => {
    const mois = [...new Set(releves.map((r) => r.mk))];
    expect(mois).toHaveLength(24);
    expect(mois[0]).toBe("2024-09");
    expect(mois[mois.length - 1]).toBe("2026-08");
  });
});

describe("aucun nom réel", () => {
  const { motifs, erreurs } = lireListeNoire(resolve(__dirname, "../../.."));

  it.skipIf(motifs === null && listeFacultative())(
    "patrimoine.json ne contient aucun nom de la liste noire",
    () => {
      expect(erreurs).toEqual([]);
      // Un numéro de motif, jamais le texte trouvé.
      expect(trouverInterdit(texteFichier, motifs ?? [])).toBeNull();
    }
  );

  it("des comptes et des banques génériques seulement", () => {
    for (const r of releves) {
      expect(r.banque).toMatch(/^(Banque [ABC]|Immobilier)$/);
      expect(r.compte).toMatch(/^(Banque [ABC] - |Assurance-vie Banque B$|Retraite Banque C$|Appartement - )/);
    }
  });
});
