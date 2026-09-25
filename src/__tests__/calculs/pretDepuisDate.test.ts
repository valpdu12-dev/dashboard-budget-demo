// ── Le prêt calculé depuis sa date — lot F.1 ─────────────────────────────
//
// F1 : capital, date, taux et durée donnent l'échéancier ENTIER. L'échéance
// courante est le nombre de mois entre l'échéance n° 1 et le dernier mois
// des données — jamais l'horloge de la machine.
//
// Tous les prêts ci-dessous sont calculés À LA MAIN (taux 0 % pour la
// plupart : la mensualité est alors montant / durée). Aucun ne vient de la
// démonstration.
//
// Le test « sait échouer » est le dernier : mêmes transactions, date décalée
// d'un an → la position change de 12 échéances. S'il passait avec les deux
// dates, la date ne servirait à rien.

import { describe, it, expect } from "vitest";
import { calculerPret } from "@/calculs/calculPret";
import { reglesVides } from "@/calculs/regles";
import { makeTx, makeConfig } from "../helpers/factories";

type Pret = { montant: number; mensualite: number; echeances: number; taux_annuel?: number; date_debut?: string; premiere_echeance?: string };

/** Une seule transaction, sans rapport avec le prêt : elle fixe le dernier mois des données. */
const donneesJusqua = (mk: string) => [makeTx({ date: `${mk}-10`, monthKey: mk })];

const calcul = (pret: Pret, dernierMois: string) =>
  calculerPret(donneesJusqua(dernierMois), makeConfig({ pret }), reglesVides());

describe("F.1 — position calculée depuis la date", () => {
  it("date en janvier : 12 000 € à 0 % sur 12 mois, données jusqu'en avril → échéance 4", () => {
    const p = calcul({ montant: 12000, mensualite: 1000, echeances: 12, taux_annuel: 0, date_debut: "2026-01" }, "2026-04");
    expect(p.positionEstimee).toBe(false);
    expect(p.kpis!.echeancesPayees).toBe(4);
    expect(p.kpis!.echeancesRestantes).toBe(8);
    expect(p.kpis!.capitalRestant).toBeCloseTo(8000, 2);
    expect(p.dateFin).toBe("2026-12");
    expect(p.projectionData[0].monthKey).toBe("2026-01");
  });

  it("date en milieu d'année, à cheval sur deux ans : juillet 2025 → février 2026 = échéance 8", () => {
    const p = calcul({ montant: 12000, mensualite: 1000, echeances: 12, taux_annuel: 0, date_debut: "2025-07" }, "2026-02");
    expect(p.kpis!.echeancesPayees).toBe(8);
    expect(p.kpis!.capitalRestant).toBeCloseTo(4000, 2);
    expect(p.dateFin).toBe("2026-06");
  });

  it("durée d'un mois : soldé dès sa seule échéance", () => {
    const p = calcul({ montant: 5000, mensualite: 5000, echeances: 1, taux_annuel: 0, date_debut: "2026-03" }, "2026-03");
    expect(p.kpis!.echeancesPayees).toBe(1);
    expect(p.kpis!.echeancesRestantes).toBe(0);
    expect(p.kpis!.capitalRestant).toBeCloseTo(0, 2);
    expect(p.dateFin).toBe("2026-03");
  });

  it("dernier mois des données AVANT la date : le prêt n'a pas commencé", () => {
    const p = calcul({ montant: 12000, mensualite: 1000, echeances: 12, taux_annuel: 0, date_debut: "2026-06" }, "2026-04");
    expect(p.kpis!.echeancesPayees).toBe(0);
    expect(p.kpis!.capitalRestant).toBe(12000);
    expect(p.projectionData.every((pt) => pt.isProjection)).toBe(true);
    expect(p.dateFin).toBe("2027-05");
  });

  it("données au-delà de la dernière échéance : soldé, jamais plus que la durée", () => {
    const p = calcul({ montant: 12000, mensualite: 1000, echeances: 12, taux_annuel: 0, date_debut: "2020-01" }, "2026-04");
    expect(p.kpis!.echeancesPayees).toBe(12);
    expect(p.kpis!.capitalRestant).toBeCloseTo(0, 2);
  });

  it("taux non nul, calculé à la main : 10 000 € à 12 %/an sur 2 mois", () => {
    // r = 1 %/mois ; M = 10 000 × 0,01 / (1 − 1,01^−2) = 5 075,12
    // échéance 1 : intérêts 100, capital 4 975,12, reste 5 024,88
    const p = calcul({ montant: 10000, mensualite: 5075.12, echeances: 2, taux_annuel: 0.12, date_debut: "2026-01" }, "2026-01");
    expect(p.kpis!.echeancesPayees).toBe(1);
    expect(p.kpis!.capitalRestant).toBeCloseTo(5024.88, 2);
    expect(p.kpis!.interetsPayes).toBeCloseTo(100, 2);
  });

  it("« première échéance » situe le prêt comme « date de début » (O5)", () => {
    const p = calcul({ montant: 12000, mensualite: 1000, echeances: 12, premiere_echeance: "2026-01" }, "2026-04");
    expect(p.positionEstimee).toBe(false);
    expect(p.kpis!.echeancesPayees).toBe(4);
  });
});

describe("F8 — sans date, la position est estimée et le dit", () => {
  it("positionEstimee vaut vrai, moisDebut est vide", () => {
    const p = calcul({ montant: 12000, mensualite: 1000, echeances: 12 }, "2026-04");
    expect(p.positionEstimee).toBe(true);
    expect(p.moisDebut).toBe("");
  });
});

describe("F.1 — la preuve qui sait échouer", () => {
  it("mêmes données, date décalée d'un an → 12 échéances d'écart", () => {
    const pret = { montant: 24000, mensualite: 1000, echeances: 24, taux_annuel: 0 };
    const a = calcul({ ...pret, date_debut: "2026-01" }, "2026-04");
    const b = calcul({ ...pret, date_debut: "2025-01" }, "2026-04");
    expect(a.kpis!.echeancesPayees).toBe(4);
    expect(b.kpis!.echeancesPayees).toBe(16);
    expect(a.kpis!.capitalRestant - b.kpis!.capitalRestant).toBeCloseTo(12000, 2);
  });
});
