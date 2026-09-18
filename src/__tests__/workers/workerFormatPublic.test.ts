import { describe, it, expect, beforeAll, vi } from "vitest";
import * as XLSX from "xlsx";
import { construireClasseurModele } from "@/services/modeleExcel";
import type { RapportImport } from "@/services/lectureClasseur";

/**
 * Le chemin complet du format public, DANS le worker : reconnaissance du
 * format, lecture, validation, encodage dictionnaire.
 *
 * Les modules pris séparément sont déjà testés. Ce qui ne l'est qu'ici, c'est
 * leur assemblage — et notamment que l'encodage et le rapport de validation,
 * écrits pour l'ancien format, encaissent des données publiques : une paie
 * sans détail de cotisations, par exemple.
 */

type WorkerMsg = { type: string; [k: string]: unknown };

let onmessage: ((ev: { data: unknown }) => void) | null = null;
const sent: WorkerMsg[] = [];

beforeAll(async () => {
  vi.stubGlobal("self", {
    get onmessage() { return onmessage; },
    set onmessage(fn: typeof onmessage) { onmessage = fn; },
    postMessage: (m: WorkerMsg) => { sent.push(m); },
  });
  await import("@/components/upload/parseExcel.worker");
});

function envoyer(buffer: ArrayBuffer): WorkerMsg {
  sent.length = 0;
  onmessage!({ data: { type: "parse", buffer } });
  const dernier = sent.filter((m) => m.type !== "progress").pop();
  if (!dernier) throw new Error("Le worker n'a produit aucun message final.");
  return dernier;
}

/** Le classeur modèle, tel qu'un utilisateur le téléchargerait puis l'importerait. */
function modeleEnOctets(): ArrayBuffer {
  const o = construireClasseurModele();
  return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength) as ArrayBuffer;
}

describe("worker — import du classeur modèle", () => {
  // L'envoi doit avoir lieu APRÈS le beforeAll qui importe le worker : le corps
  // d'un `describe` s'exécute à la collecte, avant tout hook.
  let res: WorkerMsg;
  beforeAll(() => { res = envoyer(modeleEnOctets()); });

  it("aboutit à un résultat, pas à une erreur", () => {
    expect(res.type, String(res.message ?? "")).toBe("result");
  });

  it("annonce le format public", () => {
    expect(res.format).toBe("public");
  });

  it("rend un rapport sans rejet ni avertissement", () => {
    const r = res.rapport as RapportImport;
    expect(r.anomalies).toEqual([]);
    // Les compteurs portent sur TOUTES les feuilles : 51 transactions
    // constatées + 3 bulletins. L'emplacement de chaque anomalie dit, lui,
    // de quelle feuille il s'agit.
    expect(r.transactions).toHaveLength(51);
    expect(r.paie).toHaveLength(3);
    expect(r.compteurs.acceptees).toBe(54);
  });

  it("encode les transactions au format dictionnaire attendu par le dashboard", () => {
    const t = res.transactions as { s: string[]; t: unknown[][]; fields: string[] };
    expect(t.t).toHaveLength(51);
    expect(t.fields).toContain("montant");
    expect(t.s.length).toBeGreaterThan(0);
  });

  it("construit une paie sans détail de cotisations, sans se casser", () => {
    const s = res.salary as { months: unknown[]; cotLast: unknown[]; lastMonth: string };
    expect(s.months).toHaveLength(3);
    expect(s.cotLast).toEqual([]);
    expect(s.lastMonth).toBe("2026-03");
  });

  it("produit un rapport de validation cohérent avec les données lues", () => {
    const v = res.validation as { nbTransactions: number; dateMin: string; dateMax: string };
    expect(v.nbTransactions).toBe(51);
    expect(v.dateMin).toBe("2026-01-02");
    expect(v.dateMax).toBe("2026-03-28");
  });
});

describe("worker — non-régression de l'ancien format", () => {
  it("laisse le rapport vide : l'ancien format ne passe pas par le lecteur public", () => {
    // L'adaptateur de l'ancien classeur reste en place et ne produit pas de
    // rapport ligne à ligne. Le distinguer par ce champ évite que l'écran
    // d'aperçu affiche « 0 rejet » pour un chemin qui ne compte rien.
    const wb = XLSX.utils.book_new();
    // ⚠️ Lot C — la colonne S (Débit/Crédit) doit être remplie : le repli qui
    // la reconstituait depuis une liste de libellés a été supprimé.
    const entete = ["Transaction", "Compte", "Type Dépense", "Date", "Montant", "Montant réel"];
    const vides = Array.from({ length: 17 }, () => []);
    const ligne = new Array(20).fill(null);
    ligne[0] = "Courses"; ligne[1] = "Banque A - Courant"; ligne[2] = "courses";
    ligne[3] = 46023; ligne[4] = 20; ligne[5] = 20; ligne[18] = "Débit";
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([...vides, entete, ligne]),
      "Transactions 2026"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ...Array.from({ length: 11 }, () => []),
        ["", "Entreprise", "Détail", "Qui", "Catégorie", "Désignation", "Date", "Montant"],
        ["", "Employeur A", "Salaire", "Salarié", "SALAIRE", "Salaire de base", 46023, 3100],
      ]),
      "Fiche de Paie"
    );
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const res = envoyer(buffer);
    expect(res.format).toBe("ancien");
    expect(res.rapport ?? null).toBeNull();
  });
});
