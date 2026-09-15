#!/usr/bin/env node
/**
 * Contrôle d'équivalence des DEUX tuyaux de lecture Excel du projet.
 *
 *   ① le worker du navigateur — src/components/upload/parseExcel.worker.ts
 *   ② le parseur Python du skill l'outil de mise à jour des données, dont la sortie est
 *      public/data/transactions.json
 *
 * Les deux lisent le même classeur et doivent produire les mêmes lignes. Rien
 * ne le garantissait jusqu'au 11/08/2026 : le commit 8e46fb9 avait corrigé
 * deux défauts de parsing côté Python seulement, et le worker a produit des
 * données fausses pendant deux semaines sans qu'aucun test ne bronche
 * (point ouvert n° 25).
 *
 * Usage :
 *   node scripts/check-import-equivalence.mjs <classeur.xlsx> [reference.json]
 *
 * Sortie : code 0 si les deux tuyaux concordent sur la période commune,
 * 1 sinon. Les écarts sont détaillés par type de dépense.
 *
 * ⚠️ À lancer dans le fuseau d'utilisation réelle (Europe/Paris). Le défaut de
 * date corrigé le 11/08 est INVISIBLE sous TZ=UTC — un contrôle vert sur une
 * machine en UTC ne prouve rien.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

const WORKER = "src/components/upload/parseExcel.worker.ts";
const DEFAULT_REF = "public/data/transactions.json";
const CHAMPS = ["date", "compte", "type", "label", "montant", "dc", "cat1", "cat2", "cat3", "cat4", "ville"];

const [, , xlsxArg, refArg] = process.argv;
if (!xlsxArg) {
  console.error("usage : node scripts/check-import-equivalence.mjs <classeur.xlsx> [reference.json]");
  process.exit(2);
}
const xlsxPath = resolve(xlsxArg);
const refPath = resolve(refArg ?? DEFAULT_REF);

if (process.env.TZ && process.env.TZ !== "Europe/Paris") {
  console.warn(`⚠️  TZ=${process.env.TZ} : le défaut de date J-1 ne se reproduit qu'en fuseau à décalage positif.`);
}

/**
 * Transpile le worker et l'exécute hors navigateur, en stubbant `self`.
 *
 * Deux contraintes dictent la forme du bundle, l'une et l'autre découvertes à
 * l'usage : il doit être en CommonJS (`xlsx` fait un `require("stream")`
 * dynamique qu'un bundle ESM ne sait pas honorer), et il doit être écrit SOUS
 * le projet (`xlsx` reste externe, un dossier temporaire ne le résoudrait pas).
 */
async function runWorker(buffer) {
  const out = join(process.cwd(), "node_modules/.cache/import-equiv/worker.cjs");
  await build({
    entryPoints: [WORKER], bundle: true, format: "cjs", platform: "node",
    outfile: out, external: ["xlsx"], logLevel: "error",
  });

  let final = null;
  globalThis.self = {
    onmessage: null,
    postMessage: (m) => { if (m.type !== "progress") final = m; },
  };
  createRequire(import.meta.url)(out);
  globalThis.self.onmessage({ data: { type: "parse", buffer } });

  if (!final) throw new Error("le worker n'a produit aucun message final");
  if (final.type === "error") throw new Error(`worker : ${final.message}`);
  return final.transactions;
}

/** Développe l'encodage dictionnaire { s, t, fields } en objets lisibles. */
function decoder({ s, t, fields }) {
  return t.map((row) => {
    const o = {};
    fields.forEach((f, i) => {
      const v = row[i];
      o[f] = f === "montant" || f === "date"
        ? v
        : typeof v === "number" ? (v < 0 ? null : s[v]) : v;
    });
    return o;
  });
}

const cle = (o) => CHAMPS.map((f) => o[f]).join("");

function compter(lignes) {
  const m = new Map();
  for (const o of lignes) { const k = cle(o); m.set(k, (m.get(k) ?? 0) + 1); }
  return m;
}

const buf = readFileSync(xlsxPath);
const brut = await runWorker(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const ref = JSON.parse(readFileSync(refPath, "utf8"));

const lignesW = decoder(brut);
const lignesR = decoder(ref);

// La référence peut dater d'un millésime antérieur : on ne compare que la
// période qu'elle couvre, sans quoi tout ajout récent au classeur compterait
// comme un écart.
const borne = lignesR.reduce((max, o) => (o.date > max ? o.date : max), "");
const dansPerimetre = lignesW.filter((o) => o.date <= borne);

const mw = compter(dansPerimetre);
const mr = compter(lignesR);

let communs = 0;
const seulW = [], seulR = [];
for (const [k, n] of mw) {
  const m = mr.get(k) ?? 0;
  communs += Math.min(n, m);
  for (let i = 0; i < n - m; i++) seulW.push(k);
}
for (const [k, n] of mr) {
  const m = mw.get(k) ?? 0;
  for (let i = 0; i < n - m; i++) seulR.push(k);
}

const credits = (a) => a.filter((o) => o.dc === "Crédit").length;
const pct = lignesR.length ? (100 * communs / lignesR.length).toFixed(1) : "0.0";

console.log(`classeur   : ${xlsxPath}`);
console.log(`référence  : ${refPath}`);
console.log(`période commune : jusqu'au ${borne}`);
console.log(`  worker    ${dansPerimetre.length} lignes, ${credits(dansPerimetre)} crédits`);
console.log(`  référence ${lignesR.length} lignes, ${credits(lignesR)} crédits`);
console.log(`  concordantes sur les ${CHAMPS.length} champs : ${communs} (${pct} %)`);

if (seulW.length || seulR.length) {
  const parType = (ks) => {
    const m = {};
    for (const k of ks) { const t = k.split("")[2]; m[t] = (m[t] ?? 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  console.log(`\n⚠️  ${seulW.length} ligne(s) côté worker seul, ${seulR.length} côté référence seule.`);
  console.log("   worker seul, par type    :", JSON.stringify(Object.fromEntries(parType(seulW))));
  console.log("   référence seule, par type:", JSON.stringify(Object.fromEntries(parType(seulR))));
  console.log("\n   Un écart n'est pas forcément un défaut : la référence peut être");
  console.log("   d'un millésime antérieur (lignes ajoutées ou corrigées depuis).");
  console.log("   En revanche un écart de COMPTE DE CRÉDITS, ou un écart réparti sur");
  console.log("   tous les types, signe une divergence de parsing.");
  process.exit(1);
}

console.log("\n✅ Les deux tuyaux concordent sur la période commune.");
