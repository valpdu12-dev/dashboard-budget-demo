# Limites du paramétrage — état au lot A

*Écrit au lot A.2. À relire au lot C, qui est censé lever ces limites.*

## Ce que le lot A a fait

Les noms de comptes, d'organismes et d'employeurs ne sont plus recopiés dans
sept fichiers. Ils vivent dans **`src/config/accounts.ts`**, source unique.

Chaque compte y est déclaré avec **deux champs distincts** :

| Champ | Rôle | Change ? |
|---|---|---|
| `id` | identifiant, jamais affiché | jamais |
| `libelle` | ce que l'utilisateur voit | oui, au lot C |

Aujourd'hui le reste du code n'utilise que `libelle` — et s'en sert aussi
comme **clé** : clé de solde, clé de couleur, clé d'icône, clé de série de
graphique. C'est pour cela que renommer un compte oblige encore à un
remplacement global. Les deux champs sont déjà séparés pour que le lot C
n'ait plus qu'à changer les consommateurs.

## Ce que le lot A n'a PAS fait

**Les comptes ne viennent pas du fichier source.** Ils sont écrits dans
`accounts.ts`. Un utilisateur qui importerait un classeur avec ses propres
comptes ne les verrait pas apparaître. C'est le lot C.

**Les règles de solde restent écrites compte par compte.**
`src/hooks/useBalances.ts` applique une suite de conditions nommées :

- `Banque A - Courant` reçoit ses propres crédits et débits ;
- `Banque A - Part commune` et `Appli partagée - Part commune` retirent
  leurs débits de `Banque A - Courant` ;
- `Banque B - Compte joint` et `Banque C - Compte joint` retirent leurs
  crédits de `Banque A - Courant`, sauf pour le type `Virement extérieur`.

Ajouter un compte à `accounts.ts` **ne lui donne pas de solde**. Il sera
initialisé à zéro, absent du graphique, et **absent du total** — sans erreur
et sans message. C'est la limite la plus dangereuse de cet état, parce
qu'elle est silencieuse.

Le lot C remplace ces règles par deux notions générales, déjà décidées au
plan V3 : un **taux de participation** (50 %, 30 %…) et un **compte lié**.

## Ce qui, en revanche, encaisse le changement

Depuis le lot A.2, ces trois points ne cassent plus au-delà du jeu de
démonstration :

| Point | Avant | Après |
|---|---|---|
| Couleur d'un organisme inconnu | `undefined` → trait invisible | couleur de repli stable |
| Couleur d'un compte inconnu | `undefined` → pastille transparente | couleur de repli stable |
| Couleur d'un employeur inconnu | `undefined` sur la carte KPI | couleur de repli stable |
| Type `Organisme` | liste figée de 4 valeurs | chaîne libre |
| Icône d'un compte inconnu | trou dans la carte | icône générique |

Vérifié par `src/__tests__/config/couleurs.test.ts` : **6 organismes** et
**30 employeurs** reçoivent tous une couleur définie, et la même à chaque
rendu.

Ces trois trous n'avaient jamais été vus parce que le jeu de données réel
contenait exactement 4 organismes et 5 employeurs — précisément le contenu
des tables de couleurs.

## Résumé en une phrase

L'application **encaisse** aujourd'hui plus de comptes, d'organismes et
d'employeurs sans rien casser à l'affichage ; elle ne sait toujours pas
**calculer un solde** pour un compte qu'elle ne connaît pas.
