---
title: Spécification atelier de contenu
tags:
  - specification
  - contenu
  - professeur
statut: à construire
date: 2026-09-27
---

# Spécification — l'atelier de contenu

> [!abstract] Ce que ce document couvre
> Une surface d'écriture, dans l'interface professeur, pour composer un exercice ou une leçon,
> **l'éprouver par le moteur de l'élève**, et en ressortir un fichier YAML à déposer dans le
> dépôt. Plus ce qu'il faut ouvrir dans la chaîne de contenu pour que le chapitre 2 soit
> seulement possible. Il complète [[Modèle de contenu]] et ne le remplace pas.

## 1. Pourquoi

Le chapitre 1 est écrit — 112 exercices, 14 leçons, voir [[Chapitre 1]]. Il l'a été à la main,
fichier par fichier, avec un aller-retour permanent entre l'éditeur de texte et la ligne de
commande. Trois choses ont coûté cher, et elles recommenceront au chapitre 2 :

- **Le champ `attendu` ne se tape pas.** Il se génère en exécutant la solution
  (`generer_attendu.py`), parce qu'un attendu tapé à la main est ==la classe d'erreur la plus
  probable== ([[Plan de production]]). Il faut donc quitter l'éditeur, lancer un script, revenir.
- **La boucle de vérification est longue.** Écrire, lancer `valider_contenu.py`, lire un message
  d'erreur en ligne de commande, corriger. Pour un exercice qui ne tient pas en un essai, c'est
  cinq allers-retours.
- **Le YAML se venge.** Un indice contenant `: ` se lit comme une association et casse le
  chargement. Un `**` dans un énoncé passe en gras. Ces deux pièges ont mordu pendant l'écriture
  de la séance 2.

Et un mur, celui-là franc : **le schéma interdit les séances au-delà de la 3**. Le premier
exercice du chapitre 2 est refusé par la validation.

> [!note] Ce que ce document ne prétend pas
> Écrire du YAML à la main reste parfaitement viable — c'est ainsi que le chapitre 1 s'est fait.
> L'atelier ne remplace pas l'éditeur de texte, il enlève les trois allers-retours qui coûtent.

## 2. La décision de fond

[[ADR-003 Exercices versionnés en YAML]] dit, en toutes lettres : « Il n'y a pas d'interface
d'administration web pour créer des exercices. » Son raisonnement tenait sur le temps de
développement, ressource rare à treize jours du premier cours.

Ce document **amende cette décision sans la renverser**, et la nuance mérite un ADR à elle,
==ADR-015==, à écrire au palier 1 :

- **Git reste la source de vérité.** Un exercice est toujours un fichier YAML versionné.
- **L'atelier n'écrit rien sur le serveur.** Pas de base, pas de brouillon, pas de publication
  en ligne. Il lit ce qu'on lui donne, il éprouve, il rend un fichier.
- Ce qui change : ==on gagne une surface qui aide à écrire le fichier==, là où ADR-003 refusait
  une surface qui le remplacerait.

Ce qu'ADR-003 écartait — la base de données avec administration web — reste écarté, et pour la
même raison.

## 3. Périmètre

**Dans le périmètre**

- Les identifiants et les bornes ouverts aux séances 1 à 99
- `NOTIONS` et `CHAPITRES` déplacées de `schema.py` vers des fichiers YAML de contenu
- `construire_contenu.py` prenant `contenu/` pour racine et parcourant les chapitres
- Le schéma publié en JSON, produit par Pydantic lui-même
- Une page `/prof/atelier` : composition, glisser-déposer, essais, aperçu, export
- Les exercices **et** les leçons
- Un émetteur YAML au style de la maison, verrouillé par un test de tour complet
- ADR-015, et les notes du coffre qui en dépendent

**Hors périmètre**

- Tout stockage serveur : ni base, ni brouillon, ni état publié
- Toute publication depuis l'interface — un nouvel exercice passe par un commit et un déploiement
- Toute intégration Git : l'atelier ne commit pas, ne branche pas, ne pousse pas
- La génération par gabarit ou l'import CSV, levier 2 de [[Plan de production]] — chantier à part
- Un mode d'édition du YAML brut
- Les images et les ressources attachées : le contenu reste du texte et du code
- Le renommage du vocabulaire chapitre/séance (voir le piège en 4.4)
- Toute notion de plusieurs auteurs simultanés

## 4. Palier 1 — le contenu s'ouvre

Aucune interface. Ce palier se fusionne seul, et à sa fin ==on peut déclarer un chapitre 2 à la
main== et il fonctionne.

### 4.1 Les bornes

Quatre endroits figent les séances 1 à 3. Ils passent à 99, ce qui laisse la borne attraper une
faute de frappe sans plus jamais commander le calendrier.

| Fichier | Aujourd'hui | Demain |
|---|---|---|
| `outils/schema.py` | `MOTIF_ID = ^s[123]-[0-9]{2}(-expert)?$` | `^s([1-9][0-9]?)-[0-9]{2}(-expert)?$` |
| `outils/schema.py` | `seance: int = Field(ge=1, le=3)` | `Field(ge=1, le=99)` |
| `outils/schema.py` | `MOTIF_LECON = ^c[123]-[a-z]+$` | `^c([1-9][0-9]?)-[a-z]+$` |
| `api/app/routes_eleve.py` | `MOTIF_EXERCICE = ^s[123]-…` | la même expression, recopiée |

Pas de zéro en tête : `s01-01` est refusé, `s1-01` et `s99-01` sont acceptés. La liste blanche de
l'API est une validation serveur au sens d'[[ADR-008 Validation serveur des champs libres]] : la
desserrer est une décision, pas un détail.

L'API ne dépend pas de `outils/` — son image ne le contient même pas — donc les deux expressions
sont ==un miroir, pas un import==. Chacune porte en commentaire le nom de l'autre, et un test de
chaque côté fixe les mêmes cas limites : `s1-01`, `s99-01-expert`, `s0-01`, `s01-01`.

### 4.2 Les tables deviennent du contenu

`NOTIONS` et `CHAPITRES` sont deux dictionnaires Python dans `schema.py`. Ce sont pourtant du
contenu : un titre, un ordre, une couleur, une date d'ouverture. Ils deviennent, **par dossier de
chapitre** :

```
plateforme/contenu/chapitre-1/notions.yaml
plateforme/contenu/chapitre-1/chapitres.yaml
```

`notions.yaml` — une entrée par notion :

```yaml
- id: variables
  ordre: 2
  titre: Les variables
  famille: variables
  chapitre: bases
  # Facultatif : ce qui trahit cette notion dans un exemple de leçon.
  motif: '^\s*[a-z_][a-z0-9_]*\s*=(?!=)'
```

`chapitres.yaml` — une entrée par chapitre de navigation :

```yaml
- id: decisions
  ordre: 2
  titre: Calculer, comparer, décider
  seance: 2
  ouverture: 2026-09-23
```

La propriété « seule source » ne bouge pas, elle déménage : rien ne recopie ces tables, le
validateur les charge et le constructeur les publie comme aujourd'hui.

> [!warning] Le piège d'implémentation, à ne pas découvrir en route
> `Lecon.notion` est déclaré `Literal[tuple(NOTIONS)]`, ==évalué à la définition de la classe==.
> Dès que les notions se chargent à l'exécution, ce `Literal` ne peut plus être construit. Il
> devient un `field_validator` qui vérifie l'appartenance à un registre rempli par le chargeur.
> Même traitement pour tout ce qui indexe `NOTIONS` au chargement du module.

`MOTIFS_NOTION`, le dictionnaire d'expressions régulières de `valider_contenu.py`, disparaît : son
contenu passe dans le champ `motif` ci-dessus. Il est aujourd'hui figé sur les notions du
chapitre 1 et ==lève une `KeyError` si une notion disparaît==. Ce motif ne sert qu'à la
construction ; il n'est pas publié, et le navigateur ne le lit jamais.

### 4.3 Deux contrôles à ajouter

- **Les familles de couleur sont distinctes dans un chapitre.** C'est vrai des quatorze notions
  actuelles, et ==rien ne l'impose==. Il n'existe que cinq familles, donc un chapitre ne peut
  porter plus de cinq notions, et deux notions de la même couleur rendent le menu illisible.
- **Les identifiants sont uniques à travers les chapitres** — notions, chapitres et exercices. Un
  dossier de chapitre 2 qui reprendrait `variables` écraserait silencieusement l'autre.
- **Le champ `seance` s'accorde avec l'identifiant.** `s2-14` doit porter `seance: 2`, et rien ne
  le vérifie aujourd'hui : les deux se sont suivis à la main sur 112 fichiers. Un exercice rangé
  dans la mauvaise séance n'échoue nulle part, ==il apparaît simplement le mauvais jour==.

### 4.4 La racine de construction change

`construire_contenu.py` reçoit aujourd'hui un dossier de chapitre. Avec les tables réparties par
chapitre, construire le chapitre 1 seul effacerait les notions du 2. Il prend donc
`plateforme/contenu/` pour racine et parcourt les `chapitre-*/`.

`deploiement/Dockerfile.web` et le README suivent. La signature des appels de `valider_contenu.py`
suit aussi.

> [!warning] Deux sens du mot « chapitre », et on n'y touche pas
> Dans ce dépôt, `CHAPITRES` compte **une entrée par séance** — `bases` est la séance 1,
> `decisions` la séance 2 — tandis que `contenu/chapitre-1/` désigne le chapitre du cours, qui en
> contient trois. Les renommer ferait bouger `chapitres.json`, le calendrier et tout
> [[ADR-013 Une séance s'ouvre à sa date]]. ==On garde les noms et on documente le piège== dans
> [[Pièges et invariants]].

### 4.5 Le schéma se publie

`construire_contenu.py` écrit un cinquième fichier, `schema.json` :

```json
{ "exercice": { …model_json_schema()… }, "lecon": { …model_json_schema()… } }
```

Pydantic le produit lui-même. Le formulaire de l'atelier s'en nourrit — énumérations, champs
requis, bornes, variantes de tests — et ==aucune copie du schéma ne vit côté TypeScript==. C'est
exactement le traitement déjà réservé à `notions.json`.

## 5. Palier 2 — l'atelier des exercices

### 5.1 Où, et comment on y entre

`/prof/atelier`, derrière le compte professeur ([[ADR-014 Le compte professeur se crée au premier lancement]]).
`routage.ts` gagne une destination `{ vue: 'atelier' }` ; c'est une fonction pure tenue à 100 % de
couverture, donc les quatre formes de chemin sont à couvrir.

L'atelier est ==entièrement client== : il ne parle à l'API pour rien. Il lit `schema.json` et
`notions.json` comme le reste de l'interface lit le contenu publié.

### 5.2 La page

Deux colonnes. À gauche ce qu'on remplit, à droite un panneau à deux onglets, **Aperçu** et
**Essais** — on ne regarde jamais les deux en même temps, et ils se disputeraient la place.

Un **rail de fichiers** en tête de la colonne de gauche : les YAML déposés s'y empilent, on passe
de l'un à l'autre, chacun garde ses modifications.

La colonne de gauche, dans l'ordre :

| Bloc | Forme |
|---|---|
| Identité | `id`, `titre`, `notion` (liste tirée de `notions.json`), `concept`, `type`, `niveau`, `obligatoire`. `seance` se **déduit de l'identifiant** et s'affiche sans se saisir — voir la règle d'accord en 4.3 |
| Énoncé | éditeur de texte ; l'aperçu montre le rendu de `**gras**`, `*italique*` et `` `code` `` |
| Départ, Solution | éditeurs Python, ceux de l'élève |
| Indices | une ligne par indice, **texte brut** — les indices ne sont pas formatés, et un `**` y resterait littéral |
| Tests | des cartes, une par test, ajoutées par type ; chaque carte n'affiche que ses propres champs |

### 5.3 Le champ `attendu` ne se tape jamais

Sur une carte de test `sortie`, on écrit les `entrees` et on demande à l'atelier de remplir : il
exécute la solution avec ces entrées et écrit la sortie obtenue. C'est `generer_attendu.py`
déplacé dans le navigateur, et ==c'est le plus gros gain de temps du chantier==.

Si la solution est vide ou plante, l'atelier le dit et n'écrit rien : un `attendu` rempli avec un
message d'erreur serait pire que vide.

### 5.4 L'onglet Essais

Il rejoue la batterie de [[Moteur de validation]], dans cet ordre, et chaque ligne dit ce qui a
échoué et pourquoi.

| Contrôle | Origine |
|---|---|
| La solution passe tous ses tests, critères de maîtrise compris | `valider_contenu.py::_passe(ex, solution)` |
| Le code de départ **échoue** — sinon l'exercice est déjà résolu | `_passe(ex, depart, exiger_maitrise=False)` |
| Aucun motif interdit ne figure dans la solution | `verifier_coherence` |
| Aucun motif ne contient de guillemet — il se contournerait en changeant de ponctuation | `verifier_coherence` |

Les deux premiers passent par **Pyodide et `evaluer()`**, donc par le moteur même de l'élève —
plus fidèle que le miroir Python. Pour chaque test, l'atelier exécute le code avec **les entrées
de ce test-là**, jamais une exécution partagée : c'est déjà la règle de `_passe` et d'`evaluer`, et
la violer refuse à tort les exercices à plusieurs jeux d'entrées.

Les deux derniers sont deux règles de chaîne, recopiées en TypeScript. ==C'est un miroir assumé==,
de la même famille que `evaluer` miroir de `_passe`, ou que la liste blanche des types d'erreur de
l'API qui double celle du navigateur. Chaque règle porte en commentaire le nom de sa contrepartie.

> [!important] L'atelier prévient, la construction tranche
> `valider_contenu.py` reste le juge : il tourne à la construction de l'image et fait échouer le
> déploiement. L'atelier dit la même chose ==tout de suite== au lieu de la dire au commit.

**Un contrôle en plus, que l'outillage n'a jamais eu.** Pour un exercice `predire`,
`verifier_coherence` n'exécute rien : la bonne réponse du QCM n'est vérifiée par aucun outil, elle
l'a été à la main pour les douze exercices de la séance 1. L'atelier exécute la solution et
**affiche sa sortie à côté des options**, ce qui rend l'erreur visible sans rien affirmer à la
place de l'auteur.

### 5.5 L'aperçu

L'onglet Aperçu monte `EcranExercice` avec l'exercice en cours de composition. Ce composant
==reçoit déjà l'exercice en prop==, pas un identifiant à chercher dans le contenu publié : il n'y a
donc aucun composant d'aperçu à écrire, et ce que montre l'atelier est l'écran réel de l'élève,
avec ses vraies fautes de frappe et sa vraie longueur.

### 5.6 Entrer un fichier, en sortir un

**Glisser-déposer.** On lâche un ou plusieurs `.yaml` sur la page. C'est ==la seule façon de
reprendre un exercice existant== : les solutions ne sont jamais publiées, donc rien d'utile ne peut
venir de `/contenu/`.

La lecture demande **une dépendance nouvelle, `yaml`**. Le dépôt pose « aucune dépendance
nouvelle » ; l'exception est délibérée et consignée dans ADR-015. Écrire un analyseur de
sous-ensemble serait pire : c'est précisément le genre de code qui accepte un fichier que la
construction refusera.

**L'écriture, en revanche, est à nous.** Les fichiers du dépôt ont un style que `safe_dump` ne
produit pas — et ce style n'est pas cosmétique, il rend le contenu relisible en revue :

```yaml
enonce: |
  Ce programme demande le code d'un casier, puis dit si le casier s'ouvre.
tests:
  - type: sortie
    entrees: ["4321"]
    attendu: |-
      Code du casier : 4321
```

Scalaires `|` pour les textes et le code, `|-` pour un attendu sans saut final, `entrees` en liste
courte sur une ligne, clés dans l'ordre du modèle, guillemets seulement quand il le faut. Une
centaine de lignes, et un test qui les verrouille :

> [!success] Le test qui tient l'émetteur
> ==Les 112 fichiers du dépôt, relus puis réécrits, reviennent identiques octet pour octet.==
> Si l'un diverge, c'est l'émetteur qui a tort — ou le fichier, et on le normalise une fois, dans
> son propre commit.

**La sortie.** Un bouton télécharge le fichier. Sur les navigateurs qui exposent l'API d'accès au
système de fichiers — Chrome et Edge — l'atelier propose en plus de **désigner une fois le dossier
du dépôt** et d'y enregistrer directement, sous le bon nom. Firefox et Safari retombent sur le
téléchargement, sans que rien ne manque.

### 5.7 Ce qui peut mal tourner

| Situation | Ce que fait l'atelier |
|---|---|
| Un fichier déposé n'est pas du YAML valide | Il reste dans le rail, marqué, avec la ligne fautive. Les autres se chargent |
| Un fichier valide mais qui n'est pas un exercice | L'atelier nomme les champs requis qui manquent |
| Un fichier porte des champs **inconnus** du schéma | ==Il est refusé, et les champs sont nommés.== Les charger dans un formulaire qui les ignore les perdrait silencieusement à l'export |
| Pyodide n'est pas prêt, ou lent | L'onglet Essais le dit ; tout le reste de l'atelier fonctionne |
| La solution boucle sans fin | Le délai de cinq secondes de l'exécuteur s'applique, et le message est celui de l'élève — « Ton programme tourne en rond » |

## 6. Palier 3 — l'atelier des leçons

Même page, même machinerie, un schéma plus simple. Trois types de blocs — `paragraphe`,
`attention`, `code` — en cartes qu'on ajoute, réordonne et supprime. L'aperçu réutilise l'écran de
cours de l'élève, bac à sable compris.

Un seul contrôle passe par Pyodide, et c'est le précieux : **chaque bloc de code doit tourner**,
avec ses entrées simulées. Un exemple de leçon qui plante, c'est une leçon qu'on lit en cours et
qui ne marche pas au tableau.

Deux règles viennent du schéma et sont donc tenues par le formulaire : un bloc qui déclare des
entrées ne peut pas être exécutable — le bac à sable ne sait pas les fournir, l'élève tomberait sur
une `EOFError` — et `getpass` est banni.

La règle « un exemple ne peut pas employer une notion enseignée plus tard » **reste à la
construction**. C'est une heuristique à base d'expressions régulières, et les faire vivre dans les
deux moteurs — `re` de Python et `RegExp` de JavaScript — ferait un miroir fragile pour un gain
faible.

## 7. Ce qui est mis à l'épreuve

| Palier | Épreuves |
|---|---|
| 1 | **Les quatre fichiers déjà publiés — `exercices`, `lecons`, `notions`, `chapitres` — sont identiques octet pour octet avant et après le déplacement des tables** ; les bornes acceptent `s99-01` et refusent `s0-01` et `s01-01` ; deux notions de même famille dans un chapitre échouent ; deux identifiants en double échouent ; un `seance` qui contredit son identifiant échoue ; `schema.json`, le cinquième, décrit les quatre types de tests ; l'API accepte une tentative sur `s4-01` |
| 2 | Le tour complet sur les 112 fichiers ; l'émetteur et les contrôles à **100 % de couverture**, comme toute logique pure de ce dépôt ; le lanceur d'essais avec un exécuteur simulé, y compris le cas du départ qui passe déjà ; le glisser-déposer d'un fichier cassé, d'un fichier étranger, d'un fichier à champs inconnus ; l'export refusé quand un champ requis manque |
| 3 | Les trois types de blocs ; l'exemple qui plante est signalé et nommé ; entrées et exécutable sont incompatibles |

`src/atelier/**` rejoint les seuils à 100 % de `vitest.config.ts`, aux côtés de `validation/`,
`routage.ts`, `texte.tsx` et `calendrier.ts`. Les composants restent au plancher global.

## 8. Risques

> [!danger] Le tour complet peut ne pas boucler du premier coup
> Les 112 fichiers sont écrits à la main et portent des idiosyncrasies — un titre entre guillemets
> ici, pas là. Si une poignée diverge, ==c'est un signal, pas un échec== : on normalise ces
> fichiers une fois, dans un commit séparé et lisible, avant de verrouiller le test.

> [!warning] Le palier 1 touche à la seule source
> Déplacer `NOTIONS` et `CHAPITRES`, c'est toucher ce dont dépendent le schéma, le validateur, le
> constructeur, le tableau de bord et le calendrier. L'épreuve qui compte est celle du tableau
> ci-dessus : **le contenu publié doit être identique avant et après**, sans quoi le déplacement a
> changé autre chose que son adresse.

> [!note] L'API d'accès au système de fichiers n'existe pas partout
> Elle est absente de Firefox et de Safari. Le téléchargement reste le chemin par défaut, et rien
> de fonctionnel n'en dépend.

## 9. Voir aussi

[[Modèle de contenu]] · [[Moteur de validation]] · [[Chapitre 1]] · [[Plan de production]] ·
[[Pièges et invariants]] · [[ADR-003 Exercices versionnés en YAML]] ·
[[ADR-008 Validation serveur des champs libres]] · [[ADR-013 Une séance s'ouvre à sa date]] ·
[[ADR-014 Le compte professeur se crée au premier lancement]]
