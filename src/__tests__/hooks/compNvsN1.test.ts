import { describe, it, expect } from "vitest";

/**
 * Comparaison N / N-1 par catégorie — exigence de période équivalente.
 *
 * Le calcul de `useExpenseData` était FAUX jusqu'au 11/08/2026 :
 *   ① l'année en cours respectait le filtre de période, l'année précédente
 *      prenait ses douze mois — en YTD sur huit mois, huit mois de N étaient
 *      comparés à douze mois de N-1, et le graphique affichait une baisse
 *      systématique qui n'existait pas ;
 *   ② les virements internes n'étaient exclus que d'un seul côté.
 *
 * Le hook complet dépend de trois stores et n'est pas isolable à moindre
 * frais. Ces tests portent donc sur la RÈGLE elle-même, reproduite à
 * l'identique ci-dessous : c'est elle qui était fausse, pas le câblage.
 * La limite est nommée plutôt que tue — un test du hook réel reste dû si
 * cette logique se complexifie.
 */

interface Tx { date: string; dc: string; cat2: string; type: string; montant: number }

const TRANSFERTS = new Set(["Transfert Banque A vers Banque C", "Transfert Banque A vers Banque B"]);

/** Règle telle qu'implémentée dans `useExpenseData.compNvsN1`. */
function comparer(
  txCourantes: Tx[],
  toutes: Tx[],
  moisDeLaPeriode: string[],
  curYear: string,
  prevYear: string
) {
  const estDepense = (t: Tx) =>
    t.dc === "Débit" && !!t.cat2 && t.cat2 !== "x" && !TRANSFERTS.has(t.type);
  const fenetre = new Set(
    moisDeLaPeriode.filter((mk) => mk.startsWith(curYear)).map((mk) => mk.slice(5, 7))
  );
  const cur = txCourantes.filter(
    (t) => estDepense(t) && t.date.startsWith(curYear) && fenetre.has(t.date.slice(5, 7))
  );
  const prev = toutes.filter(
    (t) => estDepense(t) && t.date.startsWith(prevYear) && fenetre.has(t.date.slice(5, 7))
  );
  const somme = (a: Tx[]) => a.reduce((s, t) => s + t.montant, 0);
  return { cur: somme(cur), prev: somme(prev) };
}

const dep = (date: string, montant: number, type = "Courses"): Tx =>
  ({ date, montant, dc: "Débit", cat2: "Alimentation", type });

describe("comparaison N / N-1 sur période équivalente", () => {
  it("limite l'année précédente aux mois de la période affichée", () => {
    // YTD sur 2 mois : décembre N-1 ne doit PAS entrer dans la comparaison.
    const courantes = [dep("2026-01-10", 100), dep("2026-02-10", 100)];
    const toutes = [
      ...courantes,
      dep("2025-01-10", 80),
      dep("2025-02-10", 80),
      dep("2025-12-10", 500), // hors fenêtre
    ];
    const r = comparer(courantes, toutes, ["2026-01", "2026-02"], "2026", "2025");
    expect(r.cur).toBe(200);
    expect(r.prev).toBe(160); // et non 660
  });

  it("ne fabrique plus de baisse artificielle en YTD", () => {
    // Le défaut d'origine : 2 mois de N contre 12 mois de N-1.
    const courantes = [dep("2026-01-10", 100), dep("2026-02-10", 100)];
    const anneePleine = Array.from({ length: 12 }, (_, i) =>
      dep(`2025-${String(i + 1).padStart(2, "0")}-10`, 100)
    );
    const r = comparer(courantes, [...courantes, ...anneePleine], ["2026-01", "2026-02"], "2026", "2025");
    expect(r.prev).toBe(200);
    expect(r.cur).toBe(r.prev); // dépense identique ⇒ écart nul
  });

  it("exclut les virements internes DES DEUX CÔTÉS", () => {
    const courantes = [dep("2026-01-10", 100), dep("2026-01-11", 900, "Transfert Banque A vers Banque C")];
    const toutes = [...courantes, dep("2025-01-10", 100), dep("2025-01-11", 900, "Transfert Banque A vers Banque C")];
    const r = comparer(courantes, toutes, ["2026-01"], "2026", "2025");
    expect(r.cur).toBe(100);
    expect(r.prev).toBe(100);
  });

  it("suit un filtre sur un mois unique", () => {
    const courantes = [dep("2026-03-10", 100)];
    const toutes = [...courantes, dep("2025-03-10", 70), dep("2025-04-10", 999)];
    const r = comparer(courantes, toutes, ["2026-03"], "2026", "2025");
    expect(r.prev).toBe(70);
  });

  it("ignore les recettes et les catégories non renseignées", () => {
    const courantes: Tx[] = [
      dep("2026-01-10", 100),
      { date: "2026-01-11", montant: 500, dc: "Crédit", cat2: "Salaire", type: "Salaire" },
      { date: "2026-01-12", montant: 50, dc: "Débit", cat2: "x", type: "Courses" },
    ];
    const r = comparer(courantes, courantes, ["2026-01"], "2026", "2025");
    expect(r.cur).toBe(100);
  });

  it("rend zéro des deux côtés quand la période ne couvre pas l'année en cours", () => {
    const r = comparer([], [dep("2025-01-10", 80)], ["2025-01"], "2026", "2025");
    expect(r.cur).toBe(0);
    expect(r.prev).toBe(0);
  });
});
