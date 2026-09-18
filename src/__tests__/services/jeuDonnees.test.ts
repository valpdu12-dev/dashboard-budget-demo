import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  VERSION_SCHEMA,
  construireJeuDepuisRapport,
  construireJeuAncienFormat,
  construireJeuStatique,
  memoriserJeu,
  lireJeuMemorise,
  oublierJeu,
  type JeuDonnees,
} from "@/services/jeuDonnees";
import { useDataStore } from "@/stores/useDataStore";
import { decodeTransactions, encodeTransactions } from "@/utils/decode";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeSalaryData, makeSalaryMonth } from "../helpers/factories";
import type { RapportImport } from "@/services/lectureClasseur";
import type { Transaction } from "@/types";
import { configVide } from "@/types/budgetConfig";

/**
 * Un jeu = un tout — lot B.5.
 *
 * Le défaut corrigé : un import ne remplaçait QUE les transactions et les
 * salaires. Configuration, objectifs et couverture restaient ceux du jeu
 * précédent, si bien que les soldes de départ de la démonstration
 * s'affichaient en face des transactions de la personne, sans un mot.
 */

const TX: Transaction[] = [
  makeTx({ date: "2026-01-03", montant: 42.15, label: "Courses" }),
  makeTx({ date: "2026-02-04", montant: 18, label: "Essence" }),
];

function rapport(over: Partial<RapportImport["parametres"]> = {}): RapportImport {
  return {
    transactions: TX,
    paie: [{ mk: "2026-01", entreprise: "Employeur A", brut: 3100, cotSal: 682, indem: 0, retenues: 0, net: 2418 }],
    parametres: { versionFormat: 1, couverture: null, pret: null, soldes: {}, config: configVide(), ...over },
    anomalies: [],
    anomaliesNonListees: 0,
    compteurs: { lignesLues: 2, acceptees: 2, rejetees: 0, ignorees: 0, avertissements: 0 },
    feuillesLues: ["Transactions"],
  };
}

beforeEach(() => {
  localStorage.clear();
  resetAllStores();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("construction d'un jeu depuis un fichier", () => {
  it("bâtit la configuration UNIQUEMENT depuis ce que le fichier déclare", () => {
    const jeu = construireJeuDepuisRapport(
      rapport({
        soldes: { "Banque A - Courant": 3200 },
        couverture: { debut: "2026-01-01", fin: "2026-03-31" },
        pret: { montant: 180000, mensualite: 893.6, echeances: 240, premiereEcheance: "2022-10" },
      }),
      "mon-budget.xlsx"
    );
    expect(jeu.config.init).toEqual({ "Banque A - Courant": 3200 });
    expect(jeu.config.couverture).toEqual({ debut: "2026-01-01", fin: "2026-03-31" });
    expect(jeu.config.pret).toMatchObject({ montant: 180000, premiere_echeance: "2022-10" });
    expect(jeu.config.demo).toBe(false);
  });

  it("laisse les soldes VIDES quand le fichier n'en déclare pas", () => {
    // Vide, et non « ceux d'avant » : c'est tout l'objet de cette étape.
    expect(construireJeuDepuisRapport(rapport(), "x.xlsx").config.init).toEqual({});
  });

  it("n'hérite d'aucun objectif de budget", () => {
    // Le format public v1 n'en porte pas. Hériter de ceux de la démonstration
    // afficherait les plafonds de quelqu'un d'autre.
    expect(construireJeuDepuisRapport(rapport(), "x.xlsx").budgets).toEqual([]);
  });

  it("mémorise la forme ENCODÉE, pas la forme décodée", () => {
    // Mesuré : 47,5 octets par transaction contre 241,5. C'est ce qui fait
    // passer la capacité d'environ 21 700 à environ 110 000 transactions.
    const jeu = construireJeuDepuisRapport(rapport(), "x.xlsx");
    expect(Array.isArray(jeu.transactions.s)).toBe(true);
    expect(jeu.transactions.t).toHaveLength(2);
    expect(decodeTransactions(jeu.transactions)).toHaveLength(2);
  });

  it("donne au jeu de l'ancien format une configuration vide, pas celle d'avant", () => {
    const jeu = construireJeuAncienFormat(encodeTransactions(TX), makeSalaryData([]), "Budget_2026.xlsx");
    expect(jeu.config).toEqual({ init: {}, demo: false });
    expect(jeu.origine).toBe("upload");
  });
});

describe("mémorisation", () => {
  const jeu = () => construireJeuDepuisRapport(rapport({ soldes: { "Banque A - Courant": 3200 } }), "x.xlsx");

  it("relit exactement ce qui a été écrit", () => {
    const avant = jeu();
    expect(memoriserJeu(avant)).toBe(true);
    expect(lireJeuMemorise().jeu).toEqual(avant);
  });

  it("porte une version de schéma", () => {
    expect(jeu().version).toBe(VERSION_SCHEMA);
  });

  it("ignore un jeu d'une version inconnue plutôt que de le lire à moitié", () => {
    localStorage.setItem("budget.jeu.v2", JSON.stringify({ ...jeu(), version: 99 }));
    expect(lireJeuMemorise().jeu).toBeNull();
  });

  it("ignore un contenu illisible sans lever d'exception", () => {
    localStorage.setItem("budget.jeu.v2", "{ceci n'est pas du JSON");
    expect(() => lireJeuMemorise().jeu).not.toThrow();
    expect(lireJeuMemorise().jeu).toBeNull();
  });

  it("rend false quand le navigateur refuse l'écriture, au lieu de l'avaler", () => {
    // C'est ce qui permet à l'écran de le DIRE. Aucun seuil de taille n'est
    // écrit dans le code : on tente, et on rapporte.
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(memoriserJeu(jeu())).toBe(false);
    setItem.mockRestore();
  });

  it("oublie le jeu, ancienne clé comprise", () => {
    memoriserJeu(jeu());
    localStorage.setItem("budget.import.v1", "{}");
    oublierJeu();
    expect(localStorage.getItem("budget.jeu.v2")).toBeNull();
    expect(localStorage.getItem("budget.import.v1")).toBeNull();
  });
});

describe("migration depuis l'ancien schéma", () => {
  it("convertit un import de la version 1 au lieu de le jeter", () => {
    // Quelqu'un qui a importé son fichier hier n'a pas à le refaire.
    localStorage.setItem("budget.import.v1", JSON.stringify({
      transactions: TX,
      salary: makeSalaryData([makeSalaryMonth({ mk: "2026-01" })]),
      fileName: "ancien.xlsx",
      importedAt: "2026-08-11T18:00:00.000Z",
    }));
    const jeu = lireJeuMemorise().jeu;
    expect(jeu?.version).toBe(VERSION_SCHEMA);
    expect(jeu?.fileName).toBe("ancien.xlsx");
    expect(decodeTransactions(jeu!.transactions)).toHaveLength(2);
    // La v1 ne portait aucune configuration : l'inventer serait exactement le
    // mélange que ce lot corrige.
    expect(jeu?.config).toEqual({ init: {}, demo: false });
  });

  it("efface l'ancienne clé une fois migrée, pour ne pas migrer deux fois", () => {
    localStorage.setItem("budget.import.v1", JSON.stringify({
      transactions: TX, salary: makeSalaryData([]), fileName: "a.xlsx",
      importedAt: "2026-08-11T18:00:00.000Z",
    }));
    lireJeuMemorise().jeu;
    expect(localStorage.getItem("budget.import.v1")).toBeNull();
    // Lot C.6 : le schéma courant est le 3.
    expect(localStorage.getItem("budget.jeu.v3")).not.toBeNull();
  });

  it("ignore un contenu v1 tronqué", () => {
    localStorage.setItem("budget.import.v1", JSON.stringify({ transactions: TX }));
    expect(lireJeuMemorise().jeu).toBeNull();
  });
});

describe("fermer / rouvrir — le critère de sortie de l'étape", () => {
  it("rend exactement le même état après un aller-retour complet", () => {
    const jeu: JeuDonnees = construireJeuDepuisRapport(
      rapport({
        soldes: { "Banque A - Courant": 3200, "Banque B - Courant": 1500 },
        couverture: { debut: "2026-01-01", fin: "2026-03-31" },
        pret: { montant: 180000, mensualite: 893.6, echeances: 240 },
      }),
      "mon-budget.xlsx"
    );

    // Ouverture 1 : on pose et on mémorise.
    useDataStore.getState().poserJeu(jeu);
    memoriserJeu(jeu);
    const avant = useDataStore.getState();
    const instantane = {
      transactions: avant.transactions,
      salary: avant.salary,
      config: avant.config,
      budgets: avant.budgets,
      origin: avant.origin,
      importedAt: avant.importedAt,
      importFileName: avant.importFileName,
    };

    // Fermeture : le store repart de zéro, le stockage survit.
    useDataStore.getState().reset();
    expect(useDataStore.getState().transactions).toHaveLength(0);

    // Ouverture 2 : on relit et on repose.
    const relu = lireJeuMemorise().jeu;
    expect(relu).not.toBeNull();
    useDataStore.getState().poserJeu(relu!);

    const apres = useDataStore.getState();
    expect({
      transactions: apres.transactions,
      salary: apres.salary,
      config: apres.config,
      budgets: apres.budgets,
      origin: apres.origin,
      importedAt: apres.importedAt,
      importFileName: apres.importFileName,
    }).toEqual(instantane);
  });
});

describe("séries publiques", () => {
  it("survivent à la pose d'un jeu qui ne les porte pas", () => {
    // L'inflation INSEE et le SMIC ne décrivent personne : ils appartiennent à
    // l'application. Ils disparaissaient à chaque import, et la page
    // « Salaire vs inflation » se vidait sans explication.
    const avecReferences = makeSalaryData([makeSalaryMonth({ mk: "2026-01" })], {
      inflation: [{ year: "2025", rate_annual: 2 } as never],
    });
    useDataStore.getState().poserJeu(
      construireJeuStatique(TX, avecReferences, { init: {} }, [])
    );
    expect(useDataStore.getState().salary?.inflation).toHaveLength(1);

    useDataStore.getState().poserJeu(construireJeuDepuisRapport(rapport(), "x.xlsx"));
    expect(useDataStore.getState().salary?.inflation).toHaveLength(1);
  });
});
