---
title: ADR-010 Abandon de la fiction narrative
tags:
  - decision
  - pedagogie
  - interface
statut: acceptée
date: 2026-09-04
---

# ADR-010 — Abandon de la fiction narrative

> [!success] Statut : acceptée le 4 septembre 2026

## Contexte

Le projet a été conçu autour d'une fiction : l'élève est un agent d'un « Quartier Général », les
exercices `debug` sont des transmissions corrompues, le code d'accès s'écrit `AGENT-XXXX`.

Cette fiction ne vivait pas seulement dans les textes. Au 4 septembre 2026, elle occupait :

| Couche | Ce qu'elle y était |
|---|---|
| Les 25 exercices | titres, énoncés, indices — mais aussi **le code Python**, les sorties attendues, les options de QCM et les motifs `interdit` |
| L'API et la base | table `agent`, colonne `code_agent` en clé primaire **et** clé étrangère, format du jeton, charge utile du tableau de bord |
| Le front | `client.ts`, `app.tsx`, `TableauDeBord.tsx` et leurs tests |
| Le déploiement | `QG_SECRET`, `QG_CODE_PROF`, `QG_BDD`, `QG_DOMAINE`, `donnees/qg.db` |
| Le coffre | 27 notes, dont deux entièrement consacrées à la fiction |

Elle était aussi le premier mot que l'élève tape, chaque séance.

## Décision

**La fiction disparaît partout.**

- Le code d'accès devient `DOJO-XXXX`. La table `agent` devient `eleve`, la colonne `code_agent`
  devient `code_acces`, les variables d'environnement passent en `DOJO_*`.
- Les 25 énoncés sont réécrits autour d'**exemples du quotidien** — prénoms, listes de courses,
  notes, âges, prix. ==Chaque exercice est autonome== : pas de fil rouge, pas de personnage
  récurrent, aucune histoire à laquelle adhérer.
- L'interface ne porte aucun vocabulaire de fiction. Le verdict vert dit « C'est juste. », plus
  « Mission accomplie. ».

## Pourquoi

Un élève qui n'adhère pas à l'histoire **lit deux fois plus de texte pour le même exercice**. Le
premier énoncé faisait quatre lignes de mise en situation avant d'arriver à la consigne. Pour un
public qui n'a jamais programmé, chaque ligne en trop est une occasion de décrocher.

Et le vocabulaire interne divergeait du produit : un développeur qui reprend le projet lit
`code_agent` dans la base, `DOJO-` dans l'interface, et doit tenir les deux dans sa tête.

## Ce qui n'a pas changé

- **Le principe du code pseudonyme.** [[ADR-002 Identification par code d'agent]] est amendée, pas
  annulée : aucune donnée personnelle, aucun SSO, un code distribué en séance. Seul son nom change.
- **La source des exercices `debug`.** Ce sont toujours les vrais ratages de la promotion 2025 —
  voir [[Bugs réels de la promotion 2025]]. Seul l'habillage était fictionnel.
- **La difficulté et la structure des 25 exercices.** Chaque `id`, `notion`, `type` et nombre de
  tests est identique. Seuls les textes, le code montré et les sorties attendues ont changé.

## Conséquences

- La base a été jetée et recréée. Elle ne contenait que trois codes de recette
  (`AGENT-TEST`, `AGENT-RVW1`, `AGENT-TES2`) et 79 tentatives de vérification : **aucun élève,
  aucun code distribué**, la première séance étant le 16 septembre.
- ==Le `.env` du serveur UNIGE doit passer en `DOJO_*` avant le prochain déploiement.== Il est
  hors dépôt : aucun test ne peut signaler l'oubli. Voir [[Pièges et invariants]].
- [[Programme d'assemblage]] décrivait un fil rouge sur les trois séances — un programme unique construit
  bloc par bloc. Le choix « chaque exercice est autonome » le supprime. `s1-34` garde sa fonction
  — finir la séance par un petit programme complet réunissant `input()`, `int()`, le f-string et
  un format exact — sous la forme d'une **carte de membre**.
- Les ADR antérieures et [[Plan palier 1]] gardent leur vocabulaire d'origine. ==Les réécrire
  falsifierait l'historique== : une décision prise reste une décision prise.
