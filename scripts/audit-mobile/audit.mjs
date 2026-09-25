// Audit mobile A56 — Lighthouse (profil mobile) + captures emulees 412 px.
// Deps installees dans /tmp/a56-tools (puppeteer-core, lighthouse).
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';

const BASE = 'http://localhost:4173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_SHOTS = process.argv[2];
const OUT_JSON = '/tmp/a56-lh';

// Samsung Galaxy A56 : 412 x 915 dip, DPR 2.625
const A56 = { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, isLandscape: false };
const UA_A56 = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

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

fs.mkdirSync(OUT_SHOTS, { recursive: true });
fs.mkdirSync(OUT_JSON, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--remote-debugging-port=9222', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars'],
});
const wsPort = 9222;

// ---------- Phase 1 : captures A56 ----------
const overflow = {};
for (const [name, route] of ROUTES) {
  const page = await browser.newPage();
  await page.setUserAgent(UA_A56);
  await page.setViewport(A56);

  // Lot 1.5 — controle de source (constat n° 4 du lot 1.3, durci).
  // Une page vide ne deborde pas non plus : le 0/9 du lot 1.3 aurait ete
  // identique si l'app etait retombee sur `public/data/*.json`. Compter les
  // cartes ne suffit plus depuis le commit `8e46fb9` (01/08), qui a enrichi ce
  // repli jusqu'au 27/07 : une page en repli ressemble desormais a une page
  // saine. On trace donc les requetes reseau elles-memes.
  const net = { api: 0, apiOk: 0, fallback: 0, failed: [] };
  page.on('response', (res) => {
    const u = res.url();
    if (/\/api\/|\/proxy-api\//.test(u)) {
      net.api += 1;
      if (res.ok()) net.apiOk += 1;
      else net.failed.push(`${res.status()} ${u.slice(0, 90)}`);
    } else if (/\/data\/[a-z]+\.json/.test(u)) {
      net.fallback += 1;
    }
  });
  page.on('requestfailed', (req) => net.failed.push(`ERR ${req.url().slice(0, 90)}`));

  await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1800)); // laisser les graphiques Recharts s'animer
  await page.screenshot({ path: path.join(OUT_SHOTS, `${name}.png`), fullPage: true });

  // mesures DOM : debordement horizontal + zones scrollables + petits textes + cibles tactiles
  overflow[name] = await page.evaluate(() => {
    const de = document.documentElement;
    // Lot 1.4 — correction de `fullHeight`. Jusqu'ici cette mesure valait
    // `de.scrollHeight`. C'etait juste au lot 1.0, ou le document lui-meme
    // defilait ; ca ne l'est plus depuis le travail sur `AppShell` du lot 1.1,
    // qui a introduit un `main` en `overflow-y-auto`. `de.scrollHeight` vaut
    // desormais 915 px — la hauteur d'ecran — sur les 9 pages, et l'indicateur
    // « contenu hors ecran » aurait annonce au lot 1.5 une chute de 3 875 a
    // 246 px sur Depenses, entierement fausse.
    // On vise donc le conteneur qui defile reellement, et on retombe sur `de`
    // s'il n'y en a pas. Verification de comparabilite avec le lot 1.0 : sur
    // Comptes, ce conteneur mesure 1 974 px pour 669 px visibles, soit
    // 1 305 px hors ecran — exactement la valeur relevee au lot 1.0.
    const scrollerY = [...document.querySelectorAll('*')].find(
      (el) => el.scrollHeight > el.clientHeight + 2 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)
    ) ?? de;
    const scrollers = [...document.querySelectorAll('*')].filter(
      (el) => el.scrollWidth > el.clientWidth + 2 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowX)
    );
    // Lot 1.5 — compteur miroir, SANS le filtre `overflowX`.
    // `hScrollZones` n'existe que si un conteneur `overflow-x-auto` est present.
    // Or le lot 1.3 a supprime ces conteneurs sous 768 px : l'indicateur peut
    // tomber a 0 parce que l'ELEMENT a disparu, pas parce que le contenu tient.
    // Un debordement reel sous `overflow-x: visible` ou `hidden` ne serait pas
    // vu. Ce miroir compte tout element dont le contenu excede la boite, quel
    // que soit son `overflow-x` — il doit lui aussi valoir 0 pour que le
    // « 0 / 9 » du lot 1.3 soit demontre et non suppose.
    const anyOverflow = [...document.querySelectorAll('*')].filter((el) => {
      if (el.scrollWidth <= el.clientWidth + 2) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0; // ecarte les noeuds non rendus
    });
    // Lot 1.6 — SECOND miroir, filtre des contenus volontairement clippes.
    // Le lot 1.6 a introduit des equivalents textuels `sr-only` (alternative
    // aux graphiques rendus decoratifs). Le motif `sr-only` reduit la boite a
    // 1 x 1 px et clippe : `scrollWidth - clientWidth` y vaut donc la largeur
    // entiere du texte, et `hScrollAny` a compte 4 noeuds / 233 px sur Pret
    // immobilier. Ce n'est PAS un debordement visuel — rien n'est peint.
    //
    // Le compteur d'origine reste inchange a cote, comme `hScrollZones` l'est
    // reste au lot 1.5 : on n'ajuste pas un instrument pour ameliorer un
    // chiffre, on en ajoute un qui repond a la question voulue. Le critere
    // d'exclusion est structurel (boite de 1 px ET contenu clippe), pas
    // « exclure ce qui echoue ».
    const estClippe = (el) => {
      let n = el;
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        const clip = cs.clip !== 'auto' || (cs.clipPath && cs.clipPath !== 'none');
        if (clip && r.width <= 2 && r.height <= 2) return true;
        n = n.parentElement;
      }
      return false;
    };
    const anyOverflowVisible = anyOverflow.filter((el) => !estClippe(el));
    const tiny = [...document.querySelectorAll('*')].filter((el) => {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      return fs > 0 && fs < 12 && el.textContent.trim().length > 0 && el.children.length === 0;
    });
    const small = [...document.querySelectorAll('a,button,[role="button"],input,select')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44);
    });
    return {
      docScrollWidth: de.scrollWidth,
      docClientWidth: de.clientWidth,
      pageOverflowsX: de.scrollWidth > de.clientWidth + 1,
      hScrollZones: scrollers.length,
      hScrollWorst: Math.max(0, ...scrollers.map((el) => el.scrollWidth - el.clientWidth)),
      // Miroir : doit valoir 0 lui aussi. S'il est > 0 alors que `hScrollZones`
      // vaut 0, le debordement a ete masque et non supprime.
      hScrollAny: anyOverflow.length,
      hScrollAnyWorst: Math.max(0, ...anyOverflow.map((el) => el.scrollWidth - el.clientWidth)),
      // Lot 1.6 — le miroir hors contenus clippes. C'est CELUI-CI qui doit
      // valoir 0 pour que le « 0 / 9 » de la cible n° 1 soit demontre.
      hScrollAnyVisible: anyOverflowVisible.length,
      hScrollAnyVisibleWorst: Math.max(0, ...anyOverflowVisible.map((el) => el.scrollWidth - el.clientWidth)),
      hScrollAnyTop: anyOverflow
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}:${el.scrollWidth - el.clientWidth}px[${getComputedStyle(el).overflowX}]`),
      tinyTextCount: tiny.length,
      tinyTextMin: tiny.length ? Math.min(...tiny.map((el) => parseFloat(getComputedStyle(el).fontSize))) : null,
      smallTargets: small.length,
      fullHeight: scrollerY.scrollHeight,
      // Conserve pour tracer la bascule d'architecture entre les lots 1.0 et 1.1.
      fullHeightDoc: de.scrollHeight,
      scrollerViewport: scrollerY.clientHeight,
      // Trace du conteneur reellement vise : si ce n'est pas `main`, le `find()`
      // a change de cible et `fullHeight` ne mesure plus la meme chose.
      scrollerTag: `${scrollerY.tagName.toLowerCase()}.${String(scrollerY.className).slice(0, 40)}`,
      // Peuplement : nombre de cartes/lignes reellement rendues (constat n° 4 du 1.3).
      kpiCards: document.querySelectorAll('.kpi-card').length,
      // « Vide » = aucun chiffre dans la carte. Critere volontairement grossier
      // et verifiable a l'oeil sur les captures, plutot qu'une heuristique fine
      // qui produirait un artefact (cf. constat ② du lot 1.4).
      emptyCards: [...document.querySelectorAll('.kpi-card')].filter((c) => !/\d/.test(c.textContent)).length,
      rows: document.querySelectorAll('tbody tr').length,
    };
  });
  overflow[name].net = net;
  await page.close();
  console.log('shot', name, JSON.stringify(overflow[name]));
}
fs.writeFileSync(path.join(OUT_JSON, 'dom-metrics.json'), JSON.stringify(overflow, null, 2));

// ---------- Phase 2 : Lighthouse profil mobile ----------
const lhFlags = {
  port: wsPort,
  output: 'json',
  logLevel: 'error',
  formFactor: 'mobile',
  screenEmulation: { mobile: true, width: A56.width, height: A56.height, deviceScaleFactor: A56.deviceScaleFactor, disabled: false },
  emulatedUserAgent: UA_A56,
  onlyCategories: ['performance', 'accessibility', 'best-practices'],
};

const summary = [];
for (const [name, route] of ROUTES) {
  const res = await lighthouse(BASE + route, lhFlags);
  const c = res.lhr.categories;
  const a = res.lhr.audits;
  const failedA11y = Object.values(a)
    .filter((x) => x.score !== null && x.score < 1 && (res.lhr.categories.accessibility.auditRefs || []).some((r) => r.id === x.id))
    .map((x) => x.id);
  summary.push({
    page: name,
    route,
    perf: Math.round(c.performance.score * 100),
    a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c['best-practices'].score * 100),
    fcp: a['first-contentful-paint'].displayValue,
    lcp: a['largest-contentful-paint'].displayValue,
    tbt: a['total-blocking-time'].displayValue,
    cls: a['cumulative-layout-shift'].displayValue,
    si: a['speed-index'].displayValue,
    failedA11y,
  });
  fs.writeFileSync(path.join(OUT_JSON, `${name}.json`), JSON.stringify(res.lhr));
  console.log('lh', name, summary.at(-1).perf, summary.at(-1).a11y, summary.at(-1).bp);
}
fs.writeFileSync(path.join(OUT_JSON, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
console.log('DONE');
