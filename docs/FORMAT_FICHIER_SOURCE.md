# Format du fichier source — v2

*Lot B, étape B.0 pour la v1. Étendu au lot C.6 pour la v2 (journal, §9).*

Ce document décrit le classeur qu'une personne autre que l'auteur peut préparer
pour alimenter le tableau de bord. Il fait contrat : ce qui est écrit ici est ce
que le lecteur acceptera, et rien d'autre ne sera deviné en silence.

Le format de l'auteur — en-têtes en ligne 18, colonnes lues par position,
feuille « Transactions AAAA » — continue de fonctionner, sous forme
d'**adaptateur** (§7). Il n'est pas le format public.

**La v2 n'invalide aucun fichier v1.** Elle ajoute une colonne à
`Transactions` et des colonnes à `Paramètres`. Un fichier écrit pour la v1 se
lit sans être retouché, et donne les mêmes chiffres : c'est la contrainte que
le §8.1 s'était donnée — une v2 se reconnaît **par une colonne nouvelle, jamais
par une colonne détournée**.

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
| `Paramètres` | non, mais recommandée | Vos comptes, vos types, vos catégories, vos soldes, les dates de relevé, le prêt |

**Toute autre feuille est ignorée**, sans erreur : une feuille de notes, un
brouillon, un mode d'emploi. Le classeur modèle en porte une, nommée
`Lisez-moi`.

Sans `Paie`, les écrans Salaire et Salaire/Inflation **disparaissent de la
navigation** (étape B.4). Ils ne s'affichent pas vides.

Sans bloc Prêt dans `Paramètres`, l'écran Prêt immobilier ne disparaît que s'il
n'y a **aucune** échéance de prêt dans les transactions. S'il y en a, l'écran
reste, mais montre le seul historique réel (capital et intérêts) et invite à
déclarer le prêt pour la projection — jamais un échéancier inventé (E.3).

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
| `Montant` | **oui**, sauf si `Montant brut` | Nombre **positif**, montant déjà imputé (§3.4) |
| `Montant brut` | non | Nombre **positif**, montant avant partage (§3.4) — **v2** |
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
jamais 0. Le message nomme la colonne fautive — `Montant` ou `Montant brut`.

Aucune des deux colonnes n'est présente : le classeur est **refusé**, en disant
laquelle écrire. Les deux sont présentes : la règle est au §3.4.

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
une » sans connaître la nature des types.

**En v2, c'est le tableau `Types` qui la porte** (§5.3) : une `Nature` dit que
le mouvement n'est pas une dépense, une `Classe par défaut` dit laquelle il est
quand la ligne ne le précise pas. L'aperçu chiffre ce qui reste muet : « 4 de
vos types ne portent aucune nature ». Il ne les refuse pas — un type sans
nature est un mouvement ordinaire, et c'est le cas le plus courant.

`Classe` n'a de sens que pour un débit. Sur un crédit, elle est **ignorée, et
l'aperçu le dit** : « la classe a été ignorée sur 4 lignes de recette ». Un salaire
n'est pas une dépense fixe ; laisser croire le contraire sans rien dire est le genre
de silence que ce format existe pour supprimer.

Le lecteur actuel **calcule** ces deux informations à partir d'une liste de
libellés de types qui sont ceux de l'auteur. C'est précisément ce qui rend ce
lecteur inutilisable par quelqu'un d'autre : un type inconnu devient « Débit »
et « Dépense Occasionnelle », en silence. Dans le format public, c'est le
fichier qui le déclare.

### 3.4 `Montant`, `Montant brut`, et le taux de participation

Deux colonnes, deux régimes. **Le régime se lit sur la présence de la colonne,
il n'est jamais deviné.**

| Colonne remplie | Ce que l'outil fait |
|---|---|
| `Montant` seul | il le prend tel quel — c'est le montant **déjà imputé** |
| `Montant brut` | il lui applique le **taux de participation** du compte (§5.2) |

Une dépense de 80 € partagée à moitié s'écrit donc de deux façons, au choix :
`Montant` = 40, ou `Montant brut` = 80 sur un compte déclaré à 50 %. Les deux
donnent 40.

`Montant brut` rempli, `Montant` **n'est pas lu** — même s'il porte une valeur.
Aucune des deux ne l'emporte par surprise : la colonne écrite gagne, et c'est
tout.

Un compte sans taux déclaré impute **100 %** du brut. Un compte absent du
tableau des comptes impute 100 % **et il est nommé** dans l'aperçu : un taux
oublié ne se distingue pas d'un taux de 100 % une fois le chiffre affiché.

Le résultat est arrondi au centime, **une seule fois**, à cet endroit.

L'aperçu d'import annonce le nombre de lignes partagées. C'est une
**information**, pas un avertissement : un aperçu qui alerte sur ce qui
fonctionne apprend à ignorer ses alertes.

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

**Cinq tableaux**, tous facultatifs. Chacun est **repéré par sa cellule
d'en-tête**, où qu'elle se trouve sur la feuille : la position exacte n'est pas
imposée.

| Tableau | Cellule qui l'ouvre | Ce qu'il déclare |
|---|---|---|
| Réglages | `Paramètre` | dates de relevé, prêt, version |
| Comptes | `Compte` | vos comptes, leurs soldes, leurs règles |
| Types | `Type` | ce que chaque type fait aux calculs — **v2** |
| Catégories | `Catégorie` | les postes de budget, et leur couleur — **v2** |
| Employeurs | `Employeur` | les employeurs de la feuille `Paie` — **v2** |

**Il n'y a qu'un seul tableau des comptes.** Celui de la v1 est ce tableau,
élargi de six colonnes. Un fichier v1 en est le cas particulier à deux
colonnes.

**Deux tableaux côte à côte se séparent par une colonne vide.** La ligne
d'en-tête s'arrête à la première cellule vide à sa droite ; sans colonne vide
entre eux, le premier avalerait les colonnes du second.

**Deux tableaux l'un sous l'autre se séparent tout seuls** : un tableau
s'arrête à la cellule qui en ouvre un autre. Mesuré en écrivant les tests du
lot C.2 — sans cette règle, un tableau `Employeur` posé sous le tableau
`Compte` produisait un compte nommé « Employeur ». Sans erreur, évidemment.

**Une colonne inconnue est ignorée sans bruit**, comme dans `Transactions`.

### 5.1 Tableau « Paramètre / Valeur »

En-têtes : `Paramètre` et `Valeur`.

| Paramètre | Valeur attendue | Obligatoire |
|---|---|---|
| `Version du format` | `1` ou `2` | non — absent = lu comme une v1 |
| `Compte crédité par les sorties d'épargne` | nom d'un compte | non — **v2** |
| `Début de relevé` | date | non |
| `Fin de relevé` | date | non |
| `Prêt — montant` | nombre | non |
| `Prêt — date de début` | `AAAA-MM` ou date | non — **v2.1** |
| `Prêt — taux annuel` | taux (`1,8 %` ou `0,018`) | non — **v2.1** |
| `Prêt — durée (mois)` | entier | non — **v2.1** |
| `Prêt — mensualité` | nombre | non — bloc historique |
| `Prêt — nombre d'échéances` | entier | non — bloc historique |
| `Prêt — première échéance` | `AAAA-MM` | non |

**Début et fin de relevé** alimentent le **régime 1** de la couverture
temporelle : la source déclare ce qu'elle couvre, et on la croit. Les mois de
bord entiers sont alors conservés, au lieu d'être écartés par précaution. Règle
complète dans `CONTRAT_COUVERTURE.md`.

Déclarer l'un sans l'autre est refusé : une borne seule ne définit rien.
Une fin antérieure au début est refusée.

**Le bloc Prêt est tout ou rien, et il existe en deux formes — v2.1.**

- **Forme « taux »** (recommandée) : `montant`, `date de début`, `taux annuel`,
  `durée (mois)`. La mensualité est **calculée** :
  `M = montant × r / (1 − (1 + r)^−durée)`, avec `r = taux annuel / 12`. Un taux
  annuel de 0 % donne `montant / durée`, sans division par zéro.
- **Forme « mensualité »** (historique) : `montant`, `mensualité`,
  `nombre d'échéances`. Le taux est retrouvé par approximation. C'est la forme
  du format v2 ; elle continue d'être lue sans retouche.

Chaque forme est **tout ou rien** : ses champs présents ensemble, ou le bloc
entier est ignoré. Sans bloc lu, l'écran Prêt ne montre que l'historique réel
des échéances et ne projette rien (E.3). Un montant réel accolé à une
mensualité par défaut produirait un échéancier crédible et faux.

**Les deux formes présentes à la fois** doivent donner la **même mensualité à
1 € près**. Sinon le bloc Prêt est **refusé**, en affichant les deux valeurs et
en disant laquelle corriger — jamais « la première gagne ».

La première échéance est facultative. Absente, elle est déduite de la `date de
début` (forme taux) ou de la première transaction portant un type de prêt.

**Compte crédité par les sorties d'épargne.** Quand un type de nature
`sortie-epargne` sort de l'argent d'un livret, cet argent arrive quelque part.
Cette ligne dit où. Absente, la sortie diminue l'épargne **sans créditer aucun
compte** — et l'écran le dit, plutôt que de choisir un compte à votre place.

### 5.2 Tableau « Compte »

En-tête ouvrant : `Compte`. Un compte par ligne.

| Colonne | Obligatoire | Contenu attendu |
|---|---|---|
| `Compte` | **oui** | Le nom, tel qu'il est écrit dans `Transactions` |
| `Solde de départ` | non | Nombre. Absent = « non initialisé », **jamais 0** |
| `Organisme` | non | Banque ou établissement — regroupe les comptes à l'écran |
| `Participation` | non | Taux appliqué à `Montant brut` (§3.4). Absent = 100 % |
| `Compte lié` | non | Le compte d'où l'argent part réellement |
| `Sens répercuté` | non | `Débit`, `Crédit` ou `Les deux` |
| `Porte un solde` | non | `oui` / `non`. Absent = oui |
| `Couleur` | non | `#RRGGBB`. Absente = couleur de repli stable |

Le solde est celui de la **date de début de relevé**. Si aucune date n'est
déclarée, c'est le solde « avant la première transaction ».

**`Participation`** s'écrit `50 %`, `50%`, `0,5` ou `0.5`. Un taux hors de
l'intervalle 0–100 % est refusé, en nommant la ligne.

**`Compte lié` et `Sens répercuté` remplacent les règles écrites compte par
compte.** Un compte partagé, une cagnotte commune, une carte adossée à un
autre compte : l'argent y transite mais sort d'ailleurs. `Compte lié` nomme
cet ailleurs ; `Sens répercuté` dit ce qui y est reporté — les débits, les
crédits, ou les deux. Sans `Compte lié`, rien n'est répercuté.

Un `Compte lié` qui ne figure pas dans le tableau est **refusé**, en le
nommant : une chaîne qui pointe dans le vide ferait disparaître de l'argent.

**`Porte un solde` à `non`** désigne un compte qu'on suit sans en tenir le
solde — une carte de titres-restaurant, un compte de passage. Ses transactions
comptent dans les dépenses ; il n'entre pas dans le patrimoine, et son absence
du graphique devient un choix déclaré au lieu d'un trou.

### 5.3 Tableau « Type »

En-tête ouvrant : `Type`. Un type par ligne. **Nouveau en v2.**

| Colonne | Obligatoire | Contenu attendu |
|---|---|---|
| `Type` | **oui** | Le libellé, tel qu'il est écrit dans `Transactions` |
| `Nature` | non | Une ou plusieurs natures, séparées par des virgules |
| `Classe par défaut` | non | `Dépense Fixe`, `Courante` ou `Occasionnelle` |

**La nature dit ce que le mouvement fait aux calculs.** Six valeurs, et la
liste est close — chacune correspond à un calcul écrit dans le code. Une
nature déclarable mais sans effet serait un champ mort.

| Nature | Ce qu'elle fait |
|---|---|
| `epargne` | l'argent entre sur un livret : ce n'est pas une dépense |
| `sortie-epargne` | l'argent sort d'un livret |
| `transfert-interne` | mouvement entre vos propres comptes : ni recette ni dépense |
| `apport-exterieur` | l'argent vient de l'extérieur |
| `pret-capital` | remboursement de capital : échéancier du prêt |
| `pret-interets` | intérêts du prêt |

**Un type peut en porter plusieurs**, et c'est une nécessité mesurée : un
virement vers un livret est à la fois un transfert interne et une entrée
d'épargne ; un remboursement de capital est à la fois une entrée d'épargne et
une échéance de prêt.

Trois couples sont refusés, parce qu'ils se contredisent : `epargne` avec
`sortie-epargne`, `apport-exterieur` avec `transfert-interne`, `pret-capital`
avec `pret-interets`. Le message dit lequel, et pourquoi.

Une nature inconnue est **refusée**, avec la liste des six. Elle n'est jamais
ignorée en silence : un mot mal orthographié changerait les chiffres sans rien
dire.

**Un type absent de ce tableau est un mouvement ordinaire** — une recette ou
une dépense, selon son `Sens`. C'est le cas le plus courant, et il ne mérite
ni ligne ni avertissement. L'aperçu se contente de chiffrer : « 4 de vos types
ne portent aucune nature ».

### 5.4 Tableau « Catégorie »

En-tête ouvrant : `Catégorie`. **Nouveau en v2.**

| Colonne | Obligatoire | Contenu attendu |
|---|---|---|
| `Catégorie` | **oui** | Le poste de budget, tel qu'écrit dans `Transactions` |
| `Couleur` | non | `#RRGGBB`. Absente = couleur de repli stable |

Ce tableau ne sert qu'à **fixer les couleurs**. Une catégorie qui n'y figure
pas reste parfaitement utilisable : elle prend une couleur de repli, stable
d'un rendu à l'autre.

### 5.5 Tableau « Employeur »

En-tête ouvrant : `Employeur`. **Nouveau en v2.**

Une colonne, un employeur par ligne. Il déclare l'ordre et l'existence des
employeurs de la feuille `Paie`. Comme pour les catégories, un employeur
absent du tableau fonctionne quand même.

### 5.6 Comptes inconnus

Un compte présent dans `Transactions` mais absent du tableau `Compte` est
**lu**, ses transactions comptent dans les dépenses, et il reçoit une couleur.
Il n'a pas de solde de départ : il est « non initialisé », jamais 0.

L'import est accepté, et l'aperçu **nomme** chaque compte inconnu.

⚠️ **Ce paragraphe disait autre chose en v1.** Il disait que l'application
connaissait une liste fixe de comptes et que ses règles de solde étaient
écrites compte par compte, si bien qu'un compte nommé autrement n'apparaissait
ni dans le graphique ni dans le total du patrimoine. **Cette limite est levée
au lot C** : il n'y a plus de liste de comptes dans le code, et les règles de
solde sont devenues deux notions générales — `Participation` et `Compte lié`
(§5.2).

---

## 6. Ce que le format v2 ne fait pas

Les trois premières limites de la v1 sont levées : les comptes, les types, les
catégories et les couleurs se déclarent (§5), le taux de participation
s'applique (§3.4), et les transferts internes se déclarent par leur nature
(§5.3). Restent :

- **Il ne gère pas plusieurs devises.** Les montants sont en euros.
- **Il n'accepte pas de CSV.**
- **Il ne déclare pas de nouvelles classes de dépense.** Les trois — Fixe,
  Courante, Occasionnelle — sont l'ossature de deux écrans. Seule
  l'**affectation** d'un type à une classe se déclare.
- **Il ne déclare pas de nouvelles natures.** Les six du §5.3 correspondent
  chacune à un calcul écrit. Une septième, déclarable mais sans effet, serait
  un champ mort.
- **Il ne déclare pas l'ordre ni le nom des écrans.**
- **Il ne se modifie pas depuis l'application.** L'écran Paramètres montre ce
  que le fichier déclare ; il ne l'écrit pas. La source reste le classeur.

Et ce que la v2 aurait pu ajouter, mais n'ajoute pas :

- **Pas de colonne `Couleur` dans le tableau `Type`.** Les couleurs de types
  viennent du repli stable, qui donne déjà des teintes distinctes et
  constantes. Une colonne que personne ne remplit est une colonne morte — la
  même raison qui a fait retirer les champs inutilisés du lot C.
- **Pas de `Montant brut` sur la feuille `Paie`.** Aucun bulletin mesuré n'en
  avait l'usage.

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
  **Tenue au lot C.6** : la v2 n'a détourné aucune colonne. `Montant` garde
  exactement le sens qu'il avait, et le partage passe par `Montant brut`, qui
  n'existait pas.

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
| **v2** | **17/09/2026** | **Lot C.** Le fichier déclare son paramétrage. `Transactions` gagne **`Montant brut`** et le taux de participation (§3.4). `Paramètres` passe de deux à **cinq tableaux** (§5) : `Compte` élargi à huit colonnes, plus `Type`, `Catégorie` et `Employeur`. La limite « comptes inconnus sans solde » est **levée** (§5.6). Aucune colonne existante n'a changé de sens : **un fichier v1 se lit sans être retouché et donne les mêmes chiffres**, vérifié par le rapprochement à zéro écart des étapes C.3 à C.6. |
| **v2.1** | **22/09/2026** | **Lot E.0.** Le bloc Prêt gagne une **forme « taux »** : `date de début`, `taux annuel`, `durée (mois)` — la mensualité est **calculée** (§5.1). L'ancienne forme (`mensualité`, `nombre d'échéances`) reste lue ; les deux présentes doivent concorder à 1 € près, sinon refus. Aucune ligne existante détournée : un fichier v2 se lit sans être retouché. |
