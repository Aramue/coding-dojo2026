---
title: Modèle de contenu
tags:
  - architecture
  - contenu
mis-a-jour: 2026-09-27
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

> [!warning] Un opérateur s'écrit entre accents graves, dans un énoncé comme dans une leçon
> `formaterTexte` lit une double étoile comme une ouverture de gras. Un premier jet de `s2-08`
> écrivait `** calcule une puissance : 3 ** 2 vaut 3 fois 3` : tout ce qui séparait les deux
> doubles étoiles serait sorti en gras, et les étoiles auraient disparu de l'écran. ==Entre
> accents graves, un opérateur est du code, et rien d'autre.==
>
> Les **indices** et les **propositions de QCM** s'affichent en texte brut : un accent grave y
> resterait visible. On y écrit les opérateurs tels quels.

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

## Trois statuts d'exercice

| `obligatoire` | `niveau` | Ce que c'est | Compté dans la progression ? |
|---|---|---|---|
| `true` | `normal` | le chemin minimal, celui de la certification | **oui** |
| `false` | `normal` | un **renfort** : même difficulté, pour qui a besoin de refaire | non |
| `false` | `expert` | un **bonus** : pour qui a fini et va vite | non |

> [!important] Un facultatif n'entre jamais dans le dénominateur
> `grouper()` calcule `faits` et `total` sur les **obligatoires seulement**. Sans cette règle, un
> élève qui a terminé le chemin minimal de « Les variables » verrait `6/10` et se croirait en
> retard, alors qu'il a fini. ==C'est l'application de [[ADR-004 Mode expert en bonus débloqué]]==,
> qui pose qu'un expert n'est jamais compté dans la progression affichée.
>
> La page d'exercices les affiche sous un intertitre « Pour aller plus loin », séparés du reste.

La **seconde coche ne change rien à ce décompte non plus** : un exercice réussi compte pour un,
qu'il porte une coche ou deux. Elle distingue, elle ne conditionne pas.

### Un motif interdit peut porter son propre message

```yaml
- type: interdit
  motif: 'gauche, droite = droite, gauche'
  message: >-
    L'échange en une seule ligne est écarté ici : c'est justement le
    raisonnement que cet exercice fait travailler.
```

Le message par défaut dit « la réponse ne doit pas être écrite en dur ». Vrai pour la plupart des
motifs, **faux quand le motif interdit une technique** : l'élève de `s1-18` n'a rien écrit en dur,
il a utilisé l'affectation multiple. ==Un message trompeur l'envoie chercher un problème qu'il n'a
pas.==

### Un motif `contient` peut ne coûter qu'une coche

```yaml
- type: contient
  motif: "{"
  maitrise: true
  message: >-
    L'exercice est validé. Tu peux le refaire avec un f-string : un f collé
    devant les guillemets, et la variable entre accolades.
```

Sans `maitrise`, un `contient` absent fait échouer l'exercice. Avec, il ne fait perdre que la
**seconde coche** : l'exercice reste réussi et la suite reste ouverte. C'est la différence entre
« ça marche » et « ça marche de la bonne façon ». Le mécanisme complet, l'ordre d'évaluation et le
choix du motif sont dans [[Moteur de validation]].

`maitrise` est refusé sur un `interdit` — un interdit disqualifie par définition.

> [!warning] La seconde coche promet « plus court »
> Le verdict bleu s'intitule *Ça marche. Il y a plus court.* C'est vrai du f-string, seul critère
> de maîtrise de la séance 1. C'était faux du drapeau de `s2-28`, qui ajoute une ligne après
> chaque question : l'élève lisait « plus court », puis un conseil qui allongeait son programme.
> ==Un critère de maîtrise ne récompense qu'une méthode plus courte.== Quand la méthode attendue
> est plus longue, le motif est exigé, sans `maitrise`.

## Le chapitre, unité de regroupement

Un chapitre rassemble les notions d'un même sujet. C'est **le niveau que le menu déplie** : sans
lui, quatre notions flottaient côte à côte sans dire de quoi elles parlaient ensemble.

| Identifiant | Titre affiché | Séance | Ouverture | Notions |
|---|---|---|---|---|
| `bases` | Les bases de Python | 1 | d'emblée | `afficher`, `variables`, `types`, `saisie` |
| `decisions` | Calculer, comparer, décider | 2 | 23 septembre 2026 | `reveil`, `calculer`, `comparer`, `combiner`, `decider` |
| `boucles` | Répéter, parcourir, compter | 3 | 30 septembre 2026 | `rappels`, `repeter`, `parcourir`, `compter`, `tantque` |

La table vit dans `outils/schema.py` à côté de `NOTIONS`, et se publie en
`chapitres.json`. Chaque notion déclare son `chapitre`.

Un chapitre peut porter une date d'`ouverture`, écrite `AAAA-MM-JJ`. Avant ce jour, ni lui ni ses
notions, ses exercices et ses leçons n'existent pour l'élève, ni dans les comptes du professeur.
Sans date, il est ouvert d'emblée. Voir [[ADR-013 Une séance s'ouvre à sa date]].

## La notion, unité de navigation

Une notion porte une leçon, un groupe d'exercices et une couleur. La table vit dans
`outils/schema.py` et **nulle part ailleurs** : elle est publiée en `notions.json` pour
que le front n'en garde aucune copie.

| Identifiant | Titre affiché | Couleur | Exercices |
|---|---|---|---|
| `afficher` | Afficher un message | ambre | 7 |
| `variables` | Les variables | indigo | 6 |
| `types` | Types et conversion | vert | 6 |
| `saisie` | Demander une information | bleu | 6 |
| `reveil` | Se remettre en route | indigo | 3 |
| `calculer` | Calculer | bleu | 9 |
| `comparer` | Comparer | vert | 9 |
| `combiner` | Combiner des conditions | corail | 7 |
| `decider` | Décider | ambre | 10 |
| `rappels` | Rappels avant les boucles | indigo | 3 |
| `repeter` | Répéter avec for | corail | 9 |
| `parcourir` | Parcourir un texte | vert | 8 |
| `compter` | Compter et cumuler | bleu | 9 |
| `tantque` | Répéter tant que | ambre | 11 |

==La couleur suit la notion, pas le concept.== La table `FAMILLES` d'origine mappait
`print → variables` et `input → types` : la séance 1 n'aurait affiché que deux couleurs pour
quatre notions. Voir [[Spécification interface]].

## Arborescence

```
contenu/
  chapitre-1/
    notions.yaml                  les 14 notions : ordre, titre, couleur, motif
    chapitres.yaml                les 3 chapitres : ordre, titre, séance, ouverture
    seance-1/
      s1-01.yaml … s1-34.yaml     34 exercices, dont 25 obligatoires
      lecons/
        c1-afficher.yaml
        c1-variables.yaml
        c1-types.yaml
        c1-saisie.yaml
    seance-2/
      s2-01.yaml … s2-38.yaml     38 exercices, dont 26 obligatoires
      lecons/
        c2-reveil.yaml
        c2-calculer.yaml
        c2-comparer.yaml
        c2-combiner.yaml
        c2-decider.yaml
    seance-3/
      s3-01.yaml … s3-40.yaml     40 exercices, dont 24 obligatoires
      lecons/
        c3-rappels.yaml
        c3-repeter.yaml
        c3-parcourir.yaml
        c3-compter.yaml
        c3-tantque.yaml
```

`charger_tous()` ignore tout fichier sous un dossier `lecons/`, ainsi que `notions.yaml` et
`chapitres.yaml` : ni une leçon ni une table n'est un exercice, et la charger comme telle ferait
échouer la validation sur un fichier parfaitement valide.

> [!info] Les tables sont du contenu depuis le 27 septembre 2026
> `NOTIONS` et `CHAPITRES` vivaient dans `schema.py`, en Python. Un titre, un ordre, une couleur
> et une date d'ouverture ne sont pas du code — et l'atelier, qui produit du YAML, ne pouvait pas
> déclarer un chapitre. Voir [[ADR-015 L'atelier écrit des fichiers, pas des lignes de base]].
>
> **La racine de construction est désormais `contenu/`**, parcourue chapitre par chapitre. Chaque
> chapitre porte ses deux tables ; construire un seul chapitre effacerait les notions des autres.

Ce que la construction publie dans `web/public/contenu/` — **cinq fichiers, toutes séances
confondues** :

| Fichier | Contenu |
|---|---|
| `exercices.json` | les exercices, sans leur `solution`, chacun avec sa `famille` |
| `lecons.json` | les leçons, dans l'ordre du cours — écrit même vide |
| `notions.json` | la table des notions, **sans leur `motif`** |
| `chapitres.json` | la table des chapitres |
| `schema.json` | le schéma de l'exercice et de la leçon, produit par Pydantic |

> [!tip] Un exercice peut désormais s'écrire depuis l'atelier
> `/prof/atelier` compose le fichier, l'éprouve par le moteur de l'élève et le rend. ==Le fichier
> reste la source== : l'atelier aide à l'écrire, il ne le remplace pas. Voir
> [[ADR-015 L'atelier écrit des fichiers, pas des lignes de base]].
>
> Son émetteur reproduit le style du dépôt, et deux règles y sont sans exception : `enonce`,
> `depart` et `solution` s'écrivent **toujours** en bloc `|`, et l'`attendu` aussi — en `|-`
> quand il n'a pas de saut final, parce qu'il est comparé au caractère près.

`schema.json` est ce qui pilote le formulaire de l'atelier : énumérations, champs requis, bornes,
et le discriminant des quatre types de tests. ==Aucune copie du schéma ne vit côté TypeScript==,
exactement comme pour `notions.json`.

Le champ `motif` d'une notion, lui, ne sort jamais : il sert au validateur à repérer une notion
employée trop tôt dans une leçon, c'est un outil d'auteur.

> [!note] Un fichier par nature de contenu, pas un par séance
> Jusqu'au 14 septembre 2026, chaque séance publiait les siens (`seance-1.json`,
> `seance-1-lecons.json`…) et le front ne demandait que ceux de la séance 1. Ajouter la séance 2
> l'aurait obligé à savoir combien de séances existent, et à tolérer un fichier de leçons absent :
> ==ce fichier répondrait 404, et la connexion de l'élève échouerait==. Quatre chemins fixes lui
> épargnent les deux, et `lecons.json` est écrit même vide.
>
> `construire` appelle désormais `verifier_racine` au lieu de refaire ses propres contrôles : un
> contenu que le validateur refuse ne peut plus se publier par un autre chemin.

## Validation à la construction

Le schéma est vérifié avec Pydantic au moment du déploiement. Un exercice invalide **fait échouer
la construction** plutôt que d'atteindre les élèves. Contrôles :

- Le `type` et les `tests` sont cohérents (un `predire` exige un test `qcm`)
- La `solution` passe réellement tous ses propres tests
- Le `depart` échoue au moins un test — sinon l'exercice est déjà résolu
- Chaque `expert` référencé existe
- Chaque date d'ouverture de chapitre est un vrai jour, écrit `AAAA-MM-JJ` — « 23/09/2026 » se
  comparerait quand même dans le navigateur, et la séance resterait fermée en silence
- **Chaque exemple de code d'une leçon s'exécute sans lever d'exception**
- Une leçon n'utilise aucune notion enseignée après elle — une affectation dans « Afficher un
  message », un `int()` avant « Types et conversion », un `input()` avant « Demander une
  information » sont refusés
- L'ordre d'une leçon est celui de sa notion : c'est lui qui décide des notions que ses exemples
  ont le droit d'employer
- Un programme qui ne s'arrête pas est interrompu après 100 000 tours de boucle, et compte comme
  un échec : la boucle infinie d'un exercice `debug` ne bloque pas la construction

> [!tip] Le contrôle qui sauve le plus de temps
> ==Exécuter la solution contre ses propres tests, à chaque construction.== C'est ce qui empêche
> de publier un exercice impossible à valider — la panne la plus coûteuse en séance, parce
> qu'elle envoie toute la classe lever la main en même temps.

## Production par gabarit

Une part importante des exercices se décline mécaniquement à partir de quelques gabarits — par
exemple les opérateurs arithmétiques (`+ - * / // % **`) sur deux entiers. C'est ce qui rend un
volume de plusieurs dizaines d'exercices atteignable en treize jours.
Détail dans [[Chapitre 1]].
