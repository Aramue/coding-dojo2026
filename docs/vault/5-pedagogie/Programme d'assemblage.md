---
title: Programme d'assemblage
tags:
  - pedagogie
mis-a-jour: 2026-09-14
---

# Programme d'assemblage

Chaque séance se termine par **un petit programme complet**, qui réunit les notions vues dans la
séance. C'est ce qui remplace le « problème à rendre » séparé : l'élève ne découvre pas un
énoncé neuf en fin de parcours, il assemble ce qu'il vient d'apprendre.

## Séance 1 — la carte de membre

`s1-34`. Le programme demande un prénom et un âge, convertit l'âge en nombre entier, calcule
l'âge de l'année suivante, et affiche quatre lignes au format exact.

```
=== CARTE DE MEMBRE ===
Nom : Camille
Age : 17 ans
L'an prochain : 18 ans
```

Notions réunies : `input()`, `int()`, le f-string, `print`, et le format exact. Rien d'autre.

## Séance 2 — l'abonnement de la piscine

`s2-38`, écrit le 14 septembre 2026. Le programme demande un prénom et un âge. Entre 18 et
65 ans, bornes comprises, il souhaite la bienvenue et calcule un code de casier ; sinon, il refuse.

```
Bienvenue Camille !
Abonnement accepté
Ton code de casier : 110
```

Notions réunies : l'encadrement, `if` / `else`, le calcul et le modulo, le f-string, et le format
exact, exigé. Les essais passent par les deux bornes, 18 et 65 ans.

> [!note] Le code vaut `(age * 37) % 1000`, et non `(age * 7) % 1000`
> La formule de 2025 multipliait par 7. Or entre 18 et 65 ans, `age * 7` ne dépasse jamais 455 :
> le modulo n'aurait rien fait, et aucun essai n'aurait distingué `% 1000` de `% 10000` — l'erreur
> que la conception voulait justement démasquer. Avec 37, un abonné de 65 ans obtient 2405 avant
> le modulo, et 405 après.

## Séance 3 — la carte jeune du cinéma

`s3-39`, écrit le 14 septembre 2026. Le programme demande un prénom et un âge. De 15 à 25 ans,
bornes comprises, il souhaite la bienvenue et calcule le code de la carte, `(age * 43) % 1000`,
puis en affiche chaque chiffre sur sa ligne, numéroté à partir de 1 ; sinon, il refuse.

```
Bienvenue Camille !
Code de la carte : 817
Chiffre 1 : 8
Chiffre 2 : 1
Chiffre 3 : 7
```

Notions réunies : les trois séances. `input()` et `int()`, l'encadrement et `if` / `else`, le
modulo, `str()` pour parcourir un nombre, le compteur qui numérote, et le format exact, exigé.

> [!note] Un code à deux chiffres, exprès
> À 25 ans, `25 * 43` vaut 1075, et le code n'a que deux chiffres : 75. L'essai démasque un
> programme qui afficherait toujours trois lignes de chiffres au lieu de parcourir le code.

Son bonus, `s3-40`, reprend le corrigé « avancé » de 2025 : quatre questions, un drapeau et trois
contrôles, puis un code à quatre chiffres transmis position par position. ==Le compteur manuel
remplace `enumerate()`==, que ce corrigé employait sans l'avoir jamais enseigné, et aucun emoji ne
reste dans une sortie comparée.

> [!note] Les blocs de 2025, retranchés
> Les blocs des séances 2 et 3 étaient conçus autour d'un programme `acces_qg.py` construit sur
> les trois séances, dont la version finale reproduisait un fichier du cours précédent. ==Le choix
> « chaque exercice est autonome » ([[ADR-010 Abandon de la fiction narrative]]) a supprimé ce fil
> rouge== : les deux blocs ont été réécrits en programmes autonomes. La progression technique,
> elle, n'a pas changé.

## L'injection de bloc manquant

> [!success] Aucun bloc n'est un point de blocage unique
> Si un élève n'a pas fini le programme de la séance précédente — absence, lenteur, échec —
> ==la plateforme injecte la version de référence, visiblement étiquetée== pour l'élève et pour
> le professeur, et le programme complet tourne quand même.

C'est la propriété de rétention la plus importante du dispositif, et elle ne dépend **pas** du
sujet : elle survit intacte à l'abandon de la fiction. Elle change la nature du travail à la
maison : ce n'est jamais « écris ce programme », c'est **« il manque un morceau à ton programme
qui tourne déjà »**. Un élève absent en semaine 2 revient en semaine 3 sans être perdu.

Rappel du problème traité : en 2025, 18 élèves sur 24 ont décroché ([[Bilan 2025-2026]]).

> [!warning] Non implémentée
> L'injection est un choix de conception, pas encore du code. Rien dans la plateforme ne la fait
> aujourd'hui. ==La séance 2 n'en a pas eu besoin== : `s2-38` ne reprend pas `s1-34`, il part de
> quatre remarques qui découpent le travail, comme le programme de la séance 1. La séance 3 non plus :
> `s3-39` part, lui aussi, de quatre remarques.

## Ce que la réécriture a coûté

La séance 3 devait être ==la moins chère des trois== : son énoncé, son corrigé et son fichier de
résultat attendu existaient déjà dans le dépôt 2025, et étaient réutilisables tels quels.

En retirant la fiction, **on perd cette réutilisation** : le fichier de 2025 est écrit autour du
Quartier Général. Il reste utile comme référence de difficulté et de format, mais son texte est à
réécrire. C'est le prix assumé de la décision — voir [[Plan de production]].

## Le pont vers le chapitre 2

L'exercice expert de la séance 3 demande une accumulation de chaîne caractère par caractère.
C'est — sans qu'on le dise aux élèves — ==le squelette exact du chiffrement de César== qui ouvre
le chapitre 2. Ce pont ne dépend d'aucun habillage narratif : il tient.

## Voir aussi

[[Chapitre 1]] · [[Types d'exercices]] · [[Plan de production]] · [[ADR-004 Mode expert en bonus débloqué]]
