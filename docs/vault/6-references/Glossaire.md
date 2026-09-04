---
title: Glossaire
tags:
  - reference
mis-a-jour: 2026-09-03
---

# Glossaire

Les termes propres au projet, pour que deux personnes parlent de la même chose.

## Vocabulaire du projet

**Bloc** — dans une leçon, une unité de contenu : `paragraphe`, `code` ou `attention`.
Voir [[Modèle de contenu]].

**Code d'accès** — l'identifiant pseudonyme d'un élève (`DOJO-K7M2`), distribué en séance. La
plateforme ne connaît jamais son nom. Voir [[ADR-002 Identification par code d'agent]] et
[[ADR-010 Abandon de la fiction narrative]].

**Chemin minimal** — les 75 exercices obligatoires. Un élève qui les termine tous obtient la
certification, même sans avoir touché un seul expert.

**Expert** — un exercice bonus débloqué après réussite du normal correspondant. Jamais noté,
jamais compté dans la progression affichée.
Voir [[ADR-004 Mode expert en bonus débloqué]].

**Famille** — un groupe de trois couleurs (`tint`, `ink`, `deep`) associé à un concept.
Voir [[Palette]].

**Injection** — quand un élève n'a pas fini le programme d'assemblage de la séance précédente,
la plateforme fournit la version de référence, étiquetée, pour que la suite tourne quand même.
Conçue, pas encore implémentée. Voir [[Programme d'assemblage]].

**Lot** — un paquet de production de contenu, du lot 1 (les 13 jours) au lot 4 (opportuniste).
Voir [[Plan de production]].

**Renfort** — un exercice supplémentaire proposé après un échec, non obligatoire.

**Leçon** — ce que l'élève lit avant les exercices d'une notion. Quatre pour la séance 1.
Voir [[Modèle de contenu]].

**Notion** — l'unité de navigation : une leçon, un groupe d'exercices et une couleur. Quatre par
séance. Voir [[Spécification interface]].

**Programme d'assemblage** — le petit programme complet qui clôt chaque séance et réunit les
notions vues. Voir [[Programme d'assemblage]].

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
