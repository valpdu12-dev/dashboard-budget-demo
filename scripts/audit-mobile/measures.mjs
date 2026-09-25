// Metriques de mise en page A56 — en-tete, BottomNav, cartes KPI, libelles SVG.
//
// REPARE AU LOT 1.6 (point ouvert n° 21). Quatre defauts corriges, tous releves
// par `check-measures.mjs` au lot 1.5 :
//
//   ① `navBottomGap` visait `querySelector('nav')`, qui retourne le PREMIER
//      <nav> du document — la sous-nav a pills de `SubNav.tsx`, presente sur
//      7 pages sur 9. D'ou 600 px sur 7 pages et 0 sur 2 (Comptes, Insights,
//      les seules sans sous-nav). La `BottomNav` est desormais identifiee par
//      `position: fixed` CALCULE, et non par sa chaine de classes — c'est
//      exactement le mode de panne de ② qu'on evite ici.
//   ② `kpiCardW` / `kpiCount` reposaient sur une heuristique exigeant
//      /rounded/ dans le className, caduque depuis que `.kpi-card` est une
//      classe `@apply`. `null` et 0 sur 8 pages sur 9. Selecteur explicite.
//      L'ancienne heuristique est conservee sous `kpiHeuristique` : elle sert
//      de temoin de panne, pas de mesure.
//   ③ `headerH` ne mesurait que l'etat DEPLIE : chaque page Puppeteer est une
//      session neuve, `sessionStorage` vide, donc filtres deplies (arbitrage
//      du 29/07). Les deux etats sont desormais mesures.
//   ④ `deviceScaleFactor` valait 2 ici et 2,625 dans `audit.mjs` et
//      `check-measures.mjs`. Aligne a 2,625 — la valeur reelle de l'A56.
//
// Et un artefact corrige (constat ③ du lot 1.5) : `svgTrunc` comptait 8
// libelles tronques sur Depenses, dont 3 portent « … » DANS LEUR NOM
// (« Autres (Amendes, …) »). Une troncature Recharts termine la chaine ;
// un nom natif ne la termine pas. Les deux comptes sont rendus.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const ROUTES = [['comptes','/'],['depenses','/depenses'],['depenses-budget','/depenses/budget'],['revenus','/revenus'],['revenus-salaire','/revenus/salaire'],['revenus-inflation','/revenus/inflation'],['patrimoine','/patrimoine'],['patrimoine-pret','/patrimoine/pret'],['insights','/insights']];

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
const out = {};

// Sonde rejouable : appelee une fois deplie, une fois repliee.
const PROBE = () => {
  // ① La BottomNav est le <nav> en `position: fixed` calcule. Aucune chaine de
  //    classes n'intervient — un renommage Tailwind ne peut pas casser ca.
  const navs = [...document.querySelectorAll('nav')].map((n) => {
    const r = n.getBoundingClientRect();
    return {
      cls: String(n.className).slice(0, 45),
      position: getComputedStyle(n).position,
      h: Math.round(r.height),
      bottomGap: Math.round(window.innerHeight - r.bottom),
    };
  });
  const bottomNav = navs.find((n) => n.position === 'fixed') || null;

  const h = document.querySelector('header');

  // ② Selecteur explicite. L'heuristique morte reste a cote, en temoin.
  const kpi = [...document.querySelectorAll('.kpi-card')];
  const kpiHeuristique = [...document.querySelectorAll('div')].filter(
    (e) =>
      /rounded/.test(e.className) &&
      e.querySelector(':scope > div,:scope > p') &&
      e.getBoundingClientRect().width > 150 &&
      e.getBoundingClientRect().width < 220
  ).length;

  // Artefact : distinguer troncature Recharts et « … » natif.
  const svgTextes = [...document.querySelectorAll('svg text, svg tspan')];
  const avecEllipse = svgTextes.filter((t) => /…|\.\.\./.test(t.textContent));
  const tronquesReels = avecEllipse.filter((t) => /(…|\.\.\.)\s*$/.test(t.textContent));

  const charts = [...document.querySelectorAll('svg')]
    .map((s) => { const r = s.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((x) => x.w > 120 && x.h > 120);

  return {
    headerH: h ? Math.round(h.getBoundingClientRect().height) : null,
    navs,
    navH: bottomNav ? bottomNav.h : null,
    navBottomGap: bottomNav ? bottomNav.bottomGap : null,
    kpiCardW: kpi.length ? Math.round(kpi[0].getBoundingClientRect().width) : null,
    kpiCount: kpi.length,
    kpiHeuristique,
    svgTrunc: tronquesReels.length,
    svgTruncBrut: avecEllipse.length,
    svgTruncTextes: tronquesReels.map((t) => t.textContent.slice(0, 32)),
    charts,
  };
};

for (const [n, r] of ROUTES) {
  const p = await b.newPage();
  await p.setUserAgent(UA);
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:4173' + r, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((s) => setTimeout(s, 1500));

  // ③ Etat DEPLIE — celui que l'utilisateur voit au premier affichage de session.
  const deplie = await p.evaluate(PROBE);

  // Puis on replie via le bouton `aria-expanded` de l'en-tete.
  const aReplie = await p.evaluate(() => {
    const btn = document.querySelector('header [aria-expanded="true"]');
    if (!btn) return false;
    btn.click();
    return true;
  });
  await new Promise((s) => setTimeout(s, 400));
  const replie = aReplie ? await p.evaluate(PROBE) : null;

  out[n] = {
    ...deplie,
    headerHDeplie: deplie.headerH,
    headerHReplie: replie ? replie.headerH : null,
    replieMesurable: aReplie,
  };
  console.log(n, JSON.stringify({
    headerHDeplie: out[n].headerHDeplie,
    headerHReplie: out[n].headerHReplie,
    navH: out[n].navH,
    navBottomGap: out[n].navBottomGap,
    kpiCount: out[n].kpiCount,
    kpiCardW: out[n].kpiCardW,
    kpiHeuristique: out[n].kpiHeuristique,
    svgTrunc: out[n].svgTrunc,
    svgTruncBrut: out[n].svgTruncBrut,
  }));
  await p.close();
}

fs.mkdirSync('/tmp/a56-lh', { recursive: true });
fs.writeFileSync('/tmp/a56-lh/layout-metrics.json', JSON.stringify(out, null, 2));
await b.close();
console.log('DONE');
