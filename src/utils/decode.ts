// ── Décodage des transactions JSON (encodage dictionnaire) ───────────────
import type { Transaction, RawTransactionsJSON } from "@/types";

/** Ordre des champs de l'encodage dictionnaire. Décodage et encodage le partagent. */
export const CHAMPS_ENCODES = [
  "compte", "type", "date", "montant", "cat1", "cat2", "cat3", "cat4",
  "ville", "dc", "label",
] as const;

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

/**
 * Encode des transactions au format dictionnaire — l'inverse exact de
 * `decodeTransactions`.
 *
 * Vivait dans le worker jusqu'au lot B.5. Remonté ici parce que la
 * mémorisation d'un jeu en a besoin elle aussi : stocker la forme ENCODÉE
 * plutôt que la forme décodée divise par cinq la place occupée dans le
 * navigateur (mesuré : 47,5 octets par transaction contre 241,5).
 *
 * Deux copies de cette table auraient fini par diverger — et une divergence
 * entre encodeur et décodeur ne se voit pas : elle décale silencieusement une
 * colonne sur l'autre.
 */
/**
 * Tout ce qu'il faut pour encoder : `monthKey` est dérivé de la date, il n'est
 * donc pas exigé. C'est ce qui permet au worker d'encoder ses lignes brutes,
 * qui ne le portent pas, sans construire d'objets intermédiaires.
 */
export type TransactionEncodable = Omit<Transaction, "monthKey">;

export function encodeTransactions(data: readonly TransactionEncodable[]): RawTransactionsJSON {
  const table = new Map<string, number>();
  let suivant = 0;
  const intern = (v: string): number => {
    const vu = table.get(v);
    if (vu !== undefined) return vu;
    table.set(v, suivant);
    return suivant++;
  };
  const opt = (v: string): number => (v ? intern(v) : -1);

  const t = data.map((r) => [
    intern(r.compte),
    intern(r.type),
    r.date,
    r.montant,
    intern(r.cat1),
    opt(r.cat2),
    opt(r.cat3),
    opt(r.cat4),
    opt(r.ville),
    intern(r.dc),
    opt(r.label),
  ]);

  return { s: Array.from(table.keys()), t, fields: [...CHAMPS_ENCODES] };
}
