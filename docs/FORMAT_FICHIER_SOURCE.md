# Format du fichier source — v1

*Lot B, étape B.0. Écrit AVANT le code, validé avant d'être implémenté.*

Ce document décrit le classeur qu'une personne autre que l'auteur peut préparer
pour alimenter le tableau de bord. Il fait contrat : ce qui est écrit ici est ce
que le lecteur acceptera, et rien d'autre ne sera deviné en silence.

Le format de l'auteur — en-têtes en ligne 18, colonnes lues par position,
feuille « Transactions AAAA » — continue de fonctionner, sous forme
d'**adaptateur** (§7). Il n'est pas le format public.

---

## 1. Les principes

**Un fichier `.xlsx`.** Pas de `.xls`, pas de `.csv` en v1.

**Les colonnes sont nommées, pas positionnées.** L'en-tête est en **ligne 1**.
L'ordre des colonnes est libre. Une colonne inconnue est ignorée sans bruit ;
une colonne obligatoire absente arrête la lecture avec son nom.

**Les noms de colonnes sont comparés sans casse ni accents**, et les espaces de
début et de fin sont retirés. « MONTANT », « Montant » et « montant » sont la
même colonne.

**Rien n'est deviné.** Une valeur qu'on ne sait pas lire n'est jamais remplacée
par zéro. La ligne est rejetée et nommée : feuille, ligne, colonne. C'est la
règle la plus importante de ce format, et elle corrige le défaut principal du
lecteur actuel.

**Ce sont les valeurs qui sont lues, pas les formules.** Si une cellule contient
une formule, c'est son résultat enregistré qui est lu. Un classeur enregistré
par LibreOffice ou Excel porte ces résultats ; un fichier produit par un script
qui n'écrit que des formules, non.

---

## 2. Les trois feuilles

| Feuille | Obligatoire | Rôle |
|---|---|---|
| `Transactions` | **oui** | Les mouvements |
| `Paie` | non | Les bulletins de salaire, un par mois |
| `Paramètres` | non, mais recommandée | Soldes de départ, dates de relevé, prêt |

**Toute autre feuille est ignorée**, sans erreur : une feuille de notes, un
brouillon, un mode d'emploi. Le classeur modèle en porte une, nommée
`Lisez-moi`.

Sans `Paie`, les écrans Salaire et Salaire/Inflation **disparaissent de la
navigation** (étape B.4). Ils ne s'affichent pas vides.

Sans bloc Prêt dans `Paramètres`, l'écran Prêt immobilier disparaît de la même
façon.

Sans `Paramètres`, l'outil fonctionne en couverture inférée (régime 2 de
`CONTRAT_COUVERTURE.md`) et les soldes sont « non initialisés » — jamais zéro.

---

## 3. Feuille `Transactions`

En-tête en ligne 1, données à partir de la ligne 2.

| Colonne | Obligatoire | Contenu attendu |
|---|---|---|
| `Date` | **oui** | Date du mouvement |
| `Compte` | **oui** | Nom du compte, texte libre |
| `Type` | **oui** | Nature du mouvement, texte libre |
| `Montant` | **oui** | Nombre **positif**, montant imputé (voir §3.4) |
| `Sens` | **oui** | `Débit` ou `Crédit` |
| `Classe` | oui pour une **dépense** | `Dépense Fixe`, `Dépense Courante` ou `Dépense Occasionnelle` — vide sinon (§3.3) |
| `Catégorie` | non, mais avertie | Poste de budget — c'est le niveau des objectifs (§3.7) |
| `Sous-catégorie` | non | Détail |
| `Détail` | non | Texte libre |
| `Libellé` | non | Libellé bancaire brut |
| `Ville` | non | Texte libre |
| `Prévisionnel` | non | `x` marque une ligne à ignorer (voir §3.5) |

### 3.1 Dates

Trois écritures acceptées :

- une vraie date Excel (cellule au format date) ;
- `AAAA-MM-JJ` ;
- `JJ/MM/AAAA`.

Tout le reste est rejeté avec sa ligne. Une date hors de l'intervalle
1990-2100 est rejetée aussi : c'est presque toujours une cellule décalée.

### 3.2 Montants

Nombre positif. Séparateur décimal point ou virgule. Les espaces, y compris
insécables, et le symbole `€` sont retirés avant lecture. Arrondi à deux
décimales.

Un montant vide, négatif, ou illisible **rejette la ligne**. Il ne devient
jamais 0.

### 3.3 Sens et classe

`Sens` vaut `Débit` ou `Crédit`, sans casse ni accents imposés. `D` et `C` sont
refusés, avec un message qui dit quoi écrire.

**Tous les débits ne sont pas des dépenses.** Un remboursement de capital de
prêt, un virement vers un livret, un transfert entre ses propres comptes sortent
de l'argent sans être une dépense à arbitrer. Leur `Classe` est **vide**, et c'est
une valeur, pas un oubli : elle dit « cette ligne n'entre pas dans la répartition
des dépenses ». L'application fonctionne déjà ainsi — le jeu de démonstration
laisse ces lignes sans classe.

Conséquence : une `Classe` vide sur un débit ne déclenche ni rejet ni
avertissement. On ne peut pas distinguer « j'ai oublié » de « ce n'en est pas
une » sans connaître la nature des types, ce qui est le travail du lot C.

`Classe` n'a de sens que pour un débit. Sur un crédit, elle est **ignorée, et
l'aperçu le dit** : « la classe a été ignorée sur 4 lignes de recette ». Un salaire
n'est pas une dépense fixe ; laisser croire le contraire sans rien dire est le genre
de silence que ce format existe pour supprimer.

Le lecteur actuel **calcule** ces deux informations à partir d'une liste de
libellés de types qui sont ceux de l'auteur. C'est précisément ce qui rend ce
lecteur inutilisable par quelqu'un d'autre : un type inconnu devient « Débit »
et « Dépense Occasionnelle », en silence. Dans le format public, c'est le
fichier qui le déclare.

### 3.4 Le montant est le montant **imputé**

Si une dépense de 80 € est partagée à moitié, le fichier porte **40**.

L'outil ne sait pas encore appliquer un taux de participation : c'est le lot C.
Écrire 80 en attendant que l'outil divise donnerait un budget faux, sans aucun
message.

### 3.5 Lignes ignorées

Une ligne est ignorée, sans être une erreur, dans trois cas :

- elle est entièrement vide ;
- la colonne `Prévisionnel` vaut `x` — c'est une prévision, pas un mouvement
  constaté ;
- `Date`, `Compte` et `Montant` sont tous les trois vides.

Le nombre de lignes ignorées est affiché dans l'aperçu. Ignoré n'est pas
silencieux.

### 3.7 Dépenses sans catégorie de budget

Une dépense dont la colonne `Catégorie` est vide est **acceptée**. Elle compte
dans les dépenses, dans les soldes et dans les totaux.

Elle n'entre pas, en revanche, dans l'écran Budget mensuel : les objectifs se
posent à ce niveau, et une dépense sans poste n'a rien à comparer. L'aperçu
l'annonce, chiffré : « 37 dépenses sans catégorie — elles n'apparaîtront pas dans
l'écran Budget mensuel ».

Refuser ces lignes rendrait le premier fichier bien plus long à produire, pour
un renseignement que la personne peut compléter plus tard.

### 3.6 Plusieurs feuilles annuelles

`Transactions 2025`, `Transactions 2026` sont acceptées **en plus** de
`Transactions`, et **agrégées**. C'est le cas du classeur de l'auteur.

Une ligne strictement identique à une autre (même date, même compte, même type,
même montant, même libellé) est rejetée comme doublon, avec les deux
emplacements. Deux achats identiques le même jour dans le même magasin existent :
pour les garder tous les deux, il faut les différencier par le libellé.

---

## 4. Feuille `Paie`

Une ligne par mois. En-tête en ligne 1.

| Colonne | Obligatoire | Contenu |
|---|---|---|
| `Mois` | **oui** | `AAAA-MM`, ou une date — seul le mois est retenu |
| `Employeur` | **oui** | Texte libre |
| `Brut` | **oui** | Nombre positif |
| `Cotisations salariales` | **oui** | Nombre positif |
| `Indemnités` | non | Nombre positif, 0 si absent |
| `Autres retenues` | non | Nombre positif, 0 si absent |
| `Net` | non | Voir ci-dessous |

**Le net est calculé** : `Brut − Cotisations salariales + Indemnités − Autres
retenues`. C'est déjà la formule de l'application.

Si la colonne `Net` est présente, elle n'est pas utilisée pour le calcul : elle
sert de **contrôle**. Un écart de plus de 1 € produit un avertissement nommé,
pas un rejet. Une valeur affichée qui ne vient pas d'un calcul vérifiable serait
un retour en arrière.

Deux lignes pour le même mois : **rejet** des deux, avec leurs emplacements. Un
mois de paie n'a pas de raison d'apparaître deux fois, et additionner en silence
doublerait le salaire.

**Limite assumée du format simple.** Les deux graphiques de détail des
cotisations (part salariale, part patronale) ont besoin d'une ligne par ligne de
bulletin. Le format public ne les fournit pas. Ces deux graphiques afficheront
un message qui l'explique — pas des tirets muets. L'adaptateur de l'ancien
format, lui, continue de les alimenter.

---

## 5. Feuille `Paramètres`

Deux petits tableaux. Chacun est **repéré par sa cellule d'en-tête**, où qu'elle
se trouve sur la feuille : la position exacte n'est pas imposée.

### 5.1 Tableau « Paramètre / Valeur »

En-têtes : `Paramètre` et `Valeur`.

| Paramètre | Valeur attendue | Obligatoire |
|---|---|---|
| `Version du format` | `1` | non — absent = v1 |
| `Début de relevé` | date | non |
| `Fin de relevé` | date | non |
| `Prêt — montant` | nombre | non |
| `Prêt — mensualité` | nombre | non |
| `Prêt — nombre d'échéances` | entier | non |
| `Prêt — première échéance` | `AAAA-MM` | non |

**Début et fin de relevé** alimentent le **régime 1** de la couverture
temporelle : la source déclare ce qu'elle couvre, et on la croit. Les mois de
bord entiers sont alors conservés, au lieu d'être écartés par précaution. Règle
complète dans `CONTRAT_COUVERTURE.md`.

Déclarer l'un sans l'autre est refusé : une borne seule ne définit rien.
Une fin antérieure au début est refusée.

**Le bloc Prêt est tout ou rien.** Montant, mensualité et nombre d'échéances
doivent être présents ensemble, sinon le bloc entier est ignoré et l'écran Prêt
disparaît. Un montant réel accolé à une mensualité par défaut produirait un
échéancier crédible et faux.

La première échéance est facultative. Absente, elle est déduite de la première
transaction portant un type de prêt.

### 5.2 Tableau « Compte / Solde de départ »

En-têtes : `Compte` et `Solde de départ`.

Un compte par ligne, le solde à la **date de début de relevé**. Si aucune date
n'est déclarée, le solde vaut « avant la première transaction ».

Un compte absent de ce tableau est « **non initialisé** » — jamais 0. Les deux
choses ne se ressemblent pas à l'écran, et c'est voulu.

### 5.3 Comptes inconnus

L'application connaît aujourd'hui une liste fixe de comptes
(`src/config/accounts.ts`), et ses **règles de solde sont écrites compte par
compte**. Un compte nommé autrement est lu, ses transactions sont comptées dans
les dépenses — mais il **n'aura pas de solde** : absent du graphique, absent du
total du patrimoine.

L'import est accepté quand même, et l'aperçu **nomme** chaque compte inconnu en
disant exactement cela. Refuser l'import rendrait le format inutilisable avant
le lot C ; l'accepter en silence donnerait un patrimoine faux. La troisième voie
est de l'accepter en le disant.

C'est la limite la plus importante de cette v1. Elle est levée au lot C.

---

## 6. Ce que le format v1 ne fait pas

- **Il ne déclare pas les comptes, les types, les catégories ni les couleurs.**
  C'est le lot C. La feuille `Paramètres` v1 ne porte que des soldes, des dates
  et un prêt.
- **Il ne porte pas de taux de participation.** Le montant écrit est le montant
  imputé (§3.4).
- **Il ne déclare pas les types de transfert interne.** La liste des virements
  neutres reste celle de l'application. Pour un fichier tiers, un virement entre
  ses propres comptes sera compté comme une recette et une dépense. Limite
  connue, à lever au lot C.
- **Il ne gère pas plusieurs devises.** Les montants sont en euros.
- **Il n'accepte pas de CSV.**

---

## 7. L'ancien format, en adaptateur

Le classeur de l'auteur continue d'être lu, sans modification de sa part.

**Reconnaissance, dans cet ordre :**

1. une feuille nommée exactement `Transactions` **ou** `Transactions AAAA` dont
   la **ligne 1** porte au moins `Date`, `Compte` et `Montant` → **format
   public** ;
2. sinon, une feuille `Transactions AAAA` dont la **ligne 18** porte les
   en-têtes historiques → **ancien format**, lecture par position ;
3. sinon → refus, avec la liste des feuilles trouvées et ce qui était attendu.

La reconnaissance se fait sur la structure, jamais sur le nom du fichier. Le cas
ambigu — une feuille qui satisfait les deux — est impossible par construction :
la ligne 1 de l'ancien format ne porte pas ces en-têtes.

L'adaptateur reste testé par un mini-classeur à l'ancien format, construit en
mémoire dans les tests. C'est le verrou de non-régression du lot B.

---

## 8. Les points ouverts

### 8.1 Tranchés le 16/09/2026, sur arbitrage

- **Dépense sans catégorie** : acceptée, avec un avertissement chiffré (§3.7).
- **Classe remplie sur une recette** : ignorée, et l'aperçu le dit (§3.3).
- **`Version du format`** : facultatif. Absent, le fichier est lu comme une v1.
  Une v2 qui changerait le sens d'une colonne devra donc se reconnaître autrement
  — par une colonne nouvelle, pas par une colonne détournée. C'est une contrainte
  acceptée maintenant pour éviter une ligne de plus à remplir aujourd'hui.

### 8.2 Tranchés le 16/09/2026, sur mesure

**Nom des feuilles : tolérance, et refus en cas de collision.** Un nom de feuille
est comparé sans casse ni accents, espaces de bord retirés — même règle que pour
les colonnes. `transactions`, `TRANSACTIONS` et `Transactions ` désignent la même
feuille.

La collision n'est pas théorique : **mesuré** — SheetJS accepte sans broncher un
classeur portant à la fois `Transactions` et `transactions`. Excel ne le permet pas,
mais un fichier produit par un script, si. Dans ce cas : refus explicite, nommant les
deux feuilles. Jamais « la première gagne ».

**Mémorisation : forme encodée, et échec annoncé.** Mesuré sur le jeu de
démonstration (1 053 transactions) :

| Forme | Octets par transaction | Tient dans 5 Mo |
|---|---|---|
| Décodée — ce qui est mémorisé aujourd'hui | **241,5** | ~21 700 transactions |
| Encodée par dictionnaire — le format des fichiers du site | **47,5** | ~110 000 transactions |

⚠️ **Le commentaire de `src/services/importPersistence.ts` est faux.** Il annonce
« ~61 octets par transaction » et « ~80 000 lignes » pour saturer. Ce chiffre est
celui de la forme **encodée**, alors que le code mémorise la forme **décodée**. La
capacité réelle est environ **quatre fois plus faible** que ce qui est écrit. À
corriger au lot B.5, en même temps que le reste.

Décision : le lot B.5 mémorise la forme **encodée** — le décodage existe déjà et
est testé — et **aucun seuil chiffré n'est écrit en dur**. L'écriture est tentée ;
si le navigateur la refuse, l'écran le dit, comme il le fait déjà pour les objectifs
de budget (« non mémorisé »). Un seuil deviné serait faux sur au moins un navigateur ;
un échec constaté, jamais.

---

## 9. Journal

| Version | Date | Changement |
|---|---|---|
| v1 | 16/09/2026 | Première rédaction, avant implémentation. Les cinq points ouverts tranchés le jour même (§8) — aucun ne reste en suspens. |
| v1.1 | 16/09/2026 | Deux manques trouvés en fabriquant le modèle (B.1) : la `Classe` vide des débits qui ne sont pas des dépenses (§3.3), et le sort des feuilles non reconnues (§2). |
