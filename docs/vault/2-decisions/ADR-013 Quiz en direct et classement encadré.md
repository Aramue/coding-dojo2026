---
title: ADR-013 Quiz en direct et classement encadré
tags:
  - decision
  - pedagogie
  - professeur
statut: acceptée
date: 2026-09-27
---

# ADR-013 — Quiz en direct et classement encadré

> [!success] Statut : acceptée le 27 septembre 2026
> Elle **déroge** à [[ADR-011 Trois niveaux de réussite]] sur un point précis — le classement —
> et seulement à l'intérieur d'une partie de quiz. Tout le reste d'ADR-011 tient.

> [!warning] Précisée le 28 septembre 2026, après le premier essai du professeur
> **En salle d'attente, l'élève voit qui est prêt** : un rond et un « Prénom N. » par joueur, les
> mêmes que sur l'écran projeté au même moment — le professeur voulait voir la salle se remplir
> des deux côtés, pas un simple nombre. Rien de plus ne circule : ni nom de famille complet, ni
> code d'accès (le repli d'un élève sans prénom est « Élève »), et dès que la première question
> part, les noms ne circulent plus. Scores et rangs des autres restent invisibles à l'élève.
>
> **Le professeur relit les derniers résultats d'un quiz** depuis le catalogue : le taux de
> bonnes réponses de la dernière partie jouée, et son bilan anonyme. C'est le bilan de la partie
> — une répartition par question —, pas un classement : la règle 4 ci-dessous tient.

## Contexte

Le professeur veut un moment collectif en séance, sur le modèle de Kahoot : il lance une partie,
les élèves la rejoignent, répondent à des questions en temps limité, et un classement s'affiche
au fil de la partie.

[[ADR-011 Trois niveaux de réussite]] a écarté le classement, avec une raison qui n'a pas
disparu : ==un classement visible transforme un décrochage discret en humiliation publique==,
devant vingt-quatre adolescents de huit établissements qui ne se connaissent pas.

Ce que le quiz change, c'est la nature de ce qui est classé. ADR-011 parlait du **parcours** :
des semaines de travail, un chemin vers la certification, où être dernier dit « tu es en
retard ». Une partie de quiz dure dix minutes, porte sur des questions que tout le monde découvre
en même temps, et se termine. Être septième à la question 4 ne dit rien de personne.

## Décision

**Le quiz a un classement, et ce classement est tenu en laisse.**

1. **Seuls les cinq premiers sont projetés.** L'écran du professeur, celui que toute la salle
   voit, montre le haut du tableau et jamais le bas. Personne n'est désigné comme dernier.
2. **Chaque élève voit son propre rang, sur son seul écran.** « Tu es 12ᵉ sur 21 » est une
   information pour lui, pas une annonce à la classe.
3. **Le score ne compte nulle part ailleurs.** Ni dans la progression, ni dans les coches, ni dans
   la certification. Le tableau de bord ne le montre pas.
4. **Aucun classement ne subsiste d'une partie à l'autre.** Pas de cumul, pas de classement de la
   semaine : chaque partie repart de zéro.
5. **Les noms projetés sont « Prénom N. »**, tirés de la liste de la classe
   ([[ADR-012 Le professeur tient la liste de sa classe]]). Aucun pseudonyme libre.

Et deux choix de conception qui en découlent :

- **On rejoint avec sa session, pas avec un code de partie.** L'élève est déjà connecté avec son
  code `DOJO-XXXX` ; une instance ne sert qu'une classe. Un code de partie à la Kahoot existe
  parce que les joueurs de Kahoot sont anonymes : ici il ajouterait une étape — donc une main
  levée — sans rien protéger de plus. Un bandeau « Un quiz a commencé » apparaît dans l'espace
  élève, et l'adresse `/quiz` mène à la partie.
- **Le bilan de fin de partie est anonyme.** Ce que le professeur garde de la partie, c'est la
  répartition des réponses question par question — ==« 60 % pensent que `"15" + "1"` vaut 16 »
  dit quoi réexpliquer== — pas un palmarès.

## Pourquoi

Le classement fait partie de ce qui rend le format amusant, et « que ce soit amusant » est l'un
des trois objectifs déclarés dans [[Contraintes]]. Le supprimer vide le format ; le montrer en
entier recrée exactement le risque qu'ADR-011 a nommé. Les cinq garde-fous gardent la part de jeu
et retirent la part d'exposition.

Le pseudonyme libre est écarté pour une raison simple : un champ de texte rempli par des
adolescents et projeté devant la classe est un problème de modération, et, selon
[[ADR-008 Validation serveur des champs libres]], un champ libre de plus à défendre côté serveur.
« Prénom N. » est déjà ce que le tableau de bord affiche.

## Ce qui n'a pas changé

- **ADR-011 tient pour le parcours.** Deux coches, pas de points, pas de classement : les
  exercices ne sont toujours pas comparés entre élèves.
- **Le code source de l'élève ne quitte pas son navigateur.** Une réponse de quiz est un numéro
  d'option, rien d'autre.
- **Le serveur est l'arbitre.** Les bonnes réponses ne sont jamais envoyées à un élève avant la
  fin de la question, et les points sont calculés côté serveur — voir
  [[ADR-014 Temps réel par sonnette WebSocket]].

## Conséquences

- Les questions de quiz ne sont **pas** publiées dans `/contenu`, contrairement aux exercices :
  leur bonne réponse doit rester sur le serveur. Elles sont construites dans l'image de l'API.
- La base contient les réponses de chaque élève à chaque partie. Retirer un élève les emporte,
  comme ses tentatives ; elles entrent dans la purge de fin d'année.
- Le barème est celui de Kahoot : 1000 points pour une réponse juste immédiate, 500 à la dernière
  seconde, 0 pour une réponse fausse. La vitesse compte, mais une réponse juste lente vaut
  toujours plus qu'une réponse fausse rapide.

## Alternatives écartées

- **Pas de classement du tout.** Conforme à ADR-011, mais ce n'est plus le format demandé : sans
  lui, le quiz est un QCM projeté.
- **Le classement complet projeté.** C'est Kahoot tel quel, et c'est ce qu'ADR-011 refuse pour
  de bonnes raisons.
- **Un mode par équipes.** Il dilue l'exposition individuelle, mais il faut composer les équipes
  en séance, et le professeur perd la lecture « qui a compris quoi ». À reconsidérer si le
  classement individuel pose problème à l'usage.
- **Un code de partie.** Voir plus haut : une étape de plus pour aucune protection de plus.

## Voir aussi

[[ADR-011 Trois niveaux de réussite]] · [[ADR-012 Le professeur tient la liste de sa classe]] ·
[[ADR-014 Temps réel par sonnette WebSocket]] · [[Quiz en direct]]
