---
title: Chapitre 1
tags:
  - moc
  - pedagogie
statut: conçu
mis-a-jour: 2026-09-14
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

> [!success] Séance 1 écrite en entier — 4 septembre 2026
> Les **34 exercices** de la séance 1 existent : 25 obligatoires, 4 renforts, 5 experts. Les neuf
> derniers viennent de `progression-chapitre-1.json` et, quand elle le prescrit, directement du
> matériel 2025 :
>
> | Exercice | Source |
> |---|---|
> | `s1-25` Fiche signalétique | l'Exercice 1 du notebook `variables_type_de_donnee`, ==amputé de sa ligne `bool`== reportée en séance 2 |
> | `s1-26` La boîte qui change de nature | la cellule 10 du notebook du cours, écrite et jamais travaillée |
> | `s1-17` La boîte recyclée | la copie Nikiforov, où `code` désigne successivement trois choses |
> | `s1-33` L'ordre des questions | la copie Kaena Couto `(MAUVAIS ORDRE)`, logiquement juste et sanctionnée sur le seul ordre |
>
> Les cinq autres travaillent un point isolé : `
`, `5 = age`, la casse, l'échange de deux
> variables, la lecture d'un appel imbriqué. Voir [[Bugs réels de la promotion 2025]].

> [!success] Séance 2 écrite en entier — 14 septembre 2026
> Les **38 exercices** de la séance 2 existent : 26 obligatoires, 4 renforts, 8 experts, répartis
> en cinq notions qui ont chacune leur leçon. Tout est validé par exécution et relu dans l'aperçu
> du professeur. Publiée d'avance, la séance ne s'ouvre aux élèves que le **23 septembre** — voir
> [[ADR-013 Une séance s'ouvre à sa date]].
>
> | Notion | Exercices | Leçon |
> |---|---|---|
> | Se remettre en route | `s2-01` à `s2-03` — 3 obligatoires | `c2-reveil` |
> | Calculer | `s2-04` à `s2-12` — 6 obligatoires, 1 renfort, 2 experts | `c2-calculer` |
> | Comparer | `s2-13` à `s2-21` — 6 obligatoires, 1 renfort, 2 experts | `c2-comparer` |
> | Combiner des conditions | `s2-22` à `s2-28` — 4 obligatoires, 1 renfort, 2 experts | `c2-combiner` |
> | Décider | `s2-29` à `s2-38` — 7 obligatoires, 1 renfort, 2 experts | `c2-decider` |
>
> Écarts assumés avec `progression-chapitre-1.json` :
>
> - Les trois exercices de réactivation forment **une notion à part**. La conception exige un
>   créneau nommé, qu'on ne sacrifie pas quand la séance déborde : noyés en tête de « Calculer »,
>   ils se liraient comme des exercices de calcul ratés. Leurs titres perdent le préfixe
>   « Réveil : », que le menu dit déjà — et `s2-01` ne reprend pas le titre de `s1-12`, qu'il
>   réactive : deux « Photo, pas formule » dans le même menu se confondraient.
> - `s2-03` « la ligne de rapport » devient « La phrase au format exact » : le rapport venait du
>   Quartier Général, abandonné avec [[ADR-010 Abandon de la fiction narrative]].
> - `s2-12` se valide **sur sa sortie**, pour 472 et pour 905 et son zéro au milieu, et non par
>   inspection de variables : le programme demande le nombre avec `input()`, et une inspection
>   s'exécute sans entrée. Un second motif interdit, `[`, ferme le contournement par un f-string
>   découpé — sans lui, le défi se résoudrait sans toucher à `//` ni à `%`.
> - `s2-14` fait rencontrer le `=` à la place de `==` **sans `if`**. La conception l'écrivait
>   `if age = 18`, mais `if` n'arrive que deux notions plus loin. Une comparaison rangée dans une
>   variable, `ouvert = (code = 4321)`, produit exactement la même erreur — avant même que le
>   programme pose sa première question.
> - `s2-17` et `s2-21` se valident sur leur sortie, avec plusieurs réponses dont les bornes
>   (140 cm pile, 10 ans et 130 cm pile), et non par inspection de variables : leurs programmes
>   posent leurs questions avec `input()`.
> - `s2-28`, le drapeau d'accès, se construit **sans `if`** lui aussi. La conception faisait passer
>   `acces_autorise` à `False` dans trois `if`, qui n'arrivent qu'à la notion suivante. Le drapeau
>   se met ici à jour avec `and` après chaque question : même idée, avec un outil déjà vu. Le
>   motif `autorise and` est exigé : un seul `and` écrit à la fin marche, mais ne fait pas
>   travailler le drapeau.
> - `s2-38`, le programme de fin de séance, quitte le Quartier Général et devient
>   « L'abonnement de la piscine », autonome. Sa formule passe de `(age * 7) % 1000` à
>   `(age * 37) % 1000` : entre 18 et 65 ans, `age * 7` ne dépasse jamais 1000, et aucun essai
>   n'aurait distingué `% 1000` de `% 10000`. Voir [[Programme d'assemblage]].

> [!info] Séance 3 en cours d'écriture — 14 septembre 2026
> Même méthode que la séance 2 : notion par notion, chacune avec sa leçon, validée par exécution
> et relue dans l'aperçu. Elle s'ouvre aux élèves le **30 septembre**.
>
> | Notion | Exercices | Leçon |
> |---|---|---|
> | Rappels avant les boucles | `s3-01` à `s3-03` — 3 obligatoires | `c3-rappels` |
>
> Écarts assumés avec `progression-chapitre-1.json` :
>
> - Le créneau de réactivation porte un **autre titre** que celui de la séance 2 : le tableau de
>   bord nomme la notion à côté de chaque exercice, et deux « Se remettre en route » s'y
>   confondraient.
> - Avant les boucles, deux outils ont dû changer : une leçon prend désormais l'ordre de sa
>   notion (la borne fixe à 9 bloquait la séance 3), et le validateur interrompt un programme
>   qui ne s'arrête pas — sans quoi la boucle infinie de `s3-31` aurait bloqué la construction.

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

- [[Programme d'assemblage]] — les trois séances construisent **un seul programme**, bloc par bloc
- [[Bugs réels de la promotion 2025]] — les vrais ratages de 2025 deviennent les exercices `debug`

## Production

Voir [[Plan de production]]. ==Le seul engagement des treize jours est le lot 1== : les
25 obligatoires de la séance 1 plus son programme d'assemblage, environ 8 heures.

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
