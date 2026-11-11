---
title: Exercices d'API et charge machine
tags:
  - architecture
  - execution
  - exploitation
statut: tranchée
mis-a-jour: 2026-11-10
---

# Exercices d'API et charge machine

> [!abstract] La question
> La séance 5 enseigne JSON et les API ([[Séance 5]]). Un exercice d'API appelle un service : qui
> reçoit cet appel, et est-ce que ==la VM partagée== ([[Déploiement UNIGE]]) peut le supporter ?

> [!important] Tranché le 10 novembre 2026 : le réseau réel, borné
> Le professeur a choisi **Open-Meteo en réseau réel**, pour que les élèves voient la vraie réponse
> changer avec leur requête. La décision et son implémentation sont dans
> [[ADR-018 Open-Meteo en réseau réel, borné par le dojo]]. Le reste de cette note est l'analyse
> qui a précédé : les trois options, et pourquoi la recommandation initiale (le service simulé) n'a
> pas été retenue. Ce qui en reste **entièrement valable** : la VM n'est jamais touchée, et le
> quota partagé est le vrai risque.

> [!success] Réponse courte
> **Aucun exercice n'a besoin d'atteindre le réseau.** Le code des élèves tourne dans leur
> navigateur ([[ADR-001 Exécution du code dans le navigateur]]) : un appel d'API part donc de
> **leur** machine, jamais de la nôtre. On ne peut saturer la VM que si on lui fait recevoir ces
> appels. L'option recommandée ci-dessous les garde **dans le navigateur**, comme le reste.

## Ce que le code actuel permet (vérifié le 10 novembre 2026)

| Constat | Source |
|---|---|
| Pyodide **0.26.4**, Python **3.12.1** | `pyodide-lock.json` |
| `requests`, `urllib3`, `certifi`, `pyodide-http` sont **déclarés** dans le lock… | `pyodide-lock.json` |
| …mais `web/public/pyodide/` ne contient que **cinq fichiers** : aucun de ces paquets n'est livré | dossier `public/pyodide/` |
| `import json` marche sans rien : `json` fait partie de la bibliothèque standard | `python_stdlib.zip` |
| Le worker exécute le code de l'élève par `exec()` dans un espace de noms neuf, sans réseau explicite | `execution/worker.ts` |
| Le validateur de construction exécute chaque solution **en Python natif**, sur le poste de build | `valider_contenu.py::_executer` |

> [!danger] `import requests` échouerait de façon trompeuse
> `loadPyodide({ indexURL: '/pyodide/' })` cherche les paquets sous `/pyodide/`. Le `Caddyfile`
> répond `try_files {path} /index.html` : un `.whl` absent ne donne pas un 404 mais ==la page
> d'accueil en 200==. L'erreur serait un fichier « corrompu », sans rapport avec la cause.
> *Déduit de la configuration, pas essayé.* Livrer ces paquets (quelques centaines de Ko) ne
> règle de toute façon pas le problème qui suit.

## Pourquoi un vrai service poserait problème

### 1. Une API publique (ex. Open-Meteo, celle des slides)

- **Toute la classe sort par une seule adresse IP** (NAT de l'établissement) : les quotas par IP se
  partagent à 24, et se consomment vite. Voir « La rafale compte plus que le débit » dans
  [[Déploiement UNIGE]].
- **Chaque élève transmet son adresse IP à un tiers.** Public mineur, hébergement universitaire :
  c'est la raison pour laquelle rien n'est servi depuis un CDN ([[Contraintes]]).
- **La réponse change** (la météo) : impossible d'écrire un `attendu` stable, donc impossible de
  valider ([[Moteur de validation]]).
- **Le build ne peut pas la rejouer.** `valider_contenu.py` exécute la solution à chaque
  construction ; une solution qui appelle Internet rend la construction dépendante du réseau et
  non reproductible ([[Modèle de contenu]]).
- Le réseau des établissements est inconnu, et le CORS dépend du service.

### 2. Notre propre API (FastAPI) sur la VM

Les contraintes sont dans [[Déploiement UNIGE]] : 2 cœurs et 3,9 Go **partagés** avec un autre
service, API en **un seul processus** borné à 512 Mo, et aucun `limit_req` global voulu.

> [!danger] Le vrai danger est la boucle, pas le nombre d'élèves
> Le chapitre 3 enseigne `while`. Un `while True: requests.get(...)` tourne 5 secondes avant que le
> minuteur ne le coupe ([[Moteur d'exécution]]). À quelques dizaines de millisecondes par appel,
> c'est de l'ordre de **centaines d'appels par élève** — et vingt-quatre élèves ont le même
> réflexe au même moment. *Ordre de grandeur calculé, non mesuré.* La borne de 12/min sur
> `/prof/connexion` existe pour la même raison : une route qui coûte, atteignable sans limite.

### 3. « Une API publique et gratuite, c'est bon ? » — vérifié le 10 novembre 2026

**Pour la VM : oui**, l'appel part du navigateur de l'élève, la VM ne le voit pas. Mais le coût se
déplace, il ne disparaît pas :

| | [Open-Meteo](https://open-meteo.com/en/terms) (celle des slides) | [OpenWeather](https://openweathermap.org/price) |
|---|---|---|
| Clé d'API | **aucune** | **obligatoire** |
| Limite gratuite | moins de 10 000 appels par jour, 5 000 par heure, 600 par minute, **par adresse IP** | 60 appels par minute et 1 000 000 par mois, **par compte** |
| Usage gratuit | non commercial | selon le plan |
| Qui épuise la limite | la classe entière, qui partage une IP | la classe entière, qui partage **une** clé |
| CORS depuis un navigateur | **autorisé** (`access-control-allow-origin: *`), vérifié le 10 novembre 2026 ; le quota restant est même lisible dans les en-têtes | non vérifié |

> [!danger] OpenWeather oblige à mettre une clé dans le code de chaque élève
> Une clé lisible dans le navigateur n'est plus un secret : n'importe quel élève la recopie, et
> épuise les 60 appels par minute de toute la classe. Les 24 élèves partagent **un seul** quota.
> Open-Meteo, sans clé, évite ce piège — c'est sans doute pour cela que les slides l'utilisent.

> [!warning] Reste vrai, quelle que soit l'API publique
> Réponse qui change (donc pas d'`attendu` stable), construction qui ne peut pas la rejouer, adresse IP de
> chaque élève transmise à un tiers, `requests` non livré, et réseau d'établissement inconnu. Une
> API publique convient à **une démonstration non notée**, pas à un exercice validé.

## Les trois options

| | A. API simulée dans le navigateur | B. Fichiers JSON statiques servis par Caddy | C. API réelle (tierce ou la nôtre) |
|---|---|---|---|
| Charge sur la VM | **nulle** | négligeable (fichiers de 1 à 5 Ko, mis en cache) | variable, **à borner** |
| Réseau de la salle requis | non | oui, mais même origine | oui |
| Réponse déterministe, validable | **oui** | oui | non (tierce) / oui mais coûteuse (la nôtre) |
| Rejouable à la construction | **oui** | possible, avec un serveur de test | non |
| `GET`, `POST`, `PUT`, `DELETE` | **oui** | `GET` seulement | oui |
| Codes d'erreur (404, 500) à travailler | **oui, à volonté** | un fichier absent = 404 | selon le service |
| Syntaxe apprise = syntaxe réelle | **oui** (`import requests`) | oui | oui |
| Données personnelles hors de la VM | aucune | aucune | **oui** si tierce |

## Recommandation : trois étages

> [!tip] Du plus sûr au plus risqué — on s'arrête à celui dont la séance a besoin
> **Étage 0 — JSON sans réseau.** Les slides 7 à 10 : lire un texte JSON, `json.loads`, accéder à
> `data["user"]["amis"][1]`, modifier, `json.dumps`. Le JSON est **dans l'énoncé**, comme l'image de
> `s4-37`. Aucune nouveauté d'infrastructure.
>
> **Étage 1 — `requests` simulé, dans le worker.** L'élève écrit exactement `import requests`,
> `requests.get(url, params=...)`, `.status_code`, `.json()`. Un module fourni par le harnais répond
> à partir d'un jeu de routes **déclaré dans le YAML de l'exercice**. C'est l'option A.
>
> **Étage 2 — le vrai réseau, au vidéoprojecteur seulement.** Le professeur montre Open-Meteo et
> Postman (slides 15 et 16) depuis **un** poste : une requête, une adresse IP. Les élèves ne
> l'exécutent pas.

### Ce que l'étage 1 exige

1. **Une seule source Python** pour le faux `requests`, importée par le worker (en texte, `?raw`) et
   par le validateur. Sans cela, ce serait la **troisième duplication** du projet, après les deux
   `normaliser` et la tolérance du quiz ([[Pièges et invariants]]) — et la seule qui ne se
   testerait pas par parité.
2. **Un plafond d'appels par exécution** (ordre de 20), qui lève une erreur en français :
   « Ton programme appelle le service sans arrêt ». Même raisonnement que les 60 000 caractères de
   sortie : une borne dure, plutôt qu'un minuteur seul.
3. **Les routes dans le YAML**, avec le statut, les en-têtes utiles et le corps. Un exercice sans
   routes ne peut pas appeler `requests` : l'appel lève une erreur claire.
4. **Les paramètres comptent** : `params={"latitude": 46.2}` doit changer la réponse. Sinon
   l'exercice n'enseigne pas `params`.
5. **Le test `variable` et le test `sortie` suffisent** pour valider : `valeur_attendue` est une
   chaîne `repr`, qui sait écrire un `dict`. Seul `type_attendu` est limité à
   `int | float | str | bool` dans `outils/schema.py` ; l'étendre à `list` et `dict` est optionnel.
6. **Une exécution par test** reste la règle ([[Moteur de validation]]) : le compteur d'appels
   repart à zéro à chaque exécution.

> [!warning] Dire que c'est simulé
> La leçon l'écrit en toutes lettres : « Ici, le service est simulé pour que chacun ait la même
> réponse. Sur Internet, la réponse change et peut échouer. » Un élève qui croit avoir appelé une
> vraie API et qui retrouve la même chose chez lui se sentirait floué.

## Ce que cela ne coûte pas

- Aucune route d'API de plus ([[Vue d'ensemble]] : « chaque point d'entrée est du code à défendre »).
- Aucune règle nginx, aucun `limit_req`, aucune mémoire de plus sur la VM.
- Aucune dépendance externe à l'exécution.
- Aucun paquet Pyodide de plus à livrer : le faux `requests` est un fichier Python de quelques
  dizaines de lignes.

## Ce qui a été retenu

Aucune des trois options telles quelles : **le réseau réel d'Open-Meteo, par un `requests` du dojo**
qui reprend les bornes de l'option A (plafond d'appels, hôtes autorisés, `429`, cache) et ajoute les
réponses enregistrées de l'option B pour la construction et le secours.
Voir [[ADR-018 Open-Meteo en réseau réel, borné par le dojo]].

- [x] Option retenue — ADR-018
- [ ] Le test de charge de [[Déploiement UNIGE]] (24 onglets) ne couvre pas Open-Meteo : l'essayer
      **depuis chaque salle**, avant la [[Séance 6]]
- [x] Rédiger l'ADR-018

## Voir aussi

[[Séance 5]] · [[Moteur d'exécution]] · [[ADR-001 Exécution du code dans le navigateur]] · [[Déploiement UNIGE]] · [[Pièges et invariants]]
