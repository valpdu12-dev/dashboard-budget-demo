# Contrat de paramétrage — lot C

*Étape C.0. Écrit le 16/09/2026, avant toute ligne de code. Ce document fait
contrat : ce qui est écrit ici est ce que le lecteur et les calculs feront, et
rien d'autre ne sera deviné en silence.*

*Il met au propre les neuf décisions arbitrées le 16/09/2026 (§3 de
`plan/16_PLAN_ACTION_LOT_C.md`). **Il ne les rouvre pas.** Il ajoute ce
qu'elles ne couvrent pas, et dit ce qui reste en dur.*

---

## 1. Ce que le lot C change, en une phrase

Aujourd'hui, l'application sait calculer un solde pour **sept comptes qu'elle
connaît par leur nom**. Demain, elle sait le calculer pour les comptes que le
fichier déclare — et, quand le fichier ne déclare rien, elle le **dit** au lieu
de répondre zéro.

---

## 2. Le vocabulaire

Cinq notions, à ne pas confondre. Trois existent déjà, deux sont neuves.

| Notion | Ce que c'est | Qui la porte |
|---|---|---|
| **Compte** | Là où l'argent se trouve | Tableau `Comptes`, feuille `Paramètres` |
| **Type** | Ce qu'est le mouvement, dans les mots de la personne | Colonne `Type` de `Transactions` |
| **Nature** *(neuf)* | Ce que le mouvement **fait aux calculs** | Tableau `Types`, feuille `Paramètres` |
| **Classe** | Fixe / Courante / Occasionnelle | Colonne `Classe` de `Transactions` |
| **Catégorie** | Le poste de budget | Colonne `Catégorie` de `Transactions` |

La **nature** est la notion centrale du lot. Elle remplace les quatre listes de
libellés qui gouvernent aujourd'hui cinq écrans : `TRANSFER_TYPES`,
`EPARGNE_TYPES`, `TYPE_PRET_CAPITAL`, `TYPE_PRET_INTERETS`.

### 2.1 Les natures reconnues

| Nature | Effet sur les calculs |
|---|---|
| *(vide)* | Mouvement ordinaire. Aucun effet particulier. |
| `epargne` | Entrée d'épargne — écran Patrimoine → Épargne |
| `sortie-epargne` | Sortie d'épargne (**D2**) |
| `transfert-interne` | Virement entre comptes de la personne — exclu des recettes et des dépenses |
| `apport-exterieur` | Neutralise le compte lié (**D3b**) |
| `pret-capital` | Remboursement de capital — fait exister l'onglet Prêt |
| `pret-interets` | Intérêts du prêt |

Une nature inconnue **rejette la ligne du tableau `Types`**, en la nommant et en
listant les natures acceptées. Elle n'est jamais ignorée en silence.

---

## 3. Les neuf décisions, au propre

### D1 — Le montant : une colonne nouvelle, jamais une colonne détournée

**La règle.** La feuille `Transactions` reçoit une colonne facultative
`Montant brut`.

- `Montant brut` **rempli** → l'outil calcule le montant imputé en appliquant le
  **taux de participation du compte**. `Montant` est alors ignoré, et l'aperçu le
  dit.
- `Montant brut` **vide** → `Montant` est pris tel quel : il est **déjà imputé**,
  comme aujourd'hui (§3.4 du format v1).

**Ce qu'elle remplace.** `HALF_COMPTES` dans `parseExcel.worker.ts` : trois
comptes nommés dont le montant est divisé par deux, avec un commentaire précisant
que `Banque B - Courant` n'y figure pas. Le taux existe déjà ; il change
seulement de place et cesse d'être figé à 50 %.

**Pourquoi une colonne nouvelle.** Le §8.1 du format v1 l'a écrit noir sur blanc :
une v2 qui changerait le **sens** d'une colonne existante ne se reconnaîtrait pas.
Un fichier écrit au format v1 continue donc de fonctionner sans être retouché, et
l'outil n'a **jamais** à deviner lequel des deux régimes s'applique.

### D2 — `Sortie Epargne` est un type, plus jamais un compte

**La règle.** `Sortie Epargne` devient un **type**, de nature `sortie-epargne`.
Le compte qui reçoit l'argent est déclaré **une seule fois**, dans le tableau
`Paramètre / Valeur` : ligne `Compte crédité par les sorties d'épargne`.

Absent → les sorties **ne sont pas reprises dans les soldes**, et l'écran le dit,
chiffré : « 1 sortie d'épargne (386,61 €) n'est créditée à aucun compte : aucun
compte n'est déclaré pour les recevoir. »

L'écran Patrimoine → Épargne garde **exactement** son calcul :
`épargne nette = entrées − sorties`. Seule la façon de **reconnaître** une sortie
change.

**Ce qu'elle remplace.** Deux endroits :

- `useBalances.ts` : `if (t.compte === "Sortie Epargne") running["Banque A - Courant"] += m;`
  — un pseudo-compte qui n'existe pas dans `accounts.ts`, sans solde, sans
  couleur, sans icône, invisible à l'écran ;
- `useSavingsData.ts` : `t.compte !== "Sortie Epargne"` et
  `t.compte === "Sortie Epargne"` — le même libellé, utilisé comme filtre de
  compte.

**Mesuré sur le jeu de démonstration.** La ligne existe une seule fois, et elle
porte **déjà** `type = "Sortie Epargne"` en plus de `compte = "Sortie Epargne"`
(386,61 €, Crédit). Le libellé est déjà un type dans les données ; il l'est aussi
dans `TRANSFER_TYPES`. La décision ne fait que supprimer le doublon.

### D3a — Compte lié : un seul niveau

**La règle.** Un compte déclare au plus **un** compte lié, et ce compte lié ne
doit **pas** en déclarer un à son tour. Une chaîne (`A → B → C`) est **refusée à
la lecture**, avec un message nommant les trois comptes et disant quoi écrire à
la place.

**Conséquence assumée.** Aucune détection de cycle n'est à écrire : rien qui
puisse boucler n'est accepté. Un cycle est un cas particulier de chaîne.

### D3b — L'exception `Virement extérieur` devient une nature

**La règle.** Un type de nature `apport-exterieur` **neutralise le compte lié** :
la ligne crédite (ou débite) son propre compte, et ne touche pas le compte lié.

**Ce qu'elle remplace.** Dans `useBalances.ts`, la condition
`&& t.type !== "Virement extérieur"`, répétée sur deux comptes — une règle de
compte qui dépend d'un libellé de type.

**Mesuré.** 6 lignes, **1 172,71 €**, toutes sur `Banque B - Compte joint` au
crédit. Sans cette nature, ces 1 172,71 € seraient retirés à tort du compte
principal.

### D4 — Les quatre champs morts de `Config` sont supprimés

**La règle.** `transfers`, `comptes`, `comptesLiesPrincipal` et `colors`
disparaissent de `Config` au C.1. `__tests__/helpers/factories.ts` cesse de les
remplir.

**Pourquoi.** Aucun des quatre n'est lu nulle part. Ce sont des promesses
inscrites dans un type, qu'un test entretient. C'est la forme la plus discrète du
mensonge que ce chantier chasse : un champ qui ressemble à du paramétrage et qui
ne paramètre rien.

`BudgetConfig` redéclare ce dont il a besoin, et rien de plus.

### D5 — Le critère « plus aucun nom en dur » devient un script

**La règle.** Un script `scripts/verifier-vocabulaire.mjs`, lancé par
`npm run check`, sur le modèle de `verifier-publication.mjs`. Il échoue si un nom
de compte ou un libellé de type de la démonstration apparaît dans `src/`.

**Deux exemptions, nommées dans le script :**

| Exemption | Pourquoi |
|---|---|
| `src/__tests__/**` | 213 occurrences dans 25 fichiers. Un test doit nommer un compte pour vérifier un calcul. |
| `src/services/modeleExcel.ts` | 23 lignes citant un compte, 8 citant un type. C'est le classeur modèle : ce sont des **données d'exemple**. |

Les trois classes de dépense restent en dur et **ne comptent pas** comme
violation (voir §5).

### D6 — Stockage : migration v2 → v3, et bandeau à l'écran

**La règle.** `VERSION_SCHEMA` passe à **3**. Un jeu mémorisé en v2 est
**converti, pas jeté** — `migrerV1()` sert de patron, il existe et il fonctionne.

Mais un jeu v2 ne porte **aucune configuration de comptes**. Un **bandeau
visible** le dit et invite à réimporter le fichier source.

**Ce qu'elle remplace.** `console.warn("[Budget] Jeu mémorisé d'une version
inconnue — ignoré.")` : pour la personne devant l'écran, ses données mémorisées
disparaissent **sans un mot**.

Un `console.warn` seul n'est jamais une réponse acceptable.

**La migration est tout ou rien.** À moitié migrer est nommément ce que
`jeuDonnees.ts` interdit aujourd'hui, et il a raison.

### D7 — Nature non déclarée : deux traitements distincts

| Ce qui manque | Ce que fait l'outil |
|---|---|
| Aucun type de nature `epargne` ni `sortie-epargne` | L'écran Épargne **disparaît de la navigation**, exactement comme l'onglet Prêt sans prêt |
| Aucun type de nature `transfert-interne` | L'import est **accepté**, avec un avertissement **chiffré** dans l'aperçu |

Le texte de l'avertissement dit ce qui se passe, pas ce qui pourrait se passer :
« 12 lignes ressemblent à des virements entre vos comptes, aucune n'est déclarée
comme telle : elles sont comptées une fois en recette et une fois en dépense. »

**Pourquoi accepter.** Refuser rendrait le **premier** import impossible : on ne
peut pas déclarer les natures d'un fichier qu'on n'a pas encore réussi à
importer.

### D8 — Écarts de KPI : le classeur réel ne bouge pas

**La règle.** `scripts/check-import-equivalence.mjs` est lancé depuis `DEMO/`,
pointé vers le classeur réel **là où il vit**, en **lecture seule**, avec
`TZ=Europe/Paris`.

Le classeur n'entre **jamais** dans `DEMO/`. Rien n'est écrit dans le projet
privé. Seuls des **chiffres agrégés** entrent dans le compte rendu — jamais un
libellé, jamais un nom d'organisme, jamais une ligne.

La liste noire du contrôle de publication reste le dernier garde-fou. Elle a déjà
rattrapé une fuite réelle au lot B, entrée par le **regard** et non par le code.

### D9 — Un écran Paramètres en lecture seule, et rien de plus dans ce lot

**La règle.** Au C.2, un écran montre **ce que l'outil a lu, tel qu'il l'a lu** :
comptes, taux de participation, comptes liés, types et leurs natures, catégories,
couleurs, employeurs.

**Lecture seule.** Ce qui manque y figure **comme manquant**, pas comme vide.

**Ce qui est reporté.** L'écran modifiable — listes déroulantes, saisie des taux,
choix des couleurs, réexport de la configuration — est reporté à un lot
ultérieur. Il ouvre une question neuve, « qui gagne, du fichier ou de l'écran »,
qui n'a pas à être tranchée ici. Règle pressentie pour ce lot-là, notée mais non
engagée : **le fichier pose, l'écran ajuste**, et chaque champ affiche d'où vient
sa valeur.

---

## 4. Ce que les neuf décisions ne couvrent pas

Sept compléments. Aucun ne contredit une décision ; chacun comble un trou par
lequel un chiffre faux pourrait passer sans bruit.

### 4.1 Signe des montants

**Un montant écrit dans le fichier est toujours positif.** C'est déjà la règle du
format v1 (§3.2), et `Montant brut` la suit : un montant vide, négatif ou
illisible **rejette la ligne**, il ne devient jamais 0.

C'est la colonne `Sens` — `Débit` ou `Crédit` — qui porte le sens, et elle seule.

**Conséquence.** Un remboursement ne s'écrit pas en montant négatif : il s'écrit
comme un `Crédit`. Un fichier qui porterait des montants signés serait rejeté
ligne par ligne, avec sa raison — et non lu de travers.

**En interne, une seule convention** : le signe est porté par le sens, jamais par
le montant, jusqu'au dernier calcul. `variationsByMonth` fait déjà exactement
cela (`t.dc === "Crédit" ? +montant : −montant`), et c'est le patron.

### 4.2 Arrondis

**Une seule règle, appliquée à un seul endroit.**

Le montant imputé est arrondi à **deux décimales**, au moment où il est calculé —
c'est-à-dire à la lecture, pas à l'affichage :

```
montant imputé = arrondi( Montant brut × taux , 2 )
```

L'arrondi retenu est celui d'aujourd'hui : `Math.round(v * 100) / 100`. Pour des
montants positifs, il est identique à `ROUND()` d'Excel. Comme tous les montants
sont positifs (§4.1), les deux coïncident toujours.

**Ce qui n'est jamais arrondi une deuxième fois** : les sommes, les soldes, les
moyennes. Un arrondi par ligne, puis des sommes exactes. Arrondir deux fois fait
dériver un total de quelques centimes, ce qui est exactement le genre d'écart
qu'un rapprochement à zéro doit interdire.

**Les arrondis d'affichage** (`Math.round` dans `balanceChartData`, format à
l'euro près sur les cartes) restent des arrondis d'affichage. Ils ne rentrent
jamais dans un calcul.

### 4.3 Identifiant stable contre libellé

**Ce qui joint les données à la configuration, c'est le libellé** — la colonne
`Compte` de `Transactions` et la colonne `Compte` du tableau `Comptes`.

La comparaison se fait **sans casse, sans accents, espaces de bord retirés** :
la même règle que pour les noms de colonnes et les noms de feuilles (§1 et §8.2
du format). `banque a - courant` et `Banque A - Courant ` sont le même compte.

**L'identifiant interne (`id`) est dérivé du libellé normalisé.** Il est stable
**à l'intérieur d'un import**, et sert de clé de solde, de couleur, d'icône et de
série. Il n'est jamais affiché.

**Ce que le lot C ne fait pas, et qu'il faut dire.** `accounts.ts` promet depuis
le lot A.2 un identifiant qui « ne change jamais », séparé d'un libellé qui, lui,
peut changer. Cette promesse n'est **pas** tenue par le lot C : renommer un
compte dans le fichier produit un compte **différent**, avec son propre solde et
sa propre couleur. Un historique mémorisé sous l'ancien libellé n'est pas
rattaché au nouveau.

Tenir la promesse demanderait une colonne `Identifiant` dans le tableau
`Comptes`, à écrire une fois et à ne plus jamais toucher — une colonne de plus à
remplir, pour un besoin qui ne se manifeste qu'au premier renommage. Ce n'est pas
fait dans ce lot, et le commentaire de `accounts.ts` sera corrigé pour cesser de
l'annoncer.

### 4.4 Absence de double comptage

Quatre endroits où le même euro pourrait être compté deux fois. Chacun a sa
règle.

**a) Transfert interne.** Une ligne dont le type est de nature
`transfert-interne` sort **des recettes et des dépenses**, des deux côtés. Elle
reste dans les soldes : l'argent s'est bien déplacé. Sans déclaration, D7
s'applique : accepté, chiffré, dit.

**b) Compte lié.** Une ligne répercutée sur un compte lié compte **une fois pour
son propre compte** et **une fois pour le compte lié** — ce sont deux soldes
distincts, ce n'est pas un double comptage. En revanche le **total du
patrimoine** ne somme que les comptes **portant un solde propre** : un compte
`Part commune`, qui n'a pas de solde propre, n'y entre pas. C'est déjà le
comportement de `comptesInitialises`, qui filtre sur `COMPTES_AVEC_SOLDE`.

**c) Sortie d'épargne.** La ligne crédite le compte déclaré (D2) **et** compte en
sortie dans l'écran Épargne. Ce sont deux calculs différents sur le même
mouvement, pas deux comptages du même euro dans le même total.

**d) Feuilles annuelles agrégées.** Inchangé depuis le lot B : une ligne
strictement identique à une autre est rejetée comme doublon, avec ses deux
emplacements.

**Le contrôle qui le prouve.** Le rapprochement du C.3, à zéro écart, est
précisément ce qui détecte un double comptage introduit par le déplacement des
règles. Il est écrit **avant** le déplacement et doit être vert **avant et
après**.

### 4.5 Un type peut porter plusieurs natures — mesuré, pas supposé

**Le constat.** Dans le jeu de démonstration, trois types appartiennent
aujourd'hui à **deux** listes à la fois :

| Type | Listes actuelles | Natures |
|---|---|---|
| `Crédit Immobilier` | `EPARGNE_TYPES` **et** `TYPE_PRET_CAPITAL` | `epargne`, `pret-capital` |
| `Épargne Banque A` | `EPARGNE_TYPES` **et** `TRANSFER_TYPES` | `epargne`, `transfert-interne` |
| `Sortie Epargne` | `TRANSFER_TYPES`, et compte dans `useSavingsData` | `transfert-interne`, `sortie-epargne` |

**La règle.** La colonne `Nature` du tableau `Types` accepte **plusieurs natures,
séparées par une virgule**. Une nature vide est un mouvement ordinaire.

**Pourquoi c'est obligatoire.** Une nature unique par type rendrait le
rapprochement à zéro écart du C.3 **impossible** : le remboursement de capital
cesserait d'être compté comme de l'épargne, ou l'onglet Prêt disparaîtrait. Le
constat n'a pas été anticipé au plan d'action ; il est mesuré ici.

**Les combinaisons interdites** — refusées à la lecture, en nommant le type :

- `epargne` **et** `sortie-epargne` sur le même type : le sens du mouvement
  deviendrait indécidable ;
- `apport-exterieur` **et** `transfert-interne` : l'un dit « l'argent vient de
  l'extérieur », l'autre « l'argent vient d'un de vos comptes » ;
- `pret-capital` **et** `pret-interets` : l'échéancier sommerait la même ligne
  deux fois.

### 4.6 Où vivent les nouveaux tableaux

**Le piège, mesuré dans le code.** `tableauParEnTete(grille, "Compte")` cherche la
**première** cellule valant `Compte` sur la feuille `Paramètres` et lit deux
colonnes : la clé et sa voisine de droite. Un nouveau tableau `Comptes` dont
l'en-tête de première colonne serait `Compte` serait donc trouvé **à la place** du
tableau des soldes de départ — ou l'inverse, selon leur position sur la feuille.
Silencieusement.

**La règle.** Il n'y a **qu'un seul** tableau des comptes. Le tableau
« Compte / Solde de départ » du format v1 est ce tableau, **élargi** :

| Colonne | Obligatoire | Contenu |
|---|---|---|
| `Compte` | **oui** | Libellé, tel qu'il apparaît dans `Transactions` |
| `Solde de départ` | non | Nombre. Absent = « non initialisé », jamais 0 |
| `Organisme` | non | Texte libre |
| `Participation` | non | Taux, `50 %` ou `0,5`. Absent = 100 % |
| `Compte lié` | non | Libellé d'un autre compte |
| `Sens répercuté` | oui **si** `Compte lié` est rempli | `Débit`, `Crédit` ou `Les deux` (§4.7) |
| `Porte un solde` | non | `oui` / `non`. Absent = `oui` |
| `Couleur` | non | Absent = palette automatique, par `couleurStable` |

**Un fichier v1 est un cas particulier de ce tableau** : deux colonnes remplies,
six vides. Il continue de se lire sans être retouché.

**Ce que cela impose au code.** `tableauParEnTete` lit deux colonnes ; il lui
faut un frère qui lise **N colonnes nommées** sous une ligne d'en-tête. Les deux
tableaux neufs — `Types` (`Type`, `Nature`, `Classe par défaut`) et `Catégories`
(`Catégorie`, `Couleur`) — utilisent le même lecteur, repérés par leur propre
cellule d'en-tête.

**Le tableau `Paramètre / Valeur` ne change pas de forme.** Il reçoit une ligne
de plus : `Compte crédité par les sorties d'épargne` (D2).

### 4.7 L'ordre d'application des règles de solde

C'est l'ordre qui décide du résultat. Il est écrit ici une fois, et le C.4 ne
fait que l'appliquer.

Pour **chaque ligne**, dans cet ordre :

1. **Montant imputé** — `Montant brut` × taux du compte, arrondi à 2 décimales
   (D1, §4.2). Ou `Montant` tel quel si `Montant brut` est vide.
2. **Le compte de la ligne** — `Crédit` → `+`, `Débit` → `−`, si et seulement si
   le compte **porte un solde propre**.
3. **Le compte lié** — si le compte en déclare un, **et** si le sens de la ligne
   est le `Sens répercuté` déclaré, **et** si le type n'est pas de nature
   `apport-exterieur` (D3b) : le montant est **retiré** du compte lié.
4. **Sortie d'épargne** — si le type est de nature `sortie-epargne` : le montant
   est **ajouté** au compte déclaré par `Compte crédité par les sorties
   d'épargne` (D2). Sans compte déclaré, rien n'est ajouté, et l'écran le dit.

**Pourquoi `Sens répercuté` est obligatoire, et mesuré.** Les règles actuelles de
`useBalances.ts` ne se répercutent **que sur un seul sens par compte** :

| Compte | Sens qui se répercute | L'autre sens |
|---|---|---|
| `Banque A - Part commune` | Débit | aucun crédit dans les données |
| `Appli partagée - Part commune` | Débit | aucun crédit dans les données |
| `Banque B - Compte joint` | Crédit | **154 débits, 8 263,60 €**, sans effet sur le principal |
| `Banque C - Compte joint` | Crédit | **114 débits, 27 752,42 €**, sans effet sur le principal |

Répercuter les deux sens par défaut retirerait donc **36 016,02 €** à tort du
compte principal. Un défaut de cette taille, produit par une valeur par défaut,
ressemblerait à un choix de l'utilisateur — c'est exactement le piège que le §7
du plan d'action annonce.

**Donc** : `Compte lié` rempli sans `Sens répercuté` est **refusé à la lecture**,
avec un message nommant le compte et disant quoi écrire. Comme pour la chaîne de
comptes liés (D3a), l'outil ne choisit pas à la place de la personne.

---

## 5. Ce qui reste en dur, et pourquoi

Un critère de sortie qui traque ces occurrences les traquerait pour rien. La
liste est close : ce qui n'y figure pas est une violation.

| Ce qui reste en dur | Pourquoi | Où |
|---|---|---|
| Les **trois classes** de dépense — `Dépense Fixe`, `Dépense Courante`, `Dépense Occasionnelle` | Décision du plan V3 : la **liste** est fixe, seule l'**affectation** type → classe devient paramétrable. Trois classes forment la structure des écrans Dépenses et Budget, pas un vocabulaire. | `types/index.ts`, `Header.tsx`, `useKPIs.ts`, `lectureClasseur.ts` |
| Les **sept natures** (§2.1) | Chacune correspond à un calcul écrit dans le code. Une nature déclarable mais sans effet serait un champ mort — ce que D4 supprime. | `config/natures.ts` (neuf) |
| Les **deux sens**, `Débit` et `Crédit` | Ce sont les deux directions de l'argent, pas des libellés. | format, lecteur |
| Les **en-têtes du format** — `Date`, `Compte`, `Montant`… | C'est le contrat avec l'utilisateur. Le rendre paramétrable reviendrait à n'avoir plus de format. | `lectureClasseur.ts` |
| Les **données d'exemple** de `modeleExcel.ts` | Un modèle doit bien montrer quelque chose. Exempté nommément par D5. | `services/modeleExcel.ts` |
| Les **libellés dans les tests** | Un test doit nommer un compte pour vérifier un calcul. Exempté nommément par D5. | `src/__tests__/**` |

**Ce qui cesse d'être en dur** — et que le script de D5 doit donc ne plus
trouver : les sept libellés de comptes de `accounts.ts`, `COMPTES_REELS`,
`TRANSFER_TYPES`, `EPARGNE_TYPES`, `HALF_COMPTES`, `TYPE_PRET_CAPITAL`,
`TYPE_PRET_INTERETS`, la table d'icônes par libellé de `Comptes.tsx`, les cinq
séries écrites à la main de `balanceChartData`, et les quatre listes de libellés
de l'adaptateur (`FIXED_TYPES`, `CURRENT_TYPES`, `CREDIT_TYPES`, `CAT1_EXCLUDE`)
— ces quatre-là restant lisibles depuis l'adaptateur de l'ancien format, qui est
un cas particulier documenté.

---

## 6. Deux points laissés ouverts, à arbitrer

### 6.1 La couverture par compte

`CONTRAT_COUVERTURE.md` la signale : un compte ajouté en cours de route voit ses
premiers mois comptés comme couverts alors qu'il n'existait pas encore. Ses
moyennes sont donc sous-estimées.

**Ce que je propose : ne rien ajouter au format pour l'instant, et le dire.**

Le lot C pourrait donner deux colonnes `Début` et `Fin` au tableau `Comptes`.
Mais rien ne les lirait dans ce lot : ce serait exactement le champ mort que D4
supprime, recréé le même jour, dans le même document. La limite reste donc
entière, elle est écrite ici, et l'écran Paramètres la nomme pour les comptes
concernés.

### 6.2 Le nom du tableau des comptes dans la feuille `Paramètres`

Le §4.6 fait de « Compte / Solde de départ » un tableau élargi plutôt qu'un
second tableau. C'est ce qui évite la collision d'en-tête mesurée dans
`tableauParEnTete`, et ce qui laisse les fichiers v1 fonctionner.

La conséquence à accepter : le tableau des comptes s'étale sur **huit colonnes**
dans la feuille `Paramètres`. Le classeur modèle du C.6 devra les montrer
remplies, sinon personne ne saura qu'elles existent.

---

## 7. La règle qui vaut pour tout le lot

Quand l'outil ne sait pas, il le **dit**.

Une valeur par défaut — un zéro, une liste figée, une couleur de repli
silencieuse, un message écrit dans la console que personne n'ouvre — est un
mensonge qui ne se voit pas. Le lot B l'a réappris six fois.

Le lot C porte un piège de plus : **une configuration rend chaque défaut
invisible**, puisqu'il ressemblera à un choix de l'utilisateur. Les
36 016,02 € du §4.7 en sont l'exemple chiffré.

---

## 8. Journal

| Version | Date | Changement |
|---|---|---|
| v1 | 16/09/2026 | Première rédaction (C.0). Les neuf décisions mises au propre, sept compléments ajoutés, deux points laissés ouverts. Aucun code touché. |
