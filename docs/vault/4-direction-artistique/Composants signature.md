---
title: Composants signature
tags:
  - direction-artistique
  - composants
mis-a-jour: 2026-10-28
---

# Composants signature

Les éléments repris des decks qui rendent l'interface reconnaissable.

## La carte de code

Le composant le plus identifiable des slides. Fond `#282A36`, coins arrondis, trois pastilles
macOS `#FF5F56` `#FFBD2E` `#27C93F`, et une légende optionnelle.

> [!note] Détail à respecter
> La légende de la carte est en **General Sans**, pas en chasse fixe — c'est déjà le cas dans
> les decks, où la légende « Déclaration de variables en Python » est composée en sans-serif.
> Seul le contenu du bloc est en monospace. Voir [[Typographie]].

Dans l'interface, cette carte devient **l'éditeur**.

## Le soulignement tracé main

Un trait légèrement irrégulier sous les titres de section, en SVG. Repris tel quel des decks.

> [!success] Dessiné le 28 octobre 2026
> Sous chaque titre de page (`.page__titre::after`, dans `signature.css`) : un trait de feutre,
> épais au départ, qui s'affine. Le dessin est un **masque** SVG, la couleur vient de `--encre` —
> le même trait prend la teinte de chaque notion.

## Le papier

Depuis le 28 octobre 2026, le canevas porte un grain très léger (`body::before`, en `multiply`,
transparent aux clics). Avec lui, les cartes perdent leur bordure et se posent par une ombre
**chaude**, teintée de brun ; le menu se fond dans le canevas, et le quiz éteint perd ses
pointillés de champ de formulaire. Tout vit dans `signature.css`, chargé après `app.css` : des
retouches de surface, aucune mise en page.

## Les flèches courbes dessinées à la main

Elles servaient dans les slides à relier un titre à un bloc de code. Dans l'interface, elles
relient ==un indice à la ligne de code concernée==.

## Le `>>>` vert

Marque la sortie du programme, en `#50FA7B`. Présent dans les decks, conservé.

## Le numéro de page

En bas à droite, en gras, dans l'encre de la famille. Devient **l'indicateur de progression**
de l'élève.

## Ce qui n'existe pas dans les decks et n'existera pas dans l'interface

> [!warning] Écartés délibérément
> - Les **pilules** (`border-radius: 999px`) autour de libellés qui ne portent aucun état
> - Les **capitales interlettrées**
> - La **monospace décorative**
> - Un même rayon d'arrondi et une même ombre appliqués à tous les blocs, ce qui aplatit la
>   hiérarchie
>
> Les seules formes conservées sont celles qui **encodent un état** : les pastilles de statut du
> tableau de bord, où la couleur et la forme disent « bloqué », « en cours » ou « terminé ».

## Voir aussi

[[Charte visuelle]] · [[Palette]] · [[Typographie]]
