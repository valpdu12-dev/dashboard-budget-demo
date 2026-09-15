# Contrat de couverture temporelle

*Lot 0, étape 0.5. Écrit avant le code, validé avant d'être implémenté.*

## Le problème

L'application ne connaissait qu'une chose : **les dates des transactions**. La
liste des mois était construite à partir d'elles (`extractAllMonths`).

Conséquence : un mois entièrement couvert par le relevé mais **sans aucune
dépense** n'existait pas. Il n'était pas à zéro — il était **absent**. Donc
absent aussi du dénominateur des moyennes, qui s'en trouvaient gonflées.

Deux notions étaient confondues :

| Notion | Définition |
|---|---|
| **Dates des transactions** | Les mois où il s'est passé quelque chose. |
| **Période couverte** | Les mois que la source embrasse, dépense ou pas. |

## La règle

Un mois est **comparable** s'il est **entièrement couvert** par la source. Seuls
les mois comparables entrent dans une moyenne.

Deux régimes, selon ce que la source déclare.

### Régime 1 — bornes déclarées

Si la source indique ses dates de relevé (« du 01/03/2024 au 28/02/2026 »), on
la croit. Est comparable tout mois dont le **premier et le dernier jour**
tombent dans les bornes.

Un relevé qui commence le 17 mars : mars est écarté, avril est comparable.
Un relevé qui s'arrête le 12 mai : mai est écarté, avril est comparable.

Les mois de bord sont donc gardés **quand ils sont entiers**. C'est tout
l'intérêt d'une déclaration.

**Le format actuel ne déclare rien.** Ce régime existe dans le code
(`moisComparables(mois, bornes)`) et il est testé, mais rien ne l'alimente
encore. C'est le lot B qui ajoutera les dates de relevé au format de fichier.

### Régime 2 — couverture inférée (le repli d'aujourd'hui)

Faute de déclaration, on infère les bornes : **le premier et le dernier mois
porteurs d'une transaction**. Et ces deux mois-là sont **exclus**.

Pourquoi les exclure : on ignore si le relevé commence le 1er ou le 17 du mois,
et si le dernier mois est terminé. Les compter reviendrait à diviser une
dépense partielle par un mois entier — une moyenne fausse, mais d'apparence
normale.

Tout mois strictement compris entre les deux bornes est réputé entier.

Les bornes se calculent sur le **jeu complet**, jamais sur la période affichée.
Sinon un filtre « 3 derniers mois » se fabriquerait ses propres bornes et ferait
disparaître deux mois sur trois. La période affichée ne fait que **restreindre**
la liste des mois comparables.

## Les deux conséquences assumées

**1. Le mois en cours n'entre jamais dans une moyenne.** C'est toujours la
borne haute. Les écrans le disent explicitement — sinon cela ressemble à un
bug.

**2. Un mois comparable sans dépense vaut 0 € et compte.** C'est une vraie
valeur, pas une absence. Les mois sont désormais engendrés depuis le
**calendrier** entre les bornes, et non filtrés depuis les données. Certaines
moyennes baissent : elles étaient surévaluées.

## Les cas limites

| Données | Mois comparables | Pourquoi |
|---|---|---|
| Aucune transaction | aucun | Pas de bornes |
| 1 seul mois | aucun | Borne de début **et** de fin |
| 2 mois | aucun | Deux bornes, rien entre elles |
| 3 mois | 1 — celui du milieu | Le seul encadré |
| Trou au milieu (mois sans transaction) | comparable, **0 €** | Encadré par des mois de données |
| Mois intérieur à une seule dépense | comparable, **mois entier** | Le nombre de dépenses ne mesure pas la complétude |
| Période affichée hors de la couverture | aucun | L'intersection est vide |
| Bornes déclarées, mois de bord entiers | inclus | La déclaration prime |

Tous ces cas sont couverts par `src/__tests__/utils/couverture.test.ts`.

## Ce que cette règle remplace

`MIN_DAYS_FOR_MONTH = 15` dans `useBudgetData.ts` : un mois n'entrait dans la
moyenne que s'il comptait au moins 15 **jours distincts** porteurs d'une
transaction.

Deux choses sans rapport. Un mois où l'on ne paie que trois prélèvements est un
mois complet. Et quand aucun mois ne passait le seuil, la moyenne valait 0 —
donc « conforme » face à n'importe quel objectif. Le cas est reproduit dans
`src/__tests__/hooks/budgetSansMoisComparable.test.ts`.

## Quand la moyenne est indisponible

Sans aucun mois comparable, `useBudgetData` rend `null` — jamais 0, jamais
100 % :

| Champ | Valeur |
|---|---|
| `averageMonthly` | `null` |
| `ecartValue`, `ecartPct` | `null` |
| `status` | `"indisponible"` |
| `totalActual`, `balance` | `null` |
| `complianceRate` | `null` |
| `overrunCount` | `null` |
| `totalBudgeted` | inchangé — la somme des objectifs reste connue |

Les pages **Budget mensuel**, **Dépenses** et **Comptes** affichent alors un
message qui explique pourquoi, et non un tiret muet.

## Ce qui reste à faire

**Lot B — format public.** Ajouter `debut` et `fin` de relevé dans le fichier
source, et alimenter le régime 1. C'est la seule façon de récupérer les mois de
bord et de cesser d'inférer.

**Lot B — un jeu = un tout.** La couverture doit voyager avec les données
(transactions + paie + configuration + objectifs + origine + couverture), et
être persistée avec elles.

**Lot B — couverture par compte.** Aujourd'hui la couverture est celle du jeu
entier. Si un compte a été ajouté en cours de route, ses premiers mois sont
comptés comme couverts alors qu'il n'existait pas encore. La règle actuelle
sous-estime donc ses moyennes.

**Lot B — afficher la couverture.** L'utilisateur devrait voir sur quels mois
ses moyennes sont calculées, et pas seulement qu'elles existent.

## Limite honnête

La couverture inférée est une **supposition prudente**, pas une mesure. Elle
peut écarter des mois parfaitement entiers — un relevé qui commence
effectivement le 1er mars perd mars sans raison. Nous préférons perdre un mois
juste plutôt qu'en garder un faux : une moyenne fausse ne se voit pas, une
moyenne absente se voit.
