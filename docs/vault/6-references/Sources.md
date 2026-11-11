---
title: Sources
tags:
  - reference
mis-a-jour: 2026-09-03
---

# Sources

Tout ce qui est affirmé dans ce coffre est vérifiable ici.

## Dépôt 2025-2026

Emplacement : `CD-Collegien-25/` (OneDrive, dossier partagé Coding Dojo).
Dépôt Git d'origine : `gitlab.unige.ch/coding-dojo-25-eq/introduction-python`.

| Fichier | Ce qu'il sert à établir |
|---|---|
| `introduction-python/1 - Introduction à la programmation avec Python/Notebooks/1) ...ipynb` | Le contenu réel du chapitre 1, et l'absence d'`input()` |
| `.../Exercices/*.ipynb` | Le volume d'exercices existant : environ 5 |
| `.../Problèmes/Cours 1 - Introduction aux bases de Python/` | `IDQuartierGénéralV1(Facile).py`, la version Avancé, les `résultatattendu*.txt` |
| `.../Problèmes/Cours 1 - (Corrections)/` | Les 17 copies d'élèves, verdict dans le nom du fichier |
| `.../Problèmes/Cours 3 - (Corrections)/` | Les 15 copies du TP1, toutes `(ACQUIS)` |
| `.../SlidesCours/*.pdf` | Les cinq decks Canva, source de [[Palette]] et [[Typographie]] |
| `liste élèves inscrits pour CODING DOJO.xlsx`, feuille `25-26` | Les 24 inscrits et leurs 8 établissements |
| `Inscription_eleves.xlsx`, feuille `Liste certification` | Les 6 certifiés |
| `Programme-S1.pdf` | Le programme annoncé du semestre |

Historique Git : 30 commits, du 1ᵉʳ septembre au 27 octobre 2025.

## Slides de la séance 5 — 10 novembre 2026

`IntroductionauxserviceswebavecPython.pdf`, 16 pages, fourni par le professeur. Le texte s'extrait
avec `pypdf` ; **les exemples de code sont des images**, lues à la main. Elles établissent ce que
la séance suppose connu — voir [[Séance 5]].

| Slide | Exemple de code (reconstitué) |
|---|---|
| 8 | `{"Marc": {"age": 18, "cours": ["mathématiques", "informatique", "..."]}, "Clara": {...}}` |
| 9 | `data = {"user": {"nom": "Alice", "amis": ["Bob", "Claire"]}}` puis `data["user"]["nom"]`, `data["user"]["amis"]`, `data["user"]["amis"][1]` |
| 10 | types JSON : objets `{}`, tableaux `[]`, chaîne, nombre, booléen `true`/`false`, `null` |
| 10 | `json.loads(txt)`, `data["age"] = 26`, `json.dumps(data)` |
| 15 | `requests.get(url, params=params)`, `response.json()`, avec `latitude`, `longitude`, `current_weather`, `timezone` sur `api.open-meteo.com/v1/forecast` |

Aucun de ces exemples n'est un secret ni une donnée personnelle : « Alice », « Marc » et « Clara » sont
des prénoms d'illustration.

## Open-Meteo — vérifié le 10 novembre 2026

| Ce qui est établi | Source |
|---|---|
| Limites gratuites : moins de 10 000 appels par jour, 5 000 par heure, 600 par minute, **par adresse IP**, usage non commercial, pas de clé | [open-meteo.com/en/terms](https://open-meteo.com/en/terms) |
| CORS ouvert (`access-control-allow-origin: *`) et quota lisible dans les en-têtes `X-RateLimit-*` | un appel direct à `api.open-meteo.com/v1/forecast` |
| Une requête invalide répond `400` avec `{"error": true, "reason": "..."}` ; une ville inconnue répond `200` sans clé `results` | idem, et `geocoding-api.open-meteo.com/v1/search` |
| OpenWeather : clé obligatoire, 60 appels par minute **par compte** | [openweathermap.org/price](https://openweathermap.org/price) |

Les réponses rejouées à la construction sont dans `plateforme/outils/enregistrements/open-meteo.json`.

## Métadonnées des decks

Format 1440×810, créés sous Canva, auteur « Edu », *brand kit* commun `BAGEGa96lIU`.
Polices embarquées : League Spartan, Glacial Indifference, Open Sans.

## Livrables de conception

| Livrable | Lien |
|---|---|
| Charte visuelle interactive | https://claude.ai/code/artifact/ed35a3d2-d686-46b7-b92d-d9c27e1d0c4c |
| Comparateur typographique | https://claude.ai/code/artifact/88bd7409-1f86-435a-a284-67ba7f09eab9 |
| Progression complète du chapitre 1 | `../5-pedagogie/progression-chapitre-1.json` — 112 exercices, données brutes |

## Références externes

- [Pixees — Informatique lycée, première](https://pixees.fr/informatiquelycee/cours_premiere/) —
  référence pédagogique citée au lancement du projet
- [Pyodide](https://pyodide.org) — CPython compilé en WebAssembly
- [Fontshare — General Sans](https://www.fontshare.com/fonts/general-sans)
- [Dracula Theme](https://draculatheme.com) — le thème des blocs de code
