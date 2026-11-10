---
title: ADR-018 Open-Meteo en réseau réel, borné par le dojo
tags:
  - decision
  - architecture
  - execution
statut: acceptée
date: 2026-11-10
---

# ADR-018 — Open-Meteo en réseau réel, borné par le dojo

> [!success] Statut : acceptée le 10 novembre 2026

## Contexte

La séance 6 enseigne les API ([[Séance 6]]). Les slides s'appuient sur Open-Meteo, et le
professeur veut que les élèves **manipulent la vraie requête** et voient la réponse changer avec
elle. Le coffre recommandait d'abord un service simulé ([[Exercices d'API et charge machine]]) ;
le professeur a choisi le service réel.

Ce choix ne touche pas la VM : l'appel part du navigateur de l'élève
([[ADR-001 Exécution du code dans le navigateur]]). Ce qu'il met en jeu, c'est le **quota que toute
la classe partage** : Open-Meteo limite par adresse IP (600 appels par minute, 5 000 par heure,
10 000 par jour), et vingt-quatre élèves sortent par une seule.

## Décision

**Les requêtes d'API partent pour de vrai vers Open-Meteo, par un `requests` écrit pour le dojo,
qui les borne.**

- **Un seul fichier**, `outils/requests_dojo.py`, installé sous le nom `requests` par le worker
  dans le navigateur et par le validateur à la construction. L'élève écrit `import requests` et
  `requests.get(url, params=...)`, comme partout.
- **Les bornes vivent dans ce fichier** : seuls les deux hôtes d'Open-Meteo répondent ; six appels
  par programme ; vingt appels réels par minute et par navigateur, au-delà de quoi il répond `429`
  comme le ferait le service ; un cache de cinq minutes, qui fait qu'une même requête ne part
  qu'une fois ; un budget de 3,5 s de réseau, pour qu'un service lent ne se déguise jamais en
  « ton programme tourne en rond ».
- **La construction ne touche jamais le réseau.** Elle rejoue des réponses **enregistrées**
  (`outils/enregistrements/open-meteo.json`), et c'est ce qui rend un exercice d'API validable
  hors ligne.
- **Les mêmes enregistrements servent de secours** dans le navigateur : si le réseau d'un
  établissement bloque le service, l'exercice reste jouable (`reponse.enregistree` vaut `True`).
- **Un exercice d'API ne teste que ce qui ne varie pas** avec la date : une unité, la taille d'un
  tableau, un fuseau, un code de pays, le **type** d'une température — jamais sa valeur.

## Conséquences

**Favorables**

- Les élèves voient la vraie réponse changer quand ils changent `temperature_unit`,
  `forecast_days`, `hourly`, `daily` ou la ville.
- La VM ne reçoit aucun appel de plus, et rien à déployer côté serveur.
- Vérifié le 10 novembre 2026, dans un vrai navigateur : dix-huit solutions d'API rejouées contre
  le vrai service passent les mêmes critères que le validateur ; le plafond, le refus d'hôte,
  l'erreur 400, le cache (2 ms au lieu de 35) et le secours se comportent comme prévu.

**Défavorables**

- **Le quota de la classe reste un risque, pas une certitude.** Vingt appels par minute et par
  navigateur sur vingt-quatre navigateurs, c'est 480 sur 600 : ça tient, mais un élève qui ouvre
  deux onglets double sa part. Le `429` est alors le comportement normal, et la leçon le dit.
- Une réponse enregistrée vieillit. Si Open-Meteo change un nom de champ, la construction passe
  et le navigateur échoue. Ré-enregistrer : `DOJO_ENREGISTRER=1 python valider_contenu.py`.
- Un élève peut contourner les bornes en important `js` : assumé, comme le reste du client
  ([[ADR-001 Exécution du code dans le navigateur]]).
- L'adresse IP de chaque établissement est transmise à Open-Meteo. C'est le coût du choix du
  professeur, et la raison pour laquelle l'allowlist se limite à deux hôtes.

## Alternatives écartées

- **Service simulé dans le worker.** Sans réseau, déterministe, validable à l'identique : c'était
  la recommandation. Écarté parce que les élèves ne verraient pas une vraie réponse changer.
- **Le vrai `requests` de Pyodide avec `pyodide-http`.** Non livré dans `public/pyodide/`, et sans
  aucune borne : un `while True` épuiserait le quota de la salle.
- **OpenWeather.** Exige une clé, lisible par chaque élève, et son quota est par compte : toute la
  classe partagerait 60 appels par minute.
- **Notre propre API sur la VM.** C'est la seule option qui chargerait la machine partagée
  ([[Déploiement UNIGE]]), pour aucun bénéfice.

## Voir aussi

[[Exercices d'API et charge machine]] · [[Séance 6]] · [[Moteur d'exécution]] · [[Pièges et invariants]]
