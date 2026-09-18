#!/usr/bin/env node
// ── Contrôle du vocabulaire — décision D5 du lot C ───────────────────────
//
// Le critère de sortie du lot C, écrit au plan V3 : « `grep` dans `src/` ne
// doit plus remonter aucun nom de compte ni de type ». Ce script en est la
// mise en œuvre, sur le modèle de `verifier-publication.mjs`.
//
// CE QU'IL CHERCHE : les libellés que le JEU DE DÉMONSTRATION déclare —
// comptes et types — dans les fichiers de `src/`. Il ne les recopie pas : il
// les LIT dans `public/data/config.json`. Une liste recopiée ici aurait dérivé
// du générateur au premier changement, et le contrôle aurait fini par vérifier
// un vocabulaire que plus personne n'emploie.
//
// LES DEUX EXEMPTIONS, nommées par la décision D5 :
//
//   1. `src/__tests__/**` — un test doit nommer un compte pour vérifier un
//      calcul. 213 occurrences dans 25 fichiers au moment de la décision.
//   2. `src/services/modeleExcel.ts` — c'est le classeur modèle : ce sont des
//      DONNÉES d'exemple, pas des règles. 23 lignes citant un compte, 8 citant
//      un type.
//
// CE QUI N'EST PAS UNE VIOLATION :
//
//   1. Les trois classes de dépense (`Dépense Fixe`, `Dépense Courante`,
//      `Dépense Occasionnelle`). Le plan V3 a tranché — la LISTE des trois
//      reste fixe, seule l'AFFECTATION type → classe devient paramétrable.
//      Elles ne sont donc pas cherchées.
//
//   2. Les lignes ENTIÈREMENT en commentaire. Un commentaire ne décide de
//      rien, et le lot C demande explicitement de DOCUMENTER les règles
//      retirées — on ne peut pas dire quelle règle a disparu sans la nommer.
//
//      ⚠️ Un commentaire de FIN DE LIGNE ne protège pas : la ligne est
//      examinée normalement. Sans quoi il suffirait d'un `// …` en bout de
//      ligne pour faire passer du code.
//
//      Le garde-fou contre les VRAIS noms, lui, continue de lire les
//      commentaires : c'est `verifier-publication.mjs` et sa liste noire, et
//      c'est par un commentaire qu'un vrai nom de banque est entré au lot B.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(RACINE, "src");

/** Les fichiers et dossiers exemptés, nommés par D5. */
const EXEMPTIONS = [
  {
    chemin: join("src", "__tests__"),
    raison: "un test doit nommer un compte pour vérifier un calcul",
  },
  {
    chemin: join("src", "services", "modeleExcel.ts"),
    raison: "classeur modèle — ce sont des données d'exemple, pas des règles",
  },
];

function estExempte(chemin) {
  const rel = relative(RACINE, chemin);
  return EXEMPTIONS.find((e) => rel === e.chemin || rel.startsWith(e.chemin + sep));
}

function fichiers(dossier) {
  const out = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      out.push(...fichiers(chemin));
    } else if (/\.(ts|tsx)$/.test(nom)) {
      out.push(chemin);
    }
  }
  return out;
}

// ── Le vocabulaire à traquer, lu dans le jeu publié ─────────────────────

const config = JSON.parse(
  readFileSync(join(RACINE, "public", "data", "config.json"), "utf8")
);
const parametrage = config.parametrage;

if (!parametrage || parametrage.estVide) {
  console.error(
    "✗ `public/data/config.json` ne déclare aucune configuration.\n" +
    "  Ce contrôle ne saurait pas quoi chercher. Lancez `npm run donnees`."
  );
  process.exit(1);
}

const libelles = [
  ...parametrage.comptes.map((c) => c.libelle),
  ...parametrage.types.map((t) => t.libelle),
  // Les organismes portent les mêmes noms que les banques : un libellé de
  // compte amputé de son usage reste un nom de la démonstration.
  ...new Set(parametrage.comptes.map((c) => c.organisme).filter(Boolean)),
];

// Du plus long au plus court : « Banque A - Courant » doit être signalé comme
// tel, pas comme une occurrence de « Banque A ».
libelles.sort((a, b) => b.length - a.length);

// ── La recherche ────────────────────────────────────────────────────────

const violations = [];
let examines = 0;
const exemptes = new Set();

for (const chemin of fichiers(SRC)) {
  const exemption = estExempte(chemin);
  if (exemption) {
    exemptes.add(exemption);
    continue;
  }
  examines++;

  const lignes = readFileSync(chemin, "utf8").split("\n");
  let dansBloc = false;
  for (const [i, ligne] of lignes.entries()) {
    const nu = ligne.trim();

    // Une ligne entièrement en commentaire — `//`, ou l'intérieur d'un bloc
    // `/* … */` — ne porte aucune règle.
    // `{/* … */}` est la forme JSX du commentaire de bloc.
    const ouvreBloc = nu.startsWith("/*") || nu.startsWith("{/*");
    const fermeBloc = nu.includes("*/");
    const estCommentaire =
      dansBloc || nu.startsWith("//") || ouvreBloc || nu.startsWith("*");
    if (ouvreBloc && !fermeBloc) dansBloc = true;
    else if (dansBloc && fermeBloc) dansBloc = false;
    if (estCommentaire) continue;

    for (const libelle of libelles) {
      if (!ligne.includes(libelle)) continue;
      violations.push({
        fichier: relative(RACINE, chemin),
        ligne: i + 1,
        libelle,
        extrait: ligne.trim().slice(0, 100),
      });
      break; // un signalement par ligne suffit à la faire corriger
    }
  }
}

// ── Le rapport ──────────────────────────────────────────────────────────

console.log(`  vocabulaire cherché : ${libelles.length} libellés du jeu de démonstration`);
console.log(`  fichiers examinés   : ${examines}`);
for (const e of exemptes) {
  console.log(`  exempté : ${e.chemin} — ${e.raison}`);
}

if (violations.length === 0) {
  console.log("\n✓ Aucun nom de compte ni de type de la démonstration dans `src/`.");
  process.exit(0);
}

console.error(`\n✗ ${violations.length} occurrence(s) du vocabulaire de la démonstration dans \`src/\` :\n`);
for (const v of violations) {
  console.error(`  ${v.fichier}:${v.ligne} — « ${v.libelle} »`);
  console.error(`      ${v.extrait}`);
}
console.error(
  "\n  Ces libellés doivent venir de la configuration déclarée par la source,\n" +
  "  pas du code. Voir `docs/CONTRAT_PARAMETRAGE.md`, §5."
);
process.exit(1);
