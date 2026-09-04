---
title: Spécification interface
tags:
  - specification
  - interface
statut: à relire
date: 2026-09-03
---

# Spécification — interface cours et exercices

> [!abstract] Ce que ce document couvre
> La structure complète de l'interface élève : un menu permanent, une page de cours et une page
> d'exercices par notion. Il complète [[Spécification chapitre 1]], qui traite du moteur et du
> contenu, et ne le remplace pas.

## 1. Pourquoi

Le palier 1 a livré un moteur qui fonctionne et une interface qui n'existe pas. À la livraison :

- **154 lignes de CSS** pour toute l'application, et les deux écrans que voit l'élève — connexion
  et exercice — n'avaient **aucune feuille de style**. Ils référençaient des classes inexistantes.
- **La moitié de la charte n'était pas appliquée.** [[Charte visuelle]] pose que le fond pastel
  porte ce qu'on lit et le fond sombre ce qu'on écrit. Il n'y avait que du sombre : la partie
  cours n'existait pas.
- ==Les douze exercices de type `predire` n'affichaient jamais le code à lire.== L'énoncé disait
  « lis ce programme », et le programme n'était rendu nulle part. Douze exercices sur vingt-cinq
  étaient inutilisables.
- L'application affichait **le premier exercice non réussi**, et rien d'autre. Pas de retour en
  arrière, pas de vue d'ensemble, aucun moyen de passer un exercice bloquant — alors que
  [[Chapitre 1]] pose qu'aucun point de blocage ne doit arrêter un élève plus de quelques minutes.

## 2. Périmètre

**Dans le périmètre**

- Un menu de navigation permanent listant les notions et leurs deux pages
- Une page **Cours** par notion, avec des exemples de code exécutables
- Une page **Exercices** par notion, listant ses exercices et leur état
- La vue d'un exercice ouvert, redesignée
- Un modèle de contenu pour les leçons, validé par l'outillage existant
- Le routage, sans dépendance externe
- Les quatre leçons de la séance 1

**Hors périmètre**

- Le tableau de bord professeur, déjà livré
- Le verrouillage de notions par le professeur — la route API existe, l'interface non
- Les séances 2 et 3
- Les exercices experts

> [!warning] Une dépendance de contenu
> Les 25 exercices livrés ont leurs énoncés écrits autour d'une fiction d'agents secrets. Cette
> spécification pose une interface **sans fiction**. Une passe de réécriture des énoncés est donc
> nécessaire — elle ne touche ni au code, ni aux tests, ni à la structure des fichiers. Elle est
> traitée comme une étape distincte, après l'interface.

## 3. Structure

### Le menu, toujours visible

Colonne fixe à gauche, 255 px, sur le fond neutre. Elle contient, pour chaque notion : son titre,
une pastille de sa famille de couleur, son avancement (`2/6`), et **deux liens** — *Cours* et
*Exercices*. La destination courante est marquée par `aria-current="page"`.

Sous 820 px, le menu passe au-dessus du contenu et se replie.

### Les quatre notions de la séance 1

| Identifiant | Titre affiché | Exercices | Couleur |
|---|---|---|---|
| `afficher` | Afficher un message | 7 | ambre `#FFE7C2` |
| `variables` | Les variables | 6 | indigo `#C2CCFF` |
| `types` | Types et conversion | 6 | vert `#D9F4CC` |
| `saisie` | Demander une information | 6 | bleu `#C2E8FF` |

> [!warning] Ceci amende [[Palette]]
> La charte associait une couleur à chacun des **cinq concepts du chapitre** (variables, types,
> opérateurs, conditions, boucles). Or la séance 1 n'en couvre que deux : `construire_contenu.py`
> mappe aujourd'hui `print → variables` et `input → types`, ce qui donnerait **deux couleurs pour
> quatre notions** — un menu monotone où la couleur n'oriente plus.
>
> **Décision : la couleur identifie la notion en cours dans la séance, pas le concept du chapitre.**
> Quatre notions par séance, quatre couleurs, réutilisées d'une séance à l'autre. La couleur sert
> à l'orientation — « je suis dans la deuxième notion » — et non de code global.
>
> Conséquence : le champ `famille` des exercices est **dérivé de la notion**, plus du concept.
> `construire_contenu.py` change en conséquence, et sa table `FAMILLES` disparaît au profit d'une
> table notion → couleur.

### Trois vues, deux fonds

| Vue | Fond | Ce qu'on y fait |
|---|---|---|
| **Cours** d'une notion | `tint` de la famille | on lit |
| **Exercices** d'une notion | `tint` de la même famille | on choisit |
| **Un exercice ouvert** | `deep` de la même famille | on écrit |

Le fil d'Ariane en tête de contenu change de fond en même temps que la vue : la bascule
lecture → écriture se voit sans être expliquée. C'est la règle relevée dans les supports de cours
et posée par [[ADR-006 Palette dérivée des slides]].

### Navigation

Depuis n'importe où, l'élève atteint n'importe quelle destination ouverte. Il peut relire un
cours, refaire un exercice réussi, sauter celui qui le bloque. Aucun cul-de-sac.

## 4. Routage

**Décision : l'API History du navigateur, sans bibliothèque.**

Les chemins :

```
/                                → redirige vers la première notion non terminée
/:notion/cours                   → page Cours
/:notion/exercices               → page Exercices
/:notion/exercices/:numero       → un exercice ouvert
```

`:notion` est un identifiant stable et lisible (`afficher`, `variables`, `types`, `saisie`).

Un module `routage.ts` expose une fonction pure `analyser(chemin): Destination` et un hook
`useRoute()`. La fonction pure porte toute la logique et se teste sans DOM ; le hook n'est qu'un
abonnement à `popstate`.

> [!note] Pourquoi pas `react-router`
> Quatre formes de chemin et une navigation interne ne justifient pas 20 Ko de dépendance. Ce que
> le routeur apporterait en plus — chargement différé par route, routes imbriquées, garde de
> navigation — n'est utile à aucun endroit de cette application.
>
> Ce que le routage maison **doit** apporter, et qui manquait : une URL prononçable à voix haute
> en classe, et un rechargement qui ramène au même endroit.

## 5. Contenu des leçons

Même chaîne que les exercices : fichiers YAML versionnés, validés à la construction, publiés en
JSON. Voir [[Modèle de contenu]].

```yaml
id: c1-variables
notion: variables
famille: variables
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

**Trois types de bloc, pas davantage** : `paragraphe`, `code`, `attention`. Les quatre leçons de
la séance 1 n'ont besoin d'aucun schéma ; en ajouter un type maintenant serait spéculer.
Le formatage des paragraphes se limite à `**gras**` et `` `code` `` — une fonction d'une dizaine
de lignes, aucune bibliothèque de rendu markdown.

### Règles vérifiées à la construction

Le validateur refuse une leçon qui :

- porte un bloc vide, ou une liste de blocs vide ;
- déclare un `python` qui **lève une exception** à l'exécution — les exemples d'une leçon doivent
  tourner ;
- utilise une notion enseignée après elle, d'après l'ordre déclaré ;
- contient un emoji, ou le mot `getpass`.

> [!important] Le même filet que les exercices
> Un exercice dont la solution ne passe pas ses tests fait échouer la construction. Une leçon dont
> l'exemple plante doit faire de même. ==C'est ce que du markdown libre ne permettrait pas de
> vérifier== — et c'est la raison principale du choix du YAML à blocs typés.

### Exemples exécutables

Un bloc `code` avec `executable: true` porte un bouton « Essayer » qui ouvre le code dans un
éditeur, sous la carte, avec le moteur Pyodide déjà chargé. L'élève modifie, exécute, voit la
sortie. Aucun verdict, aucune progression enregistrée : c'est un bac à sable.

## 6. Le système visuel

Reprend [[Charte visuelle]] et l'applique réellement.

- **Échelle typographique à sept crans** : `0,82 / 0,94 / 1 / 1,15 / 1,4 / 2 / 2,6 rem`. Aucune
  taille hors échelle.
- **Rythme d'espacement 4/8** : `0,5 / 1 / 1,5 / 2 / 3 / 4 rem`.
- **General Sans** 400/500/700, **JetBrains Mono** pour le code uniquement.
- **Cinq familles de couleur**, une par notion. Le neutre chaud pour tout ce qui est hors notion.
- **Aucun emoji, aucune bibliothèque d'icônes.** Les symboles sont des SVG écrits à la main, trait
  unique de 1,8.
- **Mouvement limité à trois usages** : l'apparition du verdict, l'avancement de la jauge, la
  bascule cours → exercice. 150 à 250 ms, `ease-out`, et `prefers-reduced-motion` respecté.
- **Contrastes ≥ 4,5:1**, focus visible partout, cibles ≥ 44 px.

## 7. Ce qui change dans l'existant

| Fichier | Changement |
|---|---|
| `src/app.tsx` | devient la coquille : menu, routage, alerte réseau |
| `src/ui/EcranExercice.tsx` | balisage revu ; ==la logique d'exécution n'est pas touchée== |
| `src/ui/EcranConnexion.tsx` | redesigné, vocabulaire neutre |
| `src/ui/app.css` | remplacé par des feuilles par composant |
| `outils/schema.py` | accueille le modèle `Lecon` |
| `outils/valider_contenu.py` | vérifie les leçons |
| `outils/construire_contenu.py` | publie les leçons ; la table `FAMILLES` devient une table notion → couleur |
| `contenu/chapitre-1/seance-1/*.yaml` | chaque exercice déclare sa `notion` |

> [!danger] Le seul interdit absolu
> `EcranExercice` orchestre **une exécution par test**, séquentiellement, avec cache par jeu
> d'entrées. Cette logique a coûté trois rondes de correction et un bug trouvé en résolvant les
> 25 exercices à la main. Le redesign ne touche qu'au balisage.
> Voir [[Pièges et invariants]].

## 8. Tests

L'objectif est une couverture de 100 % **sur la logique**, et une absence de duplication.

| Unité | Comment elle est testée | Cible |
|---|---|---|
| `routage.ts` — `analyser()` | fonction pure, tous les chemins et les cas d'erreur | 100 % |
| Formatage des paragraphes | fonction pure, gras, code, échappement | 100 % |
| Schéma `Lecon` | pytest, une règle refusée par test | 100 % |
| Validation des leçons | pytest, exemple qui plante, bloc vide, notion en avance | 100 % |
| Composants de page | Testing Library : ce que l'élève voit et peut faire | comportement |

**Ce que je ne promets pas.** Une couverture de 100 % sur du CSS et sur des composants de
présentation n'est ni atteignable ni utile : elle se gagne en écrivant des tests qui rendent un
composant et n'affirment rien. Les composants sont testés sur leur **comportement** — le code
d'un exercice `predire` est-il affiché, un lien du menu marque-t-il la page courante, le bouton
Valider est-il désactivé tant qu'aucune option n'est cochée.

**Outillage à mettre en place** : `vitest --coverage` côté front, `pytest-cov` côté Python, avec
un seuil qui fait échouer la construction sous la cible.

**Duplication.** Un point est déjà connu et assumé : la liste blanche des exceptions existe en
double, côté navigateur et côté serveur. C'est délibéré et commenté aux deux endroits
([[ADR-008 Validation serveur des champs libres]]). Toute autre duplication est un défaut.

## 9. Questions tranchées

> [!success] Décidé le 4 septembre 2026
> - **La fiction disparaît partout**, code et base compris : table `eleve`, colonne `code_acces`,
>   variables `DOJO_*`. Voir [[ADR-010 Abandon de la fiction narrative]].
> - **Le code d'accès devient `DOJO-XXXX`.** La base ne contenait que des codes de test, aucune
>   migration n'est nécessaire.
> - **Les 25 énoncés sont réécrits** autour d'exemples du quotidien, chaque exercice autonome.
>   ==Pas de fil rouge== — ce qui supprime le programme unique décrit dans [[Terminal QG]], dont le
>   sort reste à trancher.
>
> Le découpage est dans [[Plan interface]], tâches 1, 15 et 16.
