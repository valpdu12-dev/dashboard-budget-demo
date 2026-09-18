// ── Lecture d'un classeur au format public ───────────────────────────────
//
// Lot B.3. Contrat complet dans `docs/FORMAT_FICHIER_SOURCE.md`.
//
// LA RÈGLE QUI GOUVERNE TOUT CE FICHIER : rien n'est deviné, rien n'est
// ignoré en silence. Une ligne qu'on ne sait pas lire est REJETÉE et NOMMÉE —
// feuille, ligne, colonne. Une ligne acceptée mais douteuse produit un
// AVERTISSEMENT nommé. Un montant illisible ne devient jamais 0.
//
// Le lecteur ne pose rien dans le store : il rend un rapport. C'est l'écran
// d'aperçu qui le montre, et c'est la personne qui décide d'appliquer.

import * as XLSX from "xlsx";
import { CLASSES as CLASSES_VOCABULAIRE } from "@/config/vocabulaire";
import {
  normaliserCle,
  nettoyerTexte,
  lireDate,
  lireNombre,
  lireMois,
  arrondir,
} from "@/services/lectureValeurs";
import { lireConfigBrute } from "@/services/lectureParametres";
import { validerConfig } from "@/services/validerConfig";
import type { Anomalie } from "@/types/anomalie";
import { configVide, type BudgetConfig } from "@/types/budgetConfig";

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

/** Une transaction lue, au format que le reste de l'application attend. */
export interface TransactionLue {
  label: string;
  compte: string;
  type: string;
  date: string;
  montant: number;
  cat1: string;
  cat2: string;
  cat3: string;
  cat4: string;
  ville: string;
  dc: string;
  /**
   * La ligne portait un `Montant brut` — décision D1.
   *
   * Le montant ci-dessus est alors le montant AVANT partage : le taux de
   * participation du compte lui est appliqué dans une seconde passe, une fois
   * la feuille `Paramètres` lue.
   */
  estBrut?: true;
}

/** Un mois de paie lu. */
export interface PaieLue {
  mk: string;
  entreprise: string;
  brut: number;
  cotSal: number;
  indem: number;
  retenues: number;
  net: number;
}

/** Ce que la feuille `Paramètres` a déclaré. Chaque champ peut manquer. */
export interface ParametresLus {
  versionFormat: number | null;
  couverture: { debut: string; fin: string } | null;
  pret: { montant: number; mensualite: number; echeances: number; premiereEcheance?: string } | null;
  soldes: Record<string, number>;
  /**
   * Lot C.2 — ce que les tableaux `Comptes`, `Types`, `Catégories` et
   * `Employeurs` déclarent, une fois validé.
   *
   * `estVide` vaut vrai quand la feuille ne déclare rien : c'est le cas d'un
   * fichier au format v1, et ce n'est pas une erreur. Mais l'appelant doit
   * pouvoir le DIRE plutôt que de laisser croire à une configuration lue.
   */
  config: BudgetConfig;
}

/**
 * Un problème, situé. C'est la brique de tout le rapport.
 *
 * Déclaré dans `types/anomalie.ts` depuis le lot C.1 : la validation de la
 * configuration en produit aussi, et elle n'a pas à importer ses types du
 * lecteur de classeur. Ré-exporté ici pour que les appelants existants ne
 * changent pas d'import.
 */
export type { Anomalie };

export interface CompteursImport {
  lignesLues: number;
  acceptees: number;
  rejetees: number;
  ignorees: number;
  avertissements: number;
}

export interface RapportImport {
  transactions: TransactionLue[];
  paie: PaieLue[];
  parametres: ParametresLus;
  anomalies: Anomalie[];
  /** Nombre d'anomalies au-delà du plafond d'affichage. */
  anomaliesNonListees: number;
  compteurs: CompteursImport;
  /** Feuilles lues, dans l'ordre. */
  feuillesLues: string[];
}

/** Une erreur qui empêche toute lecture. Le fichier n'est pas exploitable. */
export class ErreurClasseur extends Error {}

// ─────────────────────────────────────────────────────────────────────────
// CONSTANTES DU FORMAT
// ─────────────────────────────────────────────────────────────────────────

const CLASSES: readonly string[] = CLASSES_VOCABULAIRE;
const CLASSES_NORM = new Map(CLASSES.map((c) => [normaliserCle(c), c]));

/** Au-delà, les anomalies sont comptées mais plus listées. */
const PLAFOND_ANOMALIES = 200;

const COLONNES_TX = {
  date: "Date",
  compte: "Compte",
  type: "Type",
  montant: "Montant",
  montantBrut: "Montant brut",
  sens: "Sens",
  classe: "Classe",
  categorie: "Catégorie",
  sousCategorie: "Sous-catégorie",
  detail: "Détail",
  libelle: "Libellé",
  ville: "Ville",
  previsionnel: "Prévisionnel",
} as const;

const OBLIGATOIRES_TX = ["date", "compte", "type", "sens"] as const;

const COLONNES_PAIE = {
  mois: "Mois",
  employeur: "Employeur",
  brut: "Brut",
  cotisations: "Cotisations salariales",
  indemnites: "Indemnités",
  retenues: "Autres retenues",
  net: "Net",
} as const;

const OBLIGATOIRES_PAIE = ["mois", "employeur", "brut", "cotisations"] as const;

// ─────────────────────────────────────────────────────────────────────────
// RECONNAISSANCE DES FEUILLES
// ─────────────────────────────────────────────────────────────────────────

/** Normalise un nom de feuille et gère les tirets longs des libellés. */
function normNom(n: string): string {
  return normaliserCle(n).replace(/[–—]/g, "-");
}

const RE_TX_PUBLIC = /^transactions( \d{4})?$/;
const RE_TX_ANCIEN = /^transactions \d{4}$/;

/**
 * Retrouve une feuille par son nom normalisé.
 *
 * ⚠️ Deux feuilles qui ne diffèrent que par la casse sont un CONFLIT, pas un
 * choix. Excel l'interdit, mais un fichier produit par un script le permet —
 * mesuré : SheetJS accepte `Transactions` et `transactions` dans le même
 * classeur. « La première gagne » serait un choix silencieux.
 */
function feuilleUnique(wb: XLSX.WorkBook, cible: string): string | null {
  const candidats = wb.SheetNames.filter((n) => normNom(n) === normNom(cible));
  if (candidats.length > 1) {
    throw new ErreurClasseur(
      `Deux feuilles portent le même nom à la casse près : « ${candidats.join(" » et « ")} ». ` +
        `Renommez-en une : le fichier est ambigu.`
    );
  }
  return candidats[0] ?? null;
}

/** Toutes les feuilles de transactions du format public, triées. */
function feuillesTransactions(wb: XLSX.WorkBook): string[] {
  const trouvees = wb.SheetNames.filter((n) => RE_TX_PUBLIC.test(normNom(n)));
  const vues = new Map<string, string[]>();
  for (const n of trouvees) {
    const cle = normNom(n);
    vues.set(cle, [...(vues.get(cle) ?? []), n]);
  }
  for (const [, noms] of vues) {
    if (noms.length > 1) {
      throw new ErreurClasseur(
        `Deux feuilles portent le même nom à la casse près : « ${noms.join(" » et « ")} ». ` +
          `Renommez-en une : le fichier est ambigu.`
      );
    }
  }
  return trouvees.sort((a, b) => normNom(a).localeCompare(normNom(b)));
}

export type FormatDetecte = "public" | "ancien";

/**
 * Décide du format sur la STRUCTURE, jamais sur le nom du fichier.
 *
 * 1. une feuille `Transactions` ou `Transactions AAAA` dont la LIGNE 1 porte
 *    au moins Date, Compte et Montant → format public ;
 * 2. sinon une feuille `Transactions AAAA` → ancien format, lu par position ;
 * 3. sinon refus, en disant ce qui a été trouvé et ce qui était attendu.
 */
export function detecterFormat(wb: XLSX.WorkBook): FormatDetecte {
  for (const nom of feuillesTransactions(wb)) {
    const entetes = new Set(ligne1(wb.Sheets[nom]).map(normaliserCle));
    if (entetes.has("date") && entetes.has("compte") && entetes.has("montant")) return "public";
  }
  if (wb.SheetNames.some((n) => RE_TX_ANCIEN.test(normNom(n)))) return "ancien";

  throw new ErreurClasseur(
    `Aucune feuille de transactions reconnue. Feuilles trouvées : ` +
      `${wb.SheetNames.join(", ") || "aucune"}. ` +
      `Le format public attend une feuille « Transactions » dont la ligne 1 porte au moins ` +
      `les colonnes Date, Compte et Montant.`
  );
}

function ligne1(ws: XLSX.WorkSheet | undefined): unknown[] {
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  return (rows[0] as unknown[]) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────
// LECTURE
// ─────────────────────────────────────────────────────────────────────────

class Collecteur {
  readonly anomalies: Anomalie[] = [];
  nonListees = 0;
  private nbAvertissements = 0;

  ajouter(a: Anomalie): void {
    if (a.gravite === "avertissement") this.nbAvertissements++;
    if (this.anomalies.length < PLAFOND_ANOMALIES) this.anomalies.push(a);
    else this.nonListees++;
  }

  get avertissements(): number {
    return this.nbAvertissements;
  }
}

/** Associe chaque colonne connue à son index, depuis la ligne 1. */
function indexerColonnes(
  entetes: unknown[],
  dictionnaire: Record<string, string>
): Record<string, number> {
  const parNom = new Map<string, number>();
  entetes.forEach((e, i) => {
    const cle = normaliserCle(e);
    if (cle && !parNom.has(cle)) parNom.set(cle, i);
  });
  const out: Record<string, number> = {};
  for (const [champ, libelle] of Object.entries(dictionnaire)) {
    const i = parNom.get(normaliserCle(libelle));
    if (i !== undefined) out[champ] = i;
  }
  return out;
}

function estVide(r: unknown[]): boolean {
  return !r || r.every((c) => c == null || nettoyerTexte(c) === "");
}

/**
 * Lit toutes les feuilles de transactions et les AGRÈGE.
 *
 * Le classeur de l'auteur porte `Transactions 2025` et `Transactions 2026` :
 * agréger est le cas réel, pas une extension théorique. Les doublons stricts
 * sont refusés, avec leurs deux emplacements — additionner en silence
 * doublerait une dépense.
 */
function lireTransactions(wb: XLSX.WorkBook, col: Collecteur, compteurs: CompteursImport) {
  const feuilles = feuillesTransactions(wb);
  const out: TransactionLue[] = [];
  const vues = new Map<string, string>();

  for (const nom of feuilles) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nom], {
      header: 1,
      raw: true,
      defval: null,
    });
    if (!rows.length) {
      col.ajouter({ gravite: "avertissement", feuille: nom, message: "Feuille vide — ignorée." });
      continue;
    }

    const idx = indexerColonnes(rows[0] as unknown[], COLONNES_TX);
    const manquantes = OBLIGATOIRES_TX.filter((c) => idx[c] === undefined);
    if (manquantes.length) {
      throw new ErreurClasseur(
        `Feuille « ${nom} » : colonne(s) obligatoire(s) absente(s) en ligne 1 — ` +
          `${manquantes.map((m) => COLONNES_TX[m]).join(", ")}. ` +
          `L'en-tête doit être en ligne 1, les colonnes nommées, l'ordre libre.`
      );
    }
    // Format v2, décision D1 : il faut l'une des deux colonnes de montant.
    // `Montant` seul est le format v1, qui continue de fonctionner sans être
    // retouché ; `Montant brut` seul suffit à un fichier neuf.
    if (idx.montant === undefined && idx.montantBrut === undefined) {
      throw new ErreurClasseur(
        `Feuille « ${nom} » : il faut une colonne « ${COLONNES_TX.montant} » ou ` +
          `« ${COLONNES_TX.montantBrut} » en ligne 1. La première porte le montant déjà ` +
          `imputé, la seconde le montant avant partage — l'outil lui applique alors le ` +
          `taux de participation du compte.`
      );
    }

    const lire = (r: unknown[], champ: keyof typeof COLONNES_TX) =>
      idx[champ] === undefined ? null : r[idx[champ]];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      const ligne = i + 1;

      if (estVide(r)) { compteurs.ignorees++; continue; }
      compteurs.lignesLues++;

      if (normaliserCle(lire(r, "previsionnel")) === "x") {
        compteurs.ignorees++;
        compteurs.lignesLues--;
        continue;
      }

      const brutDate = lire(r, "date");
      const brutCompte = lire(r, "compte");
      const brutMontant = lire(r, "montant");
      const brutMontantBrut = lire(r, "montantBrut");
      if (
        (brutDate == null || nettoyerTexte(brutDate) === "") &&
        (brutCompte == null || nettoyerTexte(brutCompte) === "") &&
        (brutMontant == null || nettoyerTexte(brutMontant) === "") &&
        (brutMontantBrut == null || nettoyerTexte(brutMontantBrut) === "")
      ) {
        compteurs.ignorees++;
        compteurs.lignesLues--;
        continue;
      }

      const rejet = (colonne: string, message: string) => {
        compteurs.rejetees++;
        col.ajouter({ gravite: "rejet", feuille: nom, ligne, colonne, message });
      };

      const date = lireDate(brutDate);
      if (!date) {
        rejet(COLONNES_TX.date,
          `Date illisible : « ${nettoyerTexte(brutDate) || "(vide)"} ». ` +
          `Attendu une date, ou JJ/MM/AAAA, ou AAAA-MM-JJ.`);
        continue;
      }

      const compte = nettoyerTexte(brutCompte);
      if (!compte) { rejet(COLONNES_TX.compte, "Compte vide."); continue; }

      const type = nettoyerTexte(lire(r, "type"));
      if (!type) { rejet(COLONNES_TX.type, "Type vide."); continue; }

      // ── Décision D1 : `Montant brut` l'emporte quand il est rempli ─────
      //
      // Rempli, l'outil lui applique le taux de participation du compte, dans
      // une seconde passe — le taux vient de la feuille `Paramètres`, qui
      // n'est lue qu'après. Vide, `Montant` est pris tel quel : il est déjà
      // imputé, comme au format v1.
      //
      // ⚠️ Jamais de colonne détournée : c'est la présence d'une colonne
      // NOUVELLE qui distingue les deux régimes, et l'outil n'a donc jamais à
      // deviner lequel s'applique (§8.1 du format).
      const aUnBrut = brutMontantBrut != null && nettoyerTexte(brutMontantBrut) !== "";
      const colonneMontant = aUnBrut ? COLONNES_TX.montantBrut : COLONNES_TX.montant;
      const brutLu = aUnBrut ? brutMontantBrut : brutMontant;
      const montant = lireNombre(brutLu);
      if (montant === null) {
        rejet(colonneMontant,
          `Montant illisible : « ${nettoyerTexte(brutLu) || "(vide)"} ». ` +
          `Il n'est PAS remplacé par 0 : la ligne est écartée.`);
        continue;
      }
      if (montant <= 0) {
        rejet(colonneMontant,
          `Montant nul ou négatif : ${montant}. Le montant est toujours positif ; ` +
          `c'est la colonne Sens qui dit Débit ou Crédit.`);
        continue;
      }

      const sensBrut = nettoyerTexte(lire(r, "sens"));
      const sensNorm = normaliserCle(sensBrut);
      let dc: string;
      if (sensNorm === "debit") dc = "Débit";
      else if (sensNorm === "credit") dc = "Crédit";
      else {
        rejet(COLONNES_TX.sens,
          `Sens illisible : « ${sensBrut || "(vide)"} ». Attendu « Débit » ou « Crédit », ` +
          `écrits en toutes lettres.`);
        continue;
      }

      const classeBrut = nettoyerTexte(lire(r, "classe"));
      let cat1 = "";
      if (classeBrut) {
        const trouvee = CLASSES_NORM.get(normaliserCle(classeBrut));
        if (!trouvee) {
          rejet(COLONNES_TX.classe,
            `Classe inconnue : « ${classeBrut} ». Attendu ${CLASSES.join(", ")}, ou rien.`);
          continue;
        }
        if (dc === "Crédit") {
          col.ajouter({
            gravite: "avertissement", feuille: nom, ligne, colonne: COLONNES_TX.classe,
            message: `Classe « ${classeBrut} » ignorée : cette ligne est une recette, ` +
                     `et une recette n'est pas une dépense à classer.`,
          });
        } else {
          cat1 = trouvee;
        }
      }

      const cat2 = nettoyerTexte(lire(r, "categorie"));
      if (dc === "Débit" && !cat2) {
        col.ajouter({
          gravite: "avertissement", feuille: nom, ligne, colonne: COLONNES_TX.categorie,
          message: "Dépense sans catégorie : elle compte dans les dépenses et les soldes, " +
                   "mais n'apparaîtra pas dans l'écran Budget mensuel.",
        });
      }

      const label = nettoyerTexte(lire(r, "libelle"));
      const cle = [date, normaliserCle(compte), normaliserCle(type), montant, normaliserCle(label)].join("|");
      const deja = vues.get(cle);
      if (deja) {
        rejet(COLONNES_TX.date,
          `Doublon strict de ${deja} — même date, même compte, même type, même montant, ` +
          `même libellé. Pour garder les deux, différenciez-les par le libellé.`);
        continue;
      }
      vues.set(cle, `${nom} ligne ${ligne}`);

      out.push({
        label, compte, type, date, montant, cat1, cat2,
        ...(aUnBrut ? { estBrut: true as const } : {}),
        cat3: nettoyerTexte(lire(r, "sousCategorie")),
        cat4: nettoyerTexte(lire(r, "detail")),
        ville: nettoyerTexte(lire(r, "ville")),
        dc,
      });
      compteurs.acceptees++;
    }
  }

  if (!out.length) {
    throw new ErreurClasseur(
      `Aucune transaction exploitable. ${compteurs.rejetees} ligne(s) rejetée(s), ` +
        `${compteurs.ignorees} ignorée(s). Le détail est dans la liste ci-dessous.`
    );
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return { transactions: out, feuilles };
}

/** Lit la feuille `Paie`, si elle existe. Son absence n'est pas une erreur. */
function lirePaie(wb: XLSX.WorkBook, col: Collecteur, compteurs: CompteursImport): PaieLue[] {
  const nom = feuilleUnique(wb, "Paie");
  if (!nom) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nom], {
    header: 1, raw: true, defval: null,
  });
  if (!rows.length) return [];

  const idx = indexerColonnes(rows[0] as unknown[], COLONNES_PAIE);
  const manquantes = OBLIGATOIRES_PAIE.filter((c) => idx[c] === undefined);
  if (manquantes.length) {
    throw new ErreurClasseur(
      `Feuille « ${nom} » : colonne(s) obligatoire(s) absente(s) en ligne 1 — ` +
        `${manquantes.map((m) => COLONNES_PAIE[m]).join(", ")}.`
    );
  }

  const lire = (r: unknown[], champ: keyof typeof COLONNES_PAIE) =>
    idx[champ] === undefined ? null : r[idx[champ]];

  const parMois = new Map<string, { p: PaieLue; ligne: number }>();
  const enDoublon = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const ligne = i + 1;
    if (estVide(r)) { compteurs.ignorees++; continue; }
    compteurs.lignesLues++;

    const rejet = (colonne: string, message: string) => {
      compteurs.rejetees++;
      col.ajouter({ gravite: "rejet", feuille: nom, ligne, colonne, message });
    };

    const mk = lireMois(lire(r, "mois"));
    if (!mk) {
      rejet(COLONNES_PAIE.mois,
        `Mois illisible : « ${nettoyerTexte(lire(r, "mois")) || "(vide)"} ». Attendu AAAA-MM.`);
      continue;
    }
    const entreprise = nettoyerTexte(lire(r, "employeur"));
    if (!entreprise) { rejet(COLONNES_PAIE.employeur, "Employeur vide."); continue; }

    const brut = lireNombre(lire(r, "brut"));
    if (brut === null || brut < 0) {
      rejet(COLONNES_PAIE.brut, `Brut illisible ou négatif. Il n'est pas remplacé par 0.`);
      continue;
    }
    const cotSal = lireNombre(lire(r, "cotisations"));
    if (cotSal === null || cotSal < 0) {
      rejet(COLONNES_PAIE.cotisations, `Cotisations illisibles ou négatives.`);
      continue;
    }

    const indem = idx.indemnites === undefined ? 0 : lireNombre(lire(r, "indemnites")) ?? 0;
    const retenues = idx.retenues === undefined ? 0 : lireNombre(lire(r, "retenues")) ?? 0;
    const net = arrondir(brut - cotSal + indem - retenues);

    // La colonne Net, si elle existe, ne sert PAS au calcul : elle contrôle.
    // Une valeur affichée qui ne vient pas d'un calcul vérifiable serait un
    // retour en arrière.
    if (idx.net !== undefined) {
      const declare = lireNombre(lire(r, "net"));
      if (declare !== null && Math.abs(declare - net) > 1) {
        col.ajouter({
          gravite: "avertissement", feuille: nom, ligne, colonne: COLONNES_PAIE.net,
          message: `Net déclaré ${declare} €, net recalculé ${net} €. C'est le calcul qui ` +
                   `fait foi : brut − cotisations + indemnités − autres retenues.`,
        });
      }
    }

    const deja = parMois.get(mk);
    if (deja) {
      enDoublon.add(mk);
      compteurs.rejetees += 2;
      compteurs.acceptees--;
      col.ajouter({
        gravite: "rejet", feuille: nom, ligne, colonne: COLONNES_PAIE.mois,
        message: `Le mois ${mk} apparaît déjà ligne ${deja.ligne}. Les DEUX lignes sont ` +
                 `écartées : additionner en silence doublerait le salaire du mois.`,
      });
      continue;
    }
    parMois.set(mk, { p: { mk, entreprise, brut, cotSal, indem, retenues, net }, ligne });
    compteurs.acceptees++;
  }

  for (const mk of enDoublon) parMois.delete(mk);
  return [...parMois.values()].map((v) => v.p).sort((a, b) => a.mk.localeCompare(b.mk));
}

/** Retrouve un petit tableau par sa cellule d'en-tête, où qu'elle soit. */
function tableauParEnTete(grille: unknown[][], enTete: string): [string, unknown, number][] {
  const cible = normaliserCle(enTete);
  for (let r = 0; r < grille.length; r++) {
    const ligne = grille[r] ?? [];
    for (let c = 0; c < ligne.length; c++) {
      if (normaliserCle(ligne[c]) !== cible) continue;
      const out: [string, unknown, number][] = [];
      for (let i = r + 1; i < grille.length; i++) {
        const cle = nettoyerTexte((grille[i] ?? [])[c]);
        if (cle) out.push([cle, (grille[i] ?? [])[c + 1], i + 1]);
      }
      return out;
    }
  }
  return [];
}

/** Lit la feuille `Paramètres`, si elle existe. */
function lireParametres(wb: XLSX.WorkBook, col: Collecteur): ParametresLus {
  const vide: ParametresLus = {
    versionFormat: null, couverture: null, pret: null, soldes: {}, config: configVide(),
  };
  const nom = feuilleUnique(wb, "Paramètres");
  if (!nom) return vide;

  const grille = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nom], {
    header: 1, raw: true, defval: null,
  });

  const params = new Map<string, { v: unknown; ligne: number }>();
  for (const [cle, valeur, ligne] of tableauParEnTete(grille, "Paramètre")) {
    params.set(normNom(cle), { v: valeur, ligne });
  }
  const lireParam = (cle: string) => params.get(normNom(cle));

  const versionFormat = lireNombre(lireParam("Version du format")?.v ?? null);

  // ── Bornes de relevé : les deux, ou aucune ───────────────────────────
  const dParam = lireParam("Début de relevé");
  const fParam = lireParam("Fin de relevé");
  let couverture: ParametresLus["couverture"] = null;
  if (dParam || fParam) {
    const debut = lireDate(dParam?.v ?? null);
    const fin = lireDate(fParam?.v ?? null);
    if (!debut || !fin) {
      col.ajouter({
        gravite: "avertissement", feuille: nom,
        ligne: (dParam ?? fParam)?.ligne,
        colonne: "Valeur",
        message: "Bornes de relevé incomplètes ou illisibles — il faut « Début de relevé » ET " +
                 "« Fin de relevé ». La couverture sera déduite des transactions, ce qui écarte " +
                 "le premier et le dernier mois des moyennes.",
      });
    } else if (fin < debut) {
      col.ajouter({
        gravite: "avertissement", feuille: nom, ligne: fParam?.ligne, colonne: "Valeur",
        message: `Fin de relevé (${fin}) antérieure au début (${debut}) — bornes ignorées.`,
      });
    } else {
      couverture = { debut, fin };
    }
  }

  // ── Prêt : tout ou rien ──────────────────────────────────────────────
  const montant = lireNombre(lireParam("Prêt - montant")?.v ?? null);
  const mensualite = lireNombre(lireParam("Prêt - mensualité")?.v ?? null);
  const echeances = lireNombre(lireParam("Prêt - nombre d'échéances")?.v ?? null);
  const premiere = nettoyerTexte(lireParam("Prêt - première échéance")?.v ?? "");
  let pret: ParametresLus["pret"] = null;
  const presents = [montant, mensualite, echeances].filter((x) => x !== null && x > 0).length;
  if (presents === 3) {
    pret = {
      montant: montant!, mensualite: mensualite!, echeances: echeances!,
      ...(premiere ? { premiereEcheance: premiere } : {}),
    };
  } else if (presents > 0) {
    col.ajouter({
      gravite: "avertissement", feuille: nom, colonne: "Valeur",
      message: "Bloc Prêt incomplet — montant, mensualité et nombre d'échéances doivent être " +
               "présents ensemble. Le bloc entier est ignoré : un montant réel accolé à une " +
               "mensualité par défaut produirait un échéancier crédible et faux.",
    });
  }

  // ── La configuration déclarée (lot C.2) ──────────────────────────────
  //
  // Le tableau des soldes de départ du format v1 EST le tableau des comptes,
  // à deux colonnes. Il n'y en a donc qu'un, et c'est lui qui donne les
  // soldes — après validation, pas avant. Voir §4.6 du contrat.
  const brute = lireConfigBrute(grille, nom, lireParam, (a) => col.ajouter(a));
  const { config, anomalies } = validerConfig(brute);
  for (const a of anomalies) col.ajouter(a);

  const soldes: Record<string, number> = {};
  for (const c of config.comptes) {
    if (c.soldeDepart !== null) soldes[c.libelle] = c.soldeDepart;
  }

  return { versionFormat, couverture, pret, soldes, config };
}

/**
 * Applique le taux de participation aux lignes qui portent un `Montant brut`.
 *
 * ⚠️ UNE SECONDE PASSE, et pas un calcul en ligne. Le taux vient du tableau
 * `Comptes` de la feuille `Paramètres`, qui n'est lue qu'APRÈS les
 * transactions. Faire l'inverse — lire les paramètres d'abord — aurait
 * réordonné toutes les anomalies du rapport, dont l'ordre est vérifié par les
 * tests du lot B.
 *
 * Décision D1. Un compte non déclaré n'a pas de taux : son montant brut est
 * pris tel quel, à 100 %. L'avertissement « compte absent du tableau
 * Comptes » le dit déjà — inutile de le redire ici.
 *
 * ⚠️ AUCUNE ANOMALIE N'EST ÉMISE ICI, et c'est délibéré. Dire « 2 lignes ont
 * été partagées selon leur taux » est une INFORMATION, pas un avertissement :
 * rien ne cloche, l'outil a fait ce que le fichier demandait. Le classer en
 * avertissement aurait fait du classeur modèle un fichier qui en déclenche —
 * et un modèle qui déclenche des avertissements enseigne à les ignorer.
 *
 * L'aperçu d'import le dit à sa place, dans le bloc « Configuration lue ».
 */
function appliquerParticipation(transactions: TransactionLue[], config: BudgetConfig): void {
  const taux = new Map(
    config.comptes.map((c) => [normaliserCle(c.libelle), c.participation])
  );

  for (const t of transactions) {
    if (!t.estBrut) continue;
    t.montant = arrondir(t.montant * (taux.get(normaliserCle(t.compte)) ?? 1));
  }
}

/**
 * Signale les comptes qui portent des transactions sans être déclarés.
 *
 * ⚠️ UN AVERTISSEMENT PAR COMPTE, CHIFFRÉ — pas un par ligne. Avant le lot
 * C.2, un compte non reconnu produisait un avertissement à CHAQUE ligne : sur
 * un classeur réel, 306 lignes sur un même compte saturaient le plafond de
 * 200 anomalies et chassaient de la liste tout le reste. Le message dit
 * maintenant combien de lignes et combien d'euros sont concernés.
 *
 * ⚠️ LOT C.4 — LE SECOND MESSAGE A DISPARU, PARCE QU'IL EST DEVENU FAUX.
 *
 * Jusqu'au lot C.3, un compte absent de la liste écrite dans `accounts.ts`
 * n'avait PAS de solde : `useBalances` appliquait des règles nommées compte
 * par compte. L'avertissement le disait, et il disait vrai.
 *
 * Depuis le C.4, un compte non déclaré a bel et bien un solde — calculé sur
 * ses propres crédits et débits. Il n'a simplement ni taux, ni compte lié, ni
 * solde de départ. Garder l'ancien message aurait été pire que se taire : un
 * avertissement faux apprend à ignorer les avertissements.
 *
 * Il ne reste donc qu'une référence : le tableau `Comptes`, quand il existe.
 * Quand il n'existe pas, l'aperçu d'import le dit déjà une fois, en toutes
 * lettres — inutile de le répéter compte par compte.
 */
function signalerComptesNonDeclares(
  transactions: TransactionLue[],
  config: BudgetConfig,
  feuille: string,
  col: Collecteur
): void {
  if (config.comptes.length === 0) return;
  const connus = new Set(config.comptes.map((c) => normaliserCle(c.libelle)));

  const inconnus = new Map<string, { lignes: number; montant: number }>();
  for (const t of transactions) {
    if (connus.has(normaliserCle(t.compte))) continue;
    const e = inconnus.get(t.compte) ?? { lignes: 0, montant: 0 };
    e.lignes++;
    e.montant = arrondir(e.montant + t.montant);
    inconnus.set(t.compte, e);
  }

  for (const [compte, e] of inconnus) {
    const chiffre = `${e.lignes} ligne${e.lignes > 1 ? "s" : ""}, ${e.montant.toFixed(2)} €`;
    col.ajouter({
      gravite: "avertissement",
      feuille,
      colonne: COLONNES_TX.compte,
      message:
        `« ${compte} » porte des transactions (${chiffre}) mais n'est pas déclaré dans le ` +
        `tableau Comptes de la feuille Paramètres. Il n'aura ni taux de participation, ` +
        `ni compte lié, ni solde de départ.`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// POINT D'ENTRÉE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Lit un classeur au format public et rend un rapport complet.
 *
 * Lève `ErreurClasseur` seulement quand il n'y a rien d'exploitable : format
 * non reconnu, colonne obligatoire absente, aucune transaction valide. Tout le
 * reste vit dans le rapport, ligne par ligne.
 */
export function lireClasseurPublic(wb: XLSX.WorkBook): RapportImport {
  const col = new Collecteur();
  const compteurs: CompteursImport = {
    lignesLues: 0, acceptees: 0, rejetees: 0, ignorees: 0, avertissements: 0,
  };

  const { transactions, feuilles } = lireTransactions(wb, col, compteurs);
  const paie = lirePaie(wb, col, compteurs);
  const parametres = lireParametres(wb, col);

  // ⚠️ APRÈS la lecture des paramètres, elle aussi : le taux de participation
  // vient du tableau `Comptes` (D1).
  appliquerParticipation(transactions, parametres.config);

  // ⚠️ APRÈS la lecture des paramètres, et pas pendant celle des
  // transactions : c'est le tableau `Comptes` qui dit désormais quels comptes
  // sont déclarés, et il n'est connu qu'ici.
  signalerComptesNonDeclares(transactions, parametres.config, feuilles[0] ?? "Transactions", col);

  compteurs.avertissements = col.avertissements;

  return {
    transactions,
    paie,
    parametres,
    anomalies: col.anomalies,
    anomaliesNonListees: col.nonListees,
    compteurs,
    feuillesLues: feuilles,
  };
}
