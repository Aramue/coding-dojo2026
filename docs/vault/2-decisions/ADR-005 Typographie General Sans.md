---
title: ADR-005 Typographie General Sans
tags:
  - decision
  - direction-artistique
statut: acceptée
date: 2026-09-03
---

# ADR-005 — Typographie General Sans

> [!success] Statut : acceptée le 3 septembre 2026

## Contexte

Les cinq decks de cours embarquent **League Spartan** (titres) et **Glacial Indifference**
(texte), deux géométriques d'inspiration Futura. La première intention était de les reprendre
telles quelles, par fidélité à [[ADR-006 Palette dérivée des slides]].

Deux objections ont émergé :

1. Leurs **apertures fermées** rendent un énoncé difficile à lire à 14 px sur un écran de salle
   informatique. Ce qui tient en projection ne tient pas forcément à l'écran.
2. Glacial Indifference est absente de Google Fonts et sa licence aurait dû être vérifiée avant
   hébergement universitaire.

## Décision

**General Sans** (Indian Type Foundry, via Fontshare), une seule famille, deux graisses :
700 pour les titres, 400 pour le texte.

**JetBrains Mono** pour le code, et pour le code uniquement.

Détails et spécimens : [[Typographie]].

## Conséquences

**Favorables**

- Grotesque géométrique contemporain : grande hauteur d'x, apertures ouvertes, approches serrées.
  Lisible à 14 px, affirmé à 60 px.
- **Une seule famille** pour les titres et le texte. La cohérence vient de là, pas d'un mariage
  de deux polices — c'est ce que font les références du genre.
- Licence ITF Free Font : gratuite, usage commercial autorisé, auto-hébergement prévu.
- Charge réduite : trois fichiers WOFF2 d'environ 21 Ko.

**Défavorables**

- ==C'est le seul endroit où l'interface s'écarte des decks.== La continuité visuelle repose
  désormais entièrement sur [[Palette]].
- Fonderie moins institutionnelle que Google Fonts. La licence devra être jointe au dossier UNIGE.
- Les slides et la plateforme n'auront pas exactement la même typographie tant que les decks ne
  seront pas repris.

> [!tip] Repli identifié
> Si le dossier UNIGE bloque sur une fonderie non-Google : **Wix Madefor Display + Text**, même
> famille d'esprit, licence SIL OFL, hébergée par Google Fonts.

## Règle induite

> [!important] La chasse fixe ne sort jamais du code
> JetBrains Mono est réservée au code, aux valeurs hexadécimales et aux identifiants d'agent.
> ==Aucun libellé d'interface, aucun en-tête de colonne, aucune étiquette en chasse fixe, et
> jamais de capitales interlettrées.==
>
> Cette règle n'est pas arbitraire : dans les decks, la monospace n'apparaît **que** dans les
> cartes de code sombres. La respecter, c'est être plus fidèle aux slides, pas moins.

## Alternatives écartées

| Piste | Écartée parce que |
|---|---|
| League Spartan + Jost | Apertures fermées, illisible en petit corps |
| Switzer | Excellente lisibilité mais titres sans caractère |
| Satoshi | Trop ronde, les titres lourds perdent leur autorité |
| Wix Madefor | Retenue comme repli, pas comme premier choix |
