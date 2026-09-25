// Lot 1.5 — verification ③ appliquee a `measures.mjs`.
// Trois de ses sorties sont suspectes par construction :
//   • `headerH` vaut 246 px sur les 9 pages, alors que le lot 1.1 annonce un
//     en-tete ramene a ~52 px ;
//   • `navBottomGap` vaut 600 px sur 7 pages et 0 sur 2 — un `fixed bottom-0`
//     ne peut pas etre a 600 px du bas ;
//   • `kpiCardW` est `null` et `kpiCount` a 0 sur 8 pages, alors qu'`audit.mjs`
//     compte 11 cartes `.kpi-card` sur Comptes.
// Ce script mesure les memes grandeurs par des selecteurs explicites, et
// distingue l'etat DEPLIE (premier affichage de session) de l'etat REPLIE.
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const ROUTES = [['comptes', '/'], ['depenses', '/depenses'], ['revenus-salaire', '/revenus/salaire'], ['insights', '/insights']];

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });

for (const [name, route] of ROUTES) {
  const p = await b.newPage();
  await p.setUserAgent(UA);
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:4173' + route, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const probe = () =>
    p.evaluate(() => {
      const navs = [...document.querySelectorAll('nav')].map((n) => {
        const r = n.getBoundingClientRect();
        return {
          cls: String(n.className).slice(0, 45),
          h: Math.round(r.height),
          bottomGap: Math.round(window.innerHeight - r.bottom),
          fixed: getComputedStyle(n).position,
        };
      });
      const h = document.querySelector('header');
      const kpi = [...document.querySelectorAll('.kpi-card')];
      // Heuristique exacte de measures.mjs, rejouee pour montrer ou elle echoue.
      const heur = [...document.querySelectorAll('div')].filter(
        (e) =>
          /rounded/.test(e.className) &&
          e.querySelector(':scope > div,:scope > p') &&
          e.getBoundingClientRect().width > 150 &&
          e.getBoundingClientRect().width < 220
      );
      return {
        headerH: h ? Math.round(h.getBoundingClientRect().height) : null,
        navs,
        kpiReel: kpi.length,
        kpiLargeurReelle: kpi.length ? Math.round(kpi[0].getBoundingClientRect().width) : null,
        kpiHeuristique: heur.length,
        svgTronques: [...document.querySelectorAll('svg text, svg tspan')]
          .filter((t) => /…|\.\.\./.test(t.textContent))
          .map((t) => t.textContent.slice(0, 24)),
      };
    });

  const deplie = await probe();
  // Replier les filtres : le bouton porte un aria-expanded dans le header.
  const replie = await p.evaluate(() => {
    const btn = document.querySelector('header [aria-expanded="true"]');
    if (!btn) return null;
    btn.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 400));
  const apres = replie ? await probe() : null;

  console.log(
    JSON.stringify(
      { page: name, deplie, replie: apres ? { headerH: apres.headerH } : 'aucun bouton aria-expanded trouve' },
      null,
      1
    )
  );
  await p.close();
}
await b.close();
