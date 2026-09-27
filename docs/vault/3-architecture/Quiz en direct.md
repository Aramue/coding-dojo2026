---
title: Quiz en direct
tags:
  - architecture
  - quiz
  - professeur
mis-a-jour: 2026-09-27
---

# Quiz en direct

Le professeur lance une partie depuis son tableau de bord ; les élèves la rejoignent depuis leur
espace, répondent à des questions en temps limité ; l'écran projeté montre la correction, la
répartition des réponses et les cinq premiers. Décisions : [[ADR-013 Quiz en direct et
classement encadré]] · [[ADR-014 Temps réel par sonnette WebSocket]]. Plan : [[Plan quiz]].

## Le déroulé

```mermaid
stateDiagram-v2
    [*] --> attente : le professeur lance un quiz
    attente --> question : « Lancer la première question »
    question --> correction : fin du temps, tout le monde a répondu,\nou « Corriger maintenant »
    correction --> question : « Question suivante »
    correction --> terminee : après la dernière question
    attente --> terminee : « Terminer la partie »
    question --> terminee : « Terminer la partie »
```

==La correction ne s'écrit jamais en base.== La table ne connaît que `attente`, `question` et
`terminee` ; une question dont l'échéance `fin_a`, plus 500 ms de tolérance, est passée **est**
corrigée, à la lecture. « Corriger maintenant » recule l'échéance au lieu d'écrire une phase. Il
n'existe donc qu'une façon d'entrer en correction, et aucun minuteur serveur à perdre au
redémarrage.

## Qui voit quoi

| | Pendant la question | À la correction | En fin de partie |
|---|---|---|---|
| **Élève** | la question, son choix | la bonne réponse, juste ou pas, ses points, **son** rang | son bilan : bonnes réponses, points, rang |
| **Écran projeté** | la question, le nombre de réponses reçues | la bonne réponse, la répartition, l'explication, les cinq premiers | le podium, le bilan anonyme question par question |

Ce que personne ne reçoit : la bonne réponse avant la correction — ni l'élève, ni l'écran projeté,
qui est au mur. Des points qui trahiraient une réponse juste avant la correction. Le nom d'un
autre élève, côté élève. Un classement au-delà de cinq, ou quelqu'un à zéro point. Tout cela est
tenu **par le serveur**, dans `api/app/quiz.py` : `vue_eleve` et `vue_prof` sont les seules
fonctions qui fabriquent ce qu'un écran reçoit, et des tests de fuite les vérifient.

## Le barème

1000 points pour une réponse juste immédiate, 500 à la dernière seconde, linéaire entre les deux ;
0 pour une réponse fausse. La réponse est chronométrée **à la réception par le serveur**, depuis
l'ouverture de la question. Ex æquo, même rang : 1, 1, 3.

## Les pièces

```
contenu/chapitre-1/quiz/*.yaml   les quiz, écrits à la main
outils/construire_quiz.py        YAML -> JSON, pour l'image de l'API SEULEMENT
api/app/
  quiz.py                        la règle du jeu, fonctions pures
  catalogue.py                   lit les quiz construits (DOJO_QUIZ)
  diffuseur.py                   la sonnette : registre des WebSocket ouverts
  routes_quiz.py                 routes élève, routes prof, WS /quiz/flux
web/src/
  quiz/horloge.ts                l'heure du serveur, le temps restant
  quiz/flux.ts                   sonnette + relève de repli
  quiz/useFluxQuiz.ts            le même, branché sur React
  ui/EcranQuiz.tsx               l'élève, sur /quiz
  ui/QuizProf.tsx                l'écran projeté, sur /prof/quiz
  ui/BandeauQuiz.tsx             « Un quiz a commencé », dans l'espace élève
  ui/OptionsQuiz.tsx             les quatre options, une famille chacune
deploiement/charge_quiz.py       le test de charge
```

## Les routes

| Route | Qui | Rôle |
|---|---|---|
| `GET /quiz/etat` | élève | la partie vue par lui ; une partie finie seulement s'il l'a jouée, un quart d'heure |
| `POST /quiz/rejoindre` | élève | entrer dans la partie en cours |
| `POST /quiz/reponse` | élève | `{partie, question, choix}` — répondre vaut rejoindre |
| `GET /prof/quiz` | prof | le catalogue |
| `POST /prof/quiz/parties` | prof | une partie à la fois, sinon 409 |
| `GET /prof/quiz/partie` | prof | la dernière partie, même terminée : son bilan reste lisible |
| `POST /prof/quiz/partie/suivante` · `corriger` | prof | portent le rang que l'écran croit courant : un double clic est refusé |
| `POST /prof/quiz/partie/terminer` | prof | arrête pour tout le monde |
| `WS /quiz/flux` | les deux | la sonnette ; présentation dans le premier message, jamais dans l'URL |

## Écrire un quiz

```yaml
id: q1-bases                 # q + séance + nom
titre: Les bases de la séance 1
seance: 1
questions:
  - enonce: Qu'affiche ce programme ?
    code: |
      print("2" + "2")
    options: ["22", "4", "2 2", "Une erreur"]   # 2 à 4, distinctes, 90 caractères au plus
    bonne_reponse: 0
    duree_s: 20                                 # 10 à 60
    sortie: true                                # la bonne réponse EST ce que le code affiche
    explication: Deux textes se collent, ils ne s'additionnent pas.
```

`sortie: true` fait exécuter le code à la construction et comparer sa sortie à l'option juste.
`erreur: TypeError` vérifie que le code plante bien ainsi. Un code qui appelle `input()` déclare
ses `entrees`. Tout code montré doit tourner. ==Varier la position de la bonne réponse== : une
classe qui repère « c'est toujours la première » ne joue plus.

```bash
cd plateforme/outils
.venv/Scripts/python valider_contenu.py ../contenu/chapitre-1   # valide aussi les quiz
.venv/Scripts/python construire_quiz.py                          # -> ../api/quiz, pour le développement
```

## Mesures

Test de charge du 27 septembre 2026 (`deploiement/charge_quiz.py`), `docker compose` sur un poste
de développement, à travers Caddy, 24 élèves simulés, 3 questions : réponses en **75 ms** de
médiane (p95 116 ms), sonnette reçue **70 ms** après « Question suivante », aucune erreur.

> [!todo] Reste à faire en salle
> Vérifier depuis le réseau d'un établissement que le WebSocket passe. S'il ne passe pas, rien ne
> casse — chaque écran relit toutes les secondes —, mais il faut le savoir.

## Voir aussi

[[ADR-013 Quiz en direct et classement encadré]] · [[ADR-014 Temps réel par sonnette WebSocket]] ·
[[Charte visuelle]] · [[Pièges et invariants]] · [[Vue d'ensemble]]
