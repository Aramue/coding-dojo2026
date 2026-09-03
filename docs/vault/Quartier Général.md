---
title: Quartier Général
tags:
  - moc
statut: en-conception
mis-a-jour: 2026-09-03
---

# Quartier Général

Plateforme web d'apprentissage de Python pour le **Coding Dojo** de l'Université de Genève,
année 2026-2027. Les élèves lisent une leçon courte, puis résolvent des exercices dont le code
s'exécute et se valide **dans leur navigateur**, sans installation et sans attendre le professeur.

> [!abstract] Le problème qu'on résout
> L'an dernier, 24 élèves se sont inscrits et 6 sont allés jusqu'à la certification. Le
> professeur était le seul validateur de la salle : chaque élève devait l'appeler pour savoir
> s'il avait juste. Voir [[Bilan 2025-2026]].

## Par où commencer

1. [[Bilan 2025-2026]] — ce qui a marché, ce qui a cassé, et les chiffres
2. [[Contraintes]] — calendrier, infrastructure, public
3. [[Journal de décisions]] — les décisions structurantes déjà prises
4. [[Vue d'ensemble]] — l'architecture technique
5. [[Charte visuelle]] — la direction artistique

## État d'avancement

| Domaine | État |
|---|---|
| Contexte et contraintes | ✅ établi |
| Décisions d'architecture | ✅ prises — voir [[Journal de décisions]] |
| Direction artistique | ✅ validée — voir [[Charte visuelle]] |
| Progression pédagogique du chapitre 1 | ✅ conçue — 112 exercices, voir [[Chapitre 1]] |
| Spécification complète | ✅ écrite — [[Spécification chapitre 1]] |
| Implémentation | ⬜ pas commencée |

## Le calendrier qui commande tout

> [!warning] Première séance le mercredi 16 septembre 2026
> Trois séances de deux heures : les **mercredis 16, 23 et 30 septembre**.
> Tout ce qui n'est pas prêt pour le 16 doit pouvoir attendre le 23 sans bloquer les élèves.

## Le principe directeur

> [!quote] Sortir le professeur du chemin critique
> Chaque fonctionnalité se juge à une seule question : *est-ce que ça réduit le nombre de fois
> où un élève doit lever la main pour avancer ?* La validation instantanée, les messages
> d'erreur en français et les indices progressifs répondent oui. Un éditeur plus joli, non.

## Cartes du coffre

- **Contexte** — [[Bilan 2025-2026]] · [[Contraintes]]
- **Décisions** — [[Journal de décisions]]
- **Architecture** — [[Vue d'ensemble]] · [[Moteur d'exécution]] · [[Moteur de validation]] · [[Modèle de contenu]] · [[Messages d'erreur en français]] · [[Déploiement UNIGE]]
- **Direction artistique** — [[Charte visuelle]] · [[Palette]] · [[Typographie]] · [[Composants signature]]
- **Pédagogie** — [[Chapitre 1]] · [[Terminal QG]] · [[Archive des agents tombés]] · [[Types d'exercices]] · [[Plan de production]]
- **Références** — [[Sources]] · [[Glossaire]]
