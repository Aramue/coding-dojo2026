---
title: ADR-012 Le professeur tient la liste de sa classe
tags:
  - decision
  - donnees
  - professeur
statut: acceptée
date: 2026-09-04
---

# ADR-012 — Le professeur tient la liste de sa classe

> [!success] Statut : acceptée le 4 septembre 2026

## Contexte

[[ADR-002 Identification par code d'agent]] posait : un code pseudonyme, **aucune donnée
personnelle stockée**. Le raisonnement tenait — public mineur, hébergement universitaire, et pas
une ligne de RGPD à écrire tant que la base ne contient qu'une chaîne de neuf caractères.

Il tenait tant que personne n'avait à faire le lien. À l'usage, ce lien existe et il vit sur un
papier à côté du clavier :

- Le tableau de bord affichait `DOJO-K7M2` bloqué sur `s1-29`. Pour aller le voir, il faut
  retrouver **qui** est `DOJO-K7M2` — donc une feuille, mise à jour à la main, perdable.
- Les codes n'existaient nulle part avant qu'un élève ne les tape : `POST /session` créait l'élève
  à la volée. ==Une faute de frappe créait un compte vide==, sans message, et l'élève croyait
  avoir perdu sa progression pendant que la liste se remplissait de fantômes.
- La certification suppose de rendre un travail au nom de quelqu'un.

## Décision

**Le professeur crée et tient la liste de sa classe depuis le tableau de bord.**

- Un élève porte un **prénom**, un **nom** et un **établissement**. Rien d'autre : ni adresse, ni
  date de naissance, ni identifiant scolaire, et toujours ==jamais le code écrit par l'élève==.
- Le **code d'accès reste la clé.** Il ne se dérive d'aucune donnée personnelle, c'est lui qui
  circule dans les jetons et dans la table des tentatives, et c'est le serveur qui le tire.
- **Un code inconnu n'ouvre plus de session** (404). Inscrire, c'est la condition d'entrée.
- L'élève voit **son prénom** en haut de son écran ; il ne voit jamais celui d'un autre.
  `/parcours` ne rend aucune identité, `/session` seulement celle du porteur du code.

## Pourquoi

Le lien code ↔ personne existe de toute façon : la question n'est pas s'il existe, mais **où**.
Sur un papier, il se perd, il ne se sauvegarde pas, il ne s'efface pas non plus. Dans la base, il
est au même endroit que le reste, il part avec la sauvegarde, et il se supprime en un clic.

Une école tient déjà la liste de ses élèves — c'est le traitement le plus ordinaire qui soit.
L'amendement ne crée pas une collecte, il déplace une collecte qui existait déjà hors du système.

Le code tiré par le serveur, et non choisi par l'appelant, ferme une porte : un code deviné
d'avance, c'est la progression de quelqu'un d'autre, lue ou écrite.

## Ce qui n'a pas changé

- **Le principe du pseudonyme.** Le code reste la clé primaire, la clé étrangère et le contenu du
  jeton. Rien dans le fonctionnement de la plateforme ne dépend d'un nom.
- **Aucun SSO, aucun compte, aucun mot de passe élève.** L'élève tape quatre caractères.
- **Le code source de l'élève ne quitte jamais son navigateur.**
- **Le tableau de bord n'affiche toujours pas ce que l'élève écrit** — seulement le type
  d'exception. Voir [[Tableau de bord]].

## Conséquences

- ==Les comptes doivent être créés avant la séance du 16 septembre.== Sans liste, personne
  n'entre. C'est le prix assumé du refus des codes inconnus.
- Une **liste se colle** plutôt que de se ressaisir : vingt-quatre élèves un par un font
  soixante-douze champs. L'aperçu compte les élèves reconnus avant d'écrire quoi que ce soit.
- L'alphabet des codes écarte **O, 0, I, 1, L et S** : un code se recopie à la main depuis un
  tableau, par quelqu'un qui n'a jamais tapé de code de sa vie, et une seule confusion coûte une
  main levée.
- Retirer un élève **emporte ses tentatives**. La confirmation nomme l'élève et le nombre de
  tentatives perdues, jamais un « Confirmer ? » nu.
- Le schéma se migre au démarrage (`ALTER TABLE ADD COLUMN` si la colonne manque) :
  `create_all` ne crée que les tables absentes, et une base déjà peuplée aurait échoué sur
  « no such column ». Voir [[Pièges et invariants]].
- **La base contient désormais des données personnelles de mineurs.** Elle doit être sauvegardée,
  et purgeable à la fin de l'année. C'est une obligation nouvelle, qui n'existait pas sous
  ADR-002. Voir [[Déploiement UNIGE]].

## Alternatives écartées

- **Garder la liste dans un tableur à côté.** C'est l'état actuel, et c'est précisément ce qui ne
  marche pas : le tableau de bord affiche un code que le professeur doit traduire de tête, en
  séance, pendant que quelqu'un attend.
- **Un identifiant scolaire officiel.** Plus de données, un lien direct avec les registres de huit
  établissements, et rien de gagné : la plateforme n'a besoin que de reconnaître quelqu'un dans
  une salle.
- **Continuer à créer l'élève à la volée, en ajoutant le nom après coup.** Les comptes fantômes
  restent, et le professeur doit deviner lesquels sont des fautes de frappe.

## Voir aussi

[[ADR-002 Identification par code d'agent]] · [[Tableau de bord]] · [[Contraintes]] · [[Déploiement UNIGE]]
