---
title: Accueil
tags:
  - moc
statut: en-conception
mis-a-jour: 2026-09-04
---

# Coding Dojo 2026-2027

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
| Plan d'implémentation | ✅ écrit — [[Plan palier 1]] |
| Implémentation du palier 1 | ✅ **livrée** — 14 tâches, branche `palier-1` |
| Spécification de l'interface | ✅ écrite — [[Spécification interface]] |
| Plan de l'interface | ✅ écrit — [[Plan interface]], 16 tâches |
| Implémentation de l'interface | ✅ **livrée** — tâches 1 à 14, branche `palier-1` |
| Retrait de la fiction — code et base | ✅ livré |
| Retrait de la fiction — 25 énoncés | ✅ livré |
| Retrait de la fiction — vault | ✅ livré |
| Tableau de bord professeur atteignable | ✅ livré — sur `/prof` |
| Revue finale de branche | ⬜ à faire |

## Ce qui tourne aujourd'hui

Le code vit dans `plateforme/`, sur la branche `palier-1`.

| Partie | État |
|---|---|
| `web/` | Front React + TypeScript, Pyodide auto-hébergé, **168 tests**, couverture 82 % |
| `api/` | FastAPI + SQLite, **30 tests** |
| `outils/` | Schéma, validateur, générateur d'attendu, constructeur, **81 tests**, couverture 89 % |
| `contenu/` | **34 exercices** de la séance 1 — 25 obligatoires, 4 renforts, 5 experts — et **4 leçons** |
| `deploiement/` | Docker Compose + Caddy, images construites et vérifiées |

Un parcours complet a été joué dans un navigateur : connexion par code d'accès, résolution des
25 exercices, « Séance terminée », progression persistée après rechargement.

> [!warning] Deux décisions prises pendant l'implémentation
> Elles ne découlent pas de la conception mais du code réel, et ce sont celles qu'on risque le
> plus de défaire par ignorance : [[ADR-007 Worker classique et chargement de Pyodide]] et
> [[ADR-008 Validation serveur des champs libres]].

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
- **Décisions** — [[Journal de décisions]] · [[ADR-009 Routage maison sans bibliothèque]] · [[ADR-010 Abandon de la fiction narrative]] · [[ADR-011 Trois niveaux de réussite]]
- **Architecture** — [[Vue d'ensemble]] · [[Moteur d'exécution]] · [[Moteur de validation]] · [[Modèle de contenu]] · [[Messages d'erreur en français]] · [[Déploiement UNIGE]] · [[Pièges et invariants]]
- **Direction artistique** — [[Charte visuelle]] · [[Palette]] · [[Typographie]] · [[Composants signature]]
- **Pédagogie** — [[Chapitre 1]] · [[Programme d'assemblage]] · [[Bugs réels de la promotion 2025]] · [[Types d'exercices]] · [[Plan de production]]
- **Références** — [[Sources]] · [[Glossaire]]
- **Spécifications** — [[Spécification chapitre 1]] · [[Spécification interface]]
- **Plans** — [[Plan palier 1]] · [[Plan interface]]
