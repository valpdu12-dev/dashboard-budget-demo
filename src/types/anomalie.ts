// ── L'anomalie : un problème, situé ──────────────────────────────────────
//
// C'est la brique de tout ce que l'outil dit à la personne. Elle était
// déclarée dans `services/lectureClasseur.ts` ; le lot C.1 la sort de là
// parce que la validation de la configuration en produit aussi, et qu'un
// service ne doit pas importer ses types du lecteur de classeur.
//
// La règle qui gouverne ce type : un problème sans emplacement n'est pas un
// problème utilisable. Feuille, ligne, colonne — autant qu'on en connaît.

/** Un problème, situé. */
export interface Anomalie {
  gravite: "rejet" | "avertissement";
  feuille: string;
  /** Numéro de ligne tel qu'il apparaît dans le tableur (1 = première ligne). */
  ligne?: number;
  colonne?: string;
  message: string;
}
