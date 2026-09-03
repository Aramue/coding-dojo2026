---
title: ADR-003 Exercices versionnés en YAML
tags:
  - decision
  - contenu
statut: acceptée
date: 2026-09-03
---

# ADR-003 — Exercices versionnés en YAML

> [!success] Statut : acceptée le 3 septembre 2026

## Contexte

Le problème numéro un de l'an dernier était le **volume** : environ cinq exercices pour tout le
chapitre 1 ([[Bilan 2025-2026]]). Il en faut plusieurs dizaines, et il faut pouvoir les produire
en treize jours, en plus de donner les cours.

## Décision

Un exercice est un **fichier YAML versionné dans Git**. Le professeur l'écrit dans son éditeur,
il commit, il déploie. Structure détaillée dans [[Modèle de contenu]].

Il n'y a **pas d'interface d'administration web** pour créer des exercices.

## Conséquences

**Favorables**

- ==Économise plusieurs jours de développement== — une interface d'administration est un projet
  en soi, et c'est typiquement l'outil qu'on construit puis qu'on n'utilise jamais parce
  qu'écrire du YAML est plus rapide.
- Historique Git : on voit quand un exercice a changé et pourquoi.
- Les exercices sont **réutilisables d'une année sur l'autre**, et se relisent en revue.
- Un exercice peut être produit **par gabarit** : les six familles d'opérateurs se déclinent
  mécaniquement, ce qui rend le volume atteignable.

**Défavorables**

- Écrire du YAML n'est pas à la portée de n'importe quel intervenant. Le contenu reste donc
  produit par des personnes techniques.
- Une erreur de syntaxe casse le chargement. Atténuation : validation du schéma à la
  construction, et le déploiement échoue plutôt que de publier un exercice cassé.
- Modifier un exercice demande un déploiement, pas un clic.

## Alternatives écartées

**Base de données avec interface d'administration.** Le confort d'édition ne compense pas le coût
de construction, sur un projet où le temps de développement est la ressource rare.

**Notebooks Jupyter, comme l'an dernier.** Impossible à valider automatiquement, et c'est
justement ce qu'on cherche à obtenir.
