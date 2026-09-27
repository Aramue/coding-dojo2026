---
title: ADR-013 Une séance s'ouvre à sa date
tags:
  - decision
  - contenu
  - pedagogie
statut: acceptée
date: 2026-09-14
---

# ADR-013 — Une séance s'ouvre à sa date

> [!success] Statut : acceptée le 14 septembre 2026

## Contexte

Le contenu de la séance 2 s'écrit avant que la séance 1 ait eu lieu, et tout ce qui était publié
arrivait jusqu'ici dans l'espace élève. Publier la séance 2 le 14 septembre, c'était la montrer
le 16, en pleine séance 1 :

- le **menu** aurait déplié un second chapitre sous le premier ;
- la **jauge de l'en-tête** aurait affiché `0 / 51` au lieu de `0 / 25` à des débutants absolus,
  ==dans la séance où se joue l'abandon== ([[Chapitre 1]]) ;
- la **médiane du tableau de bord** se serait calculée sur 51 exercices, et le professeur aurait
  lu une classe en retard qui ne l'était pas.

Les élèves rapides, eux, auraient filé vers la séance suivante. Or
[[ADR-004 Mode expert en bonus débloqué]] les occupe **en profondeur**, avec les experts de la
séance en cours — et c'est entre les séances, justement, « que se creuse l'écart entre les élèves
rapides et les autres » ([[Contraintes]]).

## Décision

**Un chapitre peut déclarer une date d'ouverture. Avant ce jour, rien de ce qui lui appartient
n'existe pour l'élève.**

- La date vit dans la table `CHAPITRES` de `outils/schema.py`, au format `AAAA-MM-JJ`, et part
  avec elle dans `chapitres.json`. ==Un chapitre sans date est ouvert d'emblée== : c'est le cas du
  premier, que le professeur doit pouvoir parcourir avant le premier cours.
- Le chapitre s'ouvre **dès le matin** de sa date, à l'heure du navigateur de l'élève.
- Avant, ses notions, ses exercices et ses leçons sont retirés du contenu **au chargement** :
  menu, jauge et routage ne les voient jamais. L'en-tête nomme la séance du dernier chapitre
  ouvert.
- Le **tableau de bord** compte de la même façon : médiane, jauges et dépliants.
- L'**aperçu** montre tout, séances à venir comprises, parce que c'est avant une séance qu'on la
  cadre. Une ligne dit ce que la classe ne voit pas encore, et à partir de quel jour.

## Pourquoi une date, et pas un bouton

- **Rien à oublier.** Un bouton « ouvrir la séance » oublié, c'est vingt-quatre élèves devant
  l'ancien menu le mercredi en début de cours, et un professeur qui cherche pourquoi.
- **Rien à stocker.** Ni table, ni migration, ni route : une fonction pure, `contenuDisponible`,
  testée sans serveur.
- **Le calendrier est fixé** : mercredis 16, 23 et 30 septembre ([[Contraintes]]).

## Ce que ce n'est pas

**Une protection.** Les fichiers de `/contenu/` sont publics : un élève curieux peut lire les
énoncés de la semaine suivante. Il n'y trouvera aucune solution, elles ne sont jamais publiées.
==La date règle le rythme de la classe, pas l'accès.==

## Conséquences

- **Déplacer une séance, c'est changer une date dans `schema.py` et redéployer.**
- Une date mal écrite **fait échouer la validation**. « 23/09/2026 » se comparerait quand même
  dans le navigateur, et la séance resterait fermée en silence : `verifier_chapitres` refuse tout
  ce qui n'est pas un vrai jour écrit `AAAA-MM-JJ`.
- Une horloge fausse sur un poste d'établissement ouvre ou ferme trop tôt pour cet élève-là. Sans
  gravité : rien n'est secret, et les séances passées restent ouvertes.
- L'écran de connexion ne nomme plus de séance. Il est le même le 16 et le 30, et le contenu
  n'est chargé qu'une fois le code accepté.

## Alternatives écartées

- **Tout montrer.** C'est l'état d'avant, et c'est ce qui abîme la séance 1.
- **Un bouton d'ouverture dans le tableau de bord.** Un état serveur, une route, une migration,
  et une action à ne pas oublier le jour même.
- **Publier séance par séance**, en redéployant chaque semaine. Le même oubli possible, déplacé
  du professeur vers celui qui déploie — et plus aucun aperçu à l'avance.

## Voir aussi

[[Modèle de contenu]] · [[Tableau de bord]] · [[ADR-004 Mode expert en bonus débloqué]] · [[Chapitre 1]] · [[Contraintes]]
