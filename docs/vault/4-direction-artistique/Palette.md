---
title: Palette
tags:
  - direction-artistique
  - tokens
mis-a-jour: 2026-09-03
---

# Palette

Relevée par analyse pixel des 77 pages des cinq decks Canva. Décision :
[[ADR-006 Palette dérivée des slides]].

## Les cinq familles

Chaque concept a un fond pastel (`tint`), une encre (`ink`) et un fond d'exercice (`deep`).

| Famille | `tint` | `ink` | `deep` | Contraste | Slides |
|---|---|---|---|---|---|
| Variables | `#C2CCFF` | `#2C0A71` | `#1A0640` | 9.63 · AAA | p. 4–9 |
| Types | `#D9F4CC` | `#053827` | `#022016` | 11.09 · AAA | p. 10–13 |
| Opérateurs | `#C2E8FF` | `#004E7A` | `#002B43` | 6.87 · AA | p. 14–23 |
| Conditions | `#FFE7C2` | `#7A4900` | `#3C2500` | 6.28 · AA | p. 24–29 |
| Boucles | `#FFD9C2` | `#7A2800` | `#3C1400` | 7.49 · AAA | *ajout* |

> [!note] Ce qui est relevé et ce qui est ajouté
> - Les quatre premiers `tint` et `ink` sont **relevés** dans les decks.
> - `#3C2500` est **relevé** (slides inversées de la section conditions).
> - Les trois autres `deep` sont **extrapolés**, en reproduisant l'écart `#FFE7C2 → #3C2500`.
> - La famille **corail** est un **ajout** : conditions et boucles partageaient l'ambre faute de
>   couleur disponible, alors que ce sont deux concepts que les élèves confondent.

## Code — thème Dracula

Relevé au pixel dans les blocs de code du deck 1, page 33. Les slides utilisaient déjà Dracula
sans que ce soit formalisé.

| Rôle | Valeur | Sur `#282A36` |
|---|---|---|
| Fond | `#282A36` | — |
| Texte | `#F8F8F2` | 13.36 |
| Mots-clés | `#FF79C6` | 5.97 |
| Nombres | `#BD93F9` | 5.90 |
| Fonctions | `#8BE9FD` | 10.29 |
| Chaînes | `#F1FA8C` | 12.74 |
| Sortie `>>>` | `#50FA7B` | 10.38 |
| Commentaires | `#6272A4` | 3.03 — ==décoratif seulement, jamais du texte à lire== |

## Pastilles macOS

`#FF5F56` `#FFBD2E` `#27C93F` — sur chaque carte de code, comme dans les decks.
Voir [[Composants signature]].

## Neutres et sémantique

| Rôle | Valeur |
|---|---|
| Fond neutre chaud | `#FBF8F3` |
| Fond neutre alterné | `#F3EEE5` |
| Encre | `#1E1B16` (16.2 sur le fond) |
| Encre secondaire | `#6B6459` (5.52) |
| Filet | `#E2DACC` |
| Succès sur clair | `#0F5C23` — ≥ 5.19 sur les cinq `tint` |
| Erreur sur clair | `#9C1B15` — ≥ 5.18 sur les cinq `tint` |

## Accents Python

Bleu `#4B8BBE` et jaune `#FFC331` — le « **Py**thon » bicolore des decks.

> [!danger] Deux pièges de contraste
> - `#FFC331` sur blanc : **1.60**. Illisible. Fond sombre uniquement.
> - `#27C93F` sur blanc : **2.21**. C'est une pastille décorative, pas une couleur de succès.
>
> Les decks n'ont jamais rencontré le problème parce qu'ils n'utilisent ces couleurs que sur
> fond sombre. L'interface, elle, doit l'expliciter.
