// ── Validation de la configuration — lot C.1 ─────────────────────────────
//
// Critère de sortie du C.1 : une config vide, une config complète, et au
// moins six configs fausses qui produisent six messages DISTINCTS et NOMMÉS.
//
// Ce que ces tests vérifient au fond : rien n'est jamais deviné. Chaque
// valeur illisible produit une anomalie située, et la configuration rendue
// ne contient que ce qui a pu être lu.

import { describe, expect, it } from "vitest";
import { couleurStable } from "@/config/colors";
import { validerConfig } from "@/services/validerConfig";
import { configBruteVide, type ConfigBrute } from "@/types/budgetConfig";

function brute(partiel: Partial<ConfigBrute> = {}): ConfigBrute {
  return { ...configBruteVide(), ...partiel };
}

/** Un compte minimal, à la ligne demandée. */
function ligneCompte(
  ligne: number, compte: string, extras: Record<string, unknown> = {}
) {
  return { ligne, compte, ...extras };
}

// ─────────────────────────────────────────────────────────────────────────

describe("validerConfig — une configuration vide", () => {
  it("ne déclare rien, et ne s'en plaint pas", () => {
    const { config, anomalies } = validerConfig(brute());

    expect(config.estVide).toBe(true);
    expect(config.comptes).toEqual([]);
    expect(config.types).toEqual([]);
    expect(config.categories).toEqual([]);
    expect(config.employeurs).toEqual([]);
    expect(config.compteCreditSortiesEpargne).toBeNull();
    expect(anomalies).toEqual([]);
  });

  it("des lignes entièrement vides valent une configuration vide", () => {
    const { config, anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, ""), ligneCompte(3, "   ")] })
    );

    expect(config.comptes).toEqual([]);
    expect(anomalies).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe("validerConfig — une configuration complète", () => {
  const complete = brute({
    comptes: [
      ligneCompte(2, "Compte Principal", {
        soldeDepart: 5000, organisme: "Organisme X", couleur: "#3B82F6",
      }),
      ligneCompte(3, "Part commune", {
        participation: "50 %", compteLie: "Compte Principal",
        sensRepercute: "Débit", porteUnSolde: "non",
      }),
      ligneCompte(4, "Livret", { soldeDepart: "1 200,50" }),
    ],
    types: [
      { ligne: 8, type: "Remboursement capital", nature: "epargne, pret-capital" },
      { ligne: 9, type: "Courses", classeParDefaut: "Dépense Courante" },
      { ligne: 10, type: "Retrait livret", nature: "sortie-epargne" },
    ],
    categories: [
      { ligne: 14, categorie: "Alimentation", couleur: "#22c55e" },
      { ligne: 15, categorie: "Transport" },
    ],
    employeurs: [{ ligne: 19, employeur: "Employeur A" }],
    compteCreditSortiesEpargne: { valeur: "Compte Principal", ligne: 22 },
  });

  it("se lit sans une seule anomalie", () => {
    expect(validerConfig(complete).anomalies).toEqual([]);
  });

  it("lit les comptes, leurs taux, leurs liens et leurs soldes", () => {
    const { config } = validerConfig(complete);

    expect(config.estVide).toBe(false);
    expect(config.comptes).toHaveLength(3);

    const [principal, part, livret] = config.comptes;

    expect(principal.id).toBe("compte principal");
    expect(principal.libelle).toBe("Compte Principal");
    expect(principal.organisme).toBe("Organisme X");
    expect(principal.participation).toBe(1);
    expect(principal.compteLie).toBeNull();
    expect(principal.porteUnSolde).toBe(true);
    expect(principal.couleur).toBe("#3b82f6");
    expect(principal.soldeDepart).toBe(5000);

    expect(part.participation).toBe(0.5);
    expect(part.compteLie).toBe("compte principal");
    expect(part.sensRepercute).toBe("Débit");
    expect(part.porteUnSolde).toBe(false);
    expect(part.soldeDepart).toBeNull();

    expect(livret.soldeDepart).toBe(1200.5);
  });

  it("lit les types, leurs natures multiples et leur classe par défaut", () => {
    const { config } = validerConfig(complete);

    expect(config.types).toHaveLength(3);
    expect(config.types[0].natures).toEqual(["epargne", "pret-capital"]);
    expect(config.types[0].classeParDefaut).toBeNull();
    expect(config.types[1].natures).toEqual([]);
    expect(config.types[1].classeParDefaut).toBe("Dépense Courante");
    expect(config.types[2].natures).toEqual(["sortie-epargne"]);
  });

  it("lit les catégories, les employeurs et le compte des sorties d'épargne", () => {
    const { config } = validerConfig(complete);

    expect(config.categories.map((c) => c.libelle)).toEqual(["Alimentation", "Transport"]);
    expect(config.categories[0].couleur).toBe("#22c55e");
    expect(config.categories[1].couleur).toBe(couleurStable("Transport"));
    expect(config.employeurs).toEqual(["Employeur A"]);
    expect(config.compteCreditSortiesEpargne).toBe("compte principal");
  });

  it("rapproche les libellés sans casse ni accents", () => {
    const { config, anomalies } = validerConfig(
      brute({
        comptes: [
          ligneCompte(2, "Compte Principal"),
          ligneCompte(3, "Part", {
            compteLie: "  COMPTE   principal ", sensRepercute: "débit",
          }),
        ],
      })
    );

    expect(anomalies).toEqual([]);
    expect(config.comptes[1].compteLie).toBe("compte principal");
    expect(config.comptes[1].sensRepercute).toBe("Débit");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// LES CONFIGURATIONS FAUSSES — un message distinct et nommé pour chacune
// ─────────────────────────────────────────────────────────────────────────

describe("validerConfig — six configurations fausses, six messages distincts", () => {
  const fausses: Array<{ nom: string; brute: ConfigBrute; attendu: RegExp }> = [
    {
      nom: "compte lié inconnu",
      brute: brute({
        comptes: [
          ligneCompte(2, "Part commune", {
            compteLie: "Compte Fantôme", sensRepercute: "Débit",
          }),
        ],
      }),
      attendu: /« Compte Fantôme » qui n'existe pas dans le tableau Comptes/,
    },
    {
      nom: "chaîne de comptes liés",
      brute: brute({
        comptes: [
          ligneCompte(2, "A", { compteLie: "B", sensRepercute: "Débit" }),
          ligneCompte(3, "B", { compteLie: "C", sensRepercute: "Débit" }),
          ligneCompte(4, "C"),
        ],
      }),
      attendu: /Chaîne de comptes liés : « A » → « B » → « C »/,
    },
    {
      nom: "compte lié sans sens répercuté",
      brute: brute({
        comptes: [
          ligneCompte(2, "Principal"),
          ligneCompte(3, "Part", { compteLie: "Principal" }),
        ],
      }),
      attendu: /sans dire quel sens s'y répercute/,
    },
    {
      nom: "taux de participation nu",
      brute: brute({ comptes: [ligneCompte(2, "Part", { participation: "50" })] }),
      attendu: /Taux de participation illisible.+5 000 %/s,
    },
    {
      nom: "nature inconnue",
      brute: brute({ types: [{ ligne: 8, type: "Courses", nature: "dépense" }] }),
      attendu: /Nature inconnue pour le type « Courses »/,
    },
    {
      nom: "natures qui se contredisent",
      brute: brute({
        types: [{ ligne: 8, type: "Livret", nature: "epargne, sortie-epargne" }],
      }),
      attendu: /deux natures qui se contredisent/,
    },
    {
      nom: "classe par défaut inconnue",
      brute: brute({
        types: [{ ligne: 8, type: "Courses", classeParDefaut: "Dépense Utile" }],
      }),
      attendu: /Classe inconnue pour le type « Courses »/,
    },
    {
      nom: "compte déclaré deux fois",
      brute: brute({
        comptes: [ligneCompte(2, "Principal"), ligneCompte(5, "principal")],
      }),
      attendu: /déclaré deux fois \(lignes 2 et 5\)/,
    },
  ];

  for (const cas of fausses) {
    it(`${cas.nom} — message nommé et situé`, () => {
      const { anomalies } = validerConfig(cas.brute);
      const rejets = anomalies.filter((a) => a.gravite === "rejet");

      expect(rejets.length).toBeGreaterThan(0);
      expect(rejets.some((a) => cas.attendu.test(a.message))).toBe(true);
      for (const a of rejets) {
        expect(a.feuille).toBe("Paramètres");
        expect(a.ligne).toBeGreaterThan(0);
        expect(a.colonne).toBeTruthy();
      }
    });
  }

  it("les huit cas produisent huit messages tous différents", () => {
    const messages = fausses.map(
      (c) => validerConfig(c.brute).anomalies.find((a) => a.gravite === "rejet")!.message
    );

    expect(new Set(messages).size).toBe(fausses.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe("validerConfig — le taux de participation n'est jamais deviné", () => {
  const cas: Array<[unknown, number]> = [
    ["50 %", 0.5],
    ["50%", 0.5],
    ["0,5", 0.5],
    ["0.5", 0.5],
    [0.5, 0.5],
    ["100 %", 1],
    [1, 1],
    ["33,33 %", 0.3333],
  ];

  for (const [ecrit, attendu] of cas) {
    it(`« ${String(ecrit)} » vaut ${attendu}`, () => {
      const { config, anomalies } = validerConfig(
        brute({ comptes: [ligneCompte(2, "C", { participation: ecrit })] })
      );
      expect(config.comptes[0].participation).toBeCloseTo(attendu, 6);
      expect(anomalies.filter((a) => a.gravite === "rejet")).toEqual([]);
    });
  }

  it("absent vaut 100 %, sans rien dire", () => {
    const { config, anomalies } = validerConfig(brute({ comptes: [ligneCompte(2, "C")] }));
    expect(config.comptes[0].participation).toBe(1);
    expect(anomalies).toEqual([]);
  });

  it("un taux supérieur à 100 % est refusé", () => {
    const { config, anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, "C", { participation: "150 %" })] })
    );
    expect(config.comptes[0].participation).toBe(1);
    expect(anomalies[0].gravite).toBe("rejet");
  });

  it("un taux négatif est refusé", () => {
    const { anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, "C", { participation: -0.5 })] })
    );
    expect(anomalies[0].gravite).toBe("rejet");
  });

  it("un taux de 0 % est accepté, mais l'outil dit ce qu'il produit", () => {
    const { config, anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, "C", { participation: "0 %" })] })
    );
    expect(config.comptes[0].participation).toBe(0);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].gravite).toBe("avertissement");
    expect(anomalies[0].message).toMatch(/deviendront 0/);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe("validerConfig — le compte lié", () => {
  it("un compte lié à lui-même est refusé", () => {
    const { config, anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, "A", { compteLie: "A", sensRepercute: "Débit" })] })
    );
    expect(config.comptes[0].compteLie).toBeNull();
    expect(anomalies[0].message).toMatch(/se déclare lié à lui-même/);
  });

  it("un lien refusé efface aussi le sens : rien ne laisse croire qu'il agit", () => {
    const { config } = validerConfig(
      brute({
        comptes: [ligneCompte(2, "A", { compteLie: "Inconnu", sensRepercute: "Crédit" })],
      })
    );
    expect(config.comptes[0].compteLie).toBeNull();
    expect(config.comptes[0].sensRepercute).toBeNull();
  });

  it("un sens sans compte lié est signalé et effacé", () => {
    const { config, anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, "A", { sensRepercute: "Crédit" })] })
    );
    expect(config.comptes[0].sensRepercute).toBeNull();
    expect(anomalies[0].gravite).toBe("avertissement");
    expect(anomalies[0].message).toMatch(/aucun compte lié/);
  });

  it("un sens illisible est refusé, jamais remplacé par « Les deux »", () => {
    const { config, anomalies } = validerConfig(
      brute({
        comptes: [
          ligneCompte(2, "Principal"),
          ligneCompte(3, "Part", { compteLie: "Principal", sensRepercute: "les 2" }),
        ],
      })
    );
    expect(config.comptes[1].sensRepercute).toBeNull();
    expect(config.comptes[1].compteLie).toBeNull();
    expect(anomalies.some((a) => /Sens répercuté illisible/.test(a.message))).toBe(true);
  });

  it("« Les deux » est une valeur qu'on peut écrire, jamais une valeur par défaut", () => {
    const { config, anomalies } = validerConfig(
      brute({
        comptes: [
          ligneCompte(2, "Principal"),
          ligneCompte(3, "Part", { compteLie: "Principal", sensRepercute: "Les deux" }),
        ],
      })
    );
    expect(config.comptes[1].sensRepercute).toBe("Les deux");
    expect(anomalies).toEqual([]);
  });

  it("la chaîne nomme les trois comptes et dit quoi écrire", () => {
    const { config, anomalies } = validerConfig(
      brute({
        comptes: [
          ligneCompte(2, "A", { compteLie: "B", sensRepercute: "Débit" }),
          ligneCompte(3, "B", { compteLie: "C", sensRepercute: "Débit" }),
          ligneCompte(4, "C"),
        ],
      })
    );
    const m = anomalies.find((a) => /Chaîne/.test(a.message))!.message;
    expect(m).toMatch(/« A »/);
    expect(m).toMatch(/« B »/);
    expect(m).toMatch(/« C »/);
    expect(config.comptes[0].compteLie).toBeNull();
    expect(config.comptes[1].compteLie).toBe("c");
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe("validerConfig — un solde absent n'est jamais 0", () => {
  it("solde absent : « non initialisé », sans anomalie", () => {
    const { config, anomalies } = validerConfig(brute({ comptes: [ligneCompte(2, "C")] }));
    expect(config.comptes[0].soldeDepart).toBeNull();
    expect(anomalies).toEqual([]);
  });

  it("solde illisible : « non initialisé », et l'outil le dit", () => {
    const { config, anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, "C", { soldeDepart: "environ 500" })] })
    );
    expect(config.comptes[0].soldeDepart).toBeNull();
    expect(anomalies[0].gravite).toBe("avertissement");
    expect(anomalies[0].message).toMatch(/jamais 0/);
  });

  it("un solde à zéro écrit dans le fichier reste zéro", () => {
    const { config, anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, "C", { soldeDepart: 0 })] })
    );
    expect(config.comptes[0].soldeDepart).toBe(0);
    expect(anomalies).toEqual([]);
  });

  it("un solde négatif est une valeur légitime — un découvert", () => {
    const { config } = validerConfig(
      brute({ comptes: [ligneCompte(2, "C", { soldeDepart: "-320,15" })] })
    );
    expect(config.comptes[0].soldeDepart).toBe(-320.15);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe("validerConfig — couleurs et solde propre", () => {
  it("une couleur absente vient de la palette automatique", () => {
    const { config, anomalies } = validerConfig(brute({ comptes: [ligneCompte(2, "C")] }));
    expect(config.comptes[0].couleur).toBe(couleurStable("C"));
    expect(anomalies).toEqual([]);
  });

  it("une couleur illisible est signalée, et remplacée par la palette", () => {
    const { config, anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, "C", { couleur: "bleu" })] })
    );
    expect(config.comptes[0].couleur).toBe(couleurStable("C"));
    expect(anomalies[0].gravite).toBe("avertissement");
    expect(anomalies[0].colonne).toBe("Couleur");
  });

  it("« Porte un solde » absent vaut oui", () => {
    const { config } = validerConfig(brute({ comptes: [ligneCompte(2, "C")] }));
    expect(config.comptes[0].porteUnSolde).toBe(true);
  });

  it("« Porte un solde » illisible est refusé, et le compte porte un solde", () => {
    const { config, anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, "C", { porteUnSolde: "peut-être" })] })
    );
    expect(config.comptes[0].porteUnSolde).toBe(true);
    expect(anomalies[0].gravite).toBe("rejet");
    expect(anomalies[0].colonne).toBe("Porte un solde");
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe("validerConfig — les natures", () => {
  it("un type peut en porter plusieurs : c'est une nécessité, pas un confort", () => {
    const { config, anomalies } = validerConfig(
      brute({
        types: [
          { ligne: 8, type: "Versement livret", nature: "transfert-interne, epargne" },
        ],
      })
    );
    expect(config.types[0].natures).toEqual(["transfert-interne", "epargne"]);
    expect(anomalies).toEqual([]);
  });

  const incompatibles: Array<[string, string]> = [
    ["epargne, sortie-epargne", "epargne"],
    ["apport-exterieur, transfert-interne", "apport-exterieur"],
    ["pret-capital, pret-interets", "pret-capital"],
  ];

  for (const [ecrit, premiere] of incompatibles) {
    it(`« ${ecrit} » est refusé, et les deux natures sont écartées`, () => {
      const { config, anomalies } = validerConfig(
        brute({ types: [{ ligne: 8, type: "T", nature: ecrit }] })
      );
      expect(config.types[0].natures).toEqual([]);
      expect(anomalies[0].gravite).toBe("rejet");
      expect(anomalies[0].message).toContain(premiere);
    });
  }

  it("une nature inconnue laisse les autres en place", () => {
    const { config, anomalies } = validerConfig(
      brute({ types: [{ ligne: 8, type: "T", nature: "epargne, marmelade" }] })
    );
    expect(config.types[0].natures).toEqual(["epargne"]);
    expect(anomalies[0].message).toMatch(/Natures acceptées/);
  });

  it("une nature répétée est sans effet, et le dit", () => {
    const { config, anomalies } = validerConfig(
      brute({ types: [{ ligne: 8, type: "T", nature: "epargne, epargne" }] })
    );
    expect(config.types[0].natures).toEqual(["epargne"]);
    expect(anomalies[0].gravite).toBe("avertissement");
  });

  it("une nature vide est un mouvement ordinaire, pas une erreur", () => {
    const { config, anomalies } = validerConfig(
      brute({ types: [{ ligne: 8, type: "Courses", nature: "" }] })
    );
    expect(config.types[0].natures).toEqual([]);
    expect(anomalies).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe("validerConfig — doublons et compte des sorties d'épargne", () => {
  it("un compte en double écarte les DEUX lignes", () => {
    const { config } = validerConfig(
      brute({
        comptes: [
          ligneCompte(2, "Principal", { soldeDepart: 100 }),
          ligneCompte(5, "PRINCIPAL", { soldeDepart: 900 }),
        ],
      })
    );
    expect(config.comptes).toEqual([]);
  });

  it("un type en double écarte les DEUX lignes", () => {
    const { config, anomalies } = validerConfig(
      brute({
        types: [
          { ligne: 8, type: "Courses", nature: "epargne" },
          { ligne: 9, type: "courses" },
        ],
      })
    );
    expect(config.types).toEqual([]);
    expect(anomalies[0].message).toMatch(/déclaré deux fois/);
  });

  it("une catégorie en double écarte les DEUX lignes", () => {
    const { config, anomalies } = validerConfig(
      brute({
        categories: [
          { ligne: 14, categorie: "Alimentation" },
          { ligne: 16, categorie: "alimentation" },
        ],
      })
    );
    expect(config.categories).toEqual([]);
    expect(anomalies[0].gravite).toBe("rejet");
  });

  it("un employeur en double est simplement signalé, une seule fois retenu", () => {
    const { config, anomalies } = validerConfig(
      brute({
        employeurs: [
          { ligne: 19, employeur: "Employeur A" },
          { ligne: 20, employeur: "employeur a" },
        ],
      })
    );
    expect(config.employeurs).toEqual(["Employeur A"]);
    expect(anomalies[0].gravite).toBe("avertissement");
  });

  it("un compte des sorties d'épargne inconnu est refusé et nommé", () => {
    const { config, anomalies } = validerConfig(
      brute({
        comptes: [ligneCompte(2, "Principal")],
        compteCreditSortiesEpargne: { valeur: "Livret Fantôme", ligne: 22 },
      })
    );
    expect(config.compteCreditSortiesEpargne).toBeNull();
    expect(anomalies[0].gravite).toBe("rejet");
    expect(anomalies[0].message).toMatch(/Livret Fantôme/);
    expect(anomalies[0].message).toMatch(/l'écran le dira/);
  });

  it("un compte des sorties d'épargne absent n'est pas une erreur", () => {
    const { config, anomalies } = validerConfig(
      brute({ comptes: [ligneCompte(2, "Principal")] })
    );
    expect(config.compteCreditSortiesEpargne).toBeNull();
    expect(anomalies).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe("validerConfig — toute anomalie est situable", () => {
  it("chaque anomalie porte sa feuille, sa ligne et sa colonne", () => {
    const { anomalies } = validerConfig(
      brute({
        feuille: "Reglages",
        comptes: [
          ligneCompte(2, "A", { participation: "50", couleur: "bleu", soldeDepart: "?" }),
          ligneCompte(3, "B", { compteLie: "Inconnu", sensRepercute: "Débit" }),
        ],
        types: [{ ligne: 8, type: "T", nature: "marmelade", classeParDefaut: "Dépense Utile" }],
        compteCreditSortiesEpargne: { valeur: "Fantôme", ligne: 22 },
      })
    );

    expect(anomalies.length).toBeGreaterThanOrEqual(6);
    for (const a of anomalies) {
      expect(a.feuille).toBe("Reglages");
      expect(a.ligne).toBeGreaterThan(0);
      expect(a.colonne).toBeTruthy();
      expect(a.message.length).toBeGreaterThan(20);
    }
  });
});
