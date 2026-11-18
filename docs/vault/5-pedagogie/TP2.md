---
title: TP2
tags:
  - pedagogie
  - contenu
statut: écrit
mis-a-jour: 2026-11-18
---

# TP2 — Workflow de résolution de problèmes

> [!abstract] Ce que le TP évalue
> Un TP **noté**, à faire **chez soi en deux semaines**, qui réunit Python, JSON ([[Séance 5]]), API ([[Séance 6]]) et git ([[Séance 7]]). L'élève forke un petit programme qui interroge PokéAPI, y trouve des bugs décrits par des **issues**, et les corrige. Le professeur lit surtout l'**historique git**.

> [!important] Pourquoi pas la météo
> Open-Meteo est déjà l'API de la séance 6 : un TP qui la reprendrait serait « trop courant ». PokéAPI est gratuite, sans clé, stable, et son JSON est plus riche (listes de dictionnaires imbriquées, pagination, 404).

## Les supports

| Support | Rôle | État |
|---|---|---|
| Dépôt `WolfoNeos/tp2-pokedex` | Le projet de départ : code cassé, 42 tests, 12 tickets, `creer_issues.py` | ✅ publié le 18 novembre 2026, public, https://github.com/WolfoNeos/tp2-pokedex |
| Consignes `/tp/pokedex` | La méthode en 7 étapes, avec points de contrôle | ✅ `plateforme/contenu/chapitre-1/tp/pokedex.yaml`, dans le chapitre `versions` |
| Corrigé et barème | Les 12 issues résolues, 42 tests verts, `PROF.md` | ✅ **en local seulement**, dans `Dev/tp2-pokedex-corrige` (hors de ce dépôt, volontairement) |

Le dépôt est sous le compte personnel `WolfoNeos`, pas dans l'organisation Aramue. Les commits y utilisent l'adresse noreply du compte, pour ne pas publier l'adresse universitaire.

## Le projet

Un Pokédex en ligne de commande, d'environ 150 lignes : `main.py` (menu), `api.py`, `affichage.py`, `analyse.py`, `equipe.py`. Les **tests ne touchent jamais le réseau** : ils lisent des réponses enregistrées dans `donnees/` (un faux `requests.get` dans `tests/conftest.py`). Au départ, 34 tests échouent et 8 passent.

| # | Issue | Niveau | Notion |
|---|---|---|---|
| 1 | `Pikachu` avec une majuscule plante | facile | méthodes de chaîne |
| 2 | taille 4 m et poids 60 kg | facile | arithmétique, conversion |
| 3 | liste de 19 éléments au lieu de 20 | moyen | `range`, borne |
| 4 | un seul type affiché | moyen | boucle sur une liste de dictionnaires |
| 5 | écrire `stat_dominante` | moyen | recherche du maximum |
| 6 | l'équipe est écrasée à chaque ajout | moyen | lire, modifier, écrire du JSON |
| 7 | 7ᵉ Pokémon et doublons acceptés | moyen | conditions, `in` |
| 8 | `equipe.json` et `__pycache__` dans git | facile | `.gitignore`, `git rm --cached` |
| 9 | plantage si Pokémon inconnu ou réseau coupé | bonus | `try/except`, `status_code` |
| 10 | `tout` n'affiche que 20 Pokémon | bonus | pagination, `while` |
| 11 | chaque recherche rappelle l'API | bonus | cache JSON local |
| 12 | `fiche()` fait 30 lignes, bloc copié six fois | bonus | refactorisation |

## Ne pas assister, ne pas perdre

- **Trouver** : chaque issue est écrite comme un vrai rapport de bug (symptôme, commande pour reproduire, comportement attendu) et ne cite **jamais** le fichier fautif.
- **Vérifier** : les tests sont visibles et nommés par issue. Ils disent *attendu* et *obtenu*, jamais comment corriger.
- **Débloquer** : trois indices repliés par issue (où chercher, quelle notion, l'idée). Leur ouverture se **déclare dans la pull request**, avec un coût léger au-delà de quelques-uns.
- **Ne pas bloquer** : les issues 1 à 8 sont indépendantes ; les 9 à 12 sont des bonus.
- **Vérifier la compréhension** : un **court oral** à la remise, sur une correction tirée au hasard. L'usage des assistants IA est réglé en classe.

## Les bonus

1. **Issues 9 à 12.**
2. **Une branche par issue**, fusionnée par une pull request dans son propre fork (`Closes #n`). Des conflits sont **voulus** : les issues 1, 9 et 11 touchent `chercher_pokemon`, les issues 2, 4 et 12 touchent `fiche`.
3. **Ses propres tests de non-régression** : un commit `test:` (rouge) puis un commit `fix:` (vert), dans `tests/test_mes_tests.py`.

## Pièges à connaître

> [!warning] Les issues ne se copient pas dans un fork
> GitHub ne copie aucune issue dans un fork, et le désactive même pour elles. `creer_issues.py` active les issues du fork, crée les trois étiquettes et crée les 12 issues dans l'ordre : elles reçoivent les numéros 1 à 12, ce que les `Closes #n` supposent. Sans `gh`, repli à la main depuis `tickets/`.
> **Testé en réel le 18 novembre 2026** sur un dépôt privé hors fork (contrôle « est-ce un fork » contourné) : seul ce contrôle n'a pas été éprouvé.

> [!warning] Chaîne cachée dans l'issue 6
> Corriger `ajouter` révèle ensuite un `FileNotFoundError` au premier lancement (fichier absent). C'est voulu : l'indice 3 y renvoie.

- **L'issue 9** demande de modifier `api.py` **et** `main.py`.
- **L'issue 8** : ajouter un `.gitignore` ne suffit pas, il faut aussi `git rm --cached equipe.json` (le test le vérifie).
- Les forks d'un dépôt public sont publics : la consigne interdit mot de passe, nom réel et photo.
- Le conftest est sensible à la casse comme le vrai PokéAPI (sur Windows, le système de fichiers ne l'est pas : sans cette précaution l'issue 1 aurait passé à tort).

## Barème proposé (/20)

Dans `PROF.md`, côté corrigé : issues 1 à 8 sur 12 points (tests), historique git sur 4, oral sur 4. Bonus : +1 par issue 9 à 12, +2 pour les branches et pull requests, +2 pour les tests personnels.

## À faire

- [ ] **Date de remise** : la consigne dit « à la date annoncée en classe ». À écrire quand elle est fixée.
- [ ] Un **vrai fork d'élève** pour essayer le parcours de bout en bout, `creer_issues.py` compris.
- [ ] Le dépôt `tp2-pokedex-essai` (privé, créé pour un essai) est à supprimer sur GitHub.
- [ ] Garder le **corrigé** hors de tout dépôt public. Prévoir une sauvegarde (par exemple un dépôt privé).
- [ ] Le chapitre `versions` (séance 7) s'ouvre aux élèves le 2026-11-18 dans `schema.py` : le TP2 devient visible en même temps. À décider si ce n'est pas voulu.

## Voir aussi

[[Séance 7]] · [[Séance 6]] · [[Séance 5]] · [[Types d'exercices]]
