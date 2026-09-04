---
title: Bugs réels de la promotion 2025
tags:
  - pedagogie
mis-a-jour: 2026-09-04
---

# Bugs réels de la promotion 2025

> [!quote] Le principe
> Les exercices `debug` ne sont pas des erreurs inventées. Ce sont ==les vrais ratages de la
> promotion 2025==, remis dans un programme que l'élève doit réparer.

## D'où viennent les bugs

Les copies de 2025 sont conservées avec le verdict du professeur dans le nom du fichier. Chaque
verdict négatif est une erreur authentique, commise par un élève réel du même âge, dans le même
cours ([[Bilan 2025-2026]]).

| Erreur rejouée | Copie d'origine (verdict 2025) |
|---|---|
| Le compteur bloqué à 1 — incrémenté *hors* de la boucle | Léonard, `(BIEN-INCOMPREHENSION)` |
| Le calcul effectué six lignes avant la saisie | André, `(A REFAIRE)` |
| `Position 0` au lieu de `Position 1` | Julien, `(BIEN PB AFFICHAGE)` |
| Les questions posées dans le mauvais ordre | Kaena, `(MAUVAIS ORDRE)` |

Quatre des `debug` de la séance 3 sont ainsi **recopiés tels quels** depuis le dépôt de l'an
dernier — ce qui les rend gratuits à produire, en plus d'être authentiques.

## Pourquoi ça marche

> [!success] Rater cesse d'être honteux
> Quand le cours entier est bâti sur les ratages de ceux d'avant, l'échec devient une étape
> documentée plutôt qu'un défaut personnel. C'est un levier de rétention.

Et la boucle se referme : ==la trace de cette année alimentera la liste de l'année prochaine==.
Le dispositif s'améliore tout seul, à condition de conserver les tentatives (ce que fait déjà
l'API — voir [[Vue d'ensemble]]).

## Précaution

> [!warning] Anonymat
> Les prénoms ci-dessus servent la traçabilité **interne** du projet. Aucun élève de 2025 n'est
> identifiable dans le contenu publié : les énoncés parlent de programmes, pas de personnes.
> Cohérent avec [[ADR-002 Identification par code d'agent]].

> [!note] Ce qui a changé le 4 septembre 2026
> Cette note s'appelait « Archive des agents tombés » et présentait ces bugs comme des
> transmissions corrompues d'agents disparus. ==L'habillage était fictionnel, la substance ne
> l'est pas== : les erreurs, leur origine et leur intérêt pédagogique n'ont pas bougé. Seul le
> costume tombe. Voir [[ADR-010 Abandon de la fiction narrative]].

## Voir aussi

[[Types d'exercices]] · [[Chapitre 1]] · [[Plan de production]]
