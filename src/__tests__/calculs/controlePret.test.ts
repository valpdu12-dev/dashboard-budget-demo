// ── Le contrôle de cohérence du prêt — lot F.2 ───────────────────────────
//
// F2 : les transactions VÉRIFIENT la déclaration. Chaque test « qui sait
// échouer » part des MÊMES transactions, calculées ici à la main, et ne
// change que la déclaration : si le contrôle se taisait, il ne mesurerait
// rien.
//
// Le prêt : 120 000 € à 12 %/an (1 %/mois) sur 24 mois, première échéance
// en janvier 2025. Aucun chiffre ne vient de la démonstration.

import { describe, it, expect } from "vitest";
import { calculerPret, mensualiteDepuisTaux, TOLERANCE_INTERETS } from "@/calculs/calculPret";
import { construireRegles } from "@/calculs/regles";
import { makeTx, makeConfig } from "../helpers/factories";

const MONTANT = 120000;
const TAUX = 0.12;
const DUREE = 24;
const MENSUALITE = mensualiteDepuisTaux(MONTANT, TAUX, DUREE);

/** Les échéances n° 13 à 16 (janvier à avril 2026), calculées indépendamment du code testé. */
function transactionsDuPret(decalageInterets = 0) {
  let solde = MONTANT;
  const out = [];
  for (let k = 1; k <= 16; k++) {
    const interet = Math.round(solde * 0.01 * 100) / 100;
    const capital = Math.round((MENSUALITE - interet) * 100) / 100;
    solde -= capital;
    if (k < 13) continue;
    const mk = `2026-${String(k - 12).padStart(2, "0")}`;
    out.push(
      makeTx({ date: `${mk}-05`, monthKey: mk, type: "Crédit Immobilier", dc: "Débit", montant: capital }),
      makeTx({ date: `${mk}-05`, monthKey: mk, type: "Intérêt du prêt", dc: "Débit", montant: interet + decalageInterets }),
    );
  }
  return out;
}

const controle = (pret: Record<string, unknown>, tx = transactionsDuPret()) => {
  const config = makeConfig({ pret: { montant: MONTANT, mensualite: MENSUALITE, echeances: DUREE, ...pret } });
  return calculerPret(tx, config, construireRegles(config)).controle;
};

describe("F.2 — le bon prêt : le contrôle se tait", () => {
  it("date et taux justes → concorde, 4 mois comparés, aucun écart", () => {
    const c = controle({ taux_annuel: TAUX, date_debut: "2025-01" });
    expect(c.etat).toBe("concorde");
    expect(c.moisCompares).toBe(4);
    expect(c.ecarts).toEqual([]);
    expect(c.message).toBe("");
  });
});

describe("F.2 — les preuves qui savent échouer", () => {
  it("taux faux d'un point (13 % au lieu de 12 %) → diverge, et le dit chiffré", () => {
    const pret = { taux_annuel: 0.13, mensualite: mensualiteDepuisTaux(MONTANT, 0.13, DUREE), date_debut: "2025-01" };
    const c = controle(pret);
    expect(c.etat).toBe("diverge");
    expect(c.ecarts).toHaveLength(4);
    expect(c.message).toContain("Vérifiez la date de début et le taux");
    expect(c.message).toMatch(/intérêts lus \d/);
  });

  it("date décalée d'un an → diverge, et propose la date qui collerait", () => {
    const c = controle({ taux_annuel: TAUX, date_debut: "2024-01" });
    expect(c.etat).toBe("diverge");
    expect(c.ecarts[0].echeance).toBe(25);
    expect(c.message).toContain("après la dernière échéance déclarée");
  });

  it("date décalée de six mois, dans la durée → propose l'échéance et la date justes", () => {
    const c = controle({ taux_annuel: TAUX, date_debut: "2025-07" });
    expect(c.etat).toBe("diverge");
    expect(c.message).toContain("correspondent à l'échéance n° 16");
  });

  it("prêt déclaré après les transactions → échéance 0, « avant la première échéance »", () => {
    const c = controle({ taux_annuel: TAUX, date_debut: "2026-06" });
    expect(c.etat).toBe("diverge");
    expect(c.ecarts[0].echeance).toBeLessThan(1);
    expect(c.message).toContain("avant la première échéance déclarée");
  });
});

describe("F.2 — la tolérance O1, aux deux bords", () => {
  it("intérêts décalés de 1,50 € → dans la tolérance, concorde", () => {
    const c = controle({ taux_annuel: TAUX, date_debut: "2025-01" }, transactionsDuPret(1.5));
    expect(TOLERANCE_INTERETS).toBe(2);
    expect(c.etat).toBe("concorde");
  });

  it("intérêts décalés de 2,50 € → hors tolérance, diverge", () => {
    const c = controle({ taux_annuel: TAUX, date_debut: "2025-01" }, transactionsDuPret(2.5));
    expect(c.etat).toBe("diverge");
  });
});

describe("F.2 — O2 et F8 : ce que le contrôle ne fait pas", () => {
  it("cite remboursement anticipé, modulation et différé quand il signale", () => {
    const c = controle({ taux_annuel: 0.13, date_debut: "2025-01" });
    expect(c.message).toMatch(/remboursement anticipé.*modulation.*différé/);
  });

  it("sans date, sans objet : il ne compare pas des transactions à elles-mêmes", () => {
    const c = controle({});
    expect(c.etat).toBe("sans-objet");
    expect(c.message).toContain("sans date");
  });
});
