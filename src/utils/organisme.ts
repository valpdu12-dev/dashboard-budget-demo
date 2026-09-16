// ── Mapping compte → organisme (source unique, aligné V1) ───────────────
import { COMPTE_TO_ORGANISME, ORGANISMES } from "@/config/constants";
import type { Organisme, Transaction } from "@/types";

/**
 * Organisme d'un compte.
 *
 * ⚠️ Un compte inconnu rend SON PROPRE NOM, pas « Autre ».
 *
 * Constaté le 16/09/2026 sur un vrai fichier importé : tous les comptes de la
 * personne tombaient sur « Autre », qui ne figure dans aucune liste affichée.
 * Résultat, le graphique « Évolution mensuelle des dépenses » s'affichait
 * complètement VIDE — axes, légende et pas une seule courbe — alors que le
 * total des dépenses, lui, était juste. Un compte inconnu vaut mieux comme
 * série à son nom que comme case sans étiquette.
 */
export function toOrganisme(compte: string): Organisme {
  const connu = COMPTE_TO_ORGANISME[compte] as Organisme | undefined;
  if (connu) return connu;
  if (!compte) return "Autre";

  // Un compte inconnu s'écrit presque toujours « Organisme - Usage » :
  // « Banque Z - Courant », « Cagnotte - Part commune ». On garde ce qui
  // précède le tiret : c'est l'organisme, et c'est ce que la légende du
  // graphique annonce (« Cliquez une légende = organisme »).
  //
  // Constaté le 16/09/2026 : sans cette extraction, la légende mélangeait des
  // organismes et des libellés de comptes entiers — sept entrées là où la
  // personne en attendait cinq.
  const coupe = compte.split(/\s+[-–—]\s+/)[0].trim();
  return coupe || compte;
}

/**
 * Les organismes réellement présents dans un jeu de transactions.
 *
 * Les écrans se construisaient depuis une liste FIGÉE, celle du jeu de
 * démonstration. Tout fichier apportant d'autres comptes produisait des
 * graphiques vides. La liste vient désormais des données ; l'ordre connu est
 * conservé en tête pour que la démonstration garde ses couleurs habituelles.
 */
export function organismesPresents(transactions: readonly Transaction[]): string[] {
  const poids = new Map<string, number>();
  for (const t of transactions) {
    if (t.dc !== "Débit") continue;
    const o = toOrganisme(t.compte);
    poids.set(o, (poids.get(o) ?? 0) + t.montant);
  }
  const connus = (ORGANISMES as readonly string[]).filter((o) => poids.has(o));
  // Les inconnus par POIDS décroissant : la série la plus lourde en premier,
  // pour que l'ordre de la légende suive celui des courbes à l'écran. L'ordre
  // alphabétique donnait une liste dont rien n'expliquait la succession.
  // Calculé sur le jeu complet : l'ordre ne bouge pas quand on change de filtre.
  const autres = [...poids.keys()]
    .filter((o) => !connus.includes(o))
    .sort((a, b) => (poids.get(b) ?? 0) - (poids.get(a) ?? 0) || a.localeCompare(b));
  return [...connus, ...autres];
}
