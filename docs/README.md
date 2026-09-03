# docs/

Toute la documentation du projet vit dans [`vault/`](vault/), un coffre
[Obsidian](https://obsidian.md) : de simples fichiers Markdown, lisibles tels quels sur GitHub
ou dans n'importe quel éditeur, mais reliés entre eux par des liens `[[wikilink]]` qu'Obsidian
sait parcourir et cartographier.

Ouvrir le coffre : dans Obsidian, *Ouvrir un coffre* → *Ouvrir un dossier local* → choisir
`docs/vault`. Aucun plugin nécessaire.

Point d'entrée : **[[Quartier Général]]** (`vault/Quartier Général.md`).

## Comment c'est rangé

| Dossier | Contenu |
|---|---|
| `1-contexte` | Ce qui s'est passé l'an dernier, et les contraintes du terrain |
| `2-decisions` | Une décision structurante par note, avec sa justification |
| `3-architecture` | Comment le logiciel est fait |
| `4-direction-artistique` | Couleurs, typographie, composants |
| `5-pedagogie` | Progression, exercices, contenu des séances |
| `6-references` | Sources, glossaire, liens externes |

Les dossiers sont numérotés parce que l'ordre est un ordre de lecture : quelqu'un qui découvre
le projet les parcourt de 1 à 6.

## Deux règles

1. **Une décision = une note.** On ne réécrit pas une décision passée : on en écrit une nouvelle
   qui la remplace, et on marque l'ancienne comme remplacée. Le raisonnement compte autant que
   la conclusion — dans six mois, « pourquoi » vaut plus que « quoi ».
2. **On lie plutôt que de recopier.** Si une information existe dans une note, on la référence
   avec `[[...]]`. Une information dupliquée finit toujours par diverger.
