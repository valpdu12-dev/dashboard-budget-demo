// Diagnostic ponctuel du lot 1.4 — leve trois doutes laisses par check-kpi.mjs.
//
// ① `fullHeight` d'audit.mjs vaut 915 px (= la hauteur d'ecran) sur les 9
//    pages, alors que le lot 1.0 relevait 823 a 3 875 px de contenu hors
//    ecran. Soit le contenu ne monte plus, soit l'element qui defile n'est
//    plus `documentElement`. On identifie ici le vrai conteneur de defilement.
// ② Les 4 montants a 99-101 % de remplissage sont tous sur UNE ligne : ils
//    debordent d'une boite parente etroite sans forcement etre rognes. On
//    verifie s'il y a rognage reel (overflow hidden sur un ascendant) ou
//    simple depassement inoffensif d'un libelle centre.
// ③ L'A56 fait 412 px, mais le palier `isSmall` couvre tout ce qui est sous
//    430 px. On refait la passe a 360 px pour connaitre la marge reelle.
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA_A56 = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const ROUTES = [
  ['comptes', '/'], ['depenses', '/depenses'], ['depenses-budget', '/depenses/budget'],
  ['revenus', '/revenus'], ['revenus-salaire', '/revenus/salaire'], ['revenus-inflation', '/revenus/inflation'],
  ['patrimoine', '/patrimoine'], ['patrimoine-pret', '/patrimoine/pret'], ['insights', '/insights'],
];

const probe = async (browser, width) => {
  const out = [];
  for (const [name, route] of ROUTES) {
    const page = await browser.newPage();
    await page.setUserAgent(UA_A56);
    await page.setViewport({ width, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, isLandscape: false });
    await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1800));

    const m = await page.evaluate(() => {
      const round = (n) => Math.round(n * 100) / 100;
      // Voir check-kpi.mjs : un rect par nœud texte, pas par ligne. Les lignes
      // reelles se comptent en ordonnees distinctes.
      const natural = (el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rects = [...range.getClientRects()];
        range.detach?.();
        const tops = new Set(rects.map((r) => Math.round(r.top)));
        return { width: rects.reduce((s, r) => s + r.width, 0), lines: tops.size };
      };
      const contentWidth = (el) => {
        const cs = getComputedStyle(el);
        return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      };
      const desc = (el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().trim().split(/\s+/).slice(0, 4).join('.')}`;

      // --- ① qui defile reellement ? ---
      const de = document.documentElement;
      const scrollersY = [...document.querySelectorAll('*')]
        .filter((el) => el.scrollHeight > el.clientHeight + 2 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY))
        .map((el) => ({ sel: desc(el), scrollH: el.scrollHeight, clientH: el.clientHeight }));

      // --- ②/③ les gros montants ---
      const MONEY = /(\d[\d   ]*[,.]\d+\s*[€%])|(\d[\d   ]*\s*(k€|M€))|(\d[\d   ]*\s*%)/;
      const amounts = [...document.querySelectorAll('*')]
        .filter((el) => el.children.length === 0 && MONEY.test(el.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) >= 16)
        .map((el) => {
          const nat = natural(el);
          const parent = el.parentElement;
          const avail = parent ? contentWidth(parent) : el.clientWidth;
          // Un ascendant rogne-t-il vraiment ?
          let clipper = null;
          for (let a = el.parentElement, i = 0; a && i < 6; a = a.parentElement, i++) {
            const ox = getComputedStyle(a).overflowX;
            if (ox === 'hidden' || ox === 'clip') {
              if (nat.width > contentWidth(a) + 1) { clipper = desc(a) + ` (utile ${round(contentWidth(a))}px)`; }
              break;
            }
          }
          return {
            text: el.textContent.trim(),
            fs: parseFloat(getComputedStyle(el).fontSize),
            inCard: !!el.closest('.kpi-card'),
            ownWidth: round(el.getBoundingClientRect().width),
            natWidth: round(nat.width),
            lines: nat.lines,
            avail: round(avail),
            fill: avail > 0 ? round(nat.width / avail) : 0,
            selfClips: el.scrollWidth > el.clientWidth + 1,
            clipper,
            parent: parent ? desc(parent) : '',
          };
        });

      const cards = [...document.querySelectorAll('.kpi-card')];
      const cardFills = cards.map((c) => {
        const avail = contentWidth(c);
        const cands = [...c.querySelectorAll('div')].filter((d) => !d.children.length && d.textContent.trim());
        let v = null, mx = 0;
        for (const d of cands) { const f = parseFloat(getComputedStyle(d).fontSize); if (f > mx) { mx = f; v = d; } }
        if (!v) return { fill: 0, lines: 0, text: '', avail: round(avail) };
        const nat = natural(v);
        return { fill: avail > 0 ? round(nat.width / avail) : 0, lines: nat.lines, text: v.textContent.trim(), avail: round(avail) };
      });

      return {
        deScrollH: de.scrollHeight,
        bodyScrollH: document.body.scrollHeight,
        scrollersY,
        cardCount: cards.length,
        minAvail: cards.length ? Math.min(...cardFills.map((c) => c.avail)) : null,
        maxFill: cardFills.length ? Math.max(...cardFills.map((c) => c.fill)) : 0,
        cardsBroken: cardFills.filter((c) => c.fill >= 1 || c.lines > 1),
        cardsSaturated: cardFills.filter((c) => c.fill >= 0.9 && c.fill < 1),
        reallyClipped: amounts.filter((a) => a.clipper || a.selfClips || a.lines > 1),
        outside: amounts.filter((a) => !a.inCard && a.fill >= 0.9),
      };
    });
    await page.close();
    out.push([name, m]);
  }
  return out;
};

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars'],
});

// Largeurs a sonder. Une seule instance de Chrome ne survit pas toujours a
// deux passes de 9 pages : passer WIDTHS=360 pour rejouer une largeur seule.
const WIDTHS = (process.env.WIDTHS ?? '412,360').split(',').map(Number);

for (const width of WIDTHS) {
  const rows = await probe(browser, width);
  console.log(`\n${'#'.repeat(70)}\n### LARGEUR ${width} px\n${'#'.repeat(70)}`);
  console.log('\nPage                 Cartes  UtileMini  RemplMax  Satures  Casses   deScrollH  bodyH');
  for (const [name, m] of rows) {
    console.log(
      name.padEnd(20), String(m.cardCount).padStart(6), String(m.minAvail ?? '-').padStart(10),
      ((m.maxFill * 100).toFixed(0) + '%').padStart(9),
      String(m.cardsSaturated.length).padStart(8), String(m.cardsBroken.length).padStart(7),
      String(m.deScrollH).padStart(11), String(m.bodyScrollH).padStart(7)
    );
    for (const c of m.cardsBroken) console.log(`     CASSE  ${(c.fill * 100).toFixed(0)}% "${c.text}" ${c.lines} ligne(s) dans ${c.avail}px`);
    for (const c of m.cardsSaturated) console.log(`     satur. ${(c.fill * 100).toFixed(0)}% "${c.text}" dans ${c.avail}px`);
  }
  if (width === 412) {
    console.log('\n--- ① conteneurs de defilement vertical ---');
    for (const [name, m] of rows) {
      if (m.scrollersY.length) console.log(name.padEnd(20), m.scrollersY.map((s) => `${s.sel} ${s.scrollH}/${s.clientH}`).join(' | '));
      else console.log(name.padEnd(20), '(aucun conteneur overflow-y ; de.scrollHeight =', m.deScrollH, ')');
    }
  }
  console.log(`\n--- ② rognage REEL a ${width} px (clipper / self-clip / retour ligne) ---`);
  let n = 0;
  for (const [name, m] of rows) {
    for (const a of m.reallyClipped) {
      n++;
      console.log(`${name.padEnd(20)} "${a.text}" ${a.fs}px ${a.inCard ? '[kpi-card]' : '[HORS]'} nat=${a.natWidth} boite=${a.ownWidth} lignes=${a.lines} clipper=${a.clipper ?? 'aucun'}`);
    }
  }
  if (!n) console.log('(aucun rognage reel)');
  console.log(`\n--- depassement de boite parente sans rognage, hors .kpi-card ---`);
  for (const [name, m] of rows) {
    for (const a of m.outside) console.log(`${name.padEnd(20)} ${(a.fill * 100).toFixed(0)}% "${a.text}" nat=${a.natWidth} dans ${a.avail}px parent=${a.parent}`);
  }
}
await browser.close();
