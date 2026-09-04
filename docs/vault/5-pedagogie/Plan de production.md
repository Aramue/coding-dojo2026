---
title: Plan de production
tags:
  - pedagogie
  - planification
mis-a-jour: 2026-09-03
---

# Plan de production

> [!warning] Le point de rupture de 2025
> L'historique Git de l'an dernier s'arrête le 27 octobre ([[Bilan 2025-2026]]). Ce n'est pas la
> préparation qui a lâché, c'est le suivi — la production de contenu **pendant** que le cours
> tourne. Ce plan est conçu pour que le projet survive à ce moment-là.

## Les quatre lots

| Lot | Contenu | Coût | Quand |
|---|---|---|---|
| **1** | 25 obligatoires S1 + programme d'assemblage S1 + décisions moteur | ~8 h | ==Les 13 jours. Seul engagement ferme.== |
| **2** | 26 obligatoires S2 | ~7 h | Semaine 1 — le plus cher, donc produit **en premier**, quand la charge d'accompagnement est encore faible |
| **3** | 24 obligatoires S3 | ~5 h | Semaine 2 — le **moins** cher : son problème, son corrigé et son résultat attendu existent déjà, et 4 debug sont des copies 2025 recopiées |
| **4** | 14 renforts + 23 experts | ~6 h | Opportuniste, **jamais bloquant** — un renfort absent ne pénalise que l'élève qui a échoué, et le professeur est dans la salle |

## Ordre de production du lot 1

Du moins cher au plus cher, pour sécuriser un livrable partiel à tout moment :

1. Les 12 `predire` — un seul gabarit YAML, ~50 min pour les cinq premiers
2. Les deux exercices de format exact
3. Les `debug`
4. Les `completer`
5. Les deux `ecrire`
6. Le problème narratif

## Les cinq leviers

> [!tip] De ~43 h à ~26 h + 3 h d'outillage
> À mettre en place **avant** d'écrire le premier exercice.

1. **Générateur du champ `attendu`** — un script exécute la solution de référence avec les
   entrées simulées et écrit lui-même la sortie dans le YAML. ~2 h d'outillage, et ça supprime
   ==la classe d'erreur la plus probable : l'attendu faux tapé à la main==.
2. **Émission YAML depuis un CSV** pour la famille des exercices répétitifs (opérateurs) :
   ~20 exercices produits en une soirée.
3. **Un programme de base, une échelle complète** — écrire 12 programmes corrects et en dériver
   mécaniquement `predire` / `debug` / `completer` / `ecrire`.
4. **Les experts validés par inspection de variables**, jamais par sortie exacte :
   ~12 min pièce au lieu de ~28.
5. **Un fichier par exercice** plus un script de validation de schéma lancé avant chaque cours.
   Interdire le mono-fichier YAML de 5 000 lignes.

Ces leviers sont la raison pour laquelle 112 exercices est un objectif réaliste et non une
promesse en l'air. Voir [[Modèle de contenu]].

## Calibrage horaire de la séance 1

25 obligatoires = 12 `predire` (1,5 min) + 5 `completer` (3,5) + 5 `debug` (5) + 2 `ecrire`
(3 et 9) + problème (15) = **87,5 min pour 90 disponibles**. Marge : 2,5 min.

> [!note] Plan de coupe
> Si la salle décroche, couper dans cet ordre : `s1-24`, `s1-05`, `s1-20` (−4,5 min).
> Décidé à l'avance pour ne pas improviser devant 24 élèves.

## Risque non maîtrisé

> [!danger] 24 navigateurs chargeant Pyodide en même temps
> À tester en conditions réelles avant le jour J, avec un plan de repli.
>
> Repli identifié : les 25 obligatoires de la séance 1 ne dépendent d'aucune notion avancée et
> peuvent être basculés en notebooks Jupyter de secours. Voir [[Moteur d'exécution]].
