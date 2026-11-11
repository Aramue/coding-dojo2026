---
title: Séance 6
tags:
  - pedagogie
  - contenu
statut: écrit
mis-a-jour: 2026-11-10
---

# Séance 6 — Interroger un service web

> [!abstract] Ce que la séance enseigne
> La seconde moitié des slides *Introduction aux services web avec Python* : réseau, URL, HTTP,
> API, `requests`. Les élèves envoient de **vraies requêtes** à Open-Meteo et voient la réponse
> changer avec les paramètres. Décision : [[ADR-018 Open-Meteo en réseau réel, borné par le dojo]].
> Elle suppose les dictionnaires et le JSON de la [[Séance 5]].

> [!warning] Date d'ouverture provisoire
> Le chapitre `services` s'ouvre le **31 décembre 2099** dans `outils/schema.py` : fermé aux élèves,
> visible dans l'aperçu du professeur. À remplacer par la vraie date avant la release.

## Le volume

| | Séance 6 |
|---|---|
| Exercices | **28** |
| dont obligatoires | **19** |
| dont renforts | 6 |
| dont experts | 3 |
| `predire` | 5 |
| `debug` | 4 |
| `completer` | 3 |
| `ecrire` | 16 |

| Notion | Exercices | Leçon | Durée |
|---|---|---|---|
| Réseau, URL et HTTP | `s6-01` à `s6-08` — 5 obligatoires, 2 renforts, 1 expert | `c6-web` | 4 min |
| Envoyer une requête | `s6-09` à `s6-16` — 6 obligatoires, 2 renforts | `c6-requetes` | 5 min |
| Faire varier la requête | `s6-17` à `s6-25` — 6 obligatoires, 2 renforts, 1 expert | `c6-explorer` | 4 min |
| Un programme météo | `s6-26` à `s6-28` — 2 obligatoires, 1 expert | `c6-meteo` | 3 min |

## Ce qui se manipule

Le but est que l'élève **change un paramètre et regarde la réponse bouger**. Chaque exercice
d'exploration a une sortie qui dépend de la requête et de rien d'autre :

| Paramètre changé | Ce qui change dans la réponse | Exercice |
|---|---|---|
| `temperature_unit` | l'unité : `°C` devient `°F` | `s6-17` |
| `windspeed_unit` | l'unité du vent : `km/h` devient `mp/h` | `s6-18` |
| `forecast_days` avec `hourly` | le nombre d'heures : 24 par jour, donc 72 pour 3 jours | `s6-19` |
| `hourly` avec deux variables | les clés de `hourly` | `s6-21` |
| `daily` et `forecast_days` | le nombre de jours | `s6-22` |
| le nom de la ville (recherche) | le pays, les coordonnées, puis le fuseau de la météo | `s6-15`, `s6-24`, `s6-25` |
| une latitude impossible | un `400` et un message du service | `s6-13`, `s6-23` |

> [!important] On ne teste jamais une valeur qui change avec la date
> La température, le vent et les dates d'aujourd'hui ne se comparent à rien : les tests portent sur
> une **unité**, une **taille**, un **fuseau**, un **code de pays** ou le **type** (`float`) d'une
> valeur. C'est ce qui permet de valider un exercice contre le vrai service, et de le rejouer à
> la construction sur une réponse enregistrée. Voir [[ADR-018 Open-Meteo en réseau réel, borné par le dojo]].

## Ce que la séance réutilise

| Notion antérieure | Où elle revient |
|---|---|
| f-string ([[Chapitre 1]]) | construire une URL : `s6-01`, `s6-03`, `s6-04` |
| dictionnaire ([[Séance 5]]) | les paramètres, les méthodes, les codes de statut, `villes` |
| clés qui ont un type | `statuts["404"]` contre `statuts[404]` : `s6-05` |
| `json()` et chemin imbriqué | lire une réponse : `s6-10`, `s6-12` |
| `in` sur un dictionnaire | une ville inconnue n'a pas de clé `results` : `s6-16` |
| boucle `for` sur un dictionnaire | une requête par ville : `s6-25`, `s6-28` |
| `range(len(...))` et comparaison | le jour le plus chaud : `s6-27` |

## Le programme d'assemblage

`s6-26`, « Le temps dans une ville ». À partir de `ville = "Genève"`, le programme cherche la
ville, enchaîne une seconde requête avec ses coordonnées, range le pays, la température et l'unité,
et affiche `Genève (CH) : 10.9 °C`. Les tests portent sur `pays`, `unite` et le **type** de
`temperature` ; la phrase affichée n'est pas comparée, puisque la température change.

Voir [[Programme d'assemblage]].

## Les messages d'erreur ajoutés

La séance fait rencontrer `KeyError` (une clé de dictionnaire, `s6-05`, `s6-23`), `TypeError` sur
une réponse qu'on lit comme un dictionnaire (`s6-11`), et les erreurs de requête
(`ConnectionError`, `Timeout`, `HTTPError`, `RequestException`). Chacune a son message en français :
voir [[Messages d'erreur en français]].

## Le temps

19 obligatoires = 5 `predire`/`completer`, 4 `debug` et 10 `ecrire` : **≈ 84,5 min** de
pratique, pour **16 min** de leçons, soit **≈ 100 min**. Il reste ≈ 20 min pour les slides de
culture (réseau, URL, HTTP, Postman), ce qui est juste.

> [!note] Plan de coupe
> Si la salle décroche, couper dans cet ordre : `s6-24`, `s6-21`, `s6-16` (≈ −15 min). Décidé à
> l'avance, comme pour les séances précédentes ([[Plan de production]]).

## Avant la séance

> [!danger] À essayer depuis une vraie salle, comme le WebSocket du quiz
> Chaque établissement a un réseau inconnu ([[Contraintes]]). Ouvrir `https://api.open-meteo.com/v1/forecast?latitude=46.2&longitude=6.1&current_weather=true`
> dans un navigateur de la salle. Si rien ne répond, l'exercice reste jouable grâce aux réponses
> enregistrées, mais **sans les paramètres que l'élève invente** : seules les requêtes des
> solutions sont enregistrées.

- [ ] Date de la séance 6 dans `CHAPITRES["services"]["ouverture"]`
- [ ] Une requête depuis chaque salle utilisée
- [ ] Ré-enregistrer les réponses si Open-Meteo a changé un champ :
      `DOJO_ENREGISTRER=1 python valider_contenu.py ../contenu/chapitre-1`

## Écarts assumés avec les slides

- **Le professeur montre Postman, les élèves ne l'installent pas** : un outil à télécharger, ce que
  le projet évite depuis la friction PyCharm de 2025.
- **Seule la méthode `GET` s'exécute.** `POST`, `PUT` et `DELETE` s'apprennent comme des notions
  (`s6-02`, `s6-08`) : Open-Meteo ne propose que la lecture, et le dojo n'a pas de service à écrire.
- **Les slides 2 à 5 et 12 à 13** (réseau, URL, qu'est-ce qu'une API) n'ont pas d'exercice dédié ;
  `s6-01` à `s6-03` couvrent l'URL. Un quiz en direct pourrait les couvrir ([[Quiz en direct]]),
  mais les quiz sont aujourd'hui bornés à la séance 3 dans le schéma.

## Voir aussi

[[Séance 5]] · [[Exercices d'API et charge machine]] · [[ADR-018 Open-Meteo en réseau réel, borné par le dojo]] · [[Modèle de contenu]]
