// ═══════════════════════════════════════════════════════════════════════
// Le garde-fou du classeur modèle — lot F.4
// ═══════════════════════════════════════════════════════════════════════
//
// Un `.xlsx` est un binaire : la liste noire ne sait pas le lire. Le contrôle
// de publication refuse donc toute l'extension — sauf UN fichier, nommé :
// `public/modele/Budget_modele.xlsx` (décision F4). Cette exemption n'est
// sûre que si ce fichier est EXACTEMENT celui que le script sait refaire.
//
// Ce contrôle relance `scripts/generer-modele.mjs` dans un dossier temporaire
// et compare le résultat au fichier publié, ENTRÉE PAR ENTRÉE, contenu
// décompressé. Pas octet pour octet : un zip porte l'heure de chacune de ses
// entrées, et deux fabrications identiques ne donnent jamais le même zip
// (mesuré au F.0). Le contenu, lui, est identique — les dates du document
// sont figées par le script.
//
// Un modèle retouché d'une seule cellule est bloqué : il n'est plus ce que le
// script produit. Un vrai classeur déposé sous ce nom aussi.
//
// Lot F.5 : le modèle est publié, et le bouton de téléchargement le sert tel
// quel. Son ABSENCE est donc une erreur (`EXIGE`). Au F.4, elle était tolérée.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { inflateRawSync } from "node:zlib";

const EXIGE = true;

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..");
const MODELE_PUBLIE = "public/modele/Budget_modele.xlsx";
const PUBLIE = join(RACINE, MODELE_PUBLIE);
const GENERATEUR = join(ICI, "generer-modele.mjs");

function echouer(message) {
  console.error(`\n✗ Modèle : ${message}\n`);
  process.exit(1);
}

/**
 * Les entrées d'un zip, décompressées. Lecteur minimal — répertoire central,
 * méthodes « stocké » et « deflate » — pour ne dépendre d'aucune bibliothèque
 * qui pourrait elle-même changer ce qu'elle lit.
 */
function entreesZip(octets) {
  let fin = -1;
  for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65557); i--) {
    if (octets.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error("ce n'est pas un fichier zip (pas de répertoire central)");
  const nombre = octets.readUInt16LE(fin + 10);
  let p = octets.readUInt32LE(fin + 16);
  const entrees = new Map();
  for (let k = 0; k < nombre; k++) {
    if (octets.readUInt32LE(p) !== 0x02014b50) throw new Error("répertoire central illisible");
    const methode = octets.readUInt16LE(p + 10);
    const taille = octets.readUInt32LE(p + 20);
    const lnom = octets.readUInt16LE(p + 28);
    const lextra = octets.readUInt16LE(p + 30);
    const lcomm = octets.readUInt16LE(p + 32);
    const local = octets.readUInt32LE(p + 42);
    const nom = octets.subarray(p + 46, p + 46 + lnom).toString("utf8");
    const debut = local + 30 + octets.readUInt16LE(local + 26) + octets.readUInt16LE(local + 28);
    const brut = octets.subarray(debut, debut + taille);
    if (methode !== 0 && methode !== 8) throw new Error(`${nom} : compression ${methode} inconnue`);
    entrees.set(nom, methode === 0 ? Buffer.from(brut) : inflateRawSync(brut));
    p += 46 + lnom + lextra + lcomm;
  }
  return entrees;
}

// 1. Le modèle publié existe-t-il ?
if (!existsSync(PUBLIE)) {
  if (EXIGE) echouer(`${MODELE_PUBLIE} est absent. Le bouton de téléchargement n'aurait rien à servir.`);
  console.log(`○ Modèle : ${MODELE_PUBLIE} n'est pas encore publié — rien à comparer (lot F.4).`);
  process.exit(0);
}

// 2. Le refaire, dans un dossier temporaire — jamais dans public/.
const temp = mkdtempSync(join(tmpdir(), "modele-"));
try {
  const refait = join(temp, "Budget_modele.xlsx");
  const r = spawnSync(process.execPath, [GENERATEUR, refait], { encoding: "utf8" });
  if (r.status !== 0) echouer(`le script de fabrication a échoué (code ${r.status}).\n${r.stderr ?? ""}`);

  // 3. Comparer, entrée par entrée.
  let publie, attendu;
  try {
    publie = entreesZip(readFileSync(PUBLIE));
  } catch (e) {
    echouer(`${MODELE_PUBLIE} n'est pas un classeur lisible : ${e.message}.`);
  }
  attendu = entreesZip(readFileSync(refait));

  const noms = (m) => [...m.keys()].sort();
  const enTrop = noms(publie).filter((n) => !attendu.has(n));
  const manquants = noms(attendu).filter((n) => !publie.has(n));
  if (enTrop.length || manquants.length) {
    echouer(
      `le fichier publié n'a pas la structure que le script produit.` +
        (enTrop.length ? `\n  en trop : ${enTrop.join(", ")}` : "") +
        (manquants.length ? `\n  manquant : ${manquants.join(", ")}` : "")
    );
  }
  for (const nom of noms(attendu)) {
    const a = attendu.get(nom);
    const b = publie.get(nom);
    if (a.equals(b)) continue;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    // Aucun extrait du fichier publié n'est recopié : si c'est un vrai
    // classeur, le rapport le publierait une seconde fois (même règle que
    // `masquer` dans verifier-publication.mjs).
    echouer(
      `${nom} ne correspond pas à ce que le script produit (${b.length} o publiés, ` +
        `${a.length} o refaits ; premier écart à l'octet ${i}).\n` +
        `Un modèle retouché à la main, ou un vrai classeur, ne se publie pas. ` +
        `Refaire le fichier : node scripts/generer-modele.mjs ${MODELE_PUBLIE}`
    );
  }
  console.log(
    `✓ Modèle : ${MODELE_PUBLIE} est refait à l'identique par le script ` +
      `(${attendu.size} entrées, contenu décompressé).`
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
