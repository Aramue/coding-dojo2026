---
title: ADR-014 Temps réel par sonnette WebSocket
tags:
  - decision
  - architecture
  - temps-reel
statut: acceptée
date: 2026-09-27
---

# ADR-014 — Temps réel par sonnette WebSocket

> [!success] Statut : acceptée le 27 septembre 2026

## Contexte

Jusqu'ici la plateforme n'avait aucun temps réel : le [[Tableau de bord]] relit `GET /prof/seance`
toutes les dix secondes, et c'est suffisant pour voir qui bloque.

Le [[Quiz en direct]] ne s'en contente pas. Quand le professeur passe à la question suivante,
vingt-quatre écrans doivent la montrer dans la seconde, et le compteur « 18 / 24 réponses » de
l'écran projeté doit bouger à chaque réponse.

Trois contraintes du terrain pèsent sur le choix :

- ==Huit établissements, huit réseaux inconnus== ([[Contraintes]]). Un proxy d'établissement qui
  refuse la mise à niveau WebSocket est une possibilité réelle, et on ne le découvrira qu'en salle.
- **Un mainteneur qui est professeur de Python** ([[Vue d'ensemble]]). Chaque mécanisme ajouté est
  du code qu'il devra comprendre seul dans six mois.
- **L'API tourne dans un seul processus uvicorn**, avec SQLite.

## Décision

**Le WebSocket est une sonnette, pas un canal de données.**

1. **L'état de la partie vit en base**, comme la progression. Chaque écran le lit par un simple
   `GET` — `GET /quiz/etat` pour l'élève, `GET /prof/quiz/partie` pour le professeur — qui rend
   une photographie complète, calculée pour celui qui la demande.
2. **`WS /quiz/flux` ne transporte qu'un message** : `{"type": "changement"}`. Il dit « relis »,
   jamais « voici ». Le client relit alors par le `GET` ordinaire.
3. **Sans WebSocket, on relit toutes les secondes.** Si la connexion ne s'ouvre pas ou tombe, le
   client passe à une relecture périodique du même `GET`, et retente le WebSocket en arrière-plan.
   Même avec la sonnette, une relecture de sûreté a lieu toutes les dix secondes.
4. **Aucun minuteur côté serveur.** Chaque question porte une échéance absolue, `fin_a`. La phase
   « correction » ne s'écrit pas : elle ==se déduit== de `fin_a` et de l'heure au moment de la
   lecture. Chaque écran décompte seul, recalé sur l'heure du serveur que porte chaque
   photographie, et relit à l'échéance.
5. **L'authentification passe dans le premier message**, jamais dans l'URL : une URL finit dans
   les journaux du proxy et du serveur. Jeton élève ou code professeur, vérifiés comme sur les
   routes HTTP. Un premier message absent, invalide ou trop long ferme la connexion.
6. **Les réponses passent par `POST /quiz/reponse`**, pas par le WebSocket : validation Pydantic
   (`extra="forbid"`, bornes), codes d'erreur explicites, et une route qui marche aussi quand le
   WebSocket ne passe pas.

## Pourquoi

**La sonnette rend la panne du WebSocket bénigne.** Le chemin des données est un `GET` : il est
le même avec ou sans WebSocket, il se teste sans WebSocket, et le repli n'est qu'un minuteur
autour d'une fonction qui existe déjà. Un WebSocket qui transporterait l'état aurait demandé deux
chemins de données à maintenir identiques — exactement le genre de duplication que ce projet ne
s'autorise qu'une fois, et sous test de parité ([[Pièges et invariants]]).

**Le coût est négligeable à cette échelle.** Une sonnette déclenche au plus vingt-cinq `GET`, qui
lisent une partie, quelques dizaines de participants et quelques centaines de réponses dans
SQLite. Les réponses des élèves ne sonnent que chez le professeur : les élèves n'ont pas besoin
de savoir que leur voisin a répondu.

**Pas de minuteur, pas d'état en mémoire à perdre.** Un redémarrage du conteneur en pleine partie
ne perd rien : la question en cours, son échéance et les réponses sont en base. Un minuteur
asyncio aurait été perdu au redémarrage, et il aurait fallu écrire une reprise.

## Ce qui en découle

> [!danger] Un seul processus uvicorn
> Le registre des connexions ouvertes vit **en mémoire** du processus. Avec `--workers 2`, une
> réponse reçue par un processus ne ferait pas sonner les écrans branchés sur l'autre : le
> compteur du professeur resterait figé jusqu'à la relecture de sûreté. Ajouté à
> [[Pièges et invariants]].

- Caddy relaie la mise à niveau WebSocket sans configuration ; le proxy de développement de Vite
  a besoin de `ws: true`.
- La réponse d'un élève est chronométrée **à la réception par le serveur**, depuis l'ouverture de
  la question. Un élève en repli voit la question jusqu'à une seconde plus tard : c'est au plus
  une perte d'une cinquantaine de points sur une question de vingt secondes, et c'est assumé.
- Une tolérance de 500 ms après l'échéance absorbe la latence du réseau : une réponse partie à
  temps n'est pas refusée parce qu'elle a traversé la ville.

## Alternatives écartées

- **Relecture seule, sans WebSocket.** La plus simple, et c'est le repli. Seule, elle impose une
  seconde de retard à chaque changement, et vingt-cinq requêtes par seconde pendant toute la
  partie pour des données qui changent une fois par minute.
- **Server-Sent Events.** Un seul sens suffisait, mais `EventSource` ne sait pas envoyer d'en-tête
  `Authorization` : le jeton serait passé dans l'URL.
- **L'état complet poussé par le WebSocket.** Deux chemins de données, et le repli devenait un
  second protocole au lieu d'un minuteur.
- **Un minuteur serveur qui ferme la question.** Voir plus haut : il se perd au redémarrage, et
  la phase déduite fait la même chose sans rien écrire.

## Voir aussi

[[ADR-013 Quiz en direct et classement encadré]] · [[Quiz en direct]] · [[Vue d'ensemble]] ·
[[Pièges et invariants]]
