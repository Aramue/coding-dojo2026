---
title: ADR-006 Palette dérivée des slides
tags:
  - decision
  - direction-artistique
statut: acceptée
date: 2026-09-03
---

# ADR-006 — Palette dérivée des slides

> [!success] Statut : acceptée le 3 septembre 2026

## Contexte

Cinq decks de cours existent, réalisés sous Canva au format 1440×810, partageant un même
*brand kit* (`BAGEGa96lIU`). Ils constituent déjà une identité visuelle que les élèves ont vue
au tableau pendant tout un semestre.

L'analyse pixel des 77 pages a révélé que ==le fond change exactement aux frontières de concept==,
et qu'il s'inverse en sombre à chaque passage au vrai code Python.

## Décision

La plateforme reprend **la palette et la logique de composition des decks**, sans les inventer.

Cinq familles de concept, chacune avec un fond pastel, une encre et un fond sombre.
Valeurs exactes et provenance page par page : [[Palette]].

La règle centrale est formulée ainsi :

> [!quote] Fond pastel = j'apprends. Fond sombre = je code.
> L'élève sait où il est sans lire un mot.

## Conséquences

**Favorables**

- Continuité immédiate entre le tableau et l'écran : les élèves reconnaissent l'univers.
- La couleur **porte de l'information** (quel concept, quel mode) au lieu de décorer.
- Les contrastes ont été calculés : ==les cinq paires passent AA, quatre passent AAA.==

**Défavorables**

- Une famille a dû être **ajoutée** : conditions et boucles partageaient l'ambre dans les decks,
  faute de couleur disponible, alors que ce sont deux concepts que les élèves confondent.
  Le corail `#FFD9C2` / `#7A2800` / `#3C1400` comble ce manque en suivant le même écart.
- Trois fonds sombres ont dû être **extrapolés** : seule la famille ambre disposait de slides
  inversées dans les decks. Ils reproduisent l'écart `#FFE7C2 → #3C2500`.

## Contraintes d'usage découvertes au calcul

> [!warning] Deux couleurs ne peuvent pas servir de texte sur fond clair
> - Le jaune Python `#FFC331` tombe à **1.60** sur blanc. Réservé aux fonds sombres.
> - Le vert `#27C93F` des pastilles macOS tombe à **2.21**. Sur pastel, on utilise `#0F5C23`
>   pour le succès et `#9C1B15` pour l'erreur, calculés pour tenir sur les cinq fonds.
>
> Les decks n'ont jamais rencontré le problème parce qu'ils n'utilisent ces couleurs que sur
> fond sombre. L'interface, elle, doit l'expliciter.

## Alternative écartée

**Repartir d'une identité neuve.** Aurait gaspillé un actif existant et cohérent, et cassé la
continuité avec les supports de cours que les élèves auront sous les yeux en parallèle.

## Voir aussi

[[Charte visuelle]] · [[Composants signature]] · [[ADR-005 Typographie General Sans]]
