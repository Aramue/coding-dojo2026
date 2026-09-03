---
title: Glossaire
tags:
  - reference
mis-a-jour: 2026-09-03
---

# Glossaire

Les termes propres au projet, pour que deux personnes parlent de la même chose.

## Vocabulaire du projet

**Agent** — un élève, désigné par son code pseudonyme (`AGENT-K7M2`). La plateforme ne connaît
jamais son nom. Voir [[ADR-002 Identification par code d'agent]].

**Archive des agents tombés** — le corpus des vrais ratages de 2025, rejoués comme exercices
`debug`. Voir [[Archive des agents tombés]].

**Bloc** — un tiers du programme cumulatif construit sur les trois séances.
Voir [[Terminal QG]].

**Chemin minimal** — les 75 exercices obligatoires. Un élève qui les termine tous obtient la
certification, même sans avoir touché un seul expert.

**Expert** — un exercice bonus débloqué après réussite du normal correspondant. Jamais noté,
jamais compté dans la progression affichée.
Voir [[ADR-004 Mode expert en bonus débloqué]].

**Famille** — un groupe de trois couleurs (`tint`, `ink`, `deep`) associé à un concept.
Voir [[Palette]].

**Injection de bloc** — quand un élève n'a pas fini le bloc précédent, la plateforme fournit le
bloc de référence étiqueté pour que son programme tourne quand même.

**Lot** — un paquet de production de contenu, du lot 1 (les 13 jours) au lot 4 (opportuniste).
Voir [[Plan de production]].

**Renfort** — un exercice supplémentaire proposé après un échec, non obligatoire.

**Terminal QG** — le programme unique `acces_qg.py` que les trois séances construisent.

**Verdict VERT / BLEU** — les deux niveaux de réussite du validateur.
Voir [[Moteur de validation]].

## Vocabulaire des couleurs

**`tint`** — le fond pastel d'un écran de leçon.
**`ink`** — l'encre lisible sur ce `tint`.
**`deep`** — le fond sombre de l'écran d'exercice de la même famille.

## Vocabulaire technique

**ADR** (*Architecture Decision Record*) — une note de décision : contexte, décision,
conséquences, alternatives écartées. Voir [[Journal de décisions]].

**Pyodide** — CPython compilé en WebAssembly, qui fait tourner le Python dans le navigateur.
Voir [[Moteur d'exécution]].

**Web Worker** — un fil d'exécution séparé du fil d'affichage. Indispensable ici : il permet de
tuer une boucle infinie sans figer l'onglet de l'élève.

## Faux amis à éviter

> [!warning] Trois mots à ne pas employer
> - **« Niveau »** pour parler de normal/expert. L'expert n'est pas un niveau, c'est un bonus
>   débloqué — dire « niveau » ramène l'idée des deux parcours parallèles, écartée.
> - **« Note »** pour la progression. Rien n'est noté ; on parle d'exercices validés.
> - **« Correction »** pour la validation automatique. Le moteur valide ; le professeur, lui,
>   accompagne.
