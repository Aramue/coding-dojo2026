---
title: ADR-002 Identification par code d'agent
tags:
  - decision
  - donnees-personnelles
statut: acceptée
date: 2026-09-03
---

# ADR-002 — Identification par code d'agent

> [!success] Statut : acceptée le 3 septembre 2026

## Contexte

Les élèves ont des adresses `@eduge.ch` du DIP, pas des comptes UNIGE : ==aucun SSO n'est
possible==. Ils sont mineurs pour la plupart, et la plateforme est hébergée par une université
([[Contraintes]]).

Par ailleurs, le tableau de bord du professeur exige de savoir qui bloque sur quoi — donc une
identification est nécessaire, aussi minimale soit-elle.

## Décision

Chaque élève reçoit en séance un **code d'agent** de la forme `AGENT-K7M2`. Ce code est le seul
identifiant : pas de mot de passe, pas d'adresse électronique, pas de nom.

La base ne contient que le code, la progression et les horodatages. ==La table de correspondance
code ↔ élève reste chez le professeur, hors de la plateforme.==

## Conséquences

**Favorables**

- Aucune donnée personnelle sur le serveur universitaire. Le dossier se réduit à néant.
- Zéro friction en séance 1 : pas de création de compte, pas de mot de passe oublié en semaine 3.
- Le code d'agent **sert la fiction** : l'élève reçoit littéralement son identifiant d'agent
  secret, ce qui alimente le fil narratif « Quartier Général ».

**Défavorables**

- Un élève qui perd son code perd sa progression visible. Atténuation : le professeur détient la
  table et peut la lui redonner.
- Un code partagé entre deux élèves fausse le tableau de bord. Acceptable à 24 élèves.
- Pas de récupération en autonomie ; ça passe forcément par le professeur.

## Alternatives écartées

**Compte classique avec adresse et mot de passe.** Plus familier, mais coûte quinze minutes de
séance 1, produit des mots de passe oubliés toute l'année, et fait entrer des données de mineurs
sur un serveur universitaire — pour aucun bénéfice pédagogique.

**Aucune identification, tout en `localStorage`.** Zéro friction et zéro donnée, mais fait perdre
le tableau de bord — donc précisément le « contrôle » que le projet cherche à gagner.

## Ce que le tableau de bord affiche

> [!info] Décision liée
> Le tableau de bord montre le code d'agent, l'exercice en cours, le type d'erreur et la durée de
> blocage. Il ==n'affiche pas le code écrit par l'élève== : écarté explicitement lors de la
> conception. Voir [[Charte visuelle]].
