/**
 * Liste noire des noms personnels — lot G.
 *
 * La liste NE VIT PAS dans ce dépôt. Écrire en clair les noms qu'on veut
 * cacher, dans un dépôt public, c'est les publier. Elle vient de l'un de ces
 * deux endroits, dans cet ordre :
 *
 *   1. la variable d'environnement LISTE_NOIRE — en CI, un secret GitHub ;
 *   2. le fichier privé plan/LISTE_NOIRE_MOTIFS.txt — plan/ est ignoré par Git.
 *
 * Format : une expression par ligne, écrite /source/drapeaux. Les lignes
 * vides et celles qui commencent par # sont ignorées.
 *
 * Absente, la liste n'est PAS sautée en silence : le contrôle échoue. Seule
 * une décision explicite, LISTE_NOIRE_FACULTATIVE=1, permet de s'en passer —
 * pour quelqu'un qui clone le dépôt sans la liste. Le contrôle le dit alors.
 *
 * Aucun rapport ne recopie le texte trouvé : seulement le fichier, la ligne
 * et le numéro du motif. Un journal de CI public ne doit pas republier ce
 * que la liste protège.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CHEMIN_LISTE_PRIVEE = "plan/LISTE_NOIRE_MOTIFS.txt";

/** En dessous, la liste est jugée tronquée : un secret mal collé passerait. */
export const MIN_MOTIFS = 20;

export const listeFacultative = () => process.env.LISTE_NOIRE_FACULTATIVE === "1";

/**
 * @param {string} racine
 * @returns {{ motifs: RegExp[] | null, origine: string | null, erreurs: string[] }}
 */
export function lireListeNoire(racine) {
  const erreurs = [];
  let texte = null;
  let origine = null;
  const env = process.env.LISTE_NOIRE;
  if (env && env.trim()) {
    texte = env;
    origine = "variable LISTE_NOIRE";
  } else if (existsSync(join(racine, CHEMIN_LISTE_PRIVEE))) {
    texte = readFileSync(join(racine, CHEMIN_LISTE_PRIVEE), "utf8");
    origine = `fichier privé ${CHEMIN_LISTE_PRIVEE}`;
  }
  if (texte === null) {
    erreurs.push(
      `liste noire introuvable : ni variable LISTE_NOIRE, ni ${CHEMIN_LISTE_PRIVEE}. ` +
        `Pour s'en passer volontairement : LISTE_NOIRE_FACULTATIVE=1.`
    );
    return { motifs: null, origine, erreurs };
  }

  const motifs = [];
  texte.split(/\r?\n/).forEach((brute, i) => {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith("#")) return;
    const m = ligne.match(/^\/(.+)\/([a-z]*)$/);
    if (!m) {
      erreurs.push(`liste noire, ligne ${i + 1} : format attendu /motif/drapeaux.`);
      return;
    }
    try {
      motifs.push(new RegExp(m[1], m[2].replace(/g/g, "")));
    } catch {
      erreurs.push(`liste noire, ligne ${i + 1} : expression invalide.`);
    }
  });
  if (motifs.length < MIN_MOTIFS) {
    erreurs.push(
      `liste noire tronquée : ${motifs.length} motifs lus, au moins ${MIN_MOTIFS} attendus.`
    );
  }
  return { motifs, origine, erreurs };
}

/**
 * Premier motif trouvé dans le texte. Rend sa position et son NUMÉRO
 * (1 = premier motif de la liste), jamais le texte trouvé.
 *
 * @param {string} texte
 * @param {RegExp[]} motifs
 * @returns {{ ligne: number, numero: number } | null}
 */
export function trouverInterdit(texte, motifs) {
  for (let k = 0; k < motifs.length; k++) {
    const trouve = motifs[k].exec(texte);
    if (!trouve) continue;
    return { ligne: texte.slice(0, trouve.index).split("\n").length, numero: k + 1 };
  }
  return null;
}
