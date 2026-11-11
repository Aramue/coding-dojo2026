---
title: Messages d'erreur en français
tags:
  - architecture
  - pedagogie
mis-a-jour: 2026-09-14
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
| `TypeError` (`for` sur un nombre) | *On ne parcourt pas un nombre entier. `for` parcourt un texte caractère par caractère, ou les valeurs d'un `range()`. Pour parcourir les chiffres d'un nombre, transforme-le d'abord en texte avec `str()`.* |
| `SyntaxError` (`:` manquant) | *Il manque un `:` à la fin de la ligne. En Python, `if`, `for` et `while` finissent toujours par deux-points.* |
| `SyntaxError` (`=` au lieu de `==`) | *Un seul `=` là où Python attend une comparaison. Le signe `=` range une valeur dans une variable, il ne demande pas si deux valeurs sont égales.* |
| `IndentationError` | *Cette ligne n'est pas alignée avec les autres. Tout ce qui est à l'intérieur d'un `if` ou d'un `for` doit être décalé de la même façon.* |
| `ZeroDivisionError` | *Division par zéro. Vérifie la valeur de ton diviseur avant de diviser.* |
| Boucle infinie (5 s) | *Ton programme tourne en rond — vérifie que ta condition finit par devenir fausse.* |

> [!note] Le `=` à la place de `==`, ajouté avec la séance 2
> Depuis la version 3.10, Python devine l'erreur et le dit : *Maybe you meant '==' or ':='
> instead of '='?* — en anglais, et en citant un opérateur `:=` qu'aucun élève ne connaît.
> Sans règle dédiée, elle tombait sur le message générique, qui ne dit rien. Or c'est ==l'erreur
> la plus fréquente de la séance 2== : les exercices `s2-14` et `s2-19` la font rencontrer sous
> contrôle, puis chaque `if` peut la reproduire. Ajoutée le 14 septembre 2026.

> [!note] `KeyError`, ajouté avec la séance 5 (10 novembre 2026)
> Les dictionnaires rendent `KeyError` fréquent : une clé mal orthographiée, une majuscule, un
> niveau oublié dans une donnée imbriquée. Sans règle, le message tombait sur le générique
> « Relis la ligne signalée ». La règle nomme la clé telle que Python la rend (`'prenom'`),
> rappelle que ==les majuscules et les accents comptent==, et conseille `print()` sur le
> dictionnaire — jamais la ligne corrigée. `s5-06` et `s5-19` la font rencontrer sous contrôle.
> Le message `IndexError` parle encore de « caractère » : exact pour un texte, approximatif pour une
> liste ; non repris.

> [!note] Séances 5 et 6 : JSON et requêtes (10 novembre 2026)
> Cinq règles de plus, dont les exercices `s5-31`, `s6-11` et `s6-23` font rencontrer l'erreur :
>
> | Exception | Message |
> |---|---|
> | `JSONDecodeError` | *Ce texte n'est pas du JSON valide* — guillemets doubles, virgules ; l'apostrophe est la cause la plus fréquente |
> | `TypeError` (`'Response' object is not subscriptable`) | *Une réponse ne se lit pas comme un dictionnaire* — la piste renvoie à la leçon, sans écrire `.json()` |
> | `ConnectionError` | *Le service ne répond pas* — attendre, puis appeler le professeur : c'est peut-être le réseau de la salle |
> | `Timeout` | *Le service met trop de temps à répondre* |
> | `HTTPError`, `RequestException` | le message du dojo, déjà en français : adresse refusée, trop de requêtes, méthode non proposée |
>
> Ces noms ne figurent **pas** dans la liste blanche de `exceptions.ts` : le tableau de bord les
> compte sous `AutreErreur`. Les ajouter exigerait aussi la liste de l'API (`routes_eleve.py`).

## Ce que le message ne fait jamais

> [!warning] Ne pas donner la réponse
> Le message nomme l'erreur et oriente. Il ne récrit pas la ligne. Sinon la plateforme résout
> l'exercice à la place de l'élève, et on a remplacé un professeur trop sollicité par un
> correcteur automatique trop bavard.

Les indices progressifs, eux, sont **explicitement demandés** par l'élève et se débloquent après
un nombre d'essais — c'est un autre mécanisme, volontairement séparé.

## Voir aussi

[[Moteur de validation]] · [[Types d'exercices]] · [[Bilan 2025-2026]]
