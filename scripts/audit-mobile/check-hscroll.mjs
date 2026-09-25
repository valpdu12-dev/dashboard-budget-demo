// Verification ciblee du lot 1.3 — debordement horizontal et cibles tactiles.
//
// Ce script rejoue TEXTUELLEMENT le bloc `page.evaluate` de `audit.mjs:50-74`,
// sans Lighthouse : la mesure complete reste celle du lot 1.5. Il sert a
// trancher un seul point, celui que jsdom ne peut pas prouver — le mode carte
// fait-il reellement sortir les pages du decompte `hScrollZones` ?
//
// Rappel du critere mesure (audit.mjs:52-54) : une zone n'est comptee que si
// son `overflowX` calcule vaut `auto` ou `scroll` ET que son contenu deborde.
//
// Prerequis identiques a audit.mjs : deps dans /tmp/a56-tools, Chrome macOS,
// build servi par `vite preview` sur localhost:4173 (origine autorisee par le
// CORS du Worker — les donnees sont donc completes, cf. constat n° 5).
//
//   npx vite build --outDir /tmp/dist-lot13-0729
//   npx vite preview --port 4173 --outDir /tmp/dist-lot13-0729
//   node scripts/audit-mobile/check-hscroll.mjs
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const A56 = { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, isLandscape: false };
const UA_A56 = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// Les 9 routes de audit.mjs — la cible « 0 / 9 » porte sur l'ensemble.
const ROUTES = [
  ['comptes', '/'],
  ['depenses', '/depenses'],
  ['depenses-budget', '/depenses/budget'],
  ['revenus', '/revenus'],
  ['revenus-salaire', '/revenus/salaire'],
  ['revenus-inflation', '/revenus/inflation'],
  ['patrimoine', '/patrimoine'],
  ['patrimoine-pret', '/patrimoine/pret'],
  ['insights', '/insights'],
];

// Releve AVANT (AUDIT_MOBILE_A56.md § 3) — pour afficher l'ecart directement.
const AVANT = {
  comptes:            { zones: 0, worst: 0,   targets: 11 },
  depenses:           { zones: 1, worst: 522, targets: 16 },
  'depenses-budget':  { zones: 1, worst: 213, targets: 24 },
  revenus:            { zones: 1, worst: 85,  targets: 17 },
  'revenus-salaire':  { zones: 0, worst: 0,   targets: 21 },
  'revenus-inflation':{ zones: 1, worst: 182, targets: 20 },
  patrimoine:         { zones: 1, worst: 244, targets: 14 },
  'patrimoine-pret':  { zones: 0, worst: 0,   targets: 14 },
  insights:           { zones: 1, worst: 5,   targets: 12 },
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars'],
});

const rows = [];
for (const [name, route] of ROUTES) {
  const page = await browser.newPage();
  await page.setUserAgent(UA_A56);
  await page.setViewport(A56);
  await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1800));

  const m = await page.evaluate(() => {
    const de = document.documentElement;
    // --- copie conforme de audit.mjs:52-62 ---
    const scrollers = [...document.querySelectorAll('*')].filter(
      (el) => el.scrollWidth > el.clientWidth + 2 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowX)
    );
    const small = [...document.querySelectorAll('a,button,[role="button"],input,select')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44);
    });
    return {
      pageOverflowsX: de.scrollWidth > de.clientWidth + 1,
      hScrollZones: scrollers.length,
      hScrollWorst: Math.max(0, ...scrollers.map((el) => el.scrollWidth - el.clientWidth)),
      // Identification des coupables restants, pour ne pas chercher a l'aveugle.
      culprits: scrollers.map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').slice(0, 3).join('.')} (+${el.scrollWidth - el.clientWidth}px)`),
      smallTargets: small.length,
      smallSamples: [...new Set(small.map((el) => `${el.tagName.toLowerCase()}:${el.textContent.trim().slice(0, 18)}`))].slice(0, 6),
      fullHeight: de.scrollHeight,
    };
  });
  await page.close();
  rows.push([name, m]);
}
await browser.close();

console.log('\nPage                  Zones  Pire     Cibles<44   (AVANT -> APRES)');
console.log('-'.repeat(78));
let zonesTotal = 0;
let worstMax = 0;
for (const [name, m] of rows) {
  const a = AVANT[name];
  zonesTotal += m.hScrollZones;
  worstMax = Math.max(worstMax, m.hScrollWorst);
  console.log(
    name.padEnd(20),
    String(m.hScrollZones).padStart(5),
    String(m.hScrollWorst + 'px').padStart(8),
    String(m.smallTargets).padStart(9),
    `   (${a.zones}->${m.hScrollZones}, ${a.worst}->${m.hScrollWorst}px, ${a.targets}->${m.smallTargets})`
  );
  if (m.culprits.length) console.log('   reste:', m.culprits.join(' | '));
  if (m.smallTargets > 5) console.log('   cibles:', m.smallSamples.join(' | '));
}
console.log('-'.repeat(78));
const pagesAvecScroll = rows.filter(([, m]) => m.hScrollZones > 0).length;
console.log(`Pages avec defilement horizontal : ${pagesAvecScroll} / 9  (cible 0 / 9, AVANT 6 / 9)`);
console.log(`Pire debordement                 : ${worstMax} px      (cible 0 px, AVANT 522 px)`);
console.log(`Total de zones                   : ${zonesTotal}`);
