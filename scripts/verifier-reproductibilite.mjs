// ═══════════════════════════════════════════════════════════════════════
// Le garde-fou de reproductibilité — lot E.3
// ═══════════════════════════════════════════════════════════════════════
//
// Relance le générateur de démonstration dans un dossier TEMPORAIRE et compare
// son résultat, OCTET POUR OCTET, aux fichiers publiés dans `public/data/`. Un
// fichier que le générateur ne sait pas refaire à l'identique est bloqué —
// quels que soient les noms qu'il porte.
//
// C'est le complément de la liste noire (décision E7). Une liste de noms ne
// voit que les noms qu'on lui a donnés : un vrai export de données aux noms
// génériques passerait le contrôle de noms. Ici, un vrai export n'est pas ce que
// le générateur produit : il ne concorde pas, donc il est refusé.
//
// Le garde-fou DOIT savoir échouer : c'est prouvé en déposant dans public/data/
// un fichier qui n'est pas celui du générateur — il est alors bloqué.

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..");
const PUBLIC_DATA = join(RACINE, "public", "data");
const GENERATEUR = join(ICI, "generate-demo-data.mjs");

function echouer(message) {
  console.error(`\n✗ Reproductibilité : ${message}\n`);
  process.exit(1);
}

const lireJSON = (dossier) =>
  readdirSync(dossier)
    .filter((n) => n.endsWith(".json"))
    .sort();

// 1. Régénérer dans un dossier temporaire — jamais public/data/.
const temp = mkdtempSync(join(tmpdir(), "repro-demo-"));
try {
  const r = spawnSync(process.execPath, [GENERATEUR], {
    env: { ...process.env, SORTIE_DEMO: temp },
    encoding: "utf8",
  });
  if (r.status !== 0) {
    echouer(`le générateur a échoué (code ${r.status}).\n${r.stderr ?? ""}`);
  }

  // 2. Le générateur doit produire exactement le même ensemble de fichiers.
  const publies = lireJSON(PUBLIC_DATA);
  const regeneres = lireJSON(temp);

  const manquants = publies.filter((n) => !regeneres.includes(n));
  if (manquants.length) {
    echouer(
      `le générateur ne produit pas ${manquants.join(", ")}. Un fichier publié ` +
        `qu'il ne sait pas refaire n'est pas une démonstration.`
    );
  }
  const enTrop = regeneres.filter((n) => !publies.includes(n));
  if (enTrop.length) {
    echouer(`le générateur produit des fichiers absents de public/data/ : ${enTrop.join(", ")}.`);
  }

  // 3. Octet pour octet.
  for (const nom of publies) {
    const publie = readFileSync(join(PUBLIC_DATA, nom));
    const regenere = readFileSync(join(temp, nom));
    if (!publie.equals(regenere)) {
      echouer(
        `public/data/${nom} ne correspond pas à ce que le générateur produit ` +
          `(${publie.length} o publiés, ${regenere.length} o régénérés). Soit le ` +
          `générateur a changé, soit ce fichier ne vient pas de lui — dans les deux ` +
          `cas il ne peut pas être publié tel quel.`
      );
    }
  }

  console.log(
    `✓ Reproductibilité : les ${publies.length} fichiers de public/data/ sont ` +
      `refaits à l'octet par le générateur.`
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
