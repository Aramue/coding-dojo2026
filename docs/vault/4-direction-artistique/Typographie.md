---
title: Typographie
tags:
  - direction-artistique
  - tokens
mis-a-jour: 2026-09-03
---

# Typographie

Décision : [[ADR-005 Typographie General Sans]].
Comparateur des cinq pistes évaluées :
**https://claude.ai/code/artifact/88bd7409-1f86-435a-a284-67ba7f09eab9**

## Les deux polices

| Rôle | Police | Graisse | Source |
|---|---|---|---|
| Titres | **General Sans** | 700 | Fontshare · ITF Free Font |
| Texte | **General Sans** | 400 (500 pour les libellés) | idem |
| Code | **JetBrains Mono** | 400 / 500 | Google Fonts · SIL OFL |

Une seule famille pour les titres et le texte. ==La cohérence vient de là, pas d'un mariage de
deux polices.==

## Pourquoi JetBrains Mono pour le code

Ce n'est pas un choix esthétique. Zéro barré, et `1` / `l` / `I` nettement distincts.
Un débutant qui confond `1` et `l` perd dix minutes sur une erreur invisible — et appelle le
professeur, ce que tout le projet cherche à éviter.

## La règle qui sépare les deux

> [!important] La chasse fixe ne sort jamais du code
> JetBrains Mono est réservée au **code**, aux **valeurs hexadécimales** et aux **identifiants
> d'agent**.
>
> ==Aucun libellé d'interface, aucun en-tête de colonne, aucune étiquette en chasse fixe.
> Et jamais de capitales interlettrées.==

> [!note] Pourquoi cette règle existe
> Une première version de la charte utilisait la monospace en capitales interlettrées à douze
> endroits différents, pour de l'habillage. C'est la signature visuelle typique du design généré
> automatiquement — et c'était **infidèle aux decks**, où la monospace n'apparaît que dans les
> cartes de code sombres.
>
> La corriger a consisté à revenir à la logique des slides, pas à s'en éloigner.

## Auto-hébergement

Les fichiers WOFF2 sont servis depuis la machine UNIGE, **jamais depuis Google Fonts ou
Fontshare**. Avec un public mineur et un hébergement universitaire, hotlinker un service tiers
transmettrait les adresses IP des élèves.

Effet de bord utile : puisque toutes les pistes étaient auto-hébergées, aucune ne coûtait plus
cher qu'une autre, et ==le choix typographique est devenu purement esthétique==.
Voir [[Déploiement UNIGE]].

## Couverture française

Toute la plateforme est en français. Les capitales accentuées doivent tenir en graisse lourde :
`ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ Œœ æ`. Vérifié sur General Sans 700.

## Repli identifié

**Wix Madefor Display + Text**, licence SIL OFL sur Google Fonts, si le dossier UNIGE bloque sur
une fonderie non-Google.
