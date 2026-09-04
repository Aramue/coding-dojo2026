---
title: ADR-011 Trois niveaux de réussite
tags:
  - decision
  - pedagogie
  - validation
statut: acceptée
date: 2026-09-04
---

# ADR-011 — Trois niveaux de réussite

> [!success] Statut : acceptée le 4 septembre 2026

## Contexte

Le verdict était binaire à l'affichage : réussi, ou pas. Le BLEU existait déjà — il valide
l'exercice quand la sortie ne correspond qu'après normalisation — mais rien ne le distinguait du
VERT dans la liste d'exercices ni dans la progression. Une coche, dans les deux cas.

Ce silence coûtait deux choses.

D'un côté, l'élève qui passe en BLEU pour un problème de format **n'a aucune raison de revenir**.
[[Moteur de validation]] posait déjà le risque : arriver au chapitre 2 sans la compétence, là où
le format compte. Le diff est affiché sur le moment, puis disparaît.

De l'autre, plusieurs exercices acceptent des solutions de qualité franchement différente pour la
même sortie. `s1-31`, `s1-33` et `s1-34` demandent d'assembler du texte et une variable : une
concaténation avec `+` produit exactement le même affichage qu'un f-string. Les leçons `s1-23` et
`s1-24` enseignent le f-string ; la plateforme ne le récompensait nulle part.

## Décision

**Trois niveaux, deux coches.**

| Verdict | Coches | Ce que ça veut dire |
|---|---|---|
| ROUGE | aucune | l'exercice n'est pas validé, l'élève lit ce qui cloche |
| BLEU | une | ça marche, et la suite est ouverte |
| VERT | deux | ça marche, et de la bonne façon |

Un exercice peut déclarer un **critère de maîtrise** : un test `contient` marqué `maitrise: true`.
Il est vérifié en dernier, quand le programme marche déjà, et ne coûte que la seconde coche.

L'élève qui revient sur un exercice validé lit la **date de sa première réussite** et sa mention.
Sur une coche, la mention dit ce qui reste à faire.

## Pourquoi

==Une coche suffit à valider. La seconde récompense, elle ne conditionne rien.== Aucun exercice ne
se ferme derrière une coche manquante, aucune progression ne la compte : `faits / total` reste le
décompte des obligatoires réussis, quel que soit le nombre de coches.

C'est la même logique que [[ADR-004 Mode expert en bonus débloqué]] appliquée à l'intérieur d'un
exercice. Le chemin minimal ne doit jamais se durcir — c'est lui qui mène à la certification, et
le [[Bilan 2025-2026]] dit assez ce que coûte un obstacle de plus. Mais un élève qui a fini a
maintenant quelque chose à faire de plus que d'attendre, **sur les exercices qu'il a déjà réussis**.

La date répond à une question que l'élève se pose vraiment en séance 2 : *est-ce que j'ai fait
celui-là ?* La mention répond à celle qu'il ne se posait pas : *est-ce que je l'ai bien fait ?*

## Ce qui n'a pas changé

- **Le BLEU valide toujours.** Il reproduit ce que le professeur a fait en 2025 : écrire
  `BIEN PB AFFICHAGE` et laisser passer. La seconde coche ajoute une information ; elle ne rétablit
  pas la sévérité que [[Moteur de validation]] écarte explicitement.
- **Les exercices dont l'objectif est le format exact** portent toujours `exige_exact: true` : là,
  le format n'est pas une nuance, c'est la consigne.
- **Le décompte de progression.** Menu, chapitre, notion, en-tête : tous continuent de compter des
  exercices réussis, pas des coches.

## Conséquences

- Le parcours renvoyé par l'API porte, pour chaque exercice réussi, son **verdict** et la **date de
  la première réussite**. ==Le meilleur verdict est conservé== : rejouer moins bien ne retire pas
  une coche déjà gagnée.
- `evaluer` gagne une quatrième passe, après les tests de contenu. Elle ne peut plus rien
  invalider. Quand un format approchant et une maîtrise manquée se présentent ensemble, le format
  l'emporte : c'est celui des deux qui montre un diff.
- `valider_contenu.py::_passe` distingue deux questions. De la solution de référence on exige tout,
  maîtrise comprise ; du code de départ on demande seulement s'il serait déjà validé aux yeux de
  l'élève. Voir [[Pièges et invariants]].
- Ceci **répond en partie** à la question ouverte de la gamification listée dans
  [[Journal de décisions]]. Deux coches, pas de points, pas de classement : la distinction porte
  sur le travail, pas sur la comparaison entre élèves.

## Alternatives écartées

- **Faire échouer la mauvaise méthode.** C'est ce que fait déjà un `contient` ordinaire. Appliqué
  au f-string, il aurait recalé une solution correcte qui affiche exactement ce qui est demandé —
  exactement la sévérité que le projet existe pour ne pas reproduire.
- **Un badge, un score, un classement.** Le public est un groupe de vingt-quatre adolescents dans
  une même salle. Un classement visible transforme un décrochage discret en humiliation publique.
- **Trois coches, une par critère.** Testé sur le papier : il faudrait alors expliquer ce que vaut
  chaque coche. Deux se comprennent sans légende.

## Voir aussi

[[Moteur de validation]] · [[Modèle de contenu]] · [[ADR-004 Mode expert en bonus débloqué]] · [[Bilan 2025-2026]]
