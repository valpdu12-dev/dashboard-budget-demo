// ── Le calcul des soldes, sans un seul nom de compte ─────────────────────
//
// Lot C.4. Ce fichier portait les TROIS règles nommées du projet. Elles ont
// disparu, remplacées par ce que la source déclare :
//
//   avant (lot B)                          après (lot C.4)
//   ───────────────────────────────────────────────────────────────────────
//   quatre comptes cités retirent          `Compte lié` + `Sens répercuté`
//     leur montant du principal              déclarés par compte
//   `t.type !== "Virement extérieur"`      nature `apport-exterieur`
//   `t.compte === "Sortie Epargne"`        nature `sortie-epargne` du TYPE,
//     (un pseudo-compte)                     créditée au compte déclaré
//   `COMPTES_REELS` (liste figée)          les comptes déclarés, ou les
//                                            comptes présents dans les données
//   cinq séries écrites à la main          les comptes qui portent un solde
//
// ⚠️ CE QUI EST RETIRÉ, ET DOCUMENTÉ COMME RETIRÉ (§C.4 du plan) :
//
//   - **Le pseudo-compte `Sortie Epargne`.** Ce n'était pas un compte : ni
//     solde, ni couleur, ni icône, absent de `accounts.ts`, invisible à
//     l'écran. C'était un libellé de compte utilisé comme un type. Une ligne
//     dont le TYPE porte la nature `sortie-epargne` crédite désormais le
//     compte déclaré une fois pour toutes dans `Paramètres` (D2). Sans compte
//     déclaré, elle ne crédite RIEN — et l'écran le dit, chiffré.
//   - **L'exception `Virement extérieur`.** C'était une règle de compte qui
//     dépendait d'un libellé de type. Elle devient la nature
//     `apport-exterieur`, qui neutralise le compte lié (D3b). Mesuré sur le
//     jeu de démonstration : sans elle, 1 172,71 € sur 6 lignes seraient
//     retirés à tort du compte principal.
//
// ⚠️ Comparaison des libellés par clé NORMALISÉE, jamais par `startsWith` ni
// `includes` : deux comptes de la démonstration commencent par « Banque B »
// et deux par « Banque A ».

import { normaliserCle } from "@/services/lectureValeurs";
import type { Transaction } from "@/types";
import type { Regles } from "@/calculs/regles";

export interface SoldesCalcules {
  balancesByMonth: Record<string, Record<string, number>>;
  currentBalances: Record<string, number>;
  balanceChartData: (monthsInRange: string[]) => Array<Record<string, number | string>>;
  /**
   * Comptes sans solde de départ déclaré — lot B.5.
   *
   * Un compte non initialisé n'est PAS à zéro : on ne connaît simplement pas
   * son point de départ. Le compter pour 0 dans le total du patrimoine
   * revenait à afficher la somme des mouvements en la présentant comme une
   * fortune. Ces comptes sortent donc des soldes et du total, et l'écran les
   * nomme.
   */
  comptesNonInitialises: string[];
  /** Vrai quand AUCUN compte n'a de solde de départ : rien n'est calculable. */
  aucunSoldeConnu: boolean;
  /** Tous les comptes qui apparaissent dans les données, du plus actif au moins actif. */
  comptesPresents: string[];
  /**
   * Les comptes qui portent un solde propre — déclarés, ou déduits des
   * données quand rien n'est déclaré. C'est la liste des séries de la courbe
   * et des cartes de l'écran Comptes.
   */
  comptesAvecSolde: string[];
  /**
   * Variation CUMULÉE par compte et par mois — lot B.5bis.
   *
   * Sans solde de départ, un solde est hors d'atteinte : on ignore le point
   * de départ. La variation, elle, se calcule sans rien supposer : crédits
   * moins débits, cumulés depuis la première transaction.
   */
  variationsByMonth: Record<string, Record<string, number>>;
  /**
   * Montant des sorties d'épargne qu'aucun compte ne reçoit, faute de
   * déclaration (D2). `0` quand il n'y en a pas — et l'écran ne dit rien.
   */
  sortiesNonCreditees: { lignes: number; montant: number };
}

export function calculerSoldes(
  transactions: Transaction[],
  allMonths: string[],
  initBalances: Record<string, number>,
  regles: Regles
): SoldesCalcules {
  // ── Pré-indexation par mois : O(n) + O(m) au lieu de O(n×m) ───────────
  const txByMonth = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const arr = txByMonth.get(t.monthKey);
    if (arr) arr.push(t);
    else txByMonth.set(t.monthKey, [t]);
  }

  // ── Les comptes présents dans les données, du plus actif au moins actif ─
  const poids = new Map<string, number>();
  for (const t of transactions) {
    poids.set(t.compte, (poids.get(t.compte) ?? 0) + t.montant);
  }
  const comptesPresents = [...poids.keys()].sort(
    (a, b) => (poids.get(b) ?? 0) - (poids.get(a) ?? 0) || a.localeCompare(b)
  );

  // ── Quels comptes portent un solde ? ──────────────────────────────────
  //
  // Déclarés : ceux dont la colonne `Porte un solde` ne dit pas non.
  //
  // Rien de déclaré : les comptes présents dans les données, PLUS ceux qui
  // ont un solde de départ sans avoir encore bougé.
  //
  // ⚠️ Les deux moitiés comptent, et l'oubli de l'une ou l'autre est
  // silencieux. Ne garder que les comptes ayant un solde ferait disparaître
  // ceux que l'écran doit nommer « non initialisés » (lot B.5) ; ne garder
  // que les comptes présents ferait disparaître un compte ouvert et déclaré
  // sur lequel rien ne s'est encore passé — son solde existe pourtant.
  const comptesAvecSolde = regles.declaree
    ? regles.comptesDeclares.filter((c) => c.porteUnSolde).map((c) => c.libelle)
    : [...comptesPresents, ...Object.keys(initBalances).filter((c) => !poids.has(c))];

  const porteUnSolde = new Set(comptesAvecSolde.map(normaliserCle));

  const comptesInitialises = comptesAvecSolde.filter(
    (c) => typeof initBalances[c] === "number"
  );
  const comptesNonInitialises = comptesAvecSolde.filter(
    (c) => typeof initBalances[c] !== "number"
  );

  // ── Soldes cumulatifs mois par mois ───────────────────────────────────
  const balancesByMonth: Record<string, Record<string, number>> = {};
  const running: Record<string, number> = {};
  for (const compte of comptesAvecSolde) running[compte] = initBalances[compte] ?? 0;

  const sortiesNonCreditees = { lignes: 0, montant: 0 };

  for (const mk of allMonths) {
    for (const t of txByMonth.get(mk) ?? []) {
      const m = t.montant;
      const declare = regles.compte(t.compte);

      // ① Le compte de la ligne, s'il porte un solde.
      if (porteUnSolde.has(normaliserCle(t.compte))) {
        const cle = declare?.libelle ?? t.compte;
        if (t.dc === "Crédit") running[cle] += m;
        else running[cle] -= m;
      }

      // ② Le compte lié — la contrepartie. Retiré, quel que soit le sens de
      //    la ligne : c'est le SENS RÉPERCUTÉ déclaré qui dit quand la règle
      //    s'applique, et non le signe du mouvement. Voir §4.7 du contrat.
      if (declare?.compteLie && !regles.aNature(t.type, "apport-exterieur")) {
        const sens = declare.sensRepercute;
        if (sens === "Les deux" || sens === t.dc) {
          const lie = regles.comptesDeclares.find((c) => c.id === declare.compteLie);
          if (lie && porteUnSolde.has(normaliserCle(lie.libelle))) {
            running[lie.libelle] -= m;
          }
        }
      }

      // ③ Sortie d'épargne : le TYPE la reconnaît, le compte déclaré la reçoit.
      if (regles.aNature(t.type, "sortie-epargne")) {
        if (regles.compteSorties && porteUnSolde.has(normaliserCle(regles.compteSorties))) {
          running[regles.compteSorties] += m;
        } else {
          sortiesNonCreditees.lignes++;
          sortiesNonCreditees.montant = Math.round((sortiesNonCreditees.montant + m) * 100) / 100;
        }
      }
    }

    // Seuls les comptes dont on connaît le point de départ entrent dans
    // l'instantané — et donc dans le total.
    const instantane: Record<string, number> = {};
    for (const c of comptesInitialises) instantane[c] = running[c];
    if (comptesInitialises.length > 0) {
      instantane.Total = comptesInitialises.reduce((somme, c) => somme + running[c], 0);
    }
    balancesByMonth[mk] = instantane;
  }

  // ── Variation cumulée, sans aucune règle ──────────────────────────────
  const variationsByMonth: Record<string, Record<string, number>> = {};
  const cumul: Record<string, number> = {};
  for (const c of comptesPresents) cumul[c] = 0;

  for (const mk of allMonths) {
    for (const t of txByMonth.get(mk) ?? []) {
      if (!(t.compte in cumul)) continue;
      cumul[t.compte] += t.dc === "Crédit" ? t.montant : -t.montant;
    }
    const instantane: Record<string, number> = { ...cumul };
    instantane.Total = comptesPresents.reduce((s2, c) => s2 + cumul[c], 0);
    variationsByMonth[mk] = instantane;
  }

  // ── Soldes du dernier mois (= soldes actuels) ─────────────────────────
  let currentBalances: Record<string, number>;
  if (!allMonths.length) {
    const depart: Record<string, number> = {};
    for (const c of comptesInitialises) depart[c] = initBalances[c];
    if (comptesInitialises.length > 0) {
      depart.Total = comptesInitialises.reduce((s2, c) => s2 + initBalances[c], 0);
    }
    currentBalances = depart;
  } else {
    currentBalances = balancesByMonth[allMonths[allMonths.length - 1]] ?? {};
  }

  // ── La courbe : une série par compte qui porte un solde ───────────────
  //
  // ⚠️ Cinq séries étaient écrites À LA MAIN ici. Un sixième compte, même
  // correctement initialisé, n'apparaissait pas dans la courbe — sans erreur
  // et sans message. C'était le §2.2 du plan d'action.
  const balanceChartData = (monthsInRange: string[]) =>
    monthsInRange.map((mk) => {
      const point: Record<string, number | string> = { monthKey: mk };
      for (const c of comptesAvecSolde) {
        point[c] = Math.round(balancesByMonth[mk]?.[c] ?? 0);
      }
      point.Total = Math.round(balancesByMonth[mk]?.["Total"] ?? 0);
      return point;
    });

  return {
    comptesPresents,
    comptesAvecSolde,
    variationsByMonth,
    comptesNonInitialises,
    aucunSoldeConnu: comptesInitialises.length === 0,
    balancesByMonth,
    currentBalances,
    balanceChartData,
    sortiesNonCreditees,
  };
}
