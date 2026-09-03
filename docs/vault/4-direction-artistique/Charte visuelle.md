---
title: Charte visuelle
tags:
  - moc
  - direction-artistique
statut: validée
mis-a-jour: 2026-09-03
---

# Charte visuelle

> [!info] Planche interactive
> La charte complète, avec swatches, spécimens et maquettes des trois écrans :
> **https://claude.ai/code/artifact/ed35a3d2-d686-46b7-b92d-d9c27e1d0c4c**
>
> Les notes de ce dossier enregistrent les **décisions et les valeurs** ; la planche montre le
> résultat. En cas de divergence, ce sont les notes qui font foi.

## La règle fondatrice

> [!quote] Fond pastel = j'apprends. Fond sombre = je code.
> L'élève sait où il est sans lire un mot.

Cette règle n'a pas été inventée : elle a été **relevée** dans les decks de cours, où le fond
s'inverse en sombre à chaque passage du raisonnement au vrai code Python (pages 28, 29, 33, 34,
37 du deck 1). L'interface ne fait que la rendre systématique.
Voir [[ADR-006 Palette dérivée des slides]].

## Les pièces

- [[Palette]] — les cinq familles, leurs valeurs et leurs contrastes
- [[Typographie]] — General Sans et JetBrains Mono, et la règle qui les sépare
- [[Composants signature]] — la carte de code, le soulignement tracé, les flèches

## Les cinq règles à ne pas enfreindre

1. **Le jaune Python `#FFC331` ne vit que sur fond sombre** — 1.60 sur blanc, 8.88 sur `#282A36`
2. **Les pastilles macOS ne sont pas des couleurs sémantiques** — sur pastel, `#0F5C23` pour le
   succès et `#9C1B15` pour l'erreur
3. **Un écran, une famille** — jamais deux fonds pastel sur le même écran
4. **Le sombre est réservé à l'action** — aucune page purement explicative ne passe en sombre
5. **La chasse fixe ne sort jamais du code** — voir [[Typographie]]

## Les trois écrans

| Écran | Fond | Note |
|---|---|---|
| Leçon | `tint` de la famille du concept | Court par principe : on explique vite |
| Exercice | `deep` de la **même** famille | Même concept, mode différent |
| Tableau de bord | neutre chaud `#FBF8F3` | Hors palette : c'est l'écran du professeur, pas celui des élèves |

> [!note] Ce que le tableau de bord n'affiche pas
> Le code écrit par l'élève. Écarté explicitement à la conception. L'alerte de blocage porte le
> **type** d'erreur et le test qui échoue, ce qui suffit à arriver en sachant quoi dire.
> Voir [[ADR-002 Identification par code d'agent]].
