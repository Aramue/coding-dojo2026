---
title: ADR-009 Routage maison sans bibliothèque
tags:
  - decision
  - architecture
  - interface
statut: acceptée
date: 2026-09-04
---

# ADR-009 — Routage maison sans bibliothèque

> [!success] Statut : acceptée le 4 septembre 2026, pendant l'implémentation de l'interface

## Contexte

Jusqu'au palier 1, l'application n'avait **aucune notion d'adresse**. Elle affichait le premier
exercice non réussi, et rien d'autre : pas de retour en arrière, pas de vue d'ensemble, aucun
moyen de sauter un exercice bloquant — alors que [[Chapitre 1]] pose qu'aucun point de blocage ne
doit arrêter un élève plus de quelques minutes.

[[Spécification interface]] introduit quatre formes d'adresse :

```
/                                → la première notion non terminée
/:notion/cours                   → la page Cours
/:notion/exercices               → la liste d'exercices
/:notion/exercices/:numero       → un exercice ouvert
```

## Décision

**L'API History du navigateur, sans bibliothèque de routage.**

`src/routage.ts` expose une fonction pure `analyser(chemin): Destination`, sa réciproque
`versChemin`, une fonction `naviguer` et un hook `useRoute`. ==Toute la logique vit dans la
fonction pure== : elle se teste sans DOM, et le hook n'est qu'un abonnement à `popstate`.

Le routeur valide la **forme** d'un identifiant de notion (`/^[a-z]{2,20}$/`), jamais son
vocabulaire. La liste des notions vit dans le contenu publié (`seance-1-notions.json`) ; la
recopier dans le TypeScript la ferait diverger de la table Python au premier changement de
libellé. Une notion absente du contenu donne une page « cette page n'existe pas ».

## Pourquoi pas `react-router`

Quatre formes de chemin et une navigation interne ne justifient pas 20 Ko de dépendance. Ce que
le routeur apporterait en plus — chargement différé par route, routes imbriquées, gardes de
navigation — n'est utile à aucun endroit de cette application.

Ce que le routage maison **doit** apporter, et qui manquait : une URL prononçable à voix haute en
classe (« va sur variables slash cours »), et un rechargement qui ramène au même endroit.

## Conséquences

- `naviguer` émet un `PopStateEvent` à la main. ==`history.pushState` ne déclenche aucun
  événement de lui-même== : sans cette émission, l'URL changerait et l'écran resterait le même.
- Les liens sont de vrais `<a href>`. Le `preventDefault` n'intercepte que le clic simple, pour
  que le clic du milieu, `Ctrl`+clic et « copier le lien » continuent de fonctionner.
- Un rechargement sur `/variables/cours` doit servir l'application, pas un 404. `Caddyfile` le
  fait déjà (`try_files {path} /index.html`) ; Vite en développement le fait par défaut.
- Le code d'accès est mémorisé en `sessionStorage` — ==pas en `localStorage`==. Les machines des
  huit établissements sont partagées : le code d'un élève ne doit pas survivre à la fermeture du
  navigateur. Sans cette mémoire, un simple rafraîchissement renvoyait à la saisie du code et
  faisait perdre la page en cours.

Voir [[Vue d'ensemble]] et [[Pièges et invariants]].
