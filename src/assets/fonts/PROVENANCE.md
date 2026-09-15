# Polices embarquées

Les deux familles sont **servies par le site**, jamais par un tiers.
`index.html` ne charge plus rien depuis Google Fonts : sans cela, chaque
visiteur enverrait son adresse IP à un serveur qui n'est pas le nôtre, et la
promesse « aucun service tiers » serait fausse.

| Fichier | Famille | Licence |
|---|---|---|
| `dm-sans-latin-wght-normal.woff2` | DM Sans Variable (100→1000) | SIL Open Font License 1.1 |
| `dm-sans-latin-ext-wght-normal.woff2` | DM Sans Variable, latin étendu | SIL OFL 1.1 |
| `ibm-plex-sans-latin-wght-normal.woff2` | IBM Plex Sans Variable (100→700) | SIL OFL 1.1 |
| `ibm-plex-sans-latin-ext-wght-normal.woff2` | IBM Plex Sans Variable, latin étendu | SIL OFL 1.1 |

Textes de licence : `LICENCE-DM-Sans.txt`, `LICENCE-IBM-Plex-Sans.txt`.

## D'où viennent ces fichiers

Copiés depuis les paquets npm `@fontsource-variable/dm-sans` et
`@fontsource-variable/ibm-plex-sans`, qui redistribuent les fontes officielles.

Les paquets ne sont **pas** conservés en dépendance : ils pèsent environ 2 Mo
à eux deux — toutes langues et toutes variantes — alors que le site n'utilise
que ces quatre fichiers, 132 Ko au total. Les garder ferait payer ce poids à
chaque installation et à chaque exécution de la CI, pour rien.

## Pourquoi des fontes variables

Une seule fonte couvre toutes les graisses (400, 500, 600, 700 pour les
titres ; 300 à 600 pour le texte). Quatre fichiers au lieu de quatorze.

## Pour les remplacer

```bash
npm i -D @fontsource-variable/dm-sans @fontsource-variable/ibm-plex-sans
cp node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin{,-ext}-wght-normal.woff2 src/assets/fonts/
cp node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin{,-ext}-wght-normal.woff2 src/assets/fonts/
npm uninstall @fontsource-variable/dm-sans @fontsource-variable/ibm-plex-sans
```

Les plages `unicode-range` des `@font-face` de `src/index.css` viennent des
feuilles `wght.css` de ces mêmes paquets. Les recopier telles quelles si les
fichiers changent.
