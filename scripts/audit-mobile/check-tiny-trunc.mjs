// Lot 1.5 — deux leves de doute avant de trancher les points n° 11 et 12.
//
// 1) `svgTrunc` de `measures.mjs` compte tout libelle SVG contenant « … » ou
//    « ... ». Or plusieurs categories de depenses portent ces caracteres DANS
//    LEUR NOM (« Autres (Amendes, …) »). Un nom ainsi ecrit serait compte comme
//    tronque sans l'etre. On distingue ici la troncature reelle — texte se
//    TERMINANT par l'ellipse — du caractere present au milieu du libelle.
//
// 2) `tinyTextCount` ressort a 39 sur Depenses (cible : ≤ 20) et `tinyTextMin`
//    a 10 px sur Salaire (cible : ≥ 11 px). Avant d'arbitrer le point n° 11, il
//    faut savoir CE QUI est compte : ticks Recharts (<tspan>, plancher 12 px
//    arbitre au lot 1.2) ou classes HTML `text-[11px]`.
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const ROUTES = [['depenses', '/depenses'], ['revenus-salaire', '/revenus/salaire'], ['depenses-budget', '/depenses/budget']];

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });

for (const [name, route] of ROUTES) {
  const p = await b.newPage();
  await p.setUserAgent(UA);
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:4173' + route, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1800));

  const r = await p.evaluate(() => {
    const svgTexts = [...document.querySelectorAll('svg text, svg tspan')].map((t) => t.textContent);
    const finitPar = svgTexts.filter((t) => /(…|\.\.\.)\s*$/.test(t));
    const contientAuMilieu = svgTexts.filter((t) => /…|\.\.\./.test(t) && !/(…|\.\.\.)\s*$/.test(t));

    const tiny = [...document.querySelectorAll('*')].filter((el) => {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      return fs > 0 && fs < 12 && el.textContent.trim().length > 0 && el.children.length === 0;
    });
    const parType = {};
    for (const el of tiny) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      const dansSvg = !!el.closest('svg');
      const k = `${dansSvg ? 'SVG' : 'HTML'}-${el.tagName.toLowerCase()}-${fs}px`;
      (parType[k] ??= []).push(el.textContent.trim().slice(0, 22));
    }
    return {
      svgTronquesReels: finitPar,
      svgEllipseDansLeNom: contientAuMilieu,
      tinyTotal: tiny.length,
      tinyParType: Object.fromEntries(
        Object.entries(parType).map(([k, v]) => [`${k} x${v.length}`, v.slice(0, 4)])
      ),
    };
  });
  console.log(`\n===== ${name} =====`);
  console.log(JSON.stringify(r, null, 1));
  await p.close();
}
await b.close();
