export declare const CHEMIN_LISTE_PRIVEE: string;
export declare const MIN_MOTIFS: number;
export declare function listeFacultative(): boolean;
export declare function lireListeNoire(racine: string): {
  motifs: RegExp[] | null;
  origine: string | null;
  erreurs: string[];
};
export declare function trouverInterdit(
  texte: string,
  motifs: RegExp[]
): { ligne: number; numero: number } | null;
