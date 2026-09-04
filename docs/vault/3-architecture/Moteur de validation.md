---
title: Moteur de validation
tags:
  - architecture
  - validation
mis-a-jour: 2026-09-03
---

# Moteur de validation

C'est la pièce qui remplace le professeur comme validateur. Quatre types de test couvrent tout
le chapitre 1.

## 1. `sortie` — comparer l'affichage

Exécute le programme avec des `input()` simulés et compare `stdout` à une valeur attendue.
C'est la reprise directe des fichiers `résultatattendu.txt` de l'an dernier.

### Le verdict à deux niveaux

> [!important] VERT et BLEU
> - **VERT — mission accomplie.** La sortie est exacte, au caractère près.
> - **BLEU — logique correcte, format à ajuster.** La sortie correspond après normalisation
>   (espaces multiples et de fin, casse, accents, variantes `->` / `→` / `:`, emoji ignorés).
>
> ==Le BLEU valide l'exercice et débloque la suite==, tout en affichant le diff caractère par
> caractère.

Ce n'est pas une tolérance de confort, c'est la reproduction fidèle de ce que le professeur a
**fait** en 2025 : écrire `BIEN PB AFFICHAGE` sur la copie et laisser passer.

> [!danger] Sans ce mécanisme, la plateforme est plus sévère que l'humain
> En comparaison stricte, ==la plateforme recalerait automatiquement six élèves sur dix-sept que
> le professeur avait validés==. Un élève a été recalé en 2025 pour avoir écrit `->` au lieu de
> `→`. Les fichiers de référence contiennent des `✅` et des apostrophes typographiques.
>
> Recréer cette sévérité, c'est recréer exactement l'abandon que la plateforme doit corriger.
> Voir [[Bilan 2025-2026]].

Sauf que cette fois, l'élève **voit l'écart lui-même**, vingt-quatre fois en parallèle, et entre
les séances — au lieu de le découvrir sur une copie annotée deux semaines plus tard.

> [!warning] Le risque du BLEU, et sa mitigation
> Un élève pourrait ne jamais corriger son formatage et arriver au chapitre 2 sans la compétence.
>
> Mitigation : les cinq exercices **dont l'objectif est le format exact** exigent le VERT, les
> problèmes narratifs aussi, et le BLEU affiche systématiquement le diff.

## 2. `variable` — inspecter l'état final

Après exécution, lit la valeur et le type d'une variable dans l'espace de noms.

```yaml
tests:
  - type: variable
    nom: age
    type_attendu: int
```

C'est ce qui fait fonctionner les exercices à trous `_____` hérités des notebooks, et c'est le
test qui diagnostique le mieux ==l'erreur de conversion de type==, la plus fréquente dans les
copies de l'an dernier ([[Bilan 2025-2026]]).

## 3. `qcm` — prédire sans écrire

Pour les exercices de type `predire` : on montre du code, l'élève dit ce qui s'affiche.
Aucune exécution du côté de l'élève, aucune syntaxe à maîtriser. C'est le seul type d'exercice
sur lequel un débutant absolu **ne peut pas rester bloqué**.

## 4. `contient` / `interdit` — contraindre la méthode

```yaml
tests:
  - type: interdit
    motif: 'print("Camille'
  - type: contient
    motif: 'for '
```

> [!warning] Sans ce type, la plateforme est triviale à contourner
> Un élève malin qui lit la sortie attendue écrit `print("196")` et valide le chapitre en dix
> minutes. `interdit` empêche de coder la réponse en dur ; `contient` force l'usage de la
> structure enseignée.

## Une exécution par test, pas une pour l'exercice

Un exercice peut déclarer **plusieurs tests `sortie` avec des jeux d'entrées différents**, pour
vérifier que la solution généralise et pas seulement qu'elle marche sur le premier exemple. C'est
le cas de `s1-30`, `s1-31` et `s1-34`.

> [!danger] Le piège
> Réutiliser une seule exécution partagée compare la sortie obtenue avec les entrées A à l'attendu
> écrit pour les entrées B. ==Une solution correcte est alors refusée.== Le défaut n'apparaît
> qu'avec un exercice à entrées multiples : il a été trouvé en résolvant réellement les 25
> exercices dans le navigateur, jamais par les tests unitaires.

`EcranExercice` lance donc une exécution par test, avec les entrées qui lui appartiennent :

- les exécutions au **même jeu d'entrées sont mises en cache** — même code, mêmes entrées, même
  résultat ;
- les tests `interdit`, `contient` et `qcm` n'inspectent jamais l'exécution : ils ne sollicitent
  pas Pyodide ;
- un test `variable` relit l'espace de noms d'une exécution **sans entrée**, miroir de
  `valider_contenu.py::_passe` ;
- les exécutions sont lancées **l'une après l'autre**. `Executeur` ne pilote qu'un seul worker :
  un second appel concurrent écraserait le gestionnaire de réponse du premier, qui expirerait en
  silence.

## Ordre d'évaluation

1. La syntaxe est-elle valide ? Sinon → message de syntaxe, on s'arrête.
2. Le programme s'exécute-t-il sans exception ? Sinon → [[Messages d'erreur en français]].
3. Les contraintes `interdit` / `contient` sont-elles respectées ?
4. Les tests `sortie` / `variable` / `qcm` passent-ils ?

==On ne montre jamais plus d'un échec à la fois.== Trois messages d'erreur simultanés découragent ;
un seul se corrige.

## Voir aussi

[[Modèle de contenu]] · [[Types d'exercices]] · [[Moteur d'exécution]]
