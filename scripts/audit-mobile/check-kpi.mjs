// Verification ciblee du lot 1.4 — densite des cartes KPI.
//
// POURQUOI CE SCRIPT EXISTE
// `audit.mjs` ne mesure que 6 indicateurs DOM : hScrollZones, hScrollWorst,
// tinyTextCount, tinyTextMin, smallTargets, fullHeight. AUCUN ne porte sur la
// largeur d'une carte KPI ni sur un montant coupe. Le lot 1.4 etait donc le
// seul des lots 1.1 a 1.4 sans indicateur chiffrable. Ce script en cree un.
//
// CE QU'IL MESURE, ET POURQUOI PAS `scrollWidth > clientWidth`
// Le premier reflexe — reprendre le critere de debordement d'`audit.mjs` — ne
// marche pas ici. La valeur d'une carte KPI est un <div> de flux normal, sans
// `whitespace-nowrap` ni `truncate` : quand le montant ne tient pas, il
// **passe a la ligne** au lieu de deborder. `scrollWidth` reste alors egal a
// `clientWidth` et l'indicateur resterait desesperement a zero alors que la
// carte est visuellement cassee.
//
// La mesure retenue est donc le TAUX DE REMPLISSAGE : largeur naturelle du
// texte sur une seule ligne (somme des rects d'un Range, qui restent separes
// par ligne apres un retour) rapportee a la largeur utile du conteneur.
//   fill >= 1,00  -> le montant ne tient pas : retour a la ligne ou coupe
//   fill >= 0,90  -> sature : colle aux bords, plus aucune marge
//   fill <  0,90  -> confortable
// C'est exactement la nuance de l'audit § 5 : « le seuil de rupture est
// atteint, pas depasse ».
//
// DEUX FAMILLES SCANNEES, POUR NE PAS REPETER LE PIEGE DU LOT 1.3
// Au lot 1.3 le composant nomme au plan ne portait que 4 des 6 cas. Ici le
// scan ne se limite donc pas a `.kpi-card` : une seconde passe generique
// releve TOUT montant affiche en gros (police >= 16 px, texte ressemblant a
// un montant ou un pourcentage), quel que soit le composant qui le rend.
// Elle attrape notamment la grille 2 colonnes ecrite a la main de
// `Salaire.tsx:252`, que `KPICard` ne couvre pas.
//
// CONTROLE DE PEUPLEMENT (constat n° 4 du lot 1.3)
// Une page vide ne deborde pas non plus, et ses cartes ne saturent pas. Le
// script compte les cartes reellement peuplees et celles rendues a « — » :
// sans ce garde-fou, un repli silencieux sur `public/data/*.json` produirait
// un excellent resultat pour la mauvaise raison.
//
// Prerequis identiques a audit.mjs : deps dans /tmp/a56-tools, Chrome macOS,
// build servi par `vite preview` sur localhost:4173 (origine autorisee par le
// CORS du Worker — les donnees sont donc completes, cf. constat n° 5).
//
//   npx vite build --outDir /tmp/dist-lot14
//   npx vite preview --port 4173 --outDir /tmp/dist-lot14
//   node /tmp/a56-tools/check-kpi.mjs
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const A56 = { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, isLandscape: false };
const UA_A56 = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// Les 9 routes de audit.mjs.
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
  await new Promise((r) => setTimeout(r, 1800)); // meme attente que audit.mjs

  const m = await page.evaluate(() => {
    // Largeur naturelle du texte sur une seule ligne. Un Range pose sur le
    // contenu renvoie un rect PAR ligne : leur somme redonne la largeur que
    // le texte occuperait sans retour, meme apres un retour effectif.
    // ATTENTION — piege verifie a l'usage. `getClientRects()` renvoie un rect
    // par NŒUD TEXTE, pas par ligne : `{valeur} %` en JSX produit deux nœuds
    // (« 2,2 » et « % ») et donc deux rects, alignes sur la meme ligne. Compter
    // les rects revenait a annoncer un retour a la ligne inexistant. Le nombre
    // de lignes reelles se lit sur le nombre d'ORDONNEES distinctes.
    const naturalTextWidth = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()];
      range.detach?.();
      if (!rects.length) return { width: 0, lines: 0 };
      const tops = new Set(rects.map((r) => Math.round(r.top)));
      return { width: rects.reduce((s, r) => s + r.width, 0), lines: tops.size };
    };

    // Largeur utile d'un conteneur = largeur de contenu, padding deduit.
    const contentWidth = (el) => {
      const cs = getComputedStyle(el);
      return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    };

    const round = (n) => Math.round(n * 100) / 100;

    // ---------- Famille 1 : les cartes .kpi-card ----------
    const cards = [...document.querySelectorAll('.kpi-card')];
    const cardStats = cards.map((card) => {
      const r = card.getBoundingClientRect();
      const avail = contentWidth(card);
      // La valeur est le <div> en text-xl : police la plus grosse de la carte.
      const candidates = [...card.querySelectorAll('div')].filter((d) => d.children.length === 0 && d.textContent.trim());
      let valueEl = null;
      let maxFs = 0;
      for (const d of candidates) {
        const fs = parseFloat(getComputedStyle(d).fontSize);
        if (fs > maxFs) { maxFs = fs; valueEl = d; }
      }
      const label = card.querySelector('span:last-of-type')?.textContent.trim() ?? '';
      if (!valueEl) return { label, cardWidth: round(r.width), avail: round(avail), text: '', fill: 0, lines: 0, fontSize: 0 };
      const nat = naturalTextWidth(valueEl);
      return {
        label,
        cardWidth: round(r.width),
        avail: round(avail),
        text: valueEl.textContent.trim(),
        fontSize: maxFs,
        lines: nat.lines,
        fill: avail > 0 ? round(nat.width / avail) : 0,
      };
    });

    // ---------- Famille 2 : scan generique de TOUT gros montant ----------
    // Ne depend d'aucun composant : police >= 16 px, feuille, texte qui
    // ressemble a un montant, un pourcentage ou une forme abregee.
    const MONEY = /(\d[\d   ]*[,.]\d+\s*[€%])|(\d[\d   ]*\s*(k€|M€))|(\d[\d   ]*\s*%)/;
    const bigAmounts = [...document.querySelectorAll('*')]
      .filter((el) => {
        if (el.children.length !== 0) return false;
        const t = el.textContent.trim();
        if (!t || !MONEY.test(t)) return false;
        return parseFloat(getComputedStyle(el).fontSize) >= 16;
      })
      .map((el) => {
        const parent = el.parentElement;
        const avail = parent ? contentWidth(parent) : el.clientWidth;
        const nat = naturalTextWidth(el);
        return {
          text: el.textContent.trim(),
          inKpiCard: !!el.closest('.kpi-card'),
          fontSize: parseFloat(getComputedStyle(el).fontSize),
          avail: round(avail),
          lines: nat.lines,
          fill: avail > 0 ? round(nat.width / avail) : 0,
        };
      });

    // ---------- Controle de peuplement (constat n° 4 du lot 1.3) ----------
    const empty = cardStats.filter((c) => !c.text || c.text === '—' || c.text === '-').length;

    return {
      cardCount: cards.length,
      emptyCards: empty,
      minCardWidth: cards.length ? Math.min(...cardStats.map((c) => c.cardWidth)) : null,
      minAvail: cards.length ? Math.min(...cardStats.map((c) => c.avail)) : null,
      maxFill: cardStats.length ? Math.max(...cardStats.map((c) => c.fill)) : 0,
      saturated: cardStats.filter((c) => c.fill >= 0.9).length,
      broken: cardStats.filter((c) => c.fill >= 1 || c.lines > 1).length,
      worstCards: cardStats.sort((a, b) => b.fill - a.fill).slice(0, 4),
      bigCount: bigAmounts.length,
      bigOutsideCards: bigAmounts.filter((b) => !b.inKpiCard).length,
      bigWorst: bigAmounts.sort((a, b) => b.fill - a.fill).slice(0, 4),
      docHeight: document.documentElement.scrollHeight,
    };
  });
  await page.close();
  rows.push([name, m]);
}
await browser.close();

const pct = (f) => (f * 100).toFixed(0) + '%';

console.log('\n== Famille 1 : cartes .kpi-card ==');
console.log('Page                 Cartes  Vides  LargMini  UtileMini  RemplMax  Satures  Casses  Hauteur');
console.log('-'.repeat(100));
for (const [name, m] of rows) {
  console.log(
    name.padEnd(20),
    String(m.cardCount).padStart(6),
    String(m.emptyCards).padStart(6),
    String(m.minCardWidth ?? '-').padStart(9),
    String(m.minAvail ?? '-').padStart(10),
    pct(m.maxFill).padStart(9),
    String(m.saturated).padStart(8),
    String(m.broken).padStart(7),
    String(m.docHeight + 'px').padStart(9)
  );
  for (const c of m.worstCards) {
    if (c.fill >= 0.85) console.log(`     ${pct(c.fill).padStart(4)} "${c.text}" (${c.fontSize}px, ${c.lines} ligne(s)) dans ${c.avail}px — ${c.label}`);
  }
}

console.log('\n== Famille 2 : scan generique des gros montants (hors composant) ==');
console.log('Page                 Total  HorsCartes  Pires');
console.log('-'.repeat(100));
for (const [name, m] of rows) {
  console.log(name.padEnd(20), String(m.bigCount).padStart(5), String(m.bigOutsideCards).padStart(11));
  for (const b of m.bigWorst) {
    if (b.fill >= 0.85) console.log(`     ${pct(b.fill).padStart(4)} "${b.text}" (${b.fontSize}px, ${b.lines} ligne(s)) dans ${b.avail}px ${b.inKpiCard ? '[kpi-card]' : '[HORS kpi-card]'}`);
  }
}

console.log('\n== Synthese ==');
const totalCards = rows.reduce((s, [, m]) => s + m.cardCount, 0);
const totalEmpty = rows.reduce((s, [, m]) => s + m.emptyCards, 0);
const totalSat = rows.reduce((s, [, m]) => s + m.saturated, 0);
const totalBroken = rows.reduce((s, [, m]) => s + m.broken, 0);
const totalOutside = rows.reduce((s, [, m]) => s + m.bigOutsideCards, 0);
const minW = Math.min(...rows.filter(([, m]) => m.minCardWidth).map(([, m]) => m.minCardWidth));
const totalH = rows.reduce((s, [, m]) => s + m.docHeight, 0);
console.log(`Cartes KPI rendues            : ${totalCards}  (dont ${totalEmpty} a « — » — controle de peuplement)`);
console.log(`Largeur de carte minimale     : ${minW} px`);
console.log(`Valeurs saturees (>= 90%)     : ${totalSat}`);
console.log(`Valeurs cassees (>= 100% / 2 lignes) : ${totalBroken}`);
console.log(`Gros montants hors .kpi-card  : ${totalOutside}  (perimetre que KPICard ne couvre pas)`);
console.log(`Hauteur cumulee des 9 pages   : ${totalH} px  (temoin : ne doit pas augmenter)`);
