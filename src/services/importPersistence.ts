// ── Mémorisation du dernier fichier importé ──────────────────────────────
//
// Avant le 11/08/2026, un import était perdu dès la fermeture de l'onglet :
// il fallait recharger le classeur à chaque ouverture du dashboard. Vérifié
// sur A56 le 11/08 avant d'être corrigé — le besoin est mesuré, pas supposé.
//
// ⚠️ Choix de `localStorage` là où le plan V3 prévoyait IndexedDB. Le plan a
// été écrit le 28/07 sans mesurer le volume : les données pèsent **124 Ko**
// (112 de transactions + 12 de salaires) pour une limite de 5 Mo, soit 2,4 %
// de l'espace. À ~61 octets par transaction, il faudrait ~80 000 lignes pour
// saturer, contre 1 831 aujourd'hui. IndexedDB aurait apporté de
// l'asynchrone et une dépendance de test supplémentaire pour aucun gain.
//
// ⚠️ Limite connue, commune aux deux techniques : un navigateur peut purger ce
// stockage (iOS le fait après 7 jours d'inactivité sur un site non installé).
// La promesse « conservé jusqu'au prochain import » vaut donc pour un usage
// régulier, ce qui est le cas ici, mais n'est pas une garantie du navigateur.

import type { Transaction, SalaryData } from "@/types";

const CLE = "budget.import.v1";

/** Ce qui est mémorisé d'un import, en plus des données elles-mêmes. */
export interface ImportMemorise {
  transactions: Transaction[];
  salary: SalaryData;
  /** Nom du classeur choisi par l'utilisateur, pour l'affichage. */
  fileName: string;
  /** Date de l'import (ISO), et non la date des données. */
  importedAt: string;
}

/**
 * Mémorise un import. Toute erreur est avalée : un quota dépassé ou un
 * stockage désactivé ne doit jamais empêcher l'utilisateur de consulter les
 * données qu'il vient de charger.
 */
export function saveImport(data: ImportMemorise): boolean {
  try {
    localStorage.setItem(CLE, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn("[Budget] Import non mémorisé (stockage indisponible).", err);
    return false;
  }
}

/** Relit l'import mémorisé, ou `null` s'il n'y en a pas ou s'il est illisible. */
export function loadImport(): ImportMemorise | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const o = JSON.parse(brut) as Partial<ImportMemorise>;
    // Un contenu tronqué ou d'une version antérieure ne doit pas peupler à
    // moitié le dashboard : mieux vaut repartir des données du serveur.
    if (!Array.isArray(o.transactions) || !o.salary || !o.importedAt) {
      console.warn("[Budget] Import mémorisé incomplet — ignoré.");
      return null;
    }
    return {
      transactions: o.transactions,
      salary: o.salary,
      fileName: o.fileName ?? "",
      importedAt: o.importedAt,
    };
  } catch (err) {
    console.warn("[Budget] Import mémorisé illisible — ignoré.", err);
    return null;
  }
}

/** Oublie l'import mémorisé. Appelé par « Revenir aux données par défaut ». */
export function clearImport(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    // Sans effet si le stockage est indisponible : il n'y avait rien à effacer.
  }
}
