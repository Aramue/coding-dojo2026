---
title: Pièges et invariants
tags:
  - architecture
  - maintenance
mis-a-jour: 2026-09-03
---

# Pièges et invariants

Cette note existe pour une seule raison : ==plusieurs choix du code ont l'air arbitraires et ne le
sont pas.== Chacun a été payé par un défaut réel, trouvé en exécutant. Les défaire les fait
revenir.

Chaque entrée dit **ce qu'il ne faut pas faire** et **ce qui casse si on le fait quand même**.

## Exécution

### Ne pas passer le worker en `{ type: 'module' }`

Le worker charge Pyodide par `importScripts('/pyodide/pyodide.js')`. En module, `importScripts`
n'existe pas, et l'`import()` équivalent est refusé par le serveur de développement Vite, qui
interdit d'importer un fichier de `public/` depuis le graphe de modules.

**Ce qui casse :** le worker ne démarre jamais en développement. L'élève attend cinq secondes et
reçoit un message de boucle infinie sans rapport. Détail :
[[ADR-007 Worker classique et chargement de Pyodide]].

### Ne pas déplacer le minuteur dans le worker

Le minuteur de 5 secondes vit dans `Executeur`, sur le fil principal.

**Ce qui casse :** un worker bloqué dans une boucle `while True` ne traite plus aucun message, y
compris un ordre d'arrêt. Le seul recours est `terminate()` **depuis l'extérieur**. Un minuteur
interne au worker ne se déclencherait jamais. Or le chapitre 1 enseigne `while` : il y **aura**
des boucles infinies.

### Ne pas lancer deux exécutions en parallèle

`Executeur` réaffecte `worker.onmessage` à chaque appel.

**Ce qui casse :** un second appel concurrent écrase le gestionnaire de réponse du premier, qui
expire alors en silence et affiche un faux message de boucle infinie. `EcranExercice` enchaîne
donc les exécutions avec `await`, jamais un `Promise.all`.

### Se souvenir que l'invite d'`input()` part dans la sortie

Le harnais Python écrit l'invite, puis la réponse simulée, puis un saut de ligne.

**Ce qui casse :** un `attendu` écrit sans tenir compte de l'invite ne correspond jamais.
L'exercice devient impossible à valider — et une classe entière lève la main en même temps.
C'est précisément pour ça qu'on n'écrit **jamais** un `attendu` à la main : voir plus bas.

## Validation

### Les deux `normaliser` doivent rester rigoureusement identiques

`web/src/validation/normaliser.ts` et `outils/valider_contenu.py::_normaliser` font la même
chose. `tests/test_normaliser_parite.py` rejoue les dix cas de la suite TypeScript.

**Ce qui casse :** le Python décide si la solution de référence passe ses tests **au déploiement**,
le TypeScript rend le verdict bleu **dans le navigateur**. Une divergence produit un exercice qui
valide à la construction et recale un élève qui a juste, le mercredi à 14 h.

> [!important] Toute modification de l'un exige la même dans l'autre
> Et la mise à jour du test de parité. C'est le seul endroit du projet où une duplication est
> délibérée.

### Une exécution par test, pas une pour l'exercice

Un exercice peut déclarer plusieurs tests `sortie` avec des entrées différentes, pour vérifier que
la solution généralise.

**Ce qui casse :** une exécution partagée compare la sortie obtenue avec les entrées A à l'attendu
écrit pour les entrées B. Une solution correcte est refusée. Détail dans [[Moteur de validation]].

### `VERT` est gelé

`const VERT = Object.freeze({...})` dans `evaluer.ts`, renvoyé par référence depuis six points.

**Ce qui casse :** un appelant qui enrichirait le résultat en place contaminerait silencieusement
tous les verdicts verts suivants de la session.

### Un message d'erreur ne mentionne que des notions déjà enseignées

Le message `TypeError` conseille `str()`, et **pas** le f-string.

**Ce qui casse :** cette erreur se rencontre en `s1-21`, dont le test exige `str(`. Le f-string
n'est enseigné qu'en `s1-23`. Un élève qui suivait le conseil de l'application se faisait recaler
pour l'avoir suivi — le scénario d'abandon exact décrit dans [[Bilan 2025-2026]].

## Contenu

### Ne jamais écrire un champ `attendu` à la main

`generer_attendu.py` exécute la solution de référence et écrit la sortie réelle.

**Ce qui casse :** l'`attendu` faux tapé à la main est la classe d'erreur la plus probable de la
production de contenu. Un seul suffit à rendre un exercice invalidable.

### `generer_attendu.py` utilise ruamel.yaml, jamais PyYAML

Avec `preserve_quotes` **et** `indent(mapping=2, sequence=4, offset=2)`.

**Ce qui casse :** `yaml.safe_dump` supprime tous les commentaires du fichier et transforme chaque
bloc littéral `|` en chaîne échappée sur une ligne. Or `enonce:` et `solution:` sont écrits en
blocs `|`, et ces fichiers sont édités à la main. Sans `indent()`, ruamel réaligne en plus les
tirets de **toutes** les listes, y compris celles qu'on ne modifie pas.

### Un motif `interdit` ne contient jamais de guillemet

Le validateur le refuse désormais.

**Ce qui casse :** un motif terminé par un guillemet ne bloque que cette ponctuation. L'élève
écrit la même réponse en dur avec des guillemets simples, triples ou un f-string, et passe au
vert sans rien résoudre. ==Vérifié : `print("""Agent en poste : Merle""")` traversait le motif
`Merle")`.==

### Un exercice dont l'objectif est le format exact porte `exige_exact: true`

**Ce qui casse :** sans lui, la normalisation du verdict bleu absorbe l'erreur que l'exercice
cherche justement à faire remarquer. L'exercice ne teste plus rien.

## Serveur

### La validation vit côté serveur, jamais seulement côté navigateur

**Ce qui casse :** tout ce que le JavaScript filtre, un élève le contourne en ouvrant la console.
Démontré en conditions réelles. Détail dans [[ADR-008 Validation serveur des champs libres]].

### Aucun secret n'a de valeur par défaut devinable

`DOJO_SECRET` et `DOJO_CODE_PROF` : à défaut de configuration, un secret **aléatoire** est tiré et
un avertissement est émis.

**Ce qui casse :** une valeur par défaut publiée dans le dépôt laisse forger un jeton pour
n'importe quel élève, ou obtenir l'accès professeur. Un secret aléatoire échoue de façon visible
et bénigne — les élèves se reconnectent. Une clé publiée échoue en silence et gravement.

### Renommer une variable d'environnement casse le déploiement, pas les tests

Le 4 septembre 2026, `QG_SECRET`, `QG_CODE_PROF`, `QG_BDD` et `QG_DOMAINE` sont devenues
`DOJO_*`. ==Aucun test n'aurait signalé un `.env` oublié== : le fichier est hors dépôt, et
`docker compose` refuse alors de démarrer avec un message qui ne nomme que la nouvelle variable.

**Ce qui casse :** un `.env` de production laissé sur les anciens noms. Le `.env` local a été mis
à jour ; ==celui du serveur UNIGE doit l'être aussi avant le prochain déploiement==.

## Déploiement

### Le WebAssembly doit être servi en `application/wasm`

Règle explicite du `Caddyfile`.

**Ce qui casse :** Pyodide refuse de démarrer. Rien ne fonctionne, sans message clair.

### Aucune ressource externe à l'exécution

Pyodide (**13,1 Mo**) et les cinq polices sont servis depuis l'image. Aucun `<link>` vers
`fonts.googleapis.com` ni `api.fontshare.com` dans le code livré ; un test le vérifie.

**Ce qui casse :** au-delà de la dépendance réseau, hotlinker un service tiers transmet l'adresse
IP de chaque élève. Public mineur, hébergement universitaire.

### `plateforme/contenu/` doit rester commité

`Dockerfile.web` fait `COPY contenu ./contenu`.

**Ce qui casse :** `docker compose build` échoue à froid sur un clone frais, avant même d'atteindre
la construction du contenu, avec un message qui ne dit pas qu'il manque un dossier.

## Voir aussi

[[Journal de décisions]] · [[Moteur d'exécution]] · [[Moteur de validation]] · [[Modèle de contenu]] · [[Déploiement UNIGE]]
