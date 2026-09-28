---
title: ADR-015 L'atelier écrit des fichiers, pas des lignes de base
tags:
  - decision
  - contenu
  - professeur
statut: acceptée
date: 2026-09-27
---

# ADR-015 — L'atelier écrit des fichiers, pas des lignes de base

> [!success] Statut : acceptée le 27 septembre 2026

## Contexte

[[ADR-003 Exercices versionnés en YAML]] pose, en toutes lettres : « Il n'y a **pas d'interface
d'administration web** pour créer des exercices. » L'argument d'alors était le temps de
développement, ressource rare à treize jours du premier cours.

Le chapitre 1 a été écrit ainsi — 112 exercices, 14 leçons, à la main. Ce qui a coûté n'est pas
d'avoir tapé du YAML, c'est d'avoir dû quitter l'éditeur à chaque fois :

- **Le champ `attendu` ne se tape pas.** Il se génère en exécutant la solution, parce qu'un
  attendu tapé à la main est ==la classe d'erreur la plus probable== ([[Plan de production]]).
  Donc : quitter l'éditeur, lancer un script, revenir.
- **La boucle de vérification est longue.** Écrire, lancer `valider_contenu.py`, lire une erreur
  en ligne de commande, corriger. Cinq allers-retours pour un exercice qui résiste.
- **Le YAML se venge.** Un indice contenant `: ` se lit comme une association. Un `**` dans un
  énoncé passe en gras. Les deux ont mordu pendant l'écriture de la séance 2.

Et un mur franc : **le schéma interdisait les séances au-delà de la 3**. Le premier exercice du
chapitre 2 était refusé par la validation.

## Décision

**Une surface d'écriture dans l'interface professeur, qui aide à produire le fichier et ne le
remplace pas.**

Ce qu'ADR-003 gardait, et qui ne bouge pas :

- **Git reste la source de vérité.** Un exercice est un fichier YAML versionné.
- **Aucune base de contenu.** L'atelier n'écrit rien sur le serveur : pas de table, pas de
  brouillon, pas d'état publié. Il lit ce qu'on lui donne, il éprouve, il rend un fichier.
- **Publier reste un commit et un déploiement.**

Ce qui change :

- ==On gagne une surface qui aide à écrire le fichier==, là où ADR-003 refusait une surface qui
  le remplacerait. La nuance est tout l'objet de cette décision.
- L'atelier **éprouve l'exercice par le moteur de l'élève** — Pyodide et `evaluer()` — et non par
  le miroir Python du validateur. C'est plus fidèle que ce que fait la construction.
- **Les tables de contenu deviennent du contenu.** `NOTIONS` et `CHAPITRES` quittent `schema.py`
  pour un `notions.yaml` et un `chapitres.yaml` par dossier de chapitre. Un titre, un ordre, une
  couleur et une date d'ouverture ne sont pas du code — et sans ce déplacement, l'atelier ne peut
  pas déclarer un chapitre, puisqu'il ne produit pas de Python.
- **Les séances vont jusqu'à 99.** La borne n'est plus là que pour attraper une faute de frappe.
- **Une dépendance nouvelle**, `yaml`, côté navigateur, pour lire un fichier déposé. Le dépôt
  pose « aucune dépendance nouvelle » : l'exception est ici, et elle est délibérée.

## Pourquoi pas un analyseur YAML maison

C'est la tentation, pour tenir la règle des dépendances. C'est aussi le pire choix : un
sous-ensemble accepterait des fichiers que la construction refuse, et l'atelier dirait « tout va
bien » sur un contenu qui casse le déploiement. ==Un outil de vérification qui diverge de la
vérification est pire que pas d'outil.==

## Conséquences

- **`docker compose up -d --build` publie cinq fichiers**, pas quatre : `schema.json` s'ajoute,
  produit par Pydantic lui-même. Le formulaire s'y adosse, et aucune copie du schéma ne vit côté
  TypeScript — le traitement déjà réservé à `notions.json`.
- **La racine de construction remonte** de `contenu/chapitre-1/` à `contenu/`, qui est parcourue.
  Sinon, construire le chapitre 1 effacerait les notions du 2 de tout ce qui est publié.
- **Rien ne doit lire `NOTIONS` au moment de définir une classe.** C'était le cas de
  `Lecon.notion`, déclaré `Literal[tuple(NOTIONS)]` : sur une table remplie à l'exécution, il
  refusait toutes les leçons. Voir [[Pièges et invariants]].
- **Le champ `motif` d'une notion n'est jamais publié.** C'est un outil d'auteur, pas une donnée
  d'élève.
- **L'atelier prévient, la construction tranche.** `valider_contenu.py` reste le juge et fait
  échouer le déploiement ; l'atelier dit la même chose tout de suite.
- Écrire du YAML à la main reste parfaitement viable. L'atelier n'est pas un passage obligé.

> [!note] Complément du 28 septembre 2026 — l'atelier écrit dans le dépôt
> Sur Chrome et Edge, l'atelier ouvre désormais le **dossier du clone local** et y réécrit un
> fichier corrigé, à sa place. La décision tient telle quelle : ce qu'il écrit est toujours un
> fichier du dépôt, jamais une ligne sur le serveur, et ==publier reste un commit et un
> déploiement== — que le professeur fait, après avoir relu le diff. Deux pertes ne se font jamais
> en silence : les commentaires du fichier, et une modification faite sur le disque depuis la
> lecture. Voir [[Spécification atelier de contenu]], §5.8.

## Alternatives écartées

- **Une base de contenu avec administration web.** Déjà écartée par ADR-003, et pour la même
  raison : le confort d'édition ne compense pas le coût de construction, et il faudrait en plus
  réconcilier deux sources de contenu, l'une versionnée et l'autre non.
- **Publier depuis l'interface**, avec un état brouillon. Le plus cher des trois, pour un besoin
  que personne n'a exprimé.
- **Un atelier qui affiche le Python à coller dans `schema.py`** pour créer une notion. Presque
  gratuit, honnête, mais c'est un copier-coller manuel dans un fichier de code — et la vraie
  question était : pourquoi une table de contenu vit-elle dans du code ?
- **Laisser les bornes à trois séances** et les ouvrir au moment d'écrire le chapitre 2. C'est
  reporter un travail de quatre lignes en le faisant découvrir sous la forme d'une validation qui
  refuse un fichier sain.

## Voir aussi

[[Spécification atelier de contenu]] · [[ADR-003 Exercices versionnés en YAML]] ·
[[Modèle de contenu]] · [[Moteur de validation]] · [[Pièges et invariants]] ·
[[ADR-013 Une séance s'ouvre à sa date]] · [[Plan de production]]
