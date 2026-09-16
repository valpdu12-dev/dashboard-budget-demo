# `vendor/` — bibliothèques recopiées dans le dépôt

## Pourquoi un binaire est versionné ici

SheetJS ne publie plus sur le registre npm. La dernière version qui s'y trouve
est la **0.18.5**, et SheetJS le dit lui-même : *« the registry is out of date…
This is a known registry bug »*. La source qui fait foi est
`https://cdn.sheetjs.com/`.

Deux façons d'installer depuis ce CDN :

- **par URL** — le `package-lock.json` pointe vers `cdn.sheetjs.com`, et chaque
  installation, y compris celle de l'intégration continue, dépend de la
  disponibilité de cette infrastructure ;
- **en recopiant le tarball ici** — l'installation ne sort plus du dépôt.

C'est la seconde qui est retenue, et c'est celle que SheetJS recommande :
*« making a local copy of SheetJS modules ("vendoring") is strongly
recommended. Vendoring decouples projects from SheetJS infrastructure. »*

C'est la même discipline que pour les polices
(`src/assets/fonts/PROVENANCE.md`) : ce dont le projet dépend est dans le
projet, avec sa source écrite.

## Ce qui est ici

| Fichier | Version | Taille | Source | Consulté le |
|---|---|---|---|---|
| `xlsx-0.20.3.tgz` | 0.20.3 | 2 409 319 o | `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | 16/09/2026 |

Empreinte SHA-256 dans `EMPREINTES.txt`, au format exact de
`shasum -a 256`.

## Le garde-fou

La liste noire du contrôle de publication ne sait lire que du texte : un
binaire lui échappe. Laisser passer un fichier illisible sans rien vérifier
ouvrirait le trou que ce contrôle existe pour fermer.

`scripts/verifier-publication.mjs` **recalcule donc l'empreinte** de chaque
fichier de `vendor/` et la compare à `EMPREINTES.txt`. Un fichier sans
empreinte déclarée, une empreinte qui a bougé d'un octet, ou une empreinte
déclarée pour un fichier disparu : la publication est bloquée.

Le contrôle prouve que le tarball publié est bien celui qui a été téléchargé.
Il ne prouve pas que SheetJS a publié un fichier sain — c'est une question de
confiance dans l'éditeur, que le hachage ne remplace pas.

## Mettre à jour SheetJS

Depuis `DEMO/`, une commande par ligne :

```
curl -L -o vendor/xlsx-NOUVELLE.tgz https://cdn.sheetjs.com/xlsx-NOUVELLE/xlsx-NOUVELLE.tgz
```

```
shasum -a 256 vendor/xlsx-NOUVELLE.tgz > vendor/EMPREINTES.txt
```

```
npm rm --save xlsx
```

```
npm i --save file:vendor/xlsx-NOUVELLE.tgz
```

```
rm vendor/xlsx-ANCIENNE.tgz
```

```
npm run check
```

Puis remplacer la ligne du tableau ci-dessus. Le contrôle refuse de passer tant
que `EMPREINTES.txt` et le contenu de `vendor/` ne coïncident pas exactement —
c'est ce qui empêche d'oublier une des étapes.

## Licence

SheetJS Community Edition, licence Apache-2.0. Elle voyage dans le tarball.
