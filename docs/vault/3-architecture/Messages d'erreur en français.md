---
title: Messages d'erreur en français
tags:
  - architecture
  - pedagogie
mis-a-jour: 2026-09-03
---

# Messages d'erreur en français

> [!important] La fonctionnalité au plus fort effet
> C'est, de tout le projet, la pièce qui réduit le plus directement le nombre de mains levées.
> Un débutant devant `TypeError: can only concatenate str (not "int") to str` ne peut rien
> faire d'autre qu'appeler le professeur : le message est en anglais, il nomme des types qu'il
> ne connaît pas, et il ne dit pas quoi corriger.

Les copies corrigées de l'an dernier montrent que ==les échecs portaient sur la mécanique du
langage, pas sur la logique== ([[Bilan 2025-2026]]). Ce sont exactement les erreurs qu'un
dictionnaire de traductions sait diagnostiquer.

## Principe

Chaque exception Python fréquente est traduite en trois éléments :

1. **Ce qui s'est passé**, en français, sans jargon
2. **Pourquoi**, rattaché à ce que l'élève vient d'écrire
3. **Quoi essayer**, concret et actionnable

## Le noyau

Une quinzaine d'entrées couvrent l'essentiel de ce que produit un débutant.

| Exception | Message affiché |
|---|---|
| `NameError` | *La variable `nom` n'existe pas encore. Tu l'as peut-être écrite différemment plus haut ? Python distingue `Nom` et `nom`.* |
| `TypeError` (str + int) | *Tu essaies de coller un nombre à du texte. Python refuse. Transforme-le d'abord : `str(age)`.* |
| `ValueError` (int) | *`int()` attend des chiffres, pas des lettres. Vérifie ce que tu lui donnes.* |
| `SyntaxError` (`:` manquant) | *Il manque un `:` à la fin de la ligne. En Python, `if`, `for` et `while` finissent toujours par deux-points.* |
| `IndentationError` | *Cette ligne n'est pas alignée avec les autres. Tout ce qui est à l'intérieur d'un `if` ou d'un `for` doit être décalé de la même façon.* |
| `ZeroDivisionError` | *Division par zéro. Vérifie la valeur de ton diviseur avant de diviser.* |
| Boucle infinie (5 s) | *Ton programme tourne en rond — vérifie que ta condition finit par devenir fausse.* |

## Ce que le message ne fait jamais

> [!warning] Ne pas donner la réponse
> Le message nomme l'erreur et oriente. Il ne récrit pas la ligne. Sinon la plateforme résout
> l'exercice à la place de l'élève, et on a remplacé un professeur trop sollicité par un
> correcteur automatique trop bavard.

Les indices progressifs, eux, sont **explicitement demandés** par l'élève et se débloquent après
un nombre d'essais — c'est un autre mécanisme, volontairement séparé.

## Voir aussi

[[Moteur de validation]] · [[Types d'exercices]] · [[Bilan 2025-2026]]
