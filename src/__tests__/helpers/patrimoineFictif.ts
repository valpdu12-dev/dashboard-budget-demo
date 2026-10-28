// ── Jeu fictif de relevés de soldes — Patrimoine D-4b (plan 33) ───────────
//
// Les relevés tels que le lecteur D-1 les rend (`ReleveSoldeLu`), déjà
// gardés : dates dépassées, montants saisis. Mêmes formules que le jeu de
// test du site privé (étapes P3 et P6), noms génériques.
//
// k = 0 pour octobre 2025 … k = 11 pour septembre 2026 :
//   1   Banque A - Courant               Liquidité  Banque A    1 000,25 + 10k
//   2   Banque A - Livret                Epargne    Banque A    5 000 + 100k, OUBLIÉ en août (k = 10)
//   3   Banque B - Titres                Epargne    Banque B    2 000 + 50k
//   4   Appartement - capital remboursé  Epargne    Immobilier  300 × (k + 1)
//   4.1 Banque B - Compte titres         Epargne    Banque B    500, dès juillet (k = 9)
//   5   Assurance-vie Banque C           Epargne    Banque C    1 000 + 20 × (k − 5), dès mars (k = 5)
//
// Les 4 premiers comptes ensemble = 8 300,25 + 460k.
// Aucun montant réel : tout est inventé.

import type { NaturePatrimoine, ReleveSoldeLu } from "@/services/lectureClasseur";

export const COURANT_A = "Banque A - Courant";
export const LIVRET_A = "Banque A - Livret";
export const TITRES_B = "Banque B - Titres";
export const APPARTEMENT = "Appartement - capital remboursé";
export const COMPTE_TITRES_B = "Banque B - Compte titres";
export const ASSURANCE_VIE_C = "Assurance-vie Banque C";

interface DefCompte {
  ordre: number;
  compte: string;
  nature: NaturePatrimoine;
  banque: string;
  debut: number;
  montant: (k: number) => number | null;
}

const COMPTES: DefCompte[] = [
  { ordre: 1, compte: COURANT_A, nature: "Liquidité", banque: "Banque A", debut: 0,
    montant: (k) => Math.round((1000.25 + 10 * k) * 100) / 100 },
  { ordre: 2, compte: LIVRET_A, nature: "Epargne", banque: "Banque A", debut: 0,
    montant: (k) => (k === 10 ? null : 5000 + 100 * k) },
  { ordre: 3, compte: TITRES_B, nature: "Epargne", banque: "Banque B", debut: 0,
    montant: (k) => 2000 + 50 * k },
  { ordre: 4, compte: APPARTEMENT, nature: "Epargne", banque: "Immobilier", debut: 0,
    montant: (k) => 300 * (k + 1) },
  { ordre: 4.1, compte: COMPTE_TITRES_B, nature: "Epargne", banque: "Banque B", debut: 9,
    montant: () => 500 },
  { ordre: 5, compte: ASSURANCE_VIE_C, nature: "Epargne", banque: "Banque C", debut: 5,
    montant: (k) => 1000 + 20 * (k - 5) },
];

/** Mois du rang k (0 = octobre 2025) et sa date de fin de mois. */
function moisK(k: number): { mk: string; date: string } {
  const m0 = 9 + k;
  const annee = 2025 + Math.floor(m0 / 12);
  const mois = (m0 % 12) + 1;
  const jour = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  const mk = `${annee}-${String(mois).padStart(2, "0")}`;
  return { mk, date: `${mk}-${String(jour).padStart(2, "0")}` };
}

/** Les 57 relevés du jeu, triés par mois puis par ordre (comme le lecteur). */
export function relevesFictifs(): ReleveSoldeLu[] {
  const out: ReleveSoldeLu[] = [];
  for (let k = 0; k <= 11; k++) {
    const { mk, date } = moisK(k);
    for (const c of COMPTES) {
      if (k < c.debut) continue;
      const montant = c.montant(k);
      if (montant === null) continue;
      out.push({ ordre: c.ordre, compte: c.compte, nature: c.nature, banque: c.banque, mk, date, montant });
    }
  }
  return out;
}
