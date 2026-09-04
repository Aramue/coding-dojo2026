---
title: Moteur de validation
tags:
  - architecture
  - validation
mis-a-jour: 2026-09-04
---

# Moteur de validation

C'est la pièce qui remplace le professeur comme validateur. Quatre types de test couvrent tout
le chapitre 1, et rendent l'un des trois verdicts décrits ci-dessous.

## 1. `sortie` — comparer l'affichage

Exécute le programme avec des `input()` simulés et compare `stdout` à une valeur attendue.
C'est la reprise directe des fichiers `résultatattendu.txt` de l'an dernier.

### Les trois niveaux de réussite

> [!important] Rien, une coche, deux coches
> - **ROUGE — rien.** L'exercice n'est pas validé, et l'élève lit ce qui cloche.
> - **BLEU — une coche.** L'exercice **est** validé et la suite est débloquée. Deux causes
>   possibles : la sortie ne correspond qu'après normalisation (espaces multiples et de fin,
>   casse, accents, variantes `->` / `→` / `:`, emoji ignorés), ou un critère de maîtrise n'est
>   pas atteint.
> - **VERT — deux coches.** La sortie est exacte au caractère près, et la méthode que l'exercice
>   fait travailler est employée.
>
> ==Une coche suffit à valider== : la seconde récompense, elle ne conditionne rien. Aucun
> exercice ne se ferme derrière une coche manquante, aucune progression ne la compte.

Quand les deux causes de BLEU se présentent ensemble, ==le format l'emporte== : c'est celle des
deux qui montre un diff, donc la plus utile à l'élève sur le moment.

### Comment l'écart est montré

Deux lignes, `Attendu` et `Obtenu`, chacune reconstituée **en entier** depuis les mêmes segments :
la première porte le commun et ce qui manque, la seconde le commun et ce qui est en trop. Les
espaces y sont visibles (`·`), les retours à la ligne aussi (`⏎`).

> [!danger] Une chaîne hybride n'est ni l'une ni l'autre
> L'affichage entrelaçait d'abord les deux sorties en une seule chaîne, chaque caractère portant
> sa couleur. Très lisible sur un écart d'un espace ; illisible dès que les deux textes s'éloignent.
> « banane » face à « Bonjour tout le monde » donnait ==« Bobanjour tout le moande »== — la plus
> longue sous-séquence commune n'est alors qu'un semis de lettres isolées, et le résultat ne
> ressemble à aucune des deux sorties.
>
> Le surlignage n'apparaît donc que s'il a quelque chose à pointer : il faut qu'au moins **trois
> dixièmes** de la plus longue des deux sorties soient communs. En dessous, les deux lignes
> s'affichent nues, et le conseil change — il n'y a rien à comparer caractère par caractère, il y
> a l'énoncé à relire.

Le meilleur verdict obtenu est conservé : rejouer moins bien ne retire pas une coche déjà gagnée.
La liste d'exercices et l'écran d'exercice affichent tous deux le nombre de coches, et l'écran
rappelle en plus la **date de la première réussite** quand l'élève y revient.

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
> problèmes narratifs aussi, et le BLEU affiche systématiquement le diff. La coche manquante,
> visible dans la liste comme sur l'écran de l'exercice, dit sans bloquer qu'il reste quelque
> chose à reprendre.

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

### `maitrise` — la seconde coche

Un `contient` marqué `maitrise: true` **ne disqualifie pas**. Il est vérifié en dernier, quand le
programme marche déjà, et il décide seulement de la seconde coche.

```yaml
tests:
  - type: contient
    motif: "{"
    maitrise: true
    message: >-
      L'exercice est validé. Tu peux le refaire avec un f-string : un f collé devant les
      guillemets, et la variable entre accolades.
```

C'est le mécanisme qui distingue « ça marche » de « ça marche de la bonne façon », sur les
exercices où plusieurs écritures donnent exactement la même sortie. Dans le chapitre 1 il ne sert
qu'au f-string, sur `s1-31`, `s1-33` et `s1-34` : une concaténation avec `+` y produit le même
affichage, et reste donc valide.

> [!tip] Choisir un motif que le bon geste ne peut pas rater
> Le critère porte sur l'**accolade**, pas sur `f"`. Un élève qui écrit `f'...'` avec des
> guillemets simples fait exactement ce qu'on lui demande : le lui refuser serait un faux négatif,
> et le message d'aide serait incompréhensible. ==L'accolade, elle, ne peut venir que de là== à ce
> stade du cours — et une accolade dans une chaîne ordinaire ferait échouer la comparaison de
> sortie bien avant.

Le schéma refuse `maitrise` sur un `interdit` : un interdit disqualifie par définition, le marquer
laisserait croire qu'il ne coûte qu'une coche.

> [!danger] Le piège côté outillage
> `valider_contenu.py::_passe` répond à deux questions différentes. De la **solution de
> référence** on exige tout, critères de maîtrise compris — une solution qui n'emploie pas la
> méthode récompensée ne sert de modèle à personne. Du **code de départ** on demande seulement
> s'il est déjà validé aux yeux de l'élève, ce qui n'inclut pas la maîtrise. Sans cette
> distinction (`exiger_maitrise=False`), un départ qui résout déjà l'exercice sans la bonne
> méthode passerait inaperçu.

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
3. Les contraintes `interdit` / `contient` **exigeantes** sont-elles respectées ?
4. Les tests `sortie` / `variable` / `qcm` passent-ils ?
5. Les critères de `maitrise`, en dernier. À ce point le programme marche : ils ne peuvent plus
   rien invalider, ils décident de la seconde coche.

==On ne montre jamais plus d'un échec à la fois.== Trois messages d'erreur simultanés découragent ;
un seul se corrige.

## Voir aussi

[[Modèle de contenu]] · [[Types d'exercices]] · [[Moteur d'exécution]]
