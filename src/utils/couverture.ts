// ── Couverture temporelle d'une source de données ────────────────────────
//
// Deux notions que l'application confondait jusqu'au lot 0 :
//
//   ① les DATES DES TRANSACTIONS — ce qui s'est passé ;
//   ② la PÉRIODE COUVERTE par la source — ce que le relevé embrasse.
//
// La confusion a une conséquence de calcul : un mois entièrement couvert où
// rien n'a été dépensé n'existait pas. Il n'était pas à zéro, il était absent,
// donc absent aussi du dénominateur des moyennes, qui s'en trouvaient gonflées.
//
// Voir docs/CONTRAT_COUVERTURE.md pour la règle complète et ses limites.

/** Bornes déclarées par la source, en dates ISO « AAAA-MM-JJ ». */
export interface BornesDeclarees {
  /** Premier jour couvert par le relevé, inclus. */
  debut: string;
  /** Dernier jour couvert par le relevé, inclus. */
  fin: string;
}

/** Clé de mois « AAAA-MM ». */
type CleMois = string;

/** Décale une clé de mois de `n` mois (n peut être négatif). */
export function decalerMois(mk: CleMois, n: number): CleMois {
  const annee = Number(mk.slice(0, 4));
  const mois = Number(mk.slice(5, 7));
  const total = annee * 12 + (mois - 1) + n;
  const a = Math.floor(total / 12);
  const m = total - a * 12 + 1;
  return `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
}

/**
 * Tous les mois du calendrier de `debut` à `fin`, bornes incluses.
 *
 * Volontairement construite depuis le calendrier et non depuis les données :
 * c'est ce qui fait exister un mois sans aucune transaction.
 */
export function moisEntre(debut: CleMois, fin: CleMois): CleMois[] {
  if (!debut || !fin || debut > fin) return [];
  const out: CleMois[] = [];
  for (let mk = debut; mk <= fin; mk = decalerMois(mk, 1)) out.push(mk);
  return out;
}

/** Dernier jour du mois `mk`, en « AAAA-MM-JJ ». */
function dernierJourDuMois(mk: CleMois): string {
  const suivant = decalerMois(mk, 1);
  const d = new Date(`${suivant}-01T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Les mois entièrement couverts par la source, donc comparables entre eux.
 *
 * Deux régimes :
 *
 * **Bornes déclarées** — la source dit ce qu'elle couvre, on la croit. Sont
 * comparables les mois dont le premier ET le dernier jour tombent dans les
 * bornes. Les mois de bord en font partie s'ils sont entiers.
 *
 * **Couverture inférée** — le format actuel ne déclare rien. Repli prudent :
 * les bornes sont le premier et le dernier mois porteurs d'une transaction, et
 * ces deux mois-là sont EXCLUS. On ignore si le relevé commence le 1er ou le
 * 17, et si le dernier mois est terminé. Conséquence assumée : le mois en
 * cours n'entre jamais dans une moyenne.
 *
 * @param moisAvecTransactions clés « AAAA-MM » triées, du jeu COMPLET — pas
 *   de la période affichée, sinon un filtre « 3 derniers mois » ferait
 *   disparaître deux mois sur trois.
 * @param declarees bornes de relevé si la source les fournit (lot B).
 */
export function moisComparables(
  moisAvecTransactions: CleMois[],
  declarees?: BornesDeclarees | null
): CleMois[] {
  if (declarees) {
    const premier = declarees.debut.slice(0, 7);
    const dernier = declarees.fin.slice(0, 7);
    return moisEntre(premier, dernier).filter(
      (mk) => `${mk}-01` >= declarees.debut && dernierJourDuMois(mk) <= declarees.fin
    );
  }

  if (moisAvecTransactions.length === 0) return [];
  const premier = moisAvecTransactions[0];
  const dernier = moisAvecTransactions[moisAvecTransactions.length - 1];
  // Bornes exclues des deux côtés : il faut au moins trois mois d'écart pour
  // qu'il reste quelque chose.
  return moisEntre(decalerMois(premier, 1), decalerMois(dernier, -1));
}
