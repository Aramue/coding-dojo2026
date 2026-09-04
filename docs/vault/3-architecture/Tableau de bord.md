---
title: Tableau de bord
tags:
  - architecture
  - professeur
mis-a-jour: 2026-09-04
---

# Tableau de bord

L'écran du professeur pendant la séance. Il répond à trois questions, dans cet ordre, et rien
d'autre : **qui bloque**, **sur quoi plusieurs élèves butent en même temps**, et **où en est la
classe**.

> [!quote] Le seul juge
> Ce tableau se juge à la même question que le reste de la plateforme : *est-ce qu'il réduit le
> nombre de fois où un élève doit lever la main pour avancer ?* Voir [[Bilan 2025-2026]].

## Ce qui bloque plusieurs élèves

Le bandeau regroupe les exercices sur lesquels ==au moins deux élèves sont bloqués en même temps==,
du plus encombré au moins encombré, avec les types d'exception les plus fréquents et les codes
concernés.

> [!important] C'est le seul signal qui change ce qu'on fait dans la minute
> Un élève bloqué, on va le voir. **Quatre élèves bloqués au même endroit, on arrête la salle et
> on réexplique.** L'information était déjà dans le tableau, mais il fallait la reconstituer de
> tête en lisant vingt-quatre lignes — c'est-à-dire jamais, en séance.

Un élève seul n'y apparaît pas : il est déjà en tête de la liste, et le signaler deux fois
diluerait celui qui compte.

## Où en est la classe

Une bande porte **un trait par élève**, posé là où il en est, plus la médiane.

> [!note] Pourquoi pas une moyenne
> Une moyenne dirait « la classe est à 12 » et laisserait croire à un groupe homogène. ==C'est
> l'écart qui se pilote== : six traits collés à gauche pendant que trois touchent la fin, c'est
> savoir qu'il faut aller au fond de la salle plutôt que ralentir tout le monde. Les traits se
> superposent là où plusieurs élèves sont au même point, et la densité se lit comme un aplat.

## Chaque ligne

| Colonne | Contenu |
|---|---|
| Élève | le code d'accès, en chasse fixe |
| Où | le **titre** de l'exercice, et sa notion en dessous |
| Quoi | échecs d'affilée et type d'erreur · délai d'inactivité · `8 / 25 réussis` |
| Statut | Bloqué · Inactif · En cours |

`s1-29` ne dit rien à personne, pas même à celui qui a écrit l'exercice. « L'âge qui refuse de
s'additionner », dans « Demander une information », se lit d'un coup d'œil et **se dit à voix
haute dans la salle**.

## Le pouls

Un point qui bat, et le temps écoulé depuis la dernière réponse. En classe, ==un tableau figé et
une classe silencieuse se ressemblent trait pour trait== : sans lui, le professeur ne peut pas
distinguer « personne ne soumet rien » de « la page ne se met plus à jour ». La liaison rompue
s'affiche en rouge, explicitement.

## Ce que l'API renvoie, et ce qu'elle ne sait pas

`GET /prof/seance` rend une ligne par élève ayant soumis au moins une tentative.

> [!danger] L'API ne connaît pas le contenu
> Elle ignore quels exercices sont **obligatoires** — le contenu est construit côté front — donc
> elle ne peut produire aucun décompte comparable à un total. Elle renvoie la **liste** des
> identifiants réussis, et le tableau de bord fait le tri selon
> [[ADR-004 Mode expert en bonus débloqué]].
>
> Le faire remonter par le client reviendrait à faire confiance au navigateur d'un élève pour une
> donnée qui pilote l'affichage professeur. C'est aussi pourquoi il n'existe **pas de statut
> « terminé »** : il supposerait ce même total.

Le code source de l'élève ne remonte jamais — seulement le verdict et le **type** d'exception.
Voir [[ADR-002 Identification par code d'agent]].

## Deux pièges corrigés

> [!warning] « Bloqué 0 min »
> Le délai affiché était `inactif_depuis_s`, c'est-à-dire le temps depuis la **dernière
> soumission** — souvent quelques secondes chez un élève qui enchaîne les essais. « Bloqué
> 0 min » ne veut rien dire. Le délai ne s'affiche plus qu'au-delà d'une minute.

> [!warning] Un compte sans dénominateur
> « 24 exercices validés » ne dit pas si c'est beaucoup. Et le compte incluait les renforts et les
> bonus, qui n'entrent dans aucune progression. C'est ce qui a motivé le passage de `reussis`
> d'un entier à une liste d'identifiants.

## La porte

Le code professeur ne passe **jamais dans l'URL** : il finirait dans l'historique et dans les
captures d'une projection en classe. Il se tape, et se garde le temps de l'onglet —
`sessionStorage`, jamais `localStorage`, parce que la machine de la salle est partagée.

## Voir aussi

[[Vue d'ensemble]] · [[Pièges et invariants]] · [[Bilan 2025-2026]] · [[ADR-004 Mode expert en bonus débloqué]]
