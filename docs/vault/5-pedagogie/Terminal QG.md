---
title: Terminal QG
tags:
  - pedagogie
  - narration
mis-a-jour: 2026-09-03
---

# Terminal QG

> [!quote] L'idée
> ==Il n'y a pas de « problème à rendre » séparé.== Les trois séances construisent bloc par bloc
> un seul programme, `acces_qg.py`, dont la version assemblée en fin de séance 3 **est, ligne
> pour ligne**, le fichier `IDQuartierGénéralV1(Facile).py` qui existe déjà sur le disque avec
> son fichier de résultat attendu.

## Les trois blocs

| Bloc | Séance | Ce que le programme sait faire en plus |
|---|---|---|
| 1 · Le badge d'agent | 1 | Demande le nom et l'âge, affiche un badge de trois lignes au format exact. `input()`, `int()`, f-string, `print`. Rien d'autre. |
| 2 · Le sas et le code d'accès | 2 | Vérifie `18 <= age <= 65`, calcule `code = (age * 7) % 1000`, affiche le verdict puis le code. |
| 3 · La transmission | 3 | Boucle sur `str(code)` et affiche les chiffres un par un. |

Le code d'agent pseudonyme de l'élève ([[ADR-002 Identification par code d'agent]]) est injecté
dans le programme : chacun produit une sortie qui lui est propre.

## L'injection de bloc manquant

> [!success] Aucun bloc n'est un point de blocage unique
> Si un élève n'a pas fini le bloc précédent — absence, lenteur, échec — ==la plateforme injecte
> le bloc de référence, visiblement étiqueté== pour l'élève et pour le professeur, et le
> programme complet tourne quand même.

C'est la propriété de rétention la plus importante du dispositif. Elle change la nature du devoir
maison : ce n'est jamais « écris ce programme », c'est **« il manque un bloc à ton programme qui
tourne déjà »**. Un élève absent en semaine 2 revient en semaine 3 sans être perdu.

Rappel du problème traité : en 2025, 18 élèves sur 24 ont décroché ([[Bilan 2025-2026]]).

## Pourquoi ce montage coûte peu à produire

La séance 3 est ==la moins chère des trois== alors que c'est la plus dense en notions : son
problème narratif, son corrigé et son fichier de résultat attendu **existent déjà sur le disque**.
C'est le seul actif éprouvé du dépôt 2025, et il est réutilisé tel quel.
Voir [[Plan de production]].

## Terminal QG V2 — double sécurité (expert)

Débloqué uniquement après un verdict VERT sur le bloc 3, conformément à
[[ADR-004 Mode expert en bonus débloqué]].

Quatre saisies, un drapeau `acces_autorise = True` que trois conditions indépendantes peuvent
passer à `False`, la formule `code = (age * code_agent + len(nom) * 42) % 10000`, et la
transmission numérotée `Position 1 -> 8`.

C'est `IDQuartierGénéralV1(Avancé).py`, avec deux corrections obligatoires au corrigé de
référence — voir les alertes de [[Chapitre 1]].

## Le pont vers le chapitre 2

L'exercice expert de la séance 3, le *brouilleur*, demande une accumulation de chaîne caractère
par caractère. C'est — sans qu'on le dise aux élèves — ==le squelette exact du chiffrement de
César== qui ouvre le chapitre 2.
