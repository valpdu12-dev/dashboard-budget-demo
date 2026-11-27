# Polices embarquées

Une seule famille : **Inter**, partout. Elle est **servie par le site**, jamais
par un tiers. `index.html` ne charge rien depuis Google Fonts : sans cela, chaque
visiteur enverrait son adresse IP à un serveur qui n'est pas le nôtre, et la
promesse « aucun service tiers » serait fausse.

| Fichier | Famille | Licence |
|---|---|---|
| `inter-latin-wght-normal.woff2` | Inter Variable (100→900) | SIL Open Font License 1.1 |
| `inter-latin-ext-wght-normal.woff2` | Inter Variable, latin étendu | SIL OFL 1.1 |

Texte de licence : `LICENCE-Inter.txt`.

## D'où viennent ces fichiers

Fontes officielles d'Inter, au découpage du paquet npm `@fontsource-variable/inter`
(deux fichiers : latin et latin étendu). Le paquet n'est **pas** gardé en
dépendance : le site n'utilise que ces deux fichiers.

## Pourquoi une fonte variable

Un seul fichier couvre toutes les graisses. Les plages `unicode-range` des
`@font-face` de `src/index.css` séparent le latin du latin étendu : le
navigateur ne télécharge le second que s'il en a besoin.

## Anciennes polices (retirées)

DM Sans (titres) et IBM Plex Sans (texte) ont servi jusqu'au passage au thème
Auto · Jour · Nuit. Plus aucune page ne les utilise.
