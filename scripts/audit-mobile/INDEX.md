# scripts/audit-mobile — outillage de mesure mobile A56

Scripts de la mesure « AVANT / APRÈS » de `docs/audits/AUDIT_MOBILE_A56.md` (lots 1.0 et 1.5
du plan V3). Ils émulent un Samsung Galaxy A56 (412 × 915 dip, DPR 2,625) sous le Chrome
installé localement.

## Pourquoi les dépendances ne sont pas dans `package.json`

`puppeteer-core` et `lighthouse` ne servent qu'à la mesure et ne doivent pas alourdir le
projet. Ils s'installent dans un dossier jetable, hors du dépôt. `puppeteer-core` — et non
`puppeteer` — pour réutiliser le Chrome déjà présent sur la machine sans télécharger un
second binaire.

## Rejouer la mesure

```bash
# 1. Outillage (hors dépôt, à refaire après un nettoyage de /tmp)
mkdir -p /tmp/a56-tools && cd /tmp/a56-tools
echo '{"name":"a56-tools","private":true,"type":"module"}' > package.json
npm install --no-save puppeteer-core lighthouse

# 2. Build + serveur, depuis la racine du dépôt
npx vite build --outDir /tmp/dist-a56 --emptyOutDir
npx vite preview --outDir /tmp/dist-a56 --port 4173 --strictPort &

# 3. Mesures (copier les scripts à côté de leurs dépendances)
cp scripts/audit-mobile/*.mjs /tmp/a56-tools/ && cd /tmp/a56-tools
node audit.mjs    <dossier-captures>   # Lighthouse + métriques DOM
node shots.mjs    <dossier-captures>   # captures pleine hauteur
node measures.mjs                      # métriques de mise en page
node crops.mjs                         # vignettes écran par écran, pour lecture
```

`<dossier-captures>` : `docs/audits/captures/avant/` au lot 1.0,
`docs/audits/captures/apres/` au lot 1.5.

## Ce que produit chaque script

| Script | Sortie |
|---|---|
| `audit.mjs` | `/tmp/a56-lh/<page>.json` (rapports Lighthouse), `summary.json`, `dom-metrics.json`, captures |
| `shots.mjs` | Captures pleine hauteur — le défilement est dans un `<main>` interne, pas sur `<html>`, d'où l'agrandissement du viewport |
| `measures.mjs` | `/tmp/a56-lh/layout-metrics.json` — hauteur d'en-tête, `BottomNav`, largeur des cartes KPI, libellés SVG tronqués |
| `crops.mjs` | `/tmp/a56-crops/` — vignettes 412 × 915 par écran, pour l'analyse visuelle |
| `check-hscroll.mjs` | Vérification ciblée du lot 1.3 — défilement horizontal et cibles tactiles, sans Lighthouse |
| `check-kpi.mjs` | Vérification ciblée du lot 1.4 — **taux de remplissage** des cartes KPI, contrôle de peuplement, scan générique des gros montants hors composant |
| `diag-kpi.mjs` | Diagnostic du lot 1.4 — rognage **réel** (ascendant `overflow:hidden`, `scrollWidth`, retour à la ligne), conteneur de défilement, passe multi-largeurs (`WIDTHS=412,360`) |
| `check-svg-overflow.mjs` | Lot 1.5 — lève de doute sur l'alerte `hScrollAny` : distingue un débordement SVG **réel** (le texte sort de l'aire du graphique / de l'écran) d'un artefact de `clientWidth` sur élément SVG |
| `check-measures.mjs` | Lot 1.5 — vérification ③ appliquée à `measures.mjs` : mesure `header`, `nav` et cartes KPI par sélecteurs explicites, et compare état **déplié** / **replié** de l'en-tête |
| `check-tiny-trunc.mjs` | Lot 1.5 — ventile `tinyTextCount` par origine (SVG / HTML, taille, contenu) et sépare les libellés SVG **réellement tronqués** de ceux dont le nom contient « … » |
| `check-a11y.mjs` | Lot 1.6 — **vérification ① des 3 familles d'audits d'accessibilité**. Ne mesure rien : dépouille les rapports bruts `/tmp/a56-lh/<page>.json` déjà produits par `audit.mjs`, et ventile par nœud, par sélecteur et — pour `color-contrast` — par **couple de couleurs**, avec ratio mesuré, seuil exigé, taille et graisse. C'est le regroupement par couple qui dit combien de tokens sont en cause, là où le nombre de nœuds ne dit que combien de fois ils servent |

### Lire `check-kpi.mjs` sans se tromper

Deux pièges y sont désamorcés, et ils valent pour tout nouvel indicateur :

1. **Le débordement ne détecte pas les montants trop longs.** La valeur d'une carte KPI
   est un `<div>` de flux normal : quand le montant ne tient pas, il passe à la ligne au
   lieu de déborder, et `scrollWidth` reste égal à `clientWidth`. D'où la mesure par
   **taux de remplissage** (largeur naturelle du texte / largeur utile du conteneur).
2. **`getClientRects()` renvoie un rect par nœud texte, pas par ligne.** `{valeur} %` en
   JSX produit deux nœuds sur une même ligne. Compter les rects revient à annoncer des
   retours à la ligne inexistants — c'est arrivé au lot 1.4, un correctif a été écrit puis
   retiré. Les lignes réelles se comptent en **ordonnées distinctes**.

## Points d'attention

### ⚠️ Ces scripts mentent plus souvent que le code qu'ils mesurent

Trois lots consécutifs ont trouvé un indicateur en panne. **Avant d'exploiter une sortie,
vérifier qu'elle porte encore sur ce qu'elle prétend mesurer.** Pannes connues à ce jour :

| Script | Sortie | Panne | Corrigé |
|---|---|---|---|
| `audit.mjs` | `fullHeight` | Visait `documentElement`, devenu la hauteur d'écran depuis le `main` en `overflow-y-auto` du lot 1.1 — **915 px sur les 9 pages** | Lot 1.4 |
| `audit.mjs` | `hScrollZones` | **Aveugle par construction** : exige `overflow-x ∈ {auto,scroll}`. Le lot 1.3 ayant supprimé ces conteneurs, l'indicateur tombe à 0 quand l'élément **disparaît**, pas quand le contenu tient | Lot 1.5 — miroir `hScrollAny` ajouté à côté, sans remplacer l'original |
| `measures.mjs` | `navBottomGap` | `querySelector('nav')` retourne la **sous-nav à pills**, pas la `BottomNav` — 600 px sur 7 pages | ⬜ Non corrigé, contourné par `check-measures.mjs` |
| `measures.mjs` | `kpiCardW` / `kpiCount` | Heuristique exigeant `/rounded/` dans le `className` : caduque depuis que `.kpi-card` est une classe `@apply`. **`null` et `0` sur 8 pages sur 9** | ⬜ Non corrigé, contourné par `check-measures.mjs` |
| `measures.mjs` | `headerH` | Mesure toujours l'en-tête **déplié** : chaque page Puppeteer est une session neuve, `sessionStorage` vide, filtres dépliés par arbitrage du 29/07 | ⬜ Non corrigé, contourné par `check-measures.mjs` |
| `audit.mjs` | **captures** | `fullPage: true` vise le document, or le contenu défile dans `main` : **2 402 px sur les 9 pages**, un écran exact. Utiliser `shots.mjs` pour toute capture pleine hauteur | ⬜ Non corrigé — `shots.mjs` fait le travail |
| `check-kpi.mjs` | comptage des lignes | `getClientRects()` renvoie un rect **par nœud texte**, pas par ligne | Lot 1.4 |
| `measures.mjs` | `deviceScaleFactor` | Valait **2**, contre 2,625 dans `audit.mjs` et `check-measures.mjs` : les mesures n'étaient pas prises sur le même appareil émulé | Lot 1.6 |
| `measures.mjs` | `svgTrunc` | Comptait comme tronqué tout libellé contenant « … », y compris les 3 catégories qui en portent **dans leur nom** (« Autres (Amendes, …) ») : 8 annoncés pour 5 réels sur Dépenses | Lot 1.6 — une troncature Recharts **termine** la chaîne ; `svgTrunc` (réels) et `svgTruncBrut` rendus côte à côte |
| `audit.mjs` | `hScrollAny` | Compte les contenus **volontairement clippés** : le motif `sr-only` réduit la boîte à 1 × 1 px, donc `scrollWidth − clientWidth` y vaut la largeur entière du texte. **4 nœuds / 233 px sur Prêt immobilier**, zéro pixel peint | Lot 1.6 — miroir `hScrollAnyVisible` ajouté **à côté**, sur critère structurel (boîte ≤ 2 px ET `clip`/`clip-path` actif). L'original reste inchangé |

| `parseExcel.worker.test.ts` | classeur de test | **Un classeur dont les dates sont écrites depuis un objet `Date` ne reproduit pas le décalage J-1** : l'écriture et la lecture appliquent toutes deux le fuseau local et s'annulent. Le premier jeu de tests du lot 2.0 passait **intégralement avec le code fautif** | Lot 2.0 — dates écrites en **séries numériques**, comme Excel les écrit |
| `parseExcel.worker.test.ts` | assertion sur les espaces | Un **espace insécable littéral** dans le source est invisible à la relecture : l'assertion passait pour une raison autre que celle annoncée | Lot 2.0 — réécrit en `\u00A0` |
| suite de tests | dates | Les tests de date passaient **sous `TZ=UTC` même avec le code fautif** : le défaut ne se manifeste qu'en fuseau à décalage positif | Lot 2.0 — `env: { TZ: "Europe/Paris" }` épinglé dans `vitest.config.ts` |

**Un quatrième mode de panne, découvert au lot 2.0 : l'instrument est écrit par
celui qui cherche le défaut, et il hérite de son angle mort.** Les trois pannes
ci-dessus ne viennent pas du code mesuré ni d'un DOM qui a changé : elles
viennent du **jeu d'essai**, construit par commodité plutôt que d'après la
réalité du fichier que l'application reçoit. Aucune n'a été vue à la relecture.
**Seul le contrôle de mutation les a révélées** — réintroduire le défaut et
vérifier que les tests tombent est le seul moyen de savoir s'ils mesurent quoi
que ce soit.

**Un troisième mode de panne, découvert au lot 1.6 : l'indicateur est juste, c'est le DOM
qui a changé sous lui.** Les six pannes ci-dessus venaient toutes d'un sélecteur devenu
faux. Celle de `hScrollAny` est différente : le code mesuré a gagné des nœuds `sr-only`
que l'instrument, écrit avant eux, ne pouvait pas prévoir. **Tout ce qu'un lot ajoute au
DOM est susceptible d'être compté par un indicateur écrit avant lui** — la revue
d'indicateurs est donc due en SORTIE de lot autant qu'en entrée.

**Deux signaux à traiter comme des alertes :**

1. **Un indicateur qui rend la même valeur sur les 9 pages** — sauf si cette constance est
   sa nature (`scrollerViewport` = 669 px est légitime, `headerH` = 246 px ne l'était pas).
2. **Un indicateur tombé pile sur la valeur espérée après un lot** — vérifier qu'il mesure
   encore, et non que sa cible a disparu du DOM.

### Contrôle d'équivalence des deux parseurs

`scripts/check-import-equivalence.mjs` — **hors `audit-mobile/`, mais du même
esprit.** Le projet lit le classeur Excel de deux façons : le worker du
navigateur (TypeScript) et le parseur du skill `l'outil de mise à jour des données`
(Python). Le 11/08/2026, les deux avaient divergé depuis deux semaines sans
qu'aucun test, lint ou audit ne le signale — le worker produisait des données
fausses sur les neuf pages.

    TZ=Europe/Paris node scripts/check-import-equivalence.mjs "data/Budget_demo.xlsx"

Transpile le worker réel (il ne le réécrit pas), l'exécute sur le classeur,
et compare sa sortie à `public/data/transactions.json` champ par champ. Code de
sortie 0 si les deux tuyaux concordent. **À lancer après toute modification de
l'un des deux parseurs.** Contrôle négatif vérifié : avec le défaut réintroduit,
0 % de concordance et 21 crédits au lieu de 136.

⚠️ Le fuseau importe : sous `TZ=UTC`, le défaut de date est invisible et le
contrôle passe au vert à tort.

### Divers

- **`fullHeight` d'`audit.mjs` a été corrigé au lot 1.4.** Il relevait
  `documentElement.scrollHeight`, juste au lot 1.0 mais devenu la simple hauteur d'écran
  depuis que le lot 1.1 a introduit un `main` en `overflow-y-auto` — 915 px sur les
  9 pages. Il vise désormais le conteneur qui défile réellement. `shots.mjs` documentait
  déjà ce `<main>` interne ; l'information n'avait jamais été reportée sur `audit.mjs`.
- Une seule instance de Chrome ne survit pas toujours à deux passes de 9 pages
  (`Target.createTarget: Session with given id not found`) : lancer `diag-kpi.mjs` une
  largeur à la fois via `WIDTHS=360`.
- `NODE_ENV` doit valoir `test` pour la suite (`NODE_ENV=test node
  node_modules/vitest/dist/cli.js run`) : en `production`, React désactive `act()` et
  les 320 tests tombent d'un bloc.
- Le chemin de Chrome est en dur (`/Applications/Google Chrome.app/…`) : à adapter hors macOS.
- `vite preview` doit tourner **avant** les scripts, sur le port 4173.
- Les rapports Lighthouse bruts ne sont pas versionnés ; seules les captures et
  `AUDIT_MOBILE_A56.md` le sont.
- Pour que la comparaison des lots 1.5 et 1.6 soit valable, rejouer sur la **même machine**.
- **Ne jamais réparer un indicateur en le remplaçant.** Trois fois maintenant
  (`hScrollZones` au 1.5, `kpiCardW` et `hScrollAny` au 1.6), le bon geste a été d'ajouter
  un compteur à côté et de laisser l'original répondre à sa propre question. Un indicateur
  remplacé casse la comparaison avec les lots antérieurs ; un indicateur doublé, non.
- **Identifier un élément par son style CALCULÉ, pas par sa chaîne de classes.** C'est ce
  qui a tué `kpiCardW` (`/rounded/` disparu avec le passage en `@apply`). La `BottomNav`
  est désormais retrouvée par `position: fixed` calculé — un renommage Tailwind ne peut
  plus la faire disparaître.
