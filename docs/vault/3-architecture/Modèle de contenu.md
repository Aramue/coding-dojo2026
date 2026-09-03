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
titre: "Le badge d'agent"
obligatoire: true           # fait-il partie du chemin minimal ?

enonce: |
  Le QG te demande ton badge. Crée une variable `nom_agent` qui contient
  ton nom de code, et une variable `age` qui contient ton âge.

depart: |
  nom_agent =
  age =

indices:
  - "Un texte s'écrit toujours entre guillemets. Un nombre, jamais."
  - "Regarde l'exemple du cours : nom = \"Alice\""

tests:
  - type: variable
    nom: nom_agent
    type_attendu: str
  - type: variable
    nom: age
    type_attendu: int
  - type: interdit
    motif: 'print("Agent'

solution: |
  nom_agent = "Corbeau"
  age = 17

expert: ch1-var-03-expert   # débloqué après réussite — voir ADR-004
```

## Arborescence

```
contenu/
  chapitre-1/
    01-variables/
      ch1-var-01.yaml
      ch1-var-02.yaml
      ...
    02-types/
    03-operateurs/
    04-conditions/
    05-boucles/
    problemes/
      qg-v1.yaml
  chapitre-2/
```

L'ordre de la progression est porté par les noms de dossiers et un `ordre.yaml` par concept —
==pas par une numérotation dans les identifiants==, pour pouvoir insérer un exercice sans tout
renommer.

## Validation à la construction

Le schéma est vérifié avec Pydantic au moment du déploiement. Un exercice invalide **fait échouer
la construction** plutôt que d'atteindre les élèves. Contrôles :

- Le `type` et les `tests` sont cohérents (un `predire` exige un test `qcm`)
- La `solution` passe réellement tous ses propres tests
- Le `depart` échoue au moins un test — sinon l'exercice est déjà résolu
- Chaque `expert` référencé existe

> [!tip] Le contrôle qui sauve le plus de temps
> ==Exécuter la solution contre ses propres tests, à chaque construction.== C'est ce qui empêche
> de publier un exercice impossible à valider — la panne la plus coûteuse en séance, parce
> qu'elle envoie toute la classe lever la main en même temps.

## Production par gabarit

Une part importante des exercices se décline mécaniquement à partir de quelques gabarits — par
exemple les opérateurs arithmétiques (`+ - * / // % **`) sur deux entiers. C'est ce qui rend un
volume de plusieurs dizaines d'exercices atteignable en treize jours.
Détail dans [[Chapitre 1]].
