/**
 * Lot A.3 — contrôle du jeu de démonstration produit par
 * `scripts/generate-demo-data.mjs`.
 *
 * Ces tests ne vérifient pas le générateur : ils vérifient les FICHIERS
 * effectivement publiés. Un générateur correct dont on aurait oublié de
 * rejouer la sortie laisserait passer des fichiers périmés.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeTransactions, extractAllMonths } from "@/utils/decode";
import { moisComparables } from "@/utils/couverture";
import type { RawTransactionsJSON, Config, SalaryData } from "@/types";

const lire = <T,>(nom: string): T =>
  JSON.parse(readFileSync(resolve(__dirname, "../../../public/data", nom), "utf8"));

const brut = lire<RawTransactionsJSON>("transactions.json");
const config = lire<Config>("config.json");
const salaire = lire<SalaryData>("salary.json");
const references = lire<{
  inflation: { year: string; rate_annual: number | null }[];
  smic: { year: string; net_monthly: number; brut_monthly: number; date_effective: string }[];
  sources: { serie: string; url: string; producteur: string }[];
  consulte_le: string;
}>("references.json");
const budgets = lire<{ cat2: string; target: number | null; active: boolean }[]>("budgets.json");

const transactions = decodeTransactions(brut);
const mois = extractAllMonths(transactions);

describe("transactions.json — format attendu par decode.ts", () => {
  it("se décode sans champ indéfini", () => {
    for (const t of transactions) {
      expect(t.compte).toBeTypeOf("string");
      expect(t.type).toBeTypeOf("string");
      expect(t.dc).toBeTypeOf("string");
      expect(t.cat1).toBeTypeOf("string");
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isFinite(t.montant)).toBe(true);
    }
  });

  it("n'a que des montants strictement positifs — le sens vient de dc", () => {
    expect(transactions.every((t) => t.montant > 0)).toBe(true);
  });

  it("n'utilise que « Débit » et « Crédit »", () => {
    expect(new Set(transactions.map((t) => t.dc))).toEqual(new Set(["Débit", "Crédit"]));
  });

  it("porte au moins 700 lignes sur 24 mois ou plus", () => {
    expect(transactions.length).toBeGreaterThan(700);
    expect(mois.length).toBeGreaterThanOrEqual(24);
  });
});

describe("couverture temporelle — le seuil de trois mois est franchi", () => {
  const comparables = moisComparables(mois);

  it("laisse largement plus d'un mois comparable", () => {
    // Sous trois mois de données, la page Budget n'affiche plus rien de
    // calculé et la démo s'ouvrirait sur un bandeau « indisponible ».
    expect(comparables.length).toBeGreaterThanOrEqual(12);
  });

  it("exclut bien les deux mois de bord", () => {
    expect(comparables).not.toContain(mois[0]);
    expect(comparables).not.toContain(mois[mois.length - 1]);
    expect(comparables.length).toBe(mois.length - 2);
  });

  it("contient un mois intérieur SANS AUCUNE DÉPENSE", () => {
    // C'est le cas que traite la règle de couverture : un mois couvert sans
    // dépense vaut 0 €, il compte, il n'est pas absent. Il doit être
    // visible dans la démo, pas seulement dans les tests unitaires.
    const moisAvecDepense = new Set(
      transactions.filter((t) => t.dc === "Débit").map((t) => t.monthKey)
    );
    const sansDepense = comparables.filter((mk) => !moisAvecDepense.has(mk));
    expect(sansDepense.length).toBeGreaterThanOrEqual(1);
    // …et il porte quand même une recette : c'est un mois couvert, pas un trou.
    for (const mk of sansDepense) {
      expect(transactions.some((t) => t.monthKey === mk)).toBe(true);
    }
  });

  it("contient des mois volontairement incomplets", () => {
    const parMois = new Map<string, number>();
    for (const t of transactions) parMois.set(t.monthKey, (parMois.get(t.monthKey) ?? 0) + 1);
    const median = [...parMois.values()].sort((a, b) => a - b)[Math.floor(parMois.size / 2)];
    const maigres = [...parMois.values()].filter((n) => n < median / 2);
    expect(maigres.length).toBeGreaterThanOrEqual(2);
  });
});

describe("config.json", () => {
  it("déclare un solde de départ par compte à solde propre", () => {
    expect(Object.keys(config.init ?? {}).length).toBeGreaterThanOrEqual(5);
  });

  it("déclare un prêt cohérent avec sa propre mensualité", () => {
    const p = config.pret!;
    expect(p).toBeDefined();
    // La mensualité doit être celle d'un prêt amortissable de ce montant sur
    // cette durée, à un taux plausible. Sinon la page Prêt reconstruirait un
    // taux aberrant sans le dire.
    const r = (() => {
      let lo = 1e-7, hi = 0.05;
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        const m = (p.montant * mid) / (1 - Math.pow(1 + mid, -p.echeances));
        if (m > p.mensualite) hi = mid; else lo = mid;
      }
      return (lo + hi) / 2;
    })();
    const tauxAnnuel = r * 12;
    expect(tauxAnnuel).toBeGreaterThan(0.005);
    expect(tauxAnnuel).toBeLessThan(0.06);
  });

  it("déclare ses bornes de couverture, même si rien ne les lit encore", () => {
    expect(config.couverture?.debut).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(config.couverture?.fin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("se signale comme jeu de démonstration", () => {
    expect(config.demo).toBe(true);
  });
});

describe("salary.json — 5 ans de paie", () => {
  it("couvre au moins 60 mois", () => {
    expect(salaire.months.length).toBeGreaterThanOrEqual(60);
  });

  it("montre plusieurs employeurs", () => {
    expect(new Set(salaire.months.map((m) => m.entreprise)).size).toBeGreaterThanOrEqual(3);
  });

  it("a un brut supérieur au net hors indemnités", () => {
    for (const m of salaire.months) {
      expect(m.brut).toBeGreaterThan(m.net - m.indem);
    }
  });
});

describe("references.json — données publiques réelles", () => {
  it("cite une source et une date de consultation pour chaque série", () => {
    expect(references.consulte_le).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const s of references.sources) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.producteur.length).toBeGreaterThan(0);
    }
  });

  it("porte l'inflation annuelle de 2013 à 2025", () => {
    const annees = references.inflation.map((i) => i.year);
    expect(annees[0]).toBe("2013");
    expect(annees[annees.length - 1]).toBe("2025");
    expect(references.inflation.every((i) => typeof i.rate_annual === "number")).toBe(true);
  });

  it("porte le SMIC net de 2013 à 2026, comme la base d'origine", () => {
    expect(references.smic.map((s) => s.year)).toEqual(
      Array.from({ length: 14 }, (_, i) => String(2013 + i))
    );
    expect(references.smic.every((s) => typeof s.net_monthly === "number")).toBe(true);
    expect(references.smic.every((s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s.date_effective))).toBe(true);
  });

  it("garde un rapport net/brut plausible sur toute la série", () => {
    // Un net qui s'écarterait de son brut trahirait une ligne saisie depuis
    // une autre source, ou une coquille. La plage large couvre le
    // changement de régime de cotisations de 2019 et les années où le net
    // suit une revalorisation de milieu d'année.
    for (const s of references.smic) {
      const ratio = s.net_monthly / s.brut_monthly;
      expect(ratio).toBeGreaterThan(0.75);
      expect(ratio).toBeLessThan(0.84);
    }
  });

  it("progresse d'année en année", () => {
    const nets = references.smic.map((s) => s.net_monthly);
    for (let i = 1; i < nets.length; i++) {
      expect(nets[i]).toBeGreaterThan(nets[i - 1]);
    }
  });
});

describe("budgets.json", () => {
  it("propose des objectifs, dont certains inactifs", () => {
    expect(budgets.filter((b) => b.active).length).toBeGreaterThanOrEqual(5);
    expect(budgets.some((b) => !b.active)).toBe(true);
  });
});

describe("aucune donnée personnelle dans les fichiers publiés", () => {
  it("ne contient aucun établissement, employeur ni lieu réel", () => {
    const tout = [
      readFileSync(resolve(__dirname, "../../../public/data/transactions.json"), "utf8"),
      readFileSync(resolve(__dirname, "../../../public/data/salary.json"), "utf8"),
      readFileSync(resolve(__dirname, "../../../public/data/config.json"), "utf8"),
      readFileSync(resolve(__dirname, "../../../public/data/budgets.json"), "utf8"),
    ].join("\n");
    const interdits = [
      "Agricole", "Caisse d", "Bourso", "Edenred", "Tricount", "Lydia",
      "SCALIAN", "ALTRAN", "Monoprix", "Joinville", "Duchamp",
    ];
    for (const mot of interdits) expect(tout).not.toContain(mot);
  });
});
