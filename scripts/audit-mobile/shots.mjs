// Recapture : le scroll est dans un conteneur interne (AppShell), pas sur <html>.
// On detecte le plus grand scroller vertical et on agrandit le viewport a sa hauteur.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:4173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.argv[2];
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const ROUTES = [['comptes','/'],['depenses','/depenses'],['depenses-budget','/depenses/budget'],['revenus','/revenus'],['revenus-salaire','/revenus/salaire'],['revenus-inflation','/revenus/inflation'],['patrimoine','/patrimoine'],['patrimoine-pret','/patrimoine/pret'],['insights','/insights']];

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
const info = {};

for (const [name, route] of ROUTES) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const need = await page.evaluate(() => {
    let best = 0, sel = null;
    for (const el of document.querySelectorAll('*')) {
      const ov = getComputedStyle(el).overflowY;
      if (['auto', 'scroll'].includes(ov) && el.scrollHeight > el.clientHeight + 2) {
        const extra = el.scrollHeight - el.clientHeight;
        if (extra > best) { best = extra; sel = el.tagName + '.' + (el.className || '').toString().slice(0, 60); }
      }
    }
    return { extra: best, sel };
  });

  const h = Math.min(915 + need.extra, 8000);
  if (need.extra > 0) {
    await page.setViewport({ width: 412, height: Math.ceil(h), deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await new Promise((r) => setTimeout(r, 1200));
  }
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  info[name] = { contenuHorsEcran: need.extra, hauteurCapturee: Math.ceil(h), scroller: need.sel };
  console.log(name, JSON.stringify(info[name]));
  await page.close();
}
fs.writeFileSync('/tmp/a56-lh/scroll-metrics.json', JSON.stringify(info, null, 2));
await browser.close();
console.log('DONE');
