---
title: Séance 4
tags:
  - pedagogie
  - contenu
statut: écrit
mis-a-jour: 2026-10-27
---

# Séance 4 — Listes, bits et caractères

> [!abstract] Ce que la séance prépare
> Le **TP de stéganographie** : retrouver un message caché dans les deux derniers bits du canal
> rouge de la première ligne d'une image. Le TP suppose des compétences que le chapitre 1 n'a
> jamais enseignées — listes, matrices, binaire, ASCII, opérateurs sur les bits — et que les
> élèves ont besoin d'avoir travaillées **indépendamment et en amont**. Cette séance les couvre.

Le TP présenté aux élèves reste celui du dossier `tp_stegano_26` ; ses incohérences connues
(canal vert ou rouge, 960 pixels ou largeur entière) sont assumées et ne sont pas reprises ici.

## Les consignes du TP, sur la plateforme

Depuis le 28 octobre 2026, les consignes du TP existent **en version texte**, en complément des
slides : `contenu/chapitre-1/tp/stegano.yaml`, lues sur `/tp/stegano`. Huit étapes, chacune avec
son objectif, ce qu'il faut vérifier à l'écran et des indices repliés : préparer le dossier,
charger l'image, lire un pixel, comprendre les deux bits de poids faible, récupérer les 1920 bits,
les regrouper en lettres, afficher le message — puis un bonus, cacher son propre message.

Elles suivent les slides : canal **rouge**, **première ligne**, **960 premiers pixels**, fichier
`requirements_steno.py`, fonctions `open_image_np_array` et `get_lsb`.

> [!question] Pourquoi un ET logique pour les deux bits de poids faible ?
> `valeur & 0b11` agit sur le **nombre** : le masque `00000011` met à 0 tous les bits sauf les
> deux derniers. Une sélection dans le texte de `bin(valeur)` paraît plus simple mais se trompe
> sans prévenir : `bin` n'écrit pas les zéros de gauche, et `bin(1)[-2:]` vaut `'b1'`, pas `'01'`.
> Elle oblige aussi à passer du nombre au texte puis au nombre, quand le ET reste dans les nombres.
> L'équivalent le plus facile à expliquer en classe est **`valeur % 4`** : les deux derniers bits
> valent au plus 3, et le reste de la division par 4 est exactement le nombre qu'ils forment. Les
> consignes montrent les deux, côte à côte.

## Le volume

| | Séance 4 |
|---|---|
| Exercices | **40** |
| dont obligatoires | **28** |
| dont renforts | 4 |
| dont experts | 8 |
| `predire` | 16 |
| `debug` | 5 |
| `completer` | 5 |
| `ecrire` | 14 |

Cinq notions, **pas six** : il n'existe que cinq couleurs de notion, et deux notions voisines de
la même couleur se lisent comme une seule (test `test_les_notions_d_un_meme_chapitre_ont_des_couleurs_distinctes`).

| Notion | Exercices | Leçon | Durée |
|---|---|---|---|
| Rappels avant les listes | `s4-01` à `s4-03` — 3 obligatoires | `c4-reprise` | 3 min |
| Les listes | `s4-04` à `s4-12` — 6 obligatoires, 1 renfort, 2 experts | `c4-listes` | 5 min |
| Listes de listes | `s4-13` à `s4-21` — 6 obligatoires, 1 renfort, 2 experts | `c4-matrices` | 4 min |
| Binaire et caractères | `s4-22` à `s4-29` — 5 obligatoires, 1 renfort, 2 experts | `c4-binaire` | 4 min |
| Bits de poids faible et décodage | `s4-30` à `s4-40` — 8 obligatoires, 1 renfort, 2 experts | `c4-decoder` | 6 min |

## D'où vient la liste des compétences

Elle a été extraite du TP et de sa correction (`correction_stegano.py`). Chaque compétence a au
moins un exercice **isolé**, avant d'être réunie dans le programme d'assemblage.

| Compétence du TP | Où elle se travaille |
|---|---|
| Un texte se construit avec `+=` ; `str()` avant de concaténer | `s4-01`, `s4-03` |
| `range(début, fin, pas)` | `s4-02`, et `s4-36` en usage réel |
| Liste, position à partir de 0, `len()` | `s4-04`, `s4-05`, `s4-07`, `s4-10` |
| Un pixel est une liste `[r, g, b]` | `s4-06` |
| `append()` sur une liste vide | `s4-05`, `s4-08`, `s4-17` |
| Parcourir une liste avec `for` | `s4-09`, `s4-17` |
| Liste de listes, accès `[ligne][colonne][couleur]` | `s4-13` à `s4-15` |
| `image[0, x]` (NumPy) contre `image[0][x]` | `s4-16` |
| Boucles imbriquées | `s4-18`, `s4-36` |
| Hauteur et largeur avec `len()` | `s4-19` |
| `int(texte, 2)` | `s4-22`, `s4-24`, `s4-27` |
| `chr()` et `ord()`, table ASCII | `s4-23` à `s4-26` |
| Binaire sur 8 bits, décimal vers binaire | `s4-22`, `s4-28` |
| `&`, `>>`, les deux bits de poids faible | `s4-30`, `s4-31`, `s4-38` |
| Appeler une fonction fournie, lire sa description | `s4-32`, `s4-34` |
| Déballer deux valeurs rendues (`a, b = f(x)`) | `s4-32` à `s4-34` |
| Regrouper les bits par huit | `s4-36` |
| Choisir un canal de couleur (`if` / `elif`) | `s4-40` |
| Cacher des bits (`\|`) | `s4-39` |

## Le programme d'assemblage

`s4-37`, « Le message caché dans l'image ». Une image de deux lignes de seize pixels cache le mot
`DOJO` dans les deux derniers bits du rouge de sa **première ligne** ; la seconde ligne est du
bruit, pour que lire la mauvaise ligne ne donne rien. La fonction `get_lsb` est fournie, comme dans
`requirements_stegano.py`. Le programme réunit : boucle sur la première ligne, `get_lsb`, liste de
bits, regroupement par huit, `int(..., 2)`, `chr()`, concaténation.

Voir [[Programme d'assemblage]].

## Écarts assumés avec le TP

- **Pas de NumPy ni de PIL.** Pyodide les chargerait au prix de plusieurs mégaoctets de plus par
  élève, et le réseau des salles est le risque identifié ([[Contraintes]]). L'image est donc une
  liste de listes écrite dans l'énoncé. `s4-16` fait rencontrer l'écriture `image[0, 1]`, qui
  marche avec NumPy et plante avec des listes, pour que le TP n'ait plus rien de surprenant.
- **`get_lsb` est donnée, pas écrite.** Le chapitre 1 reste sans définition de fonction
  ([[Contraintes]]). La séance enseigne à **lire** une fonction et à l'**appeler**, comme le fait
  le TP : `def` apparaît dans le code de départ, jamais dans ce que l'élève écrit.
- **`bin()` n'est utilisé que dans la leçon**, pour montrer les bits. `s4-28` l'interdit, puisque
  c'est la conversion à la main qui fait le défi.
- **Aucun exercice n'emploie `input()`.** Les données sont dans l'énoncé : un tableau de pixels
  ne se tape pas.
- **`s4-12` et `s4-40`** valident sur la variable, pas sur la sortie : leur défi est la méthode.

## Calibrage horaire

28 obligatoires = 11 `predire` (1,5 min) + 4 `completer` (3,5) + 5 `debug` (5) + 8 `ecrire`
(3, 3, 4, 6, 4, 3, 7 et 15) = **100,5 min**, pour 15 min de théorie et 105 min de pratique.
Marge : 4,5 min.

> [!note] Plan de coupe
> Si la salle décroche, couper dans cet ordre : `s4-14`, `s4-23`, `s4-09` (−6 min). Décidé à
> l'avance, comme pour les séances précédentes ([[Plan de production]]).

## Où vit le contenu

```
contenu/chapitre-1/seance-4/
  s4-01.yaml … s4-40.yaml
  lecons/
    c4-reprise.yaml · c4-listes.yaml · c4-matrices.yaml · c4-binaire.yaml · c4-decoder.yaml
```

Le dossier reste sous `chapitre-1/` parce que `construire_contenu.py` et `valider_contenu.py`
prennent ce dossier pour racine par défaut : un autre emplacement exigerait de toucher à
l'outillage pour rien. Le chapitre `stegano` de [[Modèle de contenu]] est, lui, indépendant du
dossier.

> [!note] Ouverture le 27 octobre 2026
> `CHAPITRES["stegano"]["ouverture"]` vaut `2026-10-27`, un mardi : la séance est ouverte dès
> sa publication, sans attendre un mercredi ([[ADR-013 Une séance s'ouvre à sa date]]).

## Outillage touché

`outils/schema.py` n'acceptait que les séances 1 à 3 : `seance` borné à 4, `MOTIF_ID` en
`s[1234]`, `MOTIF_LECON` en `c[1234]`, cinq notions et un chapitre en plus. Le type TypeScript
`seance` du front suit. Les quiz restent bornés à la séance 3 : la séance 4 n'en a pas.
