# Préparer votre fichier — guide

Ce guide s'adresse à vous si vous voulez essayer le tableau de bord avec **vos
chiffres**. Aucune connaissance technique n'est nécessaire : il s'agit de
remplir un classeur Excel.

La description complète et exacte du format vit dans
`FORMAT_FICHIER_SOURCE.md`. Ce guide-ci est la version courte, dans l'ordre où
on s'en sert.

---

## 1. En trois minutes

1. Ouvrez le tableau de bord, cliquez sur **Importer .xlsx**.
2. Cliquez sur **Télécharger le modèle**. Vous obtenez un classeur
   `Budget_modele.xlsx` avec trois mois d'exemple et un mode d'emploi dans la
   première feuille.
3. Remplacez les lignes d'exemple par les vôtres. Gardez les en-têtes tels
   quels.
4. Glissez votre fichier dans la fenêtre d'import.
5. **Lisez l'aperçu avant de cliquer sur Appliquer.** Il dit combien de lignes
   ont été lues, combien ont été refusées et pourquoi, feuille et ligne à
   l'appui.

Rien n'est chargé tant que vous n'avez pas cliqué sur « Appliquer ».

---

## 2. La feuille `Transactions` — la seule obligatoire

Une ligne par mouvement. L'en-tête est en ligne 1 ; l'**ordre des colonnes est
libre**, seuls les noms comptent.

**Les cinq colonnes indispensables**

| Colonne | Exemple | Remarque |
|---|---|---|
| `Date` | `12/03/2026` | ou une vraie date Excel, ou `2026-03-12` |
| `Compte` | `Banque A - Courant` | le nom que vous voulez |
| `Type` | `Courses` | la nature du mouvement, texte libre |
| `Montant` | `42,15` | **toujours positif** |
| `Sens` | `Débit` ou `Crédit` | c'est lui qui donne le signe |

**Une sixième, pour vos dépenses** : `Classe`, qui vaut `Dépense Fixe`,
`Dépense Courante` ou `Dépense Occasionnelle`. C'est ce qui alimente la
répartition des dépenses.

Laissez `Classe` **vide** pour ce qui sort de l'argent sans être une dépense à
arbitrer : un virement vers votre livret, un transfert entre vos comptes, le
capital remboursé d'un prêt. Vide est une réponse, pas un oubli.

**Les autres colonnes sont facultatives** : `Catégorie`, `Sous-catégorie`,
`Détail`, `Libellé`, `Ville`, `Prévisionnel`.

Un exemple complet :

| Date | Compte | Type | Montant | Sens | Classe | Catégorie |
|---|---|---|---|---|---|---|
| 03/01/2026 | Banque A - Courant | Courses | 42,15 | Débit | Dépense Courante | Alimentation |
| 05/01/2026 | Banque A - Courant | Salaire | 2 538,00 | Crédit |  |  |
| 05/01/2026 | Banque A - Courant | Virement épargne | 300,00 | Débit |  |  |

---

## 3. Les quatre erreurs les plus fréquentes

**Un montant négatif.** Écrivez `80`, pas `-80`, et mettez `Débit` dans `Sens`.
Un montant négatif fait refuser la ligne — il ne devient jamais 0 en silence.

**`D` ou `C` au lieu de `Débit` / `Crédit`.** Refusé, avec un message qui dit
quoi écrire. Les accents et les majuscules, eux, sont sans importance.

**Une dépense partagée écrite en entier.** Notez le montant **qui vous est
imputé** : une dépense de 80 € partagée à moitié se note `40`. L'outil ne sait
pas encore appliquer un taux de partage ; écrire 80 en attendant fausserait
votre budget sans rien vous dire.

**Deux lignes rigoureusement identiques.** Même date, même compte, même type,
même montant, même libellé : la seconde est refusée comme doublon. Deux achats
identiques le même jour, ça existe — distinguez-les par le libellé.

Vous pouvez aussi garder plusieurs feuilles annuelles : `Transactions 2025`,
`Transactions 2026`. Elles sont additionnées.

Pour mettre une ligne de côté sans la supprimer, mettez `x` dans la colonne
`Prévisionnel` : elle est ignorée, et l'aperçu vous dit combien l'ont été.

---

## 4. La feuille `Paie` — facultative

Une ligne par mois : `Mois` (`2026-01`), `Employeur`, `Brut`,
`Cotisations salariales`, et si vous voulez `Indemnités`, `Autres retenues`,
`Net`.

Le net est **calculé** : brut − cotisations + indemnités − autres retenues. Si
vous remplissez `Net`, il sert de contrôle : un écart de plus d'un euro vous
est signalé, sans rien refuser.

**Sans cette feuille, les écrans Salaire disparaissent de la navigation.** Ils
ne s'affichent pas vides.

À savoir : le détail des cotisations, ligne à ligne, n'entre pas dans ce
format. Les deux graphiques qui en dépendent vous diront pourquoi ils sont
vides plutôt que d'afficher des tirets.

---

## 5. La feuille `Paramètres` — facultative, mais elle change beaucoup

Deux petits tableaux, où vous voulez sur la feuille. Ils sont retrouvés par
leurs en-têtes.

**`Paramètre` / `Valeur`**

| Paramètre | Ce que ça fait |
|---|---|
| `Début de relevé`, `Fin de relevé` | déclarent la période que votre fichier couvre vraiment |
| `Prêt — montant`, `Prêt — mensualité`, `Prêt — nombre d'échéances` | font apparaître l'écran Prêt immobilier |
| `Prêt — première échéance` | facultative, déduite sinon |

Les deux dates de relevé vont ensemble : déclarer l'une sans l'autre est
refusé. Sans elles, l'outil devine la période couverte, prudemment — il écarte
les mois de bord dont il n'est pas sûr qu'ils soient complets.

Le bloc Prêt est **tout ou rien** : sans les trois premières valeurs, il est
ignoré en entier. Un montant réel accolé à une mensualité inventée produirait
un échéancier crédible et faux.

**`Compte` / `Solde de départ`**

Un compte par ligne, avec son solde à la date de début de relevé.

Un compte que vous ne déclarez pas ici est « **non initialisé** » — jamais 0.
Les deux ne se ressemblent pas à l'écran, et c'est voulu.

---

## 6. Ce que vous verrez, et ce que vous ne verrez pas

Cette version est une **démonstration ouverte à l'import**, pas encore un outil
paramétrable. Deux limites, dites franchement :

**Vos comptes ne sont pas les siens.** L'application connaît une liste fixe de
comptes. Si les vôtres portent d'autres noms — et c'est le cas normal — leurs
transactions sont bien comptées dans les dépenses, mais **aucun solde n'est
calculé** : ni dans le graphique de patrimoine, ni dans le total. L'écran
Comptes vous montre alors la **variation cumulée** de chaque compte (crédits
moins débits depuis votre première ligne) et vous dit que le point de départ
reste inconnu. L'import est accepté, et chaque compte inconnu vous est nommé.

**Une dépense sans `Catégorie`** compte dans les dépenses et dans les totaux,
mais n'apparaît pas dans l'écran Budget mensuel : les objectifs se posent à ce
niveau-là, et il n'y a rien à comparer. L'aperçu vous dit combien de lignes
sont concernées.

---

## 7. Vos données restent chez vous

Le classeur est lu **dans votre navigateur**. Il n'est envoyé à aucun serveur —
le site n'a d'ailleurs aucune adresse de destination : le navigateur lui-même
refuse toute sortie.

Avant d'appliquer, une case vous demande si vous voulez **garder ces données
sur cet appareil**. Elle est cochée par défaut :

- **cochée** : vous retrouvez votre tableau de bord à la prochaine ouverture ;
- **décochée** : rien n'est écrit, et tout disparaît à la fermeture de
  l'onglet. À préférer sur un ordinateur partagé.

Ensuite, la pastille en haut à droite dit ce qui est affiché — **Démo** ou
**Mes données** — et bascule de l'un à l'autre. Revenir à la démonstration
n'efface rien.

Pour tout retirer de l'appareil, ouvrez la fenêtre d'import et cliquez sur
**Effacer mes données**. On vous demande confirmation, et ce qui part est
nommé : le fichier importé, les objectifs de budget que vous avez modifiés, et
le choix d'affichage. Votre classeur, lui, n'est pas touché.

---

## 8. Si quelque chose ne passe pas

L'aperçu d'import est fait pour ça : chaque ligne refusée est située — feuille,
ligne, colonne — avec la raison. Corrigez dans votre classeur, réimportez.

Et si un écran reste vide, il devrait vous dire pourquoi. Si ce n'est pas le
cas, c'est un défaut de l'outil, pas de votre fichier.
