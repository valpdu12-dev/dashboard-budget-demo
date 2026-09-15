# `public/` — fichiers statiques

Servis tels quels par Vite, copiés dans `dist/` au build, sans transformation.

> Ce document vivait dans `public/` — il partait donc **dans le site publié**,
> à l'adresse `/INDEX.md`. Une note interne livrée aux visiteurs n'a aucun
> intérêt pour eux et élargit la surface publiée pour rien. Déplacé ici au
> lot A.5. Le contrôle de publication vérifie désormais que `public/` ne
> contient plus que des fichiers destinés au site.

| Fichier / dossier | Rôle |
|---|---|
| `data/transactions.json` | Transactions — jeu de démonstration |
| `data/salary.json` | Salaires — jeu de démonstration |
| `data/config.json` | Soldes de départ, prêt, bornes de couverture |
| `data/budgets.json` | Objectifs de budget livrés avec la démonstration |
| `data/references.json` | Inflation INSEE et SMIC — données publiques réelles, sourcées |
| `manifest.webmanifest` | Manifeste PWA (nom, icônes, couleurs de l'app installable) |
| `sw.js` | Service Worker (cache offline, PWA) |
| `favicon.svg` | Favicon du site |
| `icons/icon-192.svg`, `icons/icon-512.svg` | Icônes PWA (écran d'accueil) |

Les cinq fichiers de `data/` sont **produits** par
`scripts/generate-demo-data.mjs`. Ils ne se modifient pas à la main : toute
correction se fait dans le générateur, puis on le rejoue.
