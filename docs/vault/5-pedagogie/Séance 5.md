---
title: Séance 5
tags:
  - pedagogie
  - contenu
statut: écrit
mis-a-jour: 2026-11-10
---

# Séance 5 — Dictionnaires et JSON

> [!abstract] Ce que la séance enseigne
> La première moitié des slides *Introduction aux services web avec Python* ([[Sources]]) : le
> format de données JSON. Elles **supposent les dictionnaires**, que le chapitre 1 n'avait jamais
> enseignés : la séance commence donc par eux. Les API et `requests` forment la [[Séance 6]],
> faute de tenir dans deux heures. Séances précédentes : [[Chapitre 1]] et [[Séance 4]].

> [!success] Ouverte le 10 novembre 2026
> `CHAPITRES["donnees"]["ouverture"]` vaut `2026-11-10`, un mardi : la séance est ouverte dès la
> publication, sans attendre un mercredi ([[ADR-013 Une séance s'ouvre à sa date]]). « Publication »
> veut dire le déploiement d'un tag : tant qu'il n'est pas fait, rien n'est visible des élèves.

## Le volume

| | Séance 5 |
|---|---|
| Exercices | **37** |
| dont obligatoires | **28** |
| dont renforts | 3 |
| dont experts | 6 |
| `predire` | 14 |
| `debug` | 4 |
| `completer` | 4 |
| `ecrire` | 15 |

| Notion | Exercices | Leçon | Durée |
|---|---|---|---|
| Rappels avant les dictionnaires | `s5-01` à `s5-03` — 3 obligatoires | `c5-avantdict` | 3 min |
| Les dictionnaires | `s5-04` à `s5-16` — 10 obligatoires, 1 renfort, 2 experts | `c5-dictionnaires` | 6 min |
| Des données imbriquées | `s5-17` à `s5-27` — 8 obligatoires, 1 renfort, 2 experts | `c5-imbriques` | 4 min |
| Lire et écrire du JSON | `s5-28` à `s5-37` — 7 obligatoires, 1 renfort, 2 experts | `c5-json` | 4 min |

## Ce que disent les slides

| Slide | Contenu | Où c'est travaillé |
|---|---|---|
| 2 à 5 | Réseau, nœuds, Internet contre web, URI et URL | [[Séance 6]] |
| 6 à 8 | Pourquoi un format de données ; JSON, lisible par un humain | `c5-json` |
| 9 | `data["user"]["amis"][1]` | `s5-17`, `s5-18`, `s5-19` |
| 10 | Types JSON ; `json.loads`, modifier, `json.dumps` | `s5-28` à `s5-35` |
| 12 à 16 | API, service web, HTTP, `requests`, Postman | [[Séance 6]] |

## Les dictionnaires dans la séance

**Le trou comblé.** Les slides 8, 9 et 15 reposent sur `data["user"]["nom"]`, sur `{"age": 18}` et
sur `params = {...}` ; aucun des fichiers de contenu précédents ne parlait de dictionnaire.

| Ce que la séance utilise | Où c'est travaillé |
|---|---|
| liste, position, `for`, compteur, `if` | `avantdict` (réactivation de la séance 4) |
| clé et valeur, `d["clé"]`, `KeyError` | `s5-04` à `s5-06` |
| modifier, ajouter, `len`, `in` | `s5-07` à `s5-11` |
| `for` sur les clés, `items()` | `s5-12`, `s5-13`, `s5-14` |
| dictionnaire dans un dictionnaire, liste dans un dictionnaire | `s5-17` à `s5-21` |
| liste de dictionnaires, filtrer et cumuler | `s5-22` à `s5-24` |
| `json.loads`, `json.dumps`, `true` et `null` | `s5-28` à `s5-37` |

> [!note] Les ponts
> `s5-17` et `s5-18` reprennent **mot pour mot** les structures des slides 8 et 9 (`user`, `nom`,
> `amis` ; `Marc`, `Clara`, `cours`). `s5-15` compte les lettres d'un texte : le début de l'analyse
> de fréquences qui casse un chiffrement de César ([[Programme d'assemblage]], « Le pont vers le
> chapitre 2 »).

Les écarts assumés : aucun `def`, aucun `input()` sauf `s5-11`, et `dict(` est interdit dans `s5-08`
pour que l'élève écrive les accolades.

## Le programme d'assemblage

La séance n'a pas de programme d'assemblage unique : ses quatre notions finissent chacune sur des
exercices d'écriture (`s5-24`, `s5-34`). Le programme qui réunit tout est celui de la
[[Séance 6]] (`s6-26`), qui utilise dictionnaires, JSON et requêtes ensemble.

## Slides à ajouter pour les dictionnaires

À insérer **avant la slide 8** (format JSON), dans le style des slides existantes : cartes de code
sombres à trois pastilles, une idée par slide. Huit slides, environ 10 minutes.

| # | Titre | Contenu |
|---|---|---|
| D1 | Une liste ne suffit pas | `fiche = ["Camille", 17, "Genève"]` — « quelle est la ville ? » : il faut savoir que c'est la position 2. Un point d'interrogation sur chaque valeur. |
| D2 | Le dictionnaire : des clés et des valeurs | `fiche = {"nom": "Camille", "age": 17, "ville": "Genève"}`, avec des flèches « clé » et « valeur ». Comparaison avec un dictionnaire papier : on cherche par le mot. |
| D3 | Lire par la clé | `fiche["nom"]` et `fiche["age"] + 1`. Un encadré rouge : une clé absente donne `KeyError`, et `"Nom"` n'est pas `"nom"`. |
| D4 | Modifier, ajouter, tester | `fiche["age"] = 18` · `fiche["classe"] = "3e"` · `"pays" in fiche`. Même écriture pour modifier et pour ajouter. |
| D5 | Parcourir un dictionnaire | `for cle in notes:` puis `for cle, valeur in notes.items():`, avec la sortie à droite. |
| D6 | Un dictionnaire dans un dictionnaire | La structure de la slide 9 (`data["user"]["amis"][1]`), avec **un crochet coloré par niveau** et un petit arbre à côté. C'est la slide qui fait le lien avec le JSON. |
| D7 | Une liste de dictionnaires | `[{"nom": "Alice", ...}, {"nom": "Bob", ...}]` et `for e in eleves: e["nom"]`. Ce que renvoient presque toutes les API. |
| D8 | Liste ou dictionnaire ? | Tableau : `[ ]` position · `{ }` clé ; « un ordre » · « des noms » ; `liste[0]` · `dico["clé"]`. |

Et **une slide à ajouter après la slide 10**, qui manque pour le passage Python ↔ JSON :

| Python | JSON |
|---|---|
| `dict` | objet `{ }` |
| `list` | tableau `[ ]` |
| `str` | chaîne |
| `int`, `float` | nombre |
| `True`, `False` | `true`, `false` |
| `None` | `null` |

Avec une remarque : le texte JSON s'écrit toujours avec des **guillemets doubles**, alors que Python
peut afficher des apostrophes.

## Le temps

28 obligatoires : ≈ 93 min de pratique, pour 17 min de leçons, soit **≈ 110 min** — avant les
slides. C'est trop pour deux heures.

> [!tip] Plan de coupe
> Couper dans cet ordre : `s5-13`, `s5-23`, `s5-20`, `s5-33` (≈ −15 min), puis `s5-03`. Décidé à
> l'avance, pour ne pas improviser devant 24 élèves ([[Plan de production]]).
> Un élève qui a fini ses obligatoires et attend a les 3 renforts et les 6 experts.

## Outillage touché

`outils/schema.py` : `seance` jusqu'à 6, `MOTIF_ID` en `s[123456]`, `MOTIF_LECON` en `c[123456]`,
huit notions et deux chapitres (`donnees`, `services`). Le type TypeScript `seance` suit.
`web/src/validation/erreurs.ts` : règles `KeyError` et `JSONDecodeError`
([[Messages d'erreur en français]]). Le dossier reste sous `chapitre-1/`, comme la séance 4.

## Voir aussi

[[Séance 4]] · [[Séance 6]] · [[Programme d'assemblage]] · [[Types d'exercices]] · [[Plan de production]]
