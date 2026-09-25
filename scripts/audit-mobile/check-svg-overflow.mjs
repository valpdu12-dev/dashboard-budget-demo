// Lot 1.5 — leve de doute sur l'unique alerte du compteur miroir `hScrollAny`.
// Sur `revenus-inflation`, un <text> SVG ressort a 61 px de debordement avec
// `overflow-x: visible`. Deux lectures possibles :
//   a) un libelle qui deborde reellement de son graphique (defaut a corriger) ;
//   b) un artefact : sur un element SVG, `clientWidth` vaut 0 par specification,
//      donc `scrollWidth - clientWidth` renvoie simplement la largeur du texte.
// Ce script tranche en comparant la boite du <text> a celle de son <svg> parent :
// il n'y a debordement reel que si le texte sort de l'aire du graphique.
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
const p = await b.newPage();
await p.setUserAgent(UA);
await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
await p.goto('http://localhost:4173/revenus/inflation', { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 1800));

const res = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.scrollWidth <= el.clientWidth + 2) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    const svg = el.closest('svg');
    const sr = svg ? svg.getBoundingClientRect() : null;
    out.push({
      tag: el.tagName,
      isSvg: !!svg,
      text: (el.textContent || '').slice(0, 30),
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      box: { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) },
      svgBox: sr ? { l: Math.round(sr.left), r: Math.round(sr.right) } : null,
      // Debordement REEL : le texte sort-il de l'aire du graphique, ou de l'ecran ?
      sortDuSvg: sr ? Math.round(Math.max(0, sr.left - r.left) + Math.max(0, r.right - sr.right)) : null,
      sortDeLEcran: Math.round(Math.max(0, 0 - r.left) + Math.max(0, r.right - window.innerWidth)),
    });
  }
  return out;
});

console.log(JSON.stringify(res, null, 2));
await b.close();
