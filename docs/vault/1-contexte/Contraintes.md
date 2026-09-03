---
title: Contraintes
tags:
  - contexte
  - contraintes
mis-a-jour: 2026-09-03
---

# Contraintes

## Calendrier

> [!warning] Trois séances, six heures
> **Mercredis 16, 23 et 30 septembre 2026**, deux heures chacune.
> La conception a démarré le 3 septembre : ==treize jours avant la première séance==.

Le travail entre les séances compte autant que les séances elles-mêmes : c'est là que se creuse
l'écart entre les élèves rapides et les autres.

## Public

- Élèves de collège genevois, **15 à 19 ans**, donc **mineurs pour la plupart**
- **24 inscrits**, venant de **8 établissements** différents
- **Aucun prérequis** en programmation
- Adresses `@eduge.ch` du DIP — ce ne sont pas des comptes UNIGE, ==donc pas de SSO possible==

> [!danger] Données personnelles
> Le public est mineur et l'hébergement est universitaire. La plateforme ne stocke ni nom, ni
> prénom, ni adresse électronique : chaque élève se connecte avec un code pseudonyme et la table
> de correspondance reste chez le professeur.
> Voir [[ADR-002 Identification par code d'agent]].

## Infrastructure

Une machine virtuelle peut être allouée, avec la possibilité de lancer des conteneurs et de gérer
plusieurs connexions simultanées.

L'architecture retenue n'utilise cette machine que pour servir le site, l'API de progression, la
base et le tableau de bord — **jamais pour exécuter le code des élèves**. Ce choix réduit le
dossier de sécurité à « un site web et une base de données », ce qui se défend sans discussion.
Voir [[Déploiement UNIGE]].

## Réseau des salles informatiques

Huit établissements, donc huit configurations réseau inconnues. Deux conséquences :

- Aucune ressource ne doit venir d'un CDN externe. Polices, moteur Python, tout est servi depuis
  la machine UNIGE. Voir [[Typographie]].
- Le premier chargement coûte environ 7 Mo (le moteur Python). Il est mis en cache ensuite, mais
  ==24 élèves qui chargent simultanément en début de séance 1== est un risque à anticiper.
  Voir [[Moteur d'exécution]].

## Pédagogiques

- Le chapitre 1 couvre : variables, types, opérateurs, conditions, boucles. **Pas les fonctions.**
- Moins de cours magistral, la pratique au plus tôt.
- Le mode expert est un **bonus débloqué**, pas un parcours parallèle.
- Le fil narratif « Quartier Général » se poursuit au chapitre 2 avec la cryptographie
  (César, Vigenère).

## Objectifs déclarés

1. Plus de certifications qu'en 2025-2026 — référence chiffrée dans [[Bilan 2025-2026]]
2. Que les élèves progressent seuls, sans appeler le professeur pour chaque validation
3. Que ce soit amusant
