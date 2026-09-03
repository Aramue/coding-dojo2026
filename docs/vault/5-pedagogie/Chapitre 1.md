---
title: Chapitre 1
tags:
  - moc
  - pedagogie
statut: conçu
mis-a-jour: 2026-09-03
---

# Chapitre 1 — Introduction à la programmation

> [!success] Progression conçue le 3 septembre 2026
> Quatre progressions ont été conçues indépendamment sous quatre angles pédagogiques distincts,
> jugées par deux évaluateurs chacune, puis fusionnées. Données brutes complètes :
> `progression-chapitre-1.json` (même dossier).
>
> Classement : maîtrise 6.75 · narratif 6.5 · charge cognitive 6.25 · rétention 6.25.
> La synthèse part de la gagnante et greffe ce que les juges ont voulu sauver des trois autres.

## Le constat qui commande tout

> [!quote] Relecture des 17 copies de 2025
> ==Presque personne n'a échoué sur la logique.== Un élève a été recalé pour avoir écrit `->` au
> lieu de `→`. Un autre avait un programme juste mais posait les questions dans un autre ordre.
> Trois avaient des programmes qui tournaient et ont été sanctionnés sur l'affichage.
>
> Le seul vrai échec conceptuel du corpus tient en **cinq micro-notions jamais enseignées
> isolément** : `input()` rend du texte, `str()` avant de concaténer, le compteur s'incrémente
> *dans* la boucle, `>=` et non `>`, l'ordre des lignes est l'ordre d'exécution.
>
> ==Aucune des cinq n'est dans le notebook de cours==, qui n'écrit jamais le mot `input` alors
> que les trois problèmes commencent par `int(input(...))`.

Détail des copies dans [[Bilan 2025-2026]].

## Le volume

| | Séance 1 | Séance 2 | Séance 3 | Total |
|---|---|---|---|---|
| Exercices | 34 | 38 | 40 | **112** |
| dont obligatoires | 25 | 26 | 24 | **75** |
| dont experts | 5 | 8 | 10 | 23 |
| `predire` | 14 | 17 | 12 | 43 |
| `debug` | 9 | 10 | 10 | 29 |
| `completer` | 6 | 5 | 7 | 18 |
| `ecrire` | 5 | 6 | 11 | 22 |

À comparer aux **5 exercices** de l'an dernier. Le `predire` domine parce que c'est
==le seul type sur lequel un débutant absolu ne peut pas rester bloqué==.
Voir [[Types d'exercices]].

## Les trois séances

### Séance 1 — mercredi 16 septembre · *Le recrutement : dire, retenir, demander*

30 min de théorie, 90 min de pratique.

`print` et sortie exacte → lire un diff → ordre des lignes → variable et affectation →
réaffectation → `b = a` fige une photo → `x = x + 1` n'est pas une équation → `NameError` →
types `int`/`float`/`str` → `TypeError` → `str()` → f-string → `input()` et sa nature textuelle
→ `int(input())`.

> [!important] La séance 1 a été délestée de cinq blocs de notions
> Les opérateurs arithmétiques, `//`, `%`, la priorité et `len()` sont **déplacés en ouverture de
> séance 2**. Le type `bool` n'apparaît nulle part en séance 1 : l'introduire avant les
> comparateurs obligerait à nommer un type dont les valeurs n'ont encore aucun sens.
>
> C'est la correction du défaut le plus grave de la version dont cette progression dérive : un
> objectif de sortie inatteignable pour la moitié de la classe, dans ==la séance où se joue
> l'abandon==.

**Objectif de sortie** : chaque élève repart avec un programme qui tourne. Aucune condition,
aucune boucle, aucun opérateur nouveau — donc aucune raison structurelle d'échouer.

### Séance 2 — mercredi 23 septembre · *Le sas : calculer, comparer, décider*

20 min de théorie, 100 min de pratique.

Réactivation nommée des acquis de S1 → opérateurs et division qui rend un `float` → `//` et `%`
→ priorité et parenthèses → `len()` → `==` produit une valeur, d'où le 4ᵉ type `bool` →
`=` contre `==` → les six comparateurs et la borne inclusive `>=` → `and` / `or` / `not` →
encadrement `18 <= age <= 65` → `if` / `elif` / `else` → `IndentationError`.

### Séance 3 — mercredi 30 septembre · *La transmission : répéter, parcourir, compter*

12 min de théorie, 108 min de pratique.

`for` et `range`, borne exclusive → `range(début, fin, pas)` → dans la boucle ou après →
parcourir une chaîne → `str(nombre)` pour la rendre parcourable → initialiser AVANT,
incrémenter DEDANS → numérotation à partir de 1 → accumulateurs → `while` → boucle infinie →
choisir `for` ou `while` → bonus `import math`.

## Les deux idées de structure

- [[Terminal QG]] — les trois séances construisent **un seul programme**, bloc par bloc
- [[Archive des agents tombés]] — les vrais ratages de 2025 deviennent les exercices `debug`

## Production

Voir [[Plan de production]]. ==Le seul engagement des treize jours est le lot 1== : les
25 obligatoires de la séance 1 plus le bloc 1 du Terminal QG, environ 8 heures.

## Alertes à traiter avant d'écrire une ligne

> [!danger] Quatre problèmes hérités du matériel 2025
> 1. **`getpass` est impossible sous Pyodide.** Il a coûté deux rendus entiers en 2025 (verdict
>    `GETPASSPB`). Aucun exercice, aucun énoncé, aucun corrigé ne doit y faire référence, et la
>    fiction ne doit pas promettre de saisie masquée.
> 2. **Le corrigé Avancé utilise `enumerate()`**, construction hors périmètre du chapitre 1. Un
>    élève qui lit le corrigé y rencontrerait un objet jamais enseigné — précisément l'échec que
>    le dispositif prétend corriger. À réécrire avant la séance 3.
> 3. **`résultatattendu(facile).txt` contient un emoji `✅`.** L'emoji est banni de toute sortie
>    comparée ; le fichier doit être régénéré sans lui.
> 4. **Trois décisions moteur à prendre avant la première ligne de YAML** — voir
>    [[Moteur de validation]]. Trente minutes qui évitent de réécrire trente exercices.
