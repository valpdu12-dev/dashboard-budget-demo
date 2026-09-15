// Vignettes de lecture : ecrans successifs 412x915 (DPR 2), pour analyse visuelle.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:4173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = '/tmp/a56-crops';
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
// [nom, route, indices d'ecran a capturer]
const JOBS = [['comptes','/',[0,1]],['depenses','/depenses',[0,2]],['depenses-budget','/depenses/budget',[0,1]],['patrimoine','/patrimoine',[1]],['insights','/insights',[0]]];

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
for (const [name, route, screens] of JOBS) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  for (const i of screens) {
    if (i > 0) {
      await page.evaluate((n) => {
        const el = [...document.querySelectorAll('main')].find((e) => e.scrollHeight > e.clientHeight);
        if (el) el.scrollTop = n * (el.clientHeight - 60);
      }, i);
      await new Promise((r) => setTimeout(r, 900));
    }
    await page.screenshot({ path: `${OUT}/${name}-ecran${i + 1}.png` });
  }
  await page.close();
  console.log('ok', name);
}
await browser.close();
console.log('DONE');
