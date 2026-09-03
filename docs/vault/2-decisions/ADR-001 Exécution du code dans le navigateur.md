---
title: ADR-001 Exécution du code dans le navigateur
tags:
  - decision
  - architecture
statut: acceptée
date: 2026-09-03
---

# ADR-001 — Exécution du code dans le navigateur

> [!success] Statut : acceptée le 3 septembre 2026

## Contexte

Le vrai goulot d'étranglement n'est pas la puissance de calcul : c'est que **le professeur est le
seul validateur de la salle**. Avec 24 élèves, chacun doit lever la main pour savoir s'il a juste
([[Bilan 2025-2026]]). La question n'est donc pas « où faire tourner du Python » mais
==combien de temps s'écoule entre « l'élève clique Valider » et « l'élève sait s'il a juste »==.

Une machine virtuelle avec conteneurs est disponible ([[Contraintes]]).

## Décision

Le Python des élèves s'exécute **dans leur navigateur**, via Pyodide (CPython compilé en
WebAssembly), dans un Web Worker. La machine UNIGE sert le site, l'API de progression, la base
et le tableau de bord — **jamais le code des élèves**.

Détails d'implémentation : [[Moteur d'exécution]].

## Conséquences

**Favorables**

- Feedback en **~50 ms**. C'est la différence entre « je teste une idée » et « j'attends ».
- Charge serveur nulle : 24 élèves qui exécutent en boucle ne coûtent rien.
- Rien à sécuriser côté serveur — le code de l'élève ne quitte pas sa machine. Le dossier de
  sécurité UNIGE devient « un site web et une base ». Voir [[Déploiement UNIGE]].
- `input()` fonctionne par injection d'entrées simulées, ce qui est exactement ce qu'exigent les
  problèmes « Quartier Général » existants.
- Aucune installation côté élève, ce qui supprime la friction PyCharm de l'an dernier.

**Défavorables**

- ~7 Mo au premier chargement, servis depuis la machine UNIGE puis mis en cache.
  ==Risque concentré sur les premières minutes de la séance 1.==
- Un élève déterminé peut modifier le JavaScript pour forcer une validation. Jugé acceptable :
  la certification repose sur les problèmes rendus, pas sur le compteur d'exercices.
- Les bibliothèques nécessitant du réseau (`requests`) ne fonctionnent pas telles quelles.
  Sans effet sur les chapitres 1 et 2 ; à traiter au chapitre 3.

## Alternatives écartées

**Un conteneur jetable par soumission (juge en ligne).** Contrôle total et n'importe quelle
bibliothèque, mais 300 ms à 2 s de latence, une file d'attente à gérer, et surtout un bac à sable
qui doit être étanche. ==C'est la partie du projet la plus longue à faire et la plus facile à
rater== — celle où treize jours deviennent six semaines.

**Un conteneur persistant par élève (façon JupyterHub).** Donne un vrai environnement, mais
**ne résout pas le problème** : un IDE distant ne valide rien automatiquement. On retomberait à
corriger 24 fichiers à la main, exactement comme l'an dernier. Et 24 conteneurs vivants mangent
la mémoire de la machine.

> [!tip] Porte laissée ouverte
> Le contrat « code + tests → verdict » est identique dans les trois approches. Passer à une
> exécution serveur au chapitre 3, quand les appels réseau deviendront nécessaires, ne demandera
> pas de réécrire le reste.
