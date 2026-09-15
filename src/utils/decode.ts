// ── Décodage des transactions JSON (encodage dictionnaire) ───────────────
import type { Transaction, RawTransactionsJSON } from "@/types";

/**
 * Décode les transactions depuis le format dictionnaire V1.
 *
 * Format d'un row dans raw.t :
 *   [0] compte  (index s[])
 *   [1] type    (index s[])
 *   [2] date    (string directe "2025-01-15")
 *   [3] montant (number direct, valeur absolue)
 *   [4] cat1    (index s[])
 *   [5] cat2    (index s[], -1 = "")
 *   [6] cat3    (index s[], -1 = "")
 *   [7] cat4    (index s[], -1 = "")
 *   [8] ville   (index s[], -1 = "")
 *   [9] dc      (index s[], "Débit" ou "Crédit")
 *   [10] label  (index s[], -1 = "")
 */
export function decodeTransactions(raw: RawTransactionsJSON): Transaction[] {
  const S = raw.s;
  return raw.t.map((r) => ({
    compte:   S[r[0] as number],
    type:     S[r[1] as number],
    date:     r[2] as string,
    montant:  r[3] as number,
    cat1:     S[r[4] as number],
    cat2:     r[5] === -1 ? "" : S[r[5] as number],
    cat3:     r[6] === -1 ? "" : S[r[6] as number],
    cat4:     r[7] === -1 ? "" : S[r[7] as number],
    ville:    r[8] === -1 ? "" : S[r[8] as number],
    dc:       S[r[9] as number],
    label:    r[10] === -1 ? "" : S[r[10] as number],
    monthKey: (r[2] as string).slice(0, 7),
  }));
}

/** Extrait la liste triée des mois uniques */
export function extractAllMonths(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map((t) => t.monthKey))).sort();
}
