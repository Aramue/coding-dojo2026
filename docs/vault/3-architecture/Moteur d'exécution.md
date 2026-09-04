---
title: Moteur d'exécution
tags:
  - architecture
  - execution
mis-a-jour: 2026-09-03
---

# Moteur d'exécution

Application de [[ADR-001 Exécution du code dans le navigateur]].

## Pyodide dans un Web Worker **classique**

> [!warning] Classique, jamais `{ type: 'module' }`
> Le worker charge Pyodide par `importScripts('/pyodide/pyodide.js')`. Le passer en module casse
> le développement de façon non évidente. La raison complète est dans
> [[ADR-007 Worker classique et chargement de Pyodide]].

> [!danger] Le worker n'est pas un détail d'implémentation
> Le chapitre 1 enseigne la boucle `while`. Il y **aura** des boucles infinies — c'est même une
> étape normale de l'apprentissage.
>
> Dans le fil principal, une boucle infinie **fige l'onglet** : l'élève ne peut plus rien
> cliquer, et il lève la main. Dans un Web Worker, on tue l'exécution après 5 secondes et on
> affiche : *« Ton programme tourne en rond — vérifie que ta condition finit par devenir
> fausse. »*
>
> ==Ce seul point transforme un appel au professeur en un message pédagogique.==

## Cycle d'exécution

1. Le worker charge Pyodide une fois, au premier chargement de la page (**13,1 Mo**, mis en cache).
2. À chaque validation, on crée un **espace de noms neuf** — aucune fuite d'état entre deux essais.
3. `stdin` est branché sur les entrées de test de l'exercice, ce qui fait fonctionner `input()`.
4. `stdout` est capturé pour comparaison par le [[Moteur de validation]].
5. Minuterie de 5 s ; au-delà, le worker est terminé puis relancé.

## `input()` simulé

Les problèmes « Quartier Général » existants reposent massivement sur `input()`. Pyodide permet
d'injecter une liste d'entrées :

```yaml
tests:
  - type: sortie
    entrees: ["Corbeau", "17"]
    attendu: "Agent Corbeau, 17 ans"
```

Le premier `input()` reçoit `"Corbeau"`, le second `"17"`. C'est ce qui permet de reprendre tels
quels les énoncés de l'an dernier.

## Limites connues

| Limite | Effet | Traitement |
|---|---|---|
| **13,1 Mo** au premier chargement | 24 élèves simultanés en début de séance 1 | Servi depuis la machine UNIGE, pas d'un CDN ; en-têtes de cache d'un an |
| Pas de `requests` | Sans effet chapitres 1 et 2 | À traiter au chapitre 3 |
| Le client peut être trafiqué | Un élève peut forcer un verdict | Assumé — la certification repose sur les problèmes rendus |

## Voir aussi

[[Moteur de validation]] · [[Messages d'erreur en français]] · [[Contraintes]]
