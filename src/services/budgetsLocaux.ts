// ── Objectifs de budget — mémoire du navigateur ──────────────────────────
//
// L'application réelle enregistre les objectifs dans une base D1, derrière
// une API authentifiée. La démonstration n'a pas de serveur : un objectif
// modifié ici reste dans le navigateur de la personne qui visite, et nulle
// part ailleurs. Rien n'est envoyé, rien n'est partagé.
//
// La démo s'ouvre toujours sur les objectifs livrés avec elle
// (`public/data/budgets.json`). Le stockage local ne sert qu'à conserver ce
// que la personne a changé de sa main — c'est le « sur choix explicite »
// décidé pour ce lot.
//
// ⚠️ `localStorage` peut être refusé (navigation privée, stockage bloqué,
// quota plein) et lever à la simple lecture. Tout est donc protégé, et
// l'application fonctionne sans : au pire, les modifications ne survivent
// pas à la fermeture de l'onglet.

/** Clé des objectifs modifiés à la main — reprise par l'inventaire de `profil.ts`. */
export const CLE_OBJECTIFS = "budget.objectifs.v1";

/** Objectifs modifiés par la personne : sous-catégorie → montant cible. */
export type ObjectifsLocaux = Record<string, number>;

/** Lit les objectifs mémorisés. Retourne un objet vide si rien ou si erreur. */
export function lireObjectifsLocaux(): ObjectifsLocaux {
  try {
    const brut = localStorage.getItem(CLE_OBJECTIFS);
    if (!brut) return {};
    const objet = JSON.parse(brut) as unknown;
    if (!objet || typeof objet !== "object" || Array.isArray(objet)) return {};
    // On ne garde que les paires exploitables : un stockage corrompu ne doit
    // pas injecter de NaN dans les calculs de budget.
    const propre: ObjectifsLocaux = {};
    for (const [cat2, valeur] of Object.entries(objet as Record<string, unknown>)) {
      if (typeof valeur === "number" && Number.isFinite(valeur)) propre[cat2] = valeur;
    }
    return propre;
  } catch (err) {
    console.warn("[Budget] Objectifs locaux illisibles — valeurs livrées utilisées.", err);
    return {};
  }
}

/** Enregistre un objectif. Retourne false si le stockage a refusé. */
export function enregistrerObjectifLocal(cat2: string, cible: number): boolean {
  try {
    const actuels = lireObjectifsLocaux();
    actuels[cat2] = cible;
    localStorage.setItem(CLE_OBJECTIFS, JSON.stringify(actuels));
    return true;
  } catch (err) {
    console.warn("[Budget] Objectif non mémorisé (stockage indisponible).", err);
    return false;
  }
}

/** Efface tout ce que la personne a modifié, et revient aux valeurs livrées. */
export function effacerObjectifsLocaux(): void {
  try {
    localStorage.removeItem(CLE_OBJECTIFS);
  } catch (err) {
    console.warn("[Budget] Objectifs locaux non effacés.", err);
  }
}
