---
title: Programme d'assemblage
tags:
  - pedagogie
mis-a-jour: 2026-09-04
---

# Programme d'assemblage

Chaque séance se termine par **un petit programme complet**, qui réunit les notions vues dans la
séance. C'est ce qui remplace le « problème à rendre » séparé : l'élève ne découvre pas un
énoncé neuf en fin de parcours, il assemble ce qu'il vient d'apprendre.

## Séance 1 — la carte de membre

`s1-34`. Le programme demande un prénom et un âge, convertit l'âge en nombre entier, calcule
l'âge de l'année suivante, et affiche quatre lignes au format exact.

```
=== CARTE DE MEMBRE ===
Nom : Camille
Age : 17 ans
L'an prochain : 18 ans
```

Notions réunies : `input()`, `int()`, le f-string, `print`, et le format exact. Rien d'autre.

## Séances 2 et 3 — conçues, sujet à retrancher

> [!danger] Le sujet de ces deux blocs n'est plus valide
> Ils étaient conçus autour d'un programme `acces_qg.py` construit sur les trois séances, dont la
> version finale reproduisait un fichier du cours précédent. ==Le choix « chaque exercice est
> autonome » ([[ADR-010 Abandon de la fiction narrative]]) supprime ce fil rouge.==
>
> **La progression technique ci-dessous reste bonne. Seul son habillage est à refaire**, quand
> les séances 2 et 3 seront produites.

| Bloc | Séance | Ce que le programme sait faire en plus |
|---|---|---|
| 2 | 2 | Vérifie un intervalle (`18 <= age <= 65`), calcule une valeur dérivée, affiche un verdict puis le résultat. Conditions. |
| 3 | 3 | Boucle sur les caractères d'un nombre converti en texte et les affiche un par un. Boucles. |

## L'injection de bloc manquant

> [!success] Aucun bloc n'est un point de blocage unique
> Si un élève n'a pas fini le programme de la séance précédente — absence, lenteur, échec —
> ==la plateforme injecte la version de référence, visiblement étiquetée== pour l'élève et pour
> le professeur, et le programme complet tourne quand même.

C'est la propriété de rétention la plus importante du dispositif, et elle ne dépend **pas** du
sujet : elle survit intacte à l'abandon de la fiction. Elle change la nature du travail à la
maison : ce n'est jamais « écris ce programme », c'est **« il manque un morceau à ton programme
qui tourne déjà »**. Un élève absent en semaine 2 revient en semaine 3 sans être perdu.

Rappel du problème traité : en 2025, 18 élèves sur 24 ont décroché ([[Bilan 2025-2026]]).

> [!warning] Non implémentée
> L'injection est un choix de conception, pas encore du code. Rien dans la plateforme ne la fait
> aujourd'hui. À traiter avec les séances 2 et 3.

## Ce que la réécriture a coûté

La séance 3 devait être ==la moins chère des trois== : son énoncé, son corrigé et son fichier de
résultat attendu existaient déjà dans le dépôt 2025, et étaient réutilisables tels quels.

En retirant la fiction, **on perd cette réutilisation** : le fichier de 2025 est écrit autour du
Quartier Général. Il reste utile comme référence de difficulté et de format, mais son texte est à
réécrire. C'est le prix assumé de la décision — voir [[Plan de production]].

## Le pont vers le chapitre 2

L'exercice expert de la séance 3 demande une accumulation de chaîne caractère par caractère.
C'est — sans qu'on le dise aux élèves — ==le squelette exact du chiffrement de César== qui ouvre
le chapitre 2. Ce pont ne dépend d'aucun habillage narratif : il tient.

## Voir aussi

[[Chapitre 1]] · [[Types d'exercices]] · [[Plan de production]] · [[ADR-004 Mode expert en bonus débloqué]]
