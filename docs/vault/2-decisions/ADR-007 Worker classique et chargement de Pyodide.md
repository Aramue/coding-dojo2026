---
title: ADR-007 Worker classique et chargement de Pyodide
tags:
  - decision
  - architecture
statut: acceptée
date: 2026-09-03
---

# ADR-007 — Worker classique et chargement de Pyodide

> [!success] Statut : acceptée le 3 septembre 2026, pendant l'implémentation

## Contexte

[[ADR-001 Exécution du code dans le navigateur]] pose que le Python tourne dans un Web Worker.
Restait à décider **comment ce worker charge Pyodide**. Deux formes existent :

- un worker **classique**, qui charge par `importScripts('/pyodide/pyodide.js')` ;
- un worker **de type module**, qui charge par `import()` de `pyodide.mjs`.

La première version du plan mélangeait les deux : le worker écrivait `importScripts` alors que
l'application le créait avec `{ type: 'module' }`. ==`importScripts` n'existe pas dans un worker
module== : le worker aurait planté au premier chargement.

La correction naturelle semblait être de tout passer en module. Elle a été essayée, et elle échoue.

## Décision

**Le worker est classique.** `new Worker(new URL('./execution/worker.ts', import.meta.url))`,
sans option, et `importScripts('/pyodide/pyodide.js')` à l'intérieur.

## Pourquoi pas le module

Le serveur de développement de Vite **refuse de servir un fichier de `public/` à un `import()`
de module**. Le message est explicite :

```
Failed to load url /pyodide/pyodide.mjs
This file is in /public and will be copied as-is during build without going through
the plugin transforms, and therefore should not be imported from source code.
```

Ce n'est pas une analyse statique contournable par un commentaire `@vite-ignore` : c'est une garde
côté serveur, au moment de servir la requête. Elle ne se contourne pas.

`importScripts`, lui, est **une simple requête HTTP**. Vite sert le fichier depuis `public/` sans
discuter, en développement comme en production.

> [!warning] Ne pas « moderniser » ce worker
> Repasser en `{ type: 'module' }` casse `pnpm dev` de façon non évidente : le worker ne démarre
> jamais, l'élève voit un délai d'attente de 5 secondes et un message de boucle infinie qui n'a
> aucun rapport. Le commentaire est dans `web/src/execution/worker.ts`, ne le supprime pas.

## Conséquences

- Le fichier à télécharger est `pyodide.js`, la variante classique — **pas** `pyodide.mjs`.
- La vérification manuelle `web/verif-pyodide.html` crée elle aussi un worker classique.
- Le harnais Python et le minuteur ne changent pas — voir [[Moteur d'exécution]].

## Ce que ça a coûté

Deux rondes de correction sur la même tâche. La première a basculé en module (mauvaise direction),
la seconde est revenue au classique. L'implémenteur avait diagnostiqué le blocage correctement et
a refusé de bricoler `worker.ts` sans arbitrage — c'est ce refus qui a permis de trancher au bon
endroit plutôt que d'empiler un contournement.

## Voir aussi

[[Moteur d'exécution]] · [[Pièges et invariants]] · [[Déploiement UNIGE]]
