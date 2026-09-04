---
title: Modèle de contenu
tags:
  - architecture
  - contenu
mis-a-jour: 2026-09-03
---

# Modèle de contenu

Application de [[ADR-003 Exercices versionnés en YAML]].

## Structure d'un exercice

```yaml
id: ch1-var-03
concept: variables          # variables | types | operateurs | conditions | boucles
seance: 1
niveau: normal              # normal | expert
type: ecrire                # predire | debug | completer | ecrire
titre: "Ta fiche"
obligatoire: true           # fait-il partie du chemin minimal ?

enonce: |
  Crée une variable `prenom` qui contient ton prénom, et une variable
  `age` qui contient ton âge.

depart: |
  prenom =
  age =

indices:
  - "Un texte s'écrit toujours entre guillemets. Un nombre, jamais."
  - "Regarde l'exemple du cours : nom = \"Alice\""

tests:
  - type: variable
    nom: prenom
    type_attendu: str
  - type: variable
    nom: age
    type_attendu: int
  - type: interdit
    motif: 'print("Camille'

solution: |
  prenom = "Camille"
  age = 17

expert: ch1-var-03-expert   # débloqué après réussite — voir ADR-004
```

## Structure d'une leçon

Une leçon est ce que l'élève lit avant d'attaquer les exercices d'une notion. Même chaîne que les
exercices : YAML versionné, validé à la construction, publié en JSON.

```yaml
id: c1-variables
notion: variables
ordre: 2
titre: Les variables
duree_min: 3
blocs:
  - type: paragraphe
    texte: "Une variable, c'est une **boîte avec une étiquette**."
  - type: code
    legende: Ranger puis ressortir
    executable: true
    python: |
      prenom = "Camille"
      print(prenom)
  - type: attention
    texte: "Le signe `=` ne veut pas dire « est égal à »."
```

**Trois types de bloc, pas davantage** : `paragraphe`, `code`, `attention`. Le formatage des
paragraphes se limite à `**gras**` et `` `code` `` — une fonction d'une dizaine de lignes,
aucune bibliothèque de rendu markdown.

Un bloc `code` peut porter deux champs de plus :

| Champ | Effet |
|---|---|
| `executable: true` | ajoute un bouton « Essayer » qui ouvre l'exemple dans un éditeur, sans verdict ni progression enregistrée |
| `entrees: [...]` | entrées simulées pour un exemple qui appelle `input()` |

> [!warning] `entrees` et `executable` s'excluent
> Le bac à sable du navigateur n'a aucun moyen de fournir des entrées simulées : l'élève
> tomberait sur une `EOFError`. Le schéma refuse la combinaison.
>
> Sans `entrees`, la leçon sur `input()` ne pourrait montrer **aucun** exemple : le validateur
> exécute chaque bloc de code, et `input()` sans entrée lève `EOFError`.

## Le chapitre, unité de regroupement

Un chapitre rassemble les notions d'un même sujet. C'est **le niveau que le menu déplie** : sans
lui, quatre notions flottaient côte à côte sans dire de quoi elles parlaient ensemble.

| Identifiant | Titre affiché | Notions |
|---|---|---|
| `bases` | Les bases de Python | `afficher`, `variables`, `types`, `saisie` |

La table vit dans `outils/schema.py` à côté de `NOTIONS`, et se publie en
`seance-1-chapitres.json`. Chaque notion déclare son `chapitre`.

## La notion, unité de navigation

Une notion porte une leçon, un groupe d'exercices et une couleur. La table vit dans
`outils/schema.py` et **nulle part ailleurs** : elle est publiée en `seance-1-notions.json` pour
que le front n'en garde aucune copie.

| Identifiant | Titre affiché | Couleur | Exercices |
|---|---|---|---|
| `afficher` | Afficher un message | ambre | 7 |
| `variables` | Les variables | indigo | 6 |
| `types` | Types et conversion | vert | 6 |
| `saisie` | Demander une information | bleu | 6 |

==La couleur suit la notion, pas le concept.== La table `FAMILLES` d'origine mappait
`print → variables` et `input → types` : la séance 1 n'aurait affiché que deux couleurs pour
quatre notions. Voir [[Spécification interface]].

## Arborescence

```
contenu/
  chapitre-1/
    seance-1/
      s1-01.yaml … s1-34.yaml     25 exercices
      lecons/
        c1-afficher.yaml
        c1-variables.yaml
        c1-types.yaml
        c1-saisie.yaml
    seance-2/
    seance-3/
```

`charger_tous()` ignore tout fichier sous un dossier `lecons/` : une leçon n'est pas un exercice,
et la charger comme tel ferait échouer la validation sur un fichier parfaitement valide.

Ce que la construction publie dans `web/public/contenu/` :

| Fichier | Contenu |
|---|---|
| `seance-1.json` | les exercices, sans leur `solution`, chacun avec sa `famille` |
| `seance-1-lecons.json` | les leçons, triées par `ordre` |
| `seance-1-notions.json` | la table des notions |

## Validation à la construction

Le schéma est vérifié avec Pydantic au moment du déploiement. Un exercice invalide **fait échouer
la construction** plutôt que d'atteindre les élèves. Contrôles :

- Le `type` et les `tests` sont cohérents (un `predire` exige un test `qcm`)
- La `solution` passe réellement tous ses propres tests
- Le `depart` échoue au moins un test — sinon l'exercice est déjà résolu
- Chaque `expert` référencé existe
- **Chaque exemple de code d'une leçon s'exécute sans lever d'exception**
- Une leçon n'utilise aucune notion enseignée après elle — une affectation dans « Afficher un
  message », un `int()` avant « Types et conversion », un `input()` avant « Demander une
  information » sont refusés

> [!tip] Le contrôle qui sauve le plus de temps
> ==Exécuter la solution contre ses propres tests, à chaque construction.== C'est ce qui empêche
> de publier un exercice impossible à valider — la panne la plus coûteuse en séance, parce
> qu'elle envoie toute la classe lever la main en même temps.

## Production par gabarit

Une part importante des exercices se décline mécaniquement à partir de quelques gabarits — par
exemple les opérateurs arithmétiques (`+ - * / // % **`) sur deux entiers. C'est ce qui rend un
volume de plusieurs dizaines d'exercices atteignable en treize jours.
Détail dans [[Chapitre 1]].
