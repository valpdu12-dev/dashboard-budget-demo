// ── Validation de la configuration lue dans le fichier source ────────────
//
// Lot C.1. Reçoit ce que la feuille `Paramètres` a livré, ligne par ligne,
// et rend deux choses : une configuration SÛRE, et la liste de ce qui n'a
// pas pu être lu — situé, nommé, en français.
//
// La règle qui gouverne tout ce fichier : **quand l'outil ne sait pas, il le
// dit**. Aucune valeur n'est devinée pour combler un trou. Un taux illisible
// ne devient pas 100 %, un sens absent ne devient pas « Les deux », un solde
// illisible ne devient pas 0.
//
// Le piège propre à ce lot : une configuration rend chaque défaut invisible,
// puisqu'il ressemblera à un choix de l'utilisateur. D'où le parti pris —
// tout ce qui est refusé produit une anomalie de gravité `rejet`, jamais un
// silence, jamais un `console.warn`.
//
// Contrat : `docs/CONTRAT_PARAMETRAGE.md`.

import { couleurStable } from "@/config/colors";
import {
  CLASSES,
  NATURES,
  NATURES_INCOMPATIBLES,
  SENS_REPERCUTES,
  estNature,
  type Classe,
  type Nature,
  type SensRepercute,
} from "@/config/vocabulaire";
import { lireNombre, nettoyerTexte, normaliserCle } from "@/services/lectureValeurs";
import type { Anomalie } from "@/types/anomalie";
import {
  configVide,
  type BudgetConfig,
  type CategorieConfig,
  type CompteConfig,
  type ConfigBrute,
  type TypeConfig,
} from "@/types/budgetConfig";

export interface ResultatValidationConfig {
  config: BudgetConfig;
  anomalies: Anomalie[];
}

// ─────────────────────────────────────────────────────────────────────────
// LECTEURS DE CELLULE — chacun rend `null` quand il ne sait pas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Lit un taux de participation.
 *
 * Deux écritures, et deux seulement : `50 %` ou `0,5`. Un nombre nu
 * supérieur à 1 est REFUSÉ, jamais interprété comme un pourcentage : `50`
 * voudrait dire « 5 000 % », et le lire comme 50 % serait exactement le
 * genre de devinette que ce lot supprime.
 *
 * ⚠️ Pas d'arrondi ici, contrairement à `lireNombre` : un tiers de
 * participation s'écrit `33,33 %` et vaut 0,3333.
 */
export function lireTaux(v: unknown): number | null {
  if (typeof v === "number") return estTauxValide(v) ? v : null;
  if (v == null) return null;

  const brut = nettoyerTexte(v).replace(/[\s ]/g, "").replace(",", ".");
  if (brut === "") return null;

  const pourcent = brut.endsWith("%");
  const corps = pourcent ? brut.slice(0, -1) : brut;
  if (!/^\d+(\.\d+)?$/.test(corps)) return null;

  const n = pourcent ? Number(corps) / 100 : Number(corps);
  return estTauxValide(n) ? n : null;
}

function estTauxValide(n: number): boolean {
  return isFinite(n) && n >= 0 && n <= 1;
}

/** Lit un oui/non. Rend `null` sur tout le reste — jamais « non » par défaut. */
export function lireBooleen(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  const t = normaliserCle(v);
  if (t === "") return null;
  if (["oui", "o", "vrai", "true", "1", "x"].includes(t)) return true;
  if (["non", "n", "faux", "false", "0"].includes(t)) return false;
  return null;
}

const RE_COULEUR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Lit une couleur `#rrggbb` ou `#rgb`. Rend `null` sur tout le reste. */
export function lireCouleur(v: unknown): string | null {
  const t = nettoyerTexte(v);
  return RE_COULEUR.test(t) ? t.toLowerCase() : null;
}

/** Lit un sens répercuté. Rend `null` sur tout le reste — jamais « Les deux ». */
export function lireSensRepercute(v: unknown): SensRepercute | null {
  const t = normaliserCle(v);
  if (t === "") return null;
  return SENS_REPERCUTES.find((s) => normaliserCle(s) === t) ?? null;
}

/** Lit une classe de dépense. Rend `null` sur tout le reste. */
export function lireClasse(v: unknown): Classe | null {
  const t = normaliserCle(v);
  if (t === "") return null;
  return CLASSES.find((c) => normaliserCle(c) === t) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// LE COLLECTEUR D'ANOMALIES
// ─────────────────────────────────────────────────────────────────────────

class Collecteur {
  readonly anomalies: Anomalie[] = [];
  constructor(private readonly feuille: string) {}

  rejet(ligne: number, colonne: string, message: string): void {
    this.anomalies.push({ gravite: "rejet", feuille: this.feuille, ligne, colonne, message });
  }

  avertir(ligne: number, colonne: string, message: string): void {
    this.anomalies.push({
      gravite: "avertissement", feuille: this.feuille, ligne, colonne, message,
    });
  }
}

const LISTE_NATURES = NATURES.join(", ");

// ─────────────────────────────────────────────────────────────────────────
// POINT D'ENTRÉE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Valide une configuration brute.
 *
 * Ne lève jamais. Tout ce qui ne peut pas être lu devient une anomalie et
 * sort de la configuration : ce qui est rendu est utilisable tel quel par
 * les calculs.
 */
export function validerConfig(brute: ConfigBrute): ResultatValidationConfig {
  const col = new Collecteur(brute.feuille);

  const rienNEstDeclare =
    brute.comptes.length === 0 &&
    brute.types.length === 0 &&
    brute.categories.length === 0 &&
    brute.employeurs.length === 0 &&
    !brute.compteCreditSortiesEpargne;

  if (rienNEstDeclare) {
    return { config: configVide(), anomalies: [] };
  }

  const comptesLus = validerComptes(brute, col);
  const types = validerTypes(brute, col);
  const comptes = ecarterComptesSortieEpargne(comptesLus, types, brute, col);
  const categories = validerCategories(brute, col);
  const employeurs = validerEmployeurs(brute, col);
  const compteCreditSortiesEpargne = validerCompteSorties(brute, comptes, col);

  return {
    config: {
      comptes, types, categories, employeurs,
      compteCreditSortiesEpargne,
      estVide: false,
    },
    anomalies: col.anomalies,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// LES COMPTES
// ─────────────────────────────────────────────────────────────────────────

interface CompteEnCours extends CompteConfig {
  ligne: number;
  /** Libellé du compte lié TEL QU'ÉCRIT, avant résolution. */
  lienDeclare: string;
}

function validerComptes(brute: ConfigBrute, col: Collecteur): CompteConfig[] {
  const enCours: CompteEnCours[] = [];
  const vus = new Map<string, number>();
  const doublons = new Set<string>();

  for (const l of brute.comptes) {
    const libelle = nettoyerTexte(l.compte);
    if (libelle === "") continue; // ligne vide : ignorée, pas une erreur
    const id = normaliserCle(libelle);

    // ── Doublon : les DEUX sont rejetés ────────────────────────────────
    // Précédent du lot B : deux feuilles qui ne diffèrent que par la casse,
    // deux mois de paie identiques. Garder « le premier » serait un choix
    // arbitraire présenté comme un résultat.
    const dejaVu = vus.get(id);
    if (dejaVu !== undefined) {
      doublons.add(id);
      col.rejet(
        l.ligne, "Compte",
        `Le compte « ${libelle} » est déclaré deux fois (lignes ${dejaVu} et ${l.ligne}). ` +
        `Les deux lignes sont écartées : choisir la première serait un choix arbitraire. ` +
        `Gardez-en une seule.`
      );
      continue;
    }
    vus.set(id, l.ligne);

    enCours.push({
      id,
      libelle,
      ligne: l.ligne,
      organisme: lireOrganisme(l.organisme),
      participation: lireParticipation(l, libelle, col),
      compteLie: null,
      lienDeclare: nettoyerTexte(l.compteLie),
      sensRepercute: lireSens(l, libelle, col),
      porteUnSolde: lirePorteUnSolde(l, libelle, col),
      couleur: lireCouleurCompte(l, libelle, col),
      soldeDepart: lireSolde(l, libelle, col),
    });
  }

  const retenus = enCours.filter((c) => !doublons.has(c.id));
  resoudreComptesLies(retenus, col);

  return retenus.map((c) => ({
    id: c.id,
    libelle: c.libelle,
    organisme: c.organisme,
    participation: c.participation,
    compteLie: c.compteLie,
    sensRepercute: c.sensRepercute,
    porteUnSolde: c.porteUnSolde,
    couleur: c.couleur,
    soldeDepart: c.soldeDepart,
  }));
}

function lireOrganisme(v: unknown): string | null {
  const t = nettoyerTexte(v);
  return t === "" ? null : t;
}

function lireParticipation(
  l: ConfigBrute["comptes"][number], libelle: string, col: Collecteur
): number {
  const brut = nettoyerTexte(l.participation);
  if (brut === "") return 1; // absent = 100 %, et c'est écrit au contrat

  const taux = lireTaux(l.participation);
  if (taux === null) {
    col.rejet(
      l.ligne, "Participation",
      `Taux de participation illisible pour « ${libelle} » : « ${brut} ». ` +
      `Écrivez « 50 % » ou « 0,5 ». Un nombre nu supérieur à 1 est refusé : ` +
      `« 50 » voudrait dire 5 000 %. Le compte est traité à 100 % et l'écran le dit.`
    );
    return 1;
  }

  if (taux === 0) {
    col.avertir(
      l.ligne, "Participation",
      `Taux de participation de 0 % pour « ${libelle} » : tous les montants bruts ` +
      `de ce compte deviendront 0. Si ce n'est pas voulu, laissez la case vide.`
    );
  }

  return taux;
}

function lireSens(
  l: ConfigBrute["comptes"][number], libelle: string, col: Collecteur
): SensRepercute | null {
  const brut = nettoyerTexte(l.sensRepercute);
  if (brut === "") return null;

  const sens = lireSensRepercute(l.sensRepercute);
  if (sens === null) {
    col.rejet(
      l.ligne, "Sens répercuté",
      `Sens répercuté illisible pour « ${libelle} » : « ${brut} ». ` +
      `Écrivez « Débit », « Crédit » ou « Les deux ».`
    );
  }
  return sens;
}

function lirePorteUnSolde(
  l: ConfigBrute["comptes"][number], libelle: string, col: Collecteur
): boolean {
  const brut = nettoyerTexte(l.porteUnSolde);
  if (brut === "") return true; // absent = oui

  const b = lireBooleen(l.porteUnSolde);
  if (b === null) {
    col.rejet(
      l.ligne, "Porte un solde",
      `Valeur illisible pour « ${libelle} » : « ${brut} ». Écrivez « oui » ou « non ». ` +
      `Le compte est traité comme portant un solde.`
    );
    return true;
  }
  return b;
}

function lireCouleurCompte(
  l: ConfigBrute["comptes"][number], libelle: string, col: Collecteur
): string {
  const brut = nettoyerTexte(l.couleur);
  if (brut === "") return couleurStable(libelle);

  const c = lireCouleur(l.couleur);
  if (c === null) {
    col.avertir(
      l.ligne, "Couleur",
      `Couleur illisible pour « ${libelle} » : « ${brut} ». Écrivez « #3b82f6 ». ` +
      `Une couleur de la palette automatique est utilisée.`
    );
    return couleurStable(libelle);
  }
  return c;
}

function lireSolde(
  l: ConfigBrute["comptes"][number], libelle: string, col: Collecteur
): number | null {
  const brut = nettoyerTexte(l.soldeDepart);
  if (brut === "") return null; // non initialisé, et c'est une valeur

  const n = lireNombre(l.soldeDepart);
  if (n === null) {
    col.avertir(
      l.ligne, "Solde de départ",
      `Solde illisible pour « ${libelle} » : « ${brut} ». Le compte restera ` +
      `« non initialisé », jamais 0.`
    );
    return null;
  }
  return n;
}

/**
 * Résout les comptes liés — et refuse tout ce qui n'est pas un lien simple.
 *
 * Quatre refus, dans cet ordre : un compte lié inconnu, un compte lié à
 * lui-même, une chaîne (D3a), un lien sans sens répercuté (§4.7). Chacun a
 * son message, et chacun dit ce que le refus COÛTE : les montants du compte
 * ne sont retirés d'aucun autre.
 */
function resoudreComptesLies(comptes: CompteEnCours[], col: Collecteur): void {
  const parId = new Map(comptes.map((c) => [c.id, c]));

  for (const c of comptes) {
    if (c.lienDeclare === "") {
      // Un sens répercuté sans compte lié ne sert à rien. On le dit, et on
      // l'efface : le garder laisserait croire qu'il agit.
      if (c.sensRepercute !== null) {
        col.avertir(
          c.ligne, "Sens répercuté",
          `« ${c.libelle} » déclare un sens répercuté mais aucun compte lié : ` +
          `ce sens ne sert à rien et n'est pas appliqué.`
        );
        c.sensRepercute = null;
      }
      continue;
    }

    const cible = parId.get(normaliserCle(c.lienDeclare));

    if (!cible) {
      col.rejet(
        c.ligne, "Compte lié",
        `« ${c.libelle} » déclare un compte lié « ${c.lienDeclare} » qui n'existe pas ` +
        `dans le tableau Comptes. Le lien n'est pas appliqué : les montants de ` +
        `« ${c.libelle} » ne sont retirés d'aucun compte.`
      );
      c.sensRepercute = null;
      continue;
    }

    if (cible.id === c.id) {
      col.rejet(
        c.ligne, "Compte lié",
        `« ${c.libelle} » se déclare lié à lui-même. Le lien n'est pas appliqué : ` +
        `un compte ne peut pas être sa propre contrepartie.`
      );
      c.sensRepercute = null;
      continue;
    }

    // ── D3a : un seul niveau. Une chaîne est refusée. ──────────────────
    if (cible.lienDeclare !== "") {
      const bout = parId.get(normaliserCle(cible.lienDeclare));
      const nomBout = bout ? bout.libelle : cible.lienDeclare;
      col.rejet(
        c.ligne, "Compte lié",
        `Chaîne de comptes liés : « ${c.libelle} » → « ${cible.libelle} » → « ${nomBout} ». ` +
        `Un compte lié ne peut pas en déclarer un à son tour. Écrivez « ${nomBout} » ` +
        `directement dans la colonne Compte lié de « ${c.libelle} », ou videz celle de ` +
        `« ${cible.libelle} ». Le lien de « ${c.libelle} » n'est pas appliqué.`
      );
      c.sensRepercute = null;
      continue;
    }

    // ── §4.7 : le sens n'est jamais deviné ────────────────────────────
    if (c.sensRepercute === null) {
      col.rejet(
        c.ligne, "Sens répercuté",
        `« ${c.libelle} » déclare un compte lié sans dire quel sens s'y répercute. ` +
        `Écrivez « Débit », « Crédit » ou « Les deux ». Répercuter les deux sens par ` +
        `défaut fausserait le solde de « ${cible.libelle} » sans que rien ne le signale. ` +
        `Le lien n'est pas appliqué.`
      );
      continue;
    }

    c.compteLie = cible.id;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LES TYPES
// ─────────────────────────────────────────────────────────────────────────

function validerTypes(brute: ConfigBrute, col: Collecteur): TypeConfig[] {
  const retenus: TypeConfig[] = [];
  const vus = new Map<string, number>();
  const doublons = new Set<string>();

  for (const l of brute.types) {
    const libelle = nettoyerTexte(l.type);
    if (libelle === "") continue;
    const cle = normaliserCle(libelle);

    const dejaVu = vus.get(cle);
    if (dejaVu !== undefined) {
      doublons.add(cle);
      col.rejet(
        l.ligne, "Type",
        `Le type « ${libelle} » est déclaré deux fois (lignes ${dejaVu} et ${l.ligne}). ` +
        `Les deux lignes sont écartées. Gardez-en une seule, avec toutes ses natures ` +
        `séparées par une virgule.`
      );
      continue;
    }
    vus.set(cle, l.ligne);

    retenus.push({
      libelle,
      cle,
      natures: lireNatures(l, libelle, col),
      classeParDefaut: lireClasseParDefaut(l, libelle, col),
    });
  }

  return retenus.filter((t) => !doublons.has(t.cle));
}

/**
 * Lit la colonne `Nature` — plusieurs natures, séparées par une virgule.
 *
 * Plusieurs natures par type n'est pas un confort : c'est une nécessité
 * mesurée. Voir `NATURES_INCOMPATIBLES` et le §4.5 du contrat.
 */
function lireNatures(
  l: ConfigBrute["types"][number], libelle: string, col: Collecteur
): Nature[] {
  const brut = nettoyerTexte(l.nature);
  if (brut === "") return []; // mouvement ordinaire

  const retenues: Nature[] = [];
  for (const mot of brut.split(",")) {
    const n = normaliserCle(mot);
    if (n === "") continue;

    if (!estNature(n)) {
      col.rejet(
        l.ligne, "Nature",
        `Nature inconnue pour le type « ${libelle} » : « ${nettoyerTexte(mot)} ». ` +
        `Natures acceptées : ${LISTE_NATURES}. Laissez la case vide pour un mouvement ordinaire.`
      );
      continue;
    }

    if (retenues.includes(n)) {
      col.avertir(
        l.ligne, "Nature",
        `La nature « ${n} » est écrite deux fois pour le type « ${libelle} » : ` +
        `la répétition est sans effet.`
      );
      continue;
    }

    retenues.push(n);
  }

  return ecarterIncompatibles(retenues, l.ligne, libelle, col);
}

function ecarterIncompatibles(
  natures: Nature[], ligne: number, libelle: string, col: Collecteur
): Nature[] {
  for (const [a, b, raison] of NATURES_INCOMPATIBLES) {
    if (natures.includes(a) && natures.includes(b)) {
      col.rejet(
        ligne, "Nature",
        `Le type « ${libelle} » porte deux natures qui se contredisent : « ${a} » et ` +
        `« ${b} » — ${raison}. Les deux sont écartées : le type est traité comme un ` +
        `mouvement ordinaire.`
      );
      return natures.filter((n) => n !== a && n !== b);
    }
  }
  return natures;
}

function lireClasseParDefaut(
  l: ConfigBrute["types"][number], libelle: string, col: Collecteur
): Classe | null {
  const brut = nettoyerTexte(l.classeParDefaut);
  if (brut === "") return null;

  const c = lireClasse(l.classeParDefaut);
  if (c === null) {
    col.rejet(
      l.ligne, "Classe par défaut",
      `Classe inconnue pour le type « ${libelle} » : « ${brut} ». ` +
      `Les trois classes sont : ${CLASSES.join(", ")}. Aucune classe par défaut ` +
      `n'est appliquée à ce type.`
    );
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────
// LES CATÉGORIES ET LES EMPLOYEURS
// ─────────────────────────────────────────────────────────────────────────

function validerCategories(brute: ConfigBrute, col: Collecteur): CategorieConfig[] {
  const retenues: CategorieConfig[] = [];
  const vues = new Map<string, number>();
  const doublons = new Set<string>();

  for (const l of brute.categories) {
    const libelle = nettoyerTexte(l.categorie);
    if (libelle === "") continue;
    const cle = normaliserCle(libelle);

    const dejaVue = vues.get(cle);
    if (dejaVue !== undefined) {
      doublons.add(cle);
      col.rejet(
        l.ligne, "Catégorie",
        `La catégorie « ${libelle} » est déclarée deux fois (lignes ${dejaVue} et ` +
        `${l.ligne}). Les deux lignes sont écartées. Gardez-en une seule.`
      );
      continue;
    }
    vues.set(cle, l.ligne);

    const brutCouleur = nettoyerTexte(l.couleur);
    let couleur = couleurStable(libelle);
    if (brutCouleur !== "") {
      const c = lireCouleur(l.couleur);
      if (c === null) {
        col.avertir(
          l.ligne, "Couleur",
          `Couleur illisible pour la catégorie « ${libelle} » : « ${brutCouleur} ». ` +
          `Écrivez « #3b82f6 ». Une couleur de la palette automatique est utilisée.`
        );
      } else {
        couleur = c;
      }
    }

    retenues.push({ libelle, cle, couleur });
  }

  return retenues.filter((c) => !doublons.has(c.cle));
}

function validerEmployeurs(brute: ConfigBrute, col: Collecteur): string[] {
  const retenus: string[] = [];
  const vus = new Map<string, number>();

  for (const l of brute.employeurs) {
    const libelle = nettoyerTexte(l.employeur);
    if (libelle === "") continue;
    const cle = normaliserCle(libelle);

    const dejaVu = vus.get(cle);
    if (dejaVu !== undefined) {
      col.avertir(
        l.ligne, "Employeur",
        `L'employeur « ${libelle} » est déclaré deux fois (lignes ${dejaVu} et ` +
        `${l.ligne}) : la répétition est sans effet.`
      );
      continue;
    }
    vus.set(cle, l.ligne);
    retenus.push(libelle);
  }

  return retenus;
}

// ─────────────────────────────────────────────────────────────────────────
// F7 — « SORTIE EPARGNE » DÉCLARÉ COMME COMPTE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Depuis le format v2 (D2), le libellé des sorties d'épargne est un TYPE, de
 * nature `sortie-epargne`. Une ligne du tableau Comptes qui porte le nom d'un
 * tel type est un reste d'ancien fichier : l'import a lieu, la ligne de
 * compte est ignorée, et l'aperçu le dit en nommant quoi faire.
 *
 * Le nom est lu dans les TYPES DÉCLARÉS, jamais écrit ici (§5 du contrat) :
 * sans type `sortie-epargne` déclaré, rien n'est reconnu, et rien n'est
 * deviné.
 */
function ecarterComptesSortieEpargne(
  comptes: CompteConfig[], types: TypeConfig[], brute: ConfigBrute, col: Collecteur
): CompteConfig[] {
  const nomsDeType = new Set(
    types.filter((t) => t.natures.includes("sortie-epargne")).map((t) => t.cle)
  );
  const ecartes = comptes.filter((c) => nomsDeType.has(c.id));
  if (ecartes.length === 0) return comptes;

  const idsEcartes = new Set(ecartes.map((c) => c.id));
  for (const c of ecartes) {
    const ligne =
      brute.comptes.find((l) => normaliserCle(nettoyerTexte(l.compte)) === c.id)?.ligne ?? 0;
    col.avertir(
      ligne, "Compte",
      `« ${c.libelle} » est déclaré comme compte, mais c'est un type depuis le format v2. ` +
      `Cette ligne du tableau Comptes est ignorée. Pour garder la trace de l'épargne qui ` +
      `sort, déclarez un compte sans solde propre (« Porte un solde » = non) et ` +
      `utilisez-le dans la colonne Compte des transactions de ce type.`
    );
  }

  return comptes
    .filter((c) => !idsEcartes.has(c.id))
    .map((c) => {
      if (!c.compteLie || !idsEcartes.has(c.compteLie)) return c;
      const ligne =
        brute.comptes.find((l) => normaliserCle(nettoyerTexte(l.compte)) === c.id)?.ligne ?? 0;
      col.avertir(
        ligne, "Compte lié",
        `« ${c.libelle} » était lié à un compte ignoré (voir plus haut). Il n'a plus de ` +
        `compte lié.`
      );
      return { ...c, compteLie: null };
    });
}

// ─────────────────────────────────────────────────────────────────────────
// LE COMPTE CRÉDITÉ PAR LES SORTIES D'ÉPARGNE (D2)
// ─────────────────────────────────────────────────────────────────────────

function validerCompteSorties(
  brute: ConfigBrute, comptes: CompteConfig[], col: Collecteur
): string | null {
  const decl = brute.compteCreditSortiesEpargne;
  if (!decl) return null;

  const libelle = nettoyerTexte(decl.valeur);
  if (libelle === "") return null;

  const cible = comptes.find((c) => c.id === normaliserCle(libelle));
  if (!cible) {
    col.rejet(
      decl.ligne, "Valeur",
      `« Compte crédité par les sorties d'épargne » désigne « ${libelle} », qui n'existe ` +
      `pas dans le tableau Comptes. Les sorties d'épargne ne seront créditées à aucun ` +
      `compte, et l'écran le dira.`
    );
    return null;
  }

  return cible.id;
}
