#!/usr/bin/env node
/**
 * Contrôle de publication — BLOQUANT.
 *
 *   node scripts/verifier-publication.mjs
 *
 * Sort en code 1 dès qu'un contrôle échoue. Lancé par `npm run check` et par
 * la CI, avant tout commit et avant tout déploiement.
 *
 * Quatre contrôles, dans cet ordre :
 *
 *   1. LISTE NOIRE   aucun nom réel — établissement, employeur, marchand,
 *                    commune, personne — ni dans la source, ni dans le build.
 *   2. LISTE BLANCHE tout fichier du build doit appartenir à une famille
 *                    attendue. Un fichier inattendu dans `dist/` est un
 *                    fichier publié sans qu'on l'ait décidé.
 *   3. EXTENSIONS    aucun secret ni donnée brute dans la source
 *                    (.env, .sql, .xlsx, .pem, .key…).
 *   4. GITLEAKS      si l'outil est présent. Exigé quand GITLEAKS_REQUIS=1
 *                    (c'est le cas en CI).
 *
 * POURQUOI UNE LISTE NOIRE ET UNE LISTE BLANCHE. La liste noire attrape ce
 * qu'on sait nommer ; elle ne verra jamais un nom auquel personne n'a pensé.
 * La liste blanche attrape l'inverse : un fichier qui n'aurait rien à faire
 * là, quel que soit son contenu. Les deux ensemble, parce qu'aucune des deux
 * ne suffit.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, extname, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

// ═══════════════════════════════════════════════════════════════════════
// LISTE NOIRE
// ═══════════════════════════════════════════════════════════════════════
//
// Recherche insensible à la casse. Voir plan/LISTE_NOIRE.txt (hors dépôt)
// pour l'inventaire complet et la table de renommage.

// Des expressions et non de simples chaînes : « vdp » en sous-chaîne se
// trouve dans n'importe quel condensé base64 de package-lock.json. Les
// bornes de mot évitent ce bruit sans rien relâcher.
const INTERDITS = [
  // Établissements et services financiers
  /cr[ée]dit\s+agricole/i,
  /caisse\s+d[\u2019']?\s?[ée]pargne/i,
  /\bboursobank\b/i, /\bboursorama\b/i, /\bedenred\b/i,
  /\btricount\b/i, /\blydia\b/i,
  // Employeurs
  /\bscalian\b/i, /\baltran\b/i, /\bbonduelle\b/i,
  /\bplantex\b/i, /\bnsf\s+france\b/i,
  // Marchands
  /\bmonoprix\b/i, /\bnetflix\b/i, /\bratp\b/i, /\bnavigo\b/i,
  // Lieux
  /\bjoinville\b/i,
  // Personnes et identifiants personnels
  /\bvalentin\b/i, /\bduchamp\b/i, /\bvdp\b/i,
  // Infrastructure privée. Les hôtes *.pages.dev et *.workers.dev sont
  // traités à part, plus bas : la démonstration est elle-même hébergée sur
  // pages.dev, une interdiction sèche bloquerait son propre lien.
  // Nom de variable d'infrastructure SUIVI d'une valeur. Le nom seul peut
  // apparaître dans une explication — c'est le cas dans le README, qui s'en
  // sert comme exemple. C'est le nom ACCOLÉ À UNE VALEUR qui est une fuite.
  /\b(d1_database|account_id|api_token|proxy_token)\b\s*[:=]\s*["'`]?[A-Za-z0-9._\-/+]{12,}/i,
  // Un vrai jeton, pas le mot « Bearer » dans une phrase
  /bearer\s+[A-Za-z0-9._-]{12,}/i,
  // Secret nommé EN FRANÇAIS suivi d'une longue chaîne opaque.
  //
  // Mesuré, pas supposé : gitleaks reconnaît les secrets par mots-clés
  // ANGLAIS. `API_TOKEN = "v1.0-9f3a…"` est détecté ; la MÊME valeur sous le
  // nom `JETON` passe sans un mot. Un projet écrit en français a donc un
  // angle mort que l'outil ne couvre pas — celle-ci le comble.
  /\b(jeton|cl[ée]s?[\s_-]?(api|priv[ée]e?)|mot[\s_-]?de[\s_-]?passe|secret|identifiant)\b[^\n"'`]{0,40}["'`][A-Za-z0-9._\-/+]{24,}["'`]/i,
];

/**
 * Fichiers qui PORTENT la liste noire par construction, et sont donc les
 * seuls exemptés. Figée : un fichier qui rejoindrait cette liste sans être
 * déclaré ici ferait échouer le contrôle.
 */
const PORTEURS_DE_LA_LISTE = new Map([
  [
    "scripts/verifier-publication.mjs",
    "le contrôle lui-même — il doit bien écrire les mots qu'il cherche",
  ],
  [
    "src/__tests__/config/couleurs.test.ts",
    "vérifie qu'aucun nom réel ne revient dans accounts.ts",
  ],
  [
    "src/__tests__/data/donneesDemo.test.ts",
    "vérifie qu'aucun nom réel n'entre dans les fichiers de données publiés",
  ],
]);

// ═══════════════════════════════════════════════════════════════════════
// HÔTES D'HÉBERGEMENT
// ═══════════════════════════════════════════════════════════════════════
//
// Une adresse en *.pages.dev ou *.workers.dev désigne une infrastructure
// Cloudflare. Celle de la démonstration est publique et doit pouvoir être
// citée — c'est son propre lien. Toute AUTRE désigne une infrastructure qui
// n'a rien à faire ici, à commencer par la production privée.
//
// D'où une liste d'hôtes autorisés plutôt qu'une interdiction sèche : le
// contrôle reste strict, il cesse seulement d'être aveugle.

const HOTE_CLOUDFLARE = /\b[a-z0-9][a-z0-9-]*\.(pages|workers)\.dev\b/gi;

const HOTES_AUTORISES = new Set([
  "dashboard-budget-demo.pages.dev",
]);

function chercherHotes(base, fichiers, etiquette, exempter = () => false) {
  for (const f of fichiers) {
    if (exempter(f)) continue;
    const texte = lireTexte(join(base, f));
    if (texte === null) continue;
    for (const trouve of texte.matchAll(HOTE_CLOUDFLARE)) {
      const hote = trouve[0].toLowerCase();
      if (HOTES_AUTORISES.has(hote)) continue;
      const ligne = texte.slice(0, trouve.index).split("\n").length;
      echecs.push(
        `[hôte] ${etiquette} ${f}:${ligne} cite « ${hote} », qui n'est pas ` +
          `l'hébergement de cette démonstration.`
      );
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LISTE BLANCHE DU BUILD
// ═══════════════════════════════════════════════════════════════════════

const BUILD_AUTORISE = [
  { motif: /^index\.html$/, quoi: "page d'entrée" },
  { motif: /^favicon\.svg$/, quoi: "favicon" },
  { motif: /^manifest\.webmanifest$/, quoi: "manifeste PWA" },
  { motif: /^sw\.js$/, quoi: "service worker" },
  { motif: /^_redirects$/, quoi: "repli SPA de l'hébergeur" },
  { motif: /^_headers$/, quoi: "en-têtes de sécurité de l'hébergeur (produits par le build)" },
  { motif: /^icons\/icon-(192|512)\.svg$/, quoi: "icônes PWA" },
  { motif: /^assets\/[\w.-]+\.(js|css)$/, quoi: "bundle Vite" },
  { motif: /^assets\/[\w.-]+\.woff2$/, quoi: "police embarquée" },
  {
    motif: /^data\/(transactions|salary|config|budgets|references)\.json$/,
    quoi: "données de démonstration",
  },
];

// ═══════════════════════════════════════════════════════════════════════
// EXTENSIONS INTERDITES DANS LA SOURCE
// ═══════════════════════════════════════════════════════════════════════

const EXTENSIONS_INTERDITES = new Set([
  ".env", ".sql", ".xlsx", ".xls", ".xlsm", ".csv", ".pem", ".key",
  ".p12", ".pfx", ".crt", ".sqlite", ".db", ".bak", ".map",
]);

/**
 * Marqueurs qui ne doivent pas survivre à la publication. Un fichier de
 * licence dont le titulaire est resté un gabarit n'est pas une licence.
 */
const MARQUEURS_A_COMPLETER = [/__TITULAIRE_A_COMPLETER__/, /\[À COMPLÉTER\]/i];

const NOMS_INTERDITS = new Set([
  ".env", ".env.local", ".env.production", ".dev.vars", "wrangler.toml",
  "lighthouse-report.html",
]);

// ═══════════════════════════════════════════════════════════════════════
// PARCOURS
// ═══════════════════════════════════════════════════════════════════════

const IGNORES = new Set([
  "node_modules", "dist", "plan", ".git", ".wrangler", "coverage",
]);

/**
 * Fichiers exclus du contrôle de la source parce qu'ils ne sont jamais
 * versionnés — ce sont les mêmes motifs que `.gitignore`. Vite laisse par
 * exemple traîner des `vite.config.ts.timestamp-*.mjs` après un build
 * interrompu : ils portent l'ancien nom du projet, mais ne partent nulle
 * part.
 */
const NON_VERSIONNES = [
  /\.timestamp-.*\.mjs$/,
  /^tsconfig\.tsbuildinfo$/,
  /^\.DS_Store$/,
];

const estVersionne = (f) => !NON_VERSIONNES.some((r) => r.test(f));

function parcourir(base, dossier = base, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    if (IGNORES.has(nom)) continue;
    const complet = join(dossier, nom);
    if (statSync(complet).isDirectory()) parcourir(base, complet, sortie);
    else sortie.push(relative(base, complet).split(sep).join("/"));
  }
  return sortie;
}

/** Les fichiers binaires ne sont pas lus comme du texte. */
const BINAIRE = new Set([".woff2", ".woff", ".ttf", ".png", ".jpg", ".ico", ".gz", ".tgz"]);

function lireTexte(chemin) {
  if (BINAIRE.has(extname(chemin))) return null;
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CONTRÔLES
// ═══════════════════════════════════════════════════════════════════════

const echecs = [];
const notes = [];

/**
 * Un rapport d'erreur qui recopie le secret trouvé le publie une seconde
 * fois — dans un journal de CI, lisible par tous sur un dépôt public. Au-delà
 * de 30 caractères, la trouvaille est tronquée : assez pour savoir quoi
 * corriger, pas assez pour être réutilisée.
 */
function masquer(extrait) {
  return extrait.length <= 30 ? extrait : `${extrait.slice(0, 22)}… (tronqué)`;
}

function chercherInterdits(base, fichiers, etiquette, exempter = () => false) {
  for (const f of fichiers) {
    if (exempter(f)) continue;
    const texte = lireTexte(join(base, f));
    if (texte === null) continue;
    for (const motif of INTERDITS) {
      const trouve = motif.exec(texte);
      if (!trouve) continue;
      const ligne = texte.slice(0, trouve.index).split("\n").length;
      echecs.push(
        `[liste noire] ${etiquette} ${f}:${ligne} contient « ${masquer(trouve[0])} »`
      );
      break; // une occurrence suffit à bloquer ; inutile d'inonder le rapport
    }
  }
}

// ── 1. Liste noire — source ────────────────────────────────────────────
const fichiersSource = parcourir(RACINE).filter(estVersionne);

// Le jeu d'exemptions doit être exactement celui déclaré, ni plus ni moins.
for (const [f, raison] of PORTEURS_DE_LA_LISTE) {
  if (!fichiersSource.includes(f)) {
    echecs.push(
      `[exemption] ${f} est déclaré porteur de la liste noire mais n'existe plus. ` +
        `Retirer l'exemption plutôt que la laisser ouverte.`
    );
  } else {
    notes.push(`exempté : ${f} — ${raison}`);
  }
}

chercherInterdits(RACINE, fichiersSource, "source", (f) => PORTEURS_DE_LA_LISTE.has(f));
chercherHotes(RACINE, fichiersSource, "source", (f) => PORTEURS_DE_LA_LISTE.has(f));

// ── 2. Liste noire + liste blanche — build ─────────────────────────────
const DIST = join(RACINE, "dist");
if (!existsSync(DIST)) {
  echecs.push("[build] dist/ est absent. Lancer `npm run build` avant le contrôle.");
} else {
  const fichiersBuild = parcourir(DIST);
  chercherInterdits(DIST, fichiersBuild, "build", () => false);
  chercherHotes(DIST, fichiersBuild, "build", () => false);

  for (const f of fichiersBuild) {
    if (!BUILD_AUTORISE.some((r) => r.motif.test(f))) {
      echecs.push(
        `[liste blanche] dist/${f} ne correspond à aucune famille attendue. ` +
          `Soit il ne doit pas être publié, soit la liste blanche doit l'accueillir explicitement.`
      );
    }
  }
  notes.push(`build : ${fichiersBuild.length} fichiers, tous reconnus`);
}

// ── 3. Extensions et noms interdits dans la source ─────────────────────
for (const f of fichiersSource) {
  const base = f.split("/").pop();
  if (NOMS_INTERDITS.has(base)) {
    echecs.push(`[fichier interdit] ${f} n'a rien à faire dans un dépôt public.`);
  } else if (EXTENSIONS_INTERDITES.has(extname(f))) {
    echecs.push(`[extension interdite] ${f} — secret ou donnée brute.`);
  }
  if (PORTEURS_DE_LA_LISTE.has(f)) continue;
  const texte = lireTexte(join(RACINE, f));
  if (texte !== null) {
    for (const marqueur of MARQUEURS_A_COMPLETER) {
      if (marqueur.test(texte)) {
        echecs.push(`[à compléter] ${f} contient encore un gabarit non renseigné.`);
        break;
      }
    }
  }
}

// ── 3bis. Empreintes des bibliothèques vendorisées ──────────────────
//
// Un binaire versionné échappe à la liste noire : elle ne sait lire que du
// texte. Le laisser passer sans rien vérifier ouvrirait exactement le trou que
// ce contrôle existe pour fermer.
//
// La réponse n'est pas de l'ignorer mais de le CLOUER : chaque tarball de
// `vendor/` doit figurer dans `vendor/EMPREINTES.txt` avec son empreinte
// SHA-256, et la correspondance est vérifiée ici. Un fichier absent de la
// liste, ou dont l'empreinte a bougé d'un octet, bloque la publication.
//
// Le format de `EMPREINTES.txt` est exactement la sortie de
// `shasum -a 256 vendor/<fichier>` : rien à recopier à la main.

const VENDOR = join(RACINE, "vendor");
if (existsSync(VENDOR)) {
  const listeChemin = join(VENDOR, "EMPREINTES.txt");
  const attendues = new Map();
  if (existsSync(listeChemin)) {
    for (const ligne of readFileSync(listeChemin, "utf8").split("\n")) {
      const m = ligne.trim().match(/^([0-9a-f]{64})\s+\**(.+?)\**$/i);
      if (m) attendues.set(m[2].replace(/^vendor\//, ""), m[1].toLowerCase());
    }
  } else {
    echecs.push(
      "[vendor] vendor/EMPREINTES.txt est absent. Un binaire versionné sans empreinte " +
        "déclarée n'est pas vérifiable."
    );
  }

  const binaires = readdirSync(VENDOR).filter((n) => n !== "EMPREINTES.txt" && !n.endsWith(".md"));
  for (const nom of binaires) {
    const attendue = attendues.get(nom);
    if (!attendue) {
      echecs.push(`[vendor] ${nom} n'a pas d'empreinte déclarée dans vendor/EMPREINTES.txt.`);
      continue;
    }
    const reelle = createHash("sha256").update(readFileSync(join(VENDOR, nom))).digest("hex");
    if (reelle !== attendue) {
      echecs.push(
        `[vendor] ${nom} ne correspond pas à son empreinte déclarée. ` +
          `Attendu ${attendue.slice(0, 16)}…, obtenu ${reelle.slice(0, 16)}…`
      );
    } else {
      notes.push(`vendor : ${nom} conforme à son empreinte déclarée`);
    }
  }

  // Une empreinte déclarée pour un fichier disparu est une ligne morte qui
  // finirait par couvrir autre chose. Le jeu doit être exact des deux côtés.
  for (const nom of attendues.keys()) {
    if (!binaires.includes(nom)) {
      echecs.push(`[vendor] EMPREINTES.txt déclare ${nom}, qui n'existe plus dans vendor/.`);
    }
  }
}

// ── 3ter. Politique de sécurité du contenu — lot B.7 ────────────────────
//
// Le site reçoit le classeur de la personne. « Rien ne sort du navigateur »
// est une phrase affichée à l'écran : la politique de sécurité du contenu est
// ce qui la rend vérifiable. Publier un build qui l'aurait perdue — un plugin
// désactivé, une configuration remaniée — la transformerait en promesse.
//
// Les deux sorties sont produites par le build depuis `src/config/csp.ts`. On
// contrôle ici qu'elles sont bien là, et qu'aucune n'a été relâchée.

if (existsSync(DIST)) {
  const html = lireTexte(join(DIST, "index.html")) ?? "";
  const entetes = lireTexte(join(DIST, "_headers"));

  const meta = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i
  );
  if (!meta) {
    echecs.push(
      "[CSP] dist/index.html ne porte aucune politique de sécurité du contenu."
    );
  }
  if (entetes === null) {
    echecs.push("[CSP] dist/_headers est absent : l'hébergeur ne servira aucun en-tête.");
  }

  const politiques = [meta?.[1], entetes].filter((p) => typeof p === "string");
  for (const politique of politiques) {
    for (const exigee of ["default-src 'self'", "script-src 'self'", "connect-src 'self'"]) {
      if (!politique.includes(exigee)) {
        echecs.push(`[CSP] directive attendue absente : ${exigee}.`);
      }
    }
    // `'unsafe-inline'` est toléré sur les styles seulement (Recharts pose ses
    // dimensions en attribut style). Sur les scripts, il viderait la politique
    // de son sens.
    if (/script-src[^;]*unsafe-(inline|eval)/.test(politique)) {
      echecs.push("[CSP] script-src autorise du code en ligne ou eval.");
    }
  }
  if (politiques.length > 0) {
    notes.push("CSP : politique présente dans index.html et dans _headers");
  }
}

// ── 4. gitleaks ────────────────────────────────────────────────────────
//
// Cherche des secrets par forme (clés AWS, jetons GitHub, clés privées…),
// là où la liste noire cherche des noms connus. Deux filets différents.
//
// ⚠️ La configuration par défaut de gitleaks écarte volontairement les clés
// d'exemple de la documentation (celles qui contiennent « EXAMPLE »). Un
// essai bâti sur `AKIAIOSFODNN7EXAMPLE` passe donc au vert et ferait croire
// que l'outil ne marche pas. Pour l'éprouver, il faut une clé de forme
// réaliste.
const gitleaksRequis = process.env.GITLEAKS_REQUIS === "1";
const RAPPORT_GITLEAKS = join(RACINE, "node_modules", ".gitleaks-report.json");

let gitleaksPresent = true;
try {
  execFileSync("gitleaks", ["version"], { stdio: "pipe" });
} catch {
  gitleaksPresent = false;
  const message =
    "gitleaks n'est pas installé sur cette machine — le contrôle des secrets n'a PAS été exécuté.";
  if (gitleaksRequis) echecs.push(`[gitleaks] ${message}`);
  else notes.push(`⚠ ${message} La CI, elle, l'exige.`);
}

if (gitleaksPresent) {
  let aTourne = true;
  try {
    execFileSync(
      "gitleaks",
      [
        "dir", ".",
        "--no-banner",
        "--redact",
        "--report-format", "json",
        "--report-path", RAPPORT_GITLEAKS,
      ],
      { cwd: RACINE, stdio: "pipe" }
    );
  } catch (err) {
    // Code 1 = fuites trouvées. Tout autre code = l'outil a échoué.
    if (err.status !== 1) {
      aTourne = false;
      if (gitleaksRequis) {
        echecs.push(`[gitleaks] l'outil a échoué : ${String(err.stderr ?? err).trim()}`);
      } else {
        notes.push("⚠ gitleaks n'a pas pu s'exécuter — contrôle des secrets non effectué.");
      }
    }
  }

  if (aTourne) {
    let trouvailles = [];
    try {
      trouvailles = JSON.parse(readFileSync(RAPPORT_GITLEAKS, "utf8")) ?? [];
    } catch {
      trouvailles = [];
    }
    if (trouvailles.length === 0) {
      notes.push("gitleaks : aucun secret détecté");
    } else {
      for (const t of trouvailles) {
        echecs.push(
          `[gitleaks] ${t.File}:${t.StartLine} — règle « ${t.RuleID} » ` +
            `(valeur masquée : ${t.Secret})`
        );
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RAPPORT
// ═══════════════════════════════════════════════════════════════════════

console.log("Contrôle de publication\n");
console.log(`  fichiers source examinés : ${fichiersSource.length}`);
for (const n of notes) console.log(`  ${n}`);
console.log("");

if (echecs.length === 0) {
  console.log("✓ Aucun problème. Le dossier est publiable.");
  process.exit(0);
}

console.error(`✗ ${echecs.length} problème(s) :\n`);
for (const e of echecs) console.error(`  ${e}`);
console.error("\nPublication bloquée.");
process.exit(1);
