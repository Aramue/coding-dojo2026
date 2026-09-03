---
title: Spécification chapitre 1
tags:
  - specification
statut: à relire
date: 2026-09-03
echeance: 2026-09-16
---

# Spécification — Plateforme Quartier Général, chapitre 1

> [!abstract] Ce que ce document est
> La spécification validée du **premier chapitre uniquement**. Elle consolide les décisions
> prises le 3 septembre 2026 et sert de base au plan d'implémentation. Le détail de chaque point
> vit dans les notes liées ; ce document donne la vue complète et cohérente.
>
> Périmètre : [[Chapitre 1]]. Les chapitres 2 à 4 feront l'objet de spécifications distinctes.

## 1. Problème et objectif

En 2025-2026, 24 élèves se sont inscrits au Coding Dojo et **6 sont allés jusqu'à la
certification**. La cause identifiée n'est pas la difficulté du contenu : c'est que
==le professeur était le seul validateur de la salle==. Chaque élève devait l'appeler pour savoir
s'il avait juste, avec 24 élèves venus de 8 établissements et un PyCharm à installer sur chaque
poste. Détail chiffré : [[Bilan 2025-2026]].

**Objectif** : que l'élève sache seul, en moins d'une seconde, s'il a réussi — et pourquoi pas,
sinon.

Critère de réussite : plus de certifications qu'en 2025-2026, et un professeur qui se déplace
vers les élèves en difficulté au lieu de répondre à la file d'attente.

## 2. Périmètre

**Dans le périmètre du chapitre**

- Les cinq concepts du chapitre 1 : variables, types, opérateurs, conditions, boucles
- 112 exercices dont 75 obligatoires, répartis sur trois séances de deux heures
- Exécution et validation du Python dans le navigateur
- Progression persistée, identifiée par code pseudonyme
- Tableau de bord professeur

> [!warning] Périmètre du chapitre ≠ livrable du 16 septembre
> Cette liste couvre les **trois séances**. Ce qui doit exister le 16 septembre est le palier 1
> de la section 9 : le contenu de la séance 1 seule, soit 25 exercices sur 112. Les deux
> périmètres ne doivent jamais être confondus dans une estimation.

**Hors périmètre**

- Les fonctions (chapitre 2), les chaînes et la cryptographie (chapitre 2), JSON et les API
  (chapitre 3), Tkinter (chapitre 4)
- Toute exécution de code sur l'infrastructure UNIGE
- Toute donnée personnelle d'élève
- L'édition de contenu par interface web

## 3. Architecture

Détail : [[Vue d'ensemble]].

Le code des élèves ne quitte jamais leur navigateur. La machine UNIGE sert le site, l'API de
progression, la base et le tableau de bord.

| Couche | Choix |
|---|---|
| Éditeur | CodeMirror 6, thème Dracula |
| Exécution | Pyodide dans un Web Worker — [[Moteur d'exécution]] |
| Front | Vite + TypeScript, construction statique |
| API | FastAPI, pour que le professeur puisse la maintenir seul |
| Base | SQLite dans un volume Docker |
| Service | `docker compose` : Caddy + API — [[Déploiement UNIGE]] |

Décision fondatrice : [[ADR-001 Exécution du code dans le navigateur]].

> [!danger] Le Web Worker n'est pas optionnel
> Le chapitre 1 enseigne `while`. Il y aura des boucles infinies. Dans le fil principal, l'onglet
> gèle et l'élève lève la main ; dans un worker, on tue à 5 s et on affiche un message
> pédagogique.

### Ce que l'API expose

| Route | Rôle |
|---|---|
| `POST /session` | Échange un code d'agent contre un jeton |
| `GET /parcours` | Exercices débloqués pour cet agent |
| `POST /tentative` | Exercice, verdict, type d'erreur, durée |
| `GET /prof/seance` | Alimente le tableau de bord |
| `POST /prof/verrou` | Ouvre ou ferme un concept pour la classe |

L'API ne reçoit **jamais** le code source écrit par l'élève — seulement le verdict et le *type*
d'erreur.

## 4. Identification

[[ADR-002 Identification par code d'agent]].

Chaque élève reçoit en séance un code de la forme `AGENT-K7M2`. Pas de mot de passe, pas
d'adresse, pas de nom. La base ne contient que le code, la progression et les horodatages ;
==la table de correspondance reste chez le professeur, hors de la plateforme==.

Le code sert aussi la fiction : c'est littéralement l'identifiant d'agent, et il est injecté dans
le programme que l'élève construit.

## 5. Contenu

[[ADR-003 Exercices versionnés en YAML]] · [[Modèle de contenu]].

Un exercice est un fichier YAML versionné dans Git, un fichier par exercice. Pas d'interface
d'administration.

Champs : `id`, `concept`, `seance`, `niveau`, `type`, `titre`, `obligatoire`, `enonce`, `depart`,
`indices`, `tests`, `solution`, `expert`.

**Validation à la construction** — un exercice invalide fait échouer la construction plutôt que
d'atteindre les élèves :

- La `solution` passe réellement tous ses propres tests
- Le `depart` échoue au moins un test
- Le `type` et les `tests` sont cohérents
- Chaque `expert` référencé existe

## 6. Validation

[[Moteur de validation]].

### Quatre types de test

1. **`sortie`** — exécute avec `input()` simulés, compare `stdout`
2. **`variable`** — inspecte valeur et type après exécution
3. **`qcm`** — pour les exercices `predire`
4. **`contient` / `interdit`** — force une structure, empêche de coder la réponse en dur

> [!danger] `interdit` est obligatoire sur tout exercice `ecrire`
> Sans lui, l'élève rapide écrit la sortie attendue en dur dans un `print` et le moteur valide.

### Le verdict à deux niveaux

- **VERT** — sortie exacte au caractère près
- **BLEU** — logique correcte, format à ajuster : correspondance après normalisation (espaces
  multiples et de fin, casse, accents, variantes `->` / `→` / `:`, emoji ignorés)

==Le BLEU valide l'exercice et débloque la suite==, en affichant le diff caractère par caractère.

Justification : en comparaison stricte, la plateforme recalerait automatiquement **6 élèves sur
17** que le professeur avait validés en 2025. Le BLEU reproduit ce qu'il a fait en écrivant
« BIEN PB AFFICHAGE » et en laissant passer.

Mitigation du risque : les cinq exercices dont l'objectif *est* le format exact exigent le VERT,
les problèmes narratifs aussi.

### Ordre d'évaluation

Syntaxe → exécution sans exception → contraintes `interdit`/`contient` → tests.
==On ne montre jamais plus d'un échec à la fois.==

### Messages d'erreur en français

[[Messages d'erreur en français]]. Une quinzaine d'entrées couvrent 90 % de ce que produit un
débutant. Chaque message dit ce qui s'est passé, pourquoi, et quoi essayer — **sans donner la
réponse**.

## 7. Progression pédagogique

[[Chapitre 1]] · données brutes dans `5-pedagogie/progression-chapitre-1.json`.

| | S1 | S2 | S3 | Total |
|---|---|---|---|---|
| Exercices | 34 | 38 | 40 | 112 |
| dont obligatoires | 25 | 26 | 24 | 75 |
| dont experts | 5 | 8 | 10 | 23 |
| `predire` / `debug` / `completer` / `ecrire` | | | | 43 / 29 / 18 / 22 |

Séances : **mercredis 16, 23 et 30 septembre 2026**, deux heures chacune.

1. *Le recrutement* — dire, retenir, demander
2. *Le sas* — calculer, comparer, décider
3. *La transmission* — répéter, parcourir, compter

**La séance 1 est délestée** : opérateurs, `//`, `%`, priorité et `len()` passent en séance 2, et
`bool` n'apparaît pas en séance 1. C'est la séance où se joue l'abandon.

Deux dispositifs structurants : [[Terminal QG]] (un seul programme cumulatif, avec injection du
bloc manquant) et [[Archive des agents tombés]] (les `debug` sont les vrais ratages de 2025).

Mode expert : [[ADR-004 Mode expert en bonus débloqué]]. Non noté, non compté dans la progression
affichée ; la certification ne dépend que du parcours obligatoire.

## 8. Direction artistique

[[Charte visuelle]] · [[Palette]] · [[Typographie]] · [[Composants signature]].
Planche : https://claude.ai/code/artifact/ed35a3d2-d686-46b7-b92d-d9c27e1d0c4c

Règle fondatrice, relevée dans les decks de cours :
**fond pastel = j'apprends, fond sombre = je code.**

Cinq familles de concept (`tint` / `ink` / `deep`), thème Dracula pour le code, General Sans 700
et 400, JetBrains Mono pour le code uniquement. Contrastes vérifiés : les cinq paires passent AA,
quatre passent AAA.

Décisions : [[ADR-005 Typographie General Sans]] · [[ADR-006 Palette dérivée des slides]].

## 9. Livraison

[[Plan de production]].

### Trois paliers

**Palier 1 — le noyau irréductible, requis le 16 septembre**
Worker Pyodide · moteur de validation · écran exercice · codes d'agent · API · les 25 exercices
obligatoires de la séance 1 · bloc 1 du Terminal QG · déploiement.

**Palier 2 — si le temps le permet**
Écran leçon · tableau de bord · messages d'erreur en français · indices progressifs.

**Palier 3 — après la séance 1**
Gamification (XP, classement hebdomadaire, badges) · exercices experts · verrouillage de rythme.

> [!note] Décision de périmètre assumée
> La gamification demandée est en palier 3. Aucun de ces éléments ne fait avancer un élève d'un
> exercice au suivant ; ils font revenir en semaine 2, et la semaine 2 arrive le 23.

### Ordre de construction

| Jours | Quoi |
|---|---|
| 1–2 | Worker Pyodide + moteur de validation |
| 3 | Outillage contenu — 3 h qui économisent 17 h, **avant** d'écrire le premier exercice |
| 4–5 | Écran exercice + éditeur, en DA |
| 6 | API + codes d'agent + SQLite |
| 7–8 | Contenu lot 1, du moins cher au plus cher |
| 9 | Déploiement UNIGE + test de charge à 24 onglets |
| 10 | Messages d'erreur en français |
| 11 | **Tableau de bord** (voir arbitrage ci-dessous) |
| 12–13 | Marge |

> [!note] Arbitrage du jour 11 : tableau de bord plutôt qu'écran leçon
> S'il ne reste du temps que pour un seul des deux, c'est le **tableau de bord**.
>
> En séance 1 le professeur est dans la salle : il peut enseigner au tableau, exactement comme
> l'an dernier, donc l'absence d'écran leçon n'est pas une régression. En revanche, ==savoir
> lequel des 24 élèves est bloqué et sur quoi== est précisément le besoin exprimé, et rien
> d'autre ne le couvre.
>
> L'écran leçon devient nécessaire pour le travail **entre** les séances : il doit donc exister
> avant le 23, pas avant le 16.

### Lots de contenu suivants

Lot 2 (séance 2, ~7 h) est le plus cher : produit **en premier**, pendant la semaine 1.
Lot 3 (séance 3, ~5 h) est le moins cher : son matériel existe déjà.
Lot 4 (renforts et experts, ~6 h) est opportuniste et jamais bloquant.

## 10. Risques

| Risque | Effet | Traitement |
|---|---|---|
| 24 navigateurs chargeant Pyodide simultanément | La séance 1 échoue en entier | Test en conditions réelles avant le 16 ; repli en notebooks Jupyter pour la séance 1 |
| Le contenu n'est pas prêt | Séance vide | Paliers et lots ; livrable partiel à tout moment |
| L'élève ne corrige jamais son formatage (verdict BLEU) | Compétence manquante au chapitre 2 | Cinq exercices exigent le VERT ; le diff est toujours affiché |
| Le mode expert crée une classe à deux vitesses | Décrochage social | Experts non notés, non affichés dans la progression |
| Le client peut être trafiqué | Un élève force un verdict | Assumé — la certification repose sur les problèmes rendus |

## 11. Corrections à apporter au matériel 2025

Avant d'écrire le premier exercice :

- [ ] **`getpass` banni partout** — impossible sous Pyodide, a coûté deux rendus en 2025
- [ ] **Réécrire le corrigé Avancé** — il utilise `enumerate()`, hors périmètre du chapitre 1
- [ ] **Régénérer `résultatattendu(facile).txt` sans emoji**
- [ ] **Ajouter `input()` au contenu de cours** — absent du notebook alors que les trois problèmes
      commencent par `int(input(...))`

## 12. Questions ouvertes

- Licence ITF Free Font à joindre au dossier UNIGE — [[ADR-005 Typographie General Sans]]
- Forme exacte du classement hebdomadaire (palier 3), à arbitrer après la séance 1
- Modalités de la certification de fin de semestre : quels exercices comptent, et comment
