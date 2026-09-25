// Lot 1.6 — verification ① appliquee aux 3 familles d'audits d'accessibilite.
//
// La question posee avant tout correctif : QUE COMPTE Lighthouse au juste ?
// « color-contrast en echec sur les 9 pages » ne dit pas s'il s'agit d'un
// noeud, d'une regle CSS, ou d'un couple de couleurs — et le nombre de
// correctifs a ecrire n'est pas le meme dans les trois cas.
//
// Ce script ne mesure rien lui-meme : il DEPOUILLE les rapports bruts deja
// produits par `audit.mjs` dans /tmp/a56-lh/<page>.json. Il n'ajoute donc
// aucune passe de Chrome et ne peut pas diverger de la mesure officielle.
//
// Sortie : pour chacune des 3 familles, le nombre de noeuds par page, les
// selecteurs, et — pour `color-contrast` — le couple de couleurs, le ratio
// mesure et le ratio exige. Le regroupement par COUPLE de couleurs est le
// chiffre utile : c'est lui qui dit combien de tokens du design system sont
// en cause, la ou le nombre de noeuds ne dit que combien de fois ils servent.
import fs from 'node:fs';
import path from 'node:path';

const DIR = '/tmp/a56-lh';
const FAMILLES = ['color-contrast', 'heading-order', 'svg-img-alt'];
const PAGES = ['comptes','depenses','depenses-budget','revenus','revenus-salaire','revenus-inflation','patrimoine','patrimoine-pret','insights'];

// Un item axe-core porte son detail dans `node` (selector, snippet, explanation).
const lireNoeud = (item) => {
  const n = item.node || {};
  return {
    selector: n.selector || '(?)',
    snippet: (n.snippet || '').replace(/\s+/g, ' ').slice(0, 120),
    // 260 et non 200 : la phrase d'axe-core fait ~205 caracteres et le seuil
    // exige (« Expected contrast ratio of 4.5:1 ») est en toute fin. A 200, il
    // etait coupe et le champ `exige` sortait a `null` sur les 237 noeuds.
    explication: (n.explanation || '').replace(/\s+/g, ' ').slice(0, 260),
  };
};

// Le detail des couleurs n'est pas un champ structure : axe-core le rend en
// clair dans l'explication. On l'extrait plutot que de le supposer.
// Phrase reelle d'axe-core, relevee sur le rapport et non supposee :
//   « Element has insufficient color contrast of 3.58 (foreground color:
//     #6366f1, background color: #19203b, font size: 9.8pt (13px), font
//     weight: normal). Expected contrast ratio of 4.5:1 »
// La taille et la graisse comptent : le seuil AA tombe a 3:1 pour du texte
// dit « large » (>= 18pt, ou >= 14pt en gras). Les relever evite de corriger
// une couleur qui n'avait pas besoin de l'etre.
const extraireCouleurs = (explication) => {
  const ratio = explication.match(/insufficient color contrast of ([\d.]+)/i);
  const fg = explication.match(/foreground colou?r: (#[0-9a-f]{3,8})/i);
  const bg = explication.match(/background colou?r: (#[0-9a-f]{3,8})/i);
  const exige = explication.match(/[Ee]xpected contrast ratio of ([\d.]+)/i);
  const px = explication.match(/font size: [\d.]+pt \((\d+(?:\.\d+)?)px\)/i);
  const poids = explication.match(/font weight: (\w+)/i);
  return {
    fg: fg ? fg[1].toLowerCase() : null,
    bg: bg ? bg[1].toLowerCase() : null,
    ratio: ratio ? parseFloat(ratio[1]) : null,
    exige: exige ? parseFloat(exige[1]) : null,
    px: px ? parseFloat(px[1]) : null,
    poids: poids ? poids[1] : null,
  };
};

const parFamille = Object.fromEntries(FAMILLES.map((f) => [f, { pages: {}, noeuds: [] }]));
const absents = [];

for (const page of PAGES) {
  const f = path.join(DIR, `${page}.json`);
  if (!fs.existsSync(f)) { absents.push(page); continue; }
  const lhr = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const famille of FAMILLES) {
    const audit = lhr.audits[famille];
    if (!audit) { parFamille[famille].pages[page] = 'AUDIT ABSENT'; continue; }
    if (audit.score === null) { parFamille[famille].pages[page] = 'non applicable'; continue; }
    if (audit.score === 1) { parFamille[famille].pages[page] = 0; continue; }
    const items = (audit.details && audit.details.items) || [];
    parFamille[famille].pages[page] = items.length;
    for (const it of items) {
      const n = lireNoeud(it);
      parFamille[famille].noeuds.push({ page, ...n, ...(famille === 'color-contrast' ? extraireCouleurs(n.explication) : {}) });
    }
  }
}

console.log('='.repeat(78));
console.log('LOT 1.6 — DEPOUILLEMENT DES 3 FAMILLES D\'AUDITS D\'ACCESSIBILITE');
if (absents.length) console.log('⚠️  Rapports absents :', absents.join(', '));
console.log('='.repeat(78));

for (const famille of FAMILLES) {
  const d = parFamille[famille];
  const enEchec = Object.entries(d.pages).filter(([, v]) => typeof v === 'number' && v > 0);
  console.log(`\n### ${famille}`);
  console.log(`Pages en echec : ${enEchec.length} / ${PAGES.length}   |   noeuds cumules : ${d.noeuds.length}`);
  console.log('Par page :', JSON.stringify(d.pages));

  if (famille === 'color-contrast') {
    // LE chiffre qui compte : combien de COUPLES distincts, pas combien de noeuds.
    const couples = {};
    for (const n of d.noeuds) {
      const cle = `${n.fg || '?'} sur ${n.bg || '?'}`;
      couples[cle] = couples[cle] || { n: 0, ratio: n.ratio, exige: n.exige, tailles: new Set(), pages: new Set(), exemples: [] };
      couples[cle].n += 1;
      couples[cle].pages.add(n.page);
      couples[cle].tailles.add(`${n.px}px/${n.poids}`);
      if (couples[cle].exemples.length < 3) couples[cle].exemples.push(`${n.selector} — « ${n.snippet.slice(0, 60)} »`);
    }
    console.log(`\nCOUPLES DE COULEURS DISTINCTS : ${Object.keys(couples).length}`);
    const tri = Object.entries(couples).sort((a, b) => b[1].n - a[1].n);
    for (const [cle, v] of tri) {
      const manque = v.exige && v.ratio ? (v.exige / v.ratio).toFixed(2) : '?';
      console.log(`\n  ▸ ${cle}`);
      console.log(`    ratio ${v.ratio} / exige ${v.exige}  (facteur manquant ×${manque})  —  ${v.n} noeuds sur ${v.pages.size} pages`);
      console.log(`    tailles : ${[...v.tailles].join(', ')}`);
      v.exemples.forEach((e) => console.log(`      ${e}`));
    }
    // Les selecteurs distincts disent combien d'endroits du code sont a toucher.
    const sels = new Set(d.noeuds.map((n) => n.selector.replace(/:nth-child\(\d+\)/g, '')));
    console.log(`\n  Selecteurs distincts (nth-child neutralise) : ${sels.size}`);
  } else {
    const sels = {};
    for (const n of d.noeuds) {
      const cle = `${n.snippet.slice(0, 70)}`;
      sels[cle] = sels[cle] || { n: 0, pages: new Set(), sel: n.selector, expl: n.explication };
      sels[cle].n += 1;
      sels[cle].pages.add(n.page);
    }
    console.log(`\n  Motifs distincts : ${Object.keys(sels).length}`);
    for (const [cle, v] of Object.entries(sels).sort((a, b) => b[1].n - a[1].n)) {
      console.log(`  ▸ [${v.n} noeuds / ${v.pages.size} pages] ${cle}`);
      console.log(`      sel: ${v.sel}`);
      if (v.expl) console.log(`      why: ${v.expl.slice(0, 140)}`);
    }
  }
}

fs.writeFileSync(path.join(DIR, 'a11y-ventilation.json'), JSON.stringify(parFamille, null, 2, (k, v) => (v instanceof Set ? [...v] : v)));
console.log('\nDONE');
