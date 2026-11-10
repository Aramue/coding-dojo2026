---
title: Moteur d'exécution
tags:
  - architecture
  - execution
mis-a-jour: 2026-09-04
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
4. `stdout` est **retenu** pour comparaison par le [[Moteur de validation]] et **diffusé** au fil
   de l'eau vers le fil principal.
5. Minuterie de 5 s ; au-delà, le worker est terminé puis relancé.

## La console en direct

Le harnais Python remplace `sys.stdout` par un `StringIO` qui, en plus d'accumuler, poste chaque
morceau au fil principal. `EcranExercice` les recolle et les affiche pendant que le programme
tourne.

> [!important] Ce que la sortie finale ne pouvait pas donner
> Un programme coupé par la minuterie ne renvoie **aucun** résultat : jusqu'ici l'élève dont la
> boucle tournait en rond n'obtenait rien du tout, alors que c'est précisément le moment où voir
> ce que la boucle affichait explique le bug. La diffusion survit à la coupure — `Executeur`
> résout le dépassement de temps avec ==ce qui a été diffusé avant la fin==.

Un **passage** de console par exécution réellement lancée. Un exercice éprouvé sur plusieurs jeux
d'entrées les montre séparément, avec l'entrée employée en légende ; les exécutions servies par le
cache n'en ouvrent pas, elles afficheraient deux fois la même chose. Un QCM n'affiche pas de
console : rien ne s'y exécute.

> [!danger] Deux plafonds, pour deux problèmes différents
> **60 000 caractères** : au-delà, on cesse de retenir et de diffuser. Une boucle qui affiche sans
> fin produit des mégaoctets en cinq secondes ; sans plafond, l'onglet gonfle jusqu'à devenir
> inutilisable avant même que la minuterie ne coupe.
>
> **400 caractères ou 50 ms** avant chaque envoi. Un `print` fait *deux* appels à `write()` — le
> texte, puis le saut de ligne. Un message par appel ferait mille rendus React pour une boucle de
> cinq cents lignes, et le fil principal passerait son temps à redessiner au lieu d'afficher. Le
> regroupement plafonne à une vingtaine de messages par seconde quel que soit le volume, sans
> cesser d'être vivant à l'œil. Le tampon est **vidé avant que l'exécution ne rende la main**,
> sans quoi la fin de la sortie n'arriverait jamais.

## `input()` simulé

Les problèmes du cours 2025 reposent massivement sur `input()`. Pyodide permet
d'injecter une liste d'entrées :

```yaml
tests:
  - type: sortie
    entrees: ["Corbeau", "17"]
    attendu: "Camille, 17 ans"
```

Le premier `input()` reçoit `"Corbeau"`, le second `"17"`. C'est ce qui permet de reprendre tels
quels les énoncés de l'an dernier.

## Le réseau — depuis le 10 novembre 2026

Décision : [[ADR-018 Open-Meteo en réseau réel, borné par le dojo]]. `import requests` rend un
module écrit pour le dojo, `outils/requests_dojo.py`, que le worker installe au démarrage dans
`sys.modules` après avoir lu `/contenu/requests_dojo.py` en synchrone.

- **L'appel réel est un `XMLHttpRequest` synchrone**, permis dans un worker. Le worker est de toute
  façon bloqué le temps de la requête, et le minuteur de 5 s tourne sur le fil principal.
- **Les compteurs d'un programme repartent à zéro** à chaque exécution
  (`reinitialiser()`, appelé par `_qg_executer`). **Le cache et la limite par minute survivent** :
  un exercice évalué en plusieurs exécutions, une par test, ne paie le réseau qu'une fois.
- **Le validateur installe le même fichier** avec un transport qui rejoue des réponses enregistrées.
  C'est la raison pour laquelle il n'y a qu'**une seule source** : sans elle, ce serait une
  troisième duplication délibérée, après les deux `normaliser` et la tolérance du quiz
  ([[Pièges et invariants]]).

> [!danger] Un service lent ne doit jamais ressembler à une boucle infinie
> Si le service met 6 secondes à répondre, le minuteur de 5 s tue le worker et l'élève lit « Ton
> programme tourne en rond », sans rapport avec son code. Le délai d'un appel (2 s) et le budget de
> réseau d'un programme (3,5 s) lèvent donc une erreur **nommée** (`ConnectionError`, `Timeout`)
> avant que le minuteur ne tranche.

## Limites connues

| Limite | Effet | Traitement |
|---|---|---|
| **13,1 Mo** au premier chargement | 24 élèves simultanés en début de séance 1 | Servi depuis la machine UNIGE, pas d'un CDN ; en-têtes de cache d'un an |
| Le vrai `requests` : déclaré dans le lock de Pyodide, **non livré** dans `public/pyodide/` | Sans effet séances 1 à 5 ; la séance 6 en a besoin | Le `requests` du dojo, qui le remplace — voir « Le réseau » ci-dessous |
| Le client peut être trafiqué | Un élève peut forcer un verdict | Assumé — la certification repose sur les problèmes rendus |

## Voir aussi

[[Moteur de validation]] · [[Messages d'erreur en français]] · [[Contraintes]]
