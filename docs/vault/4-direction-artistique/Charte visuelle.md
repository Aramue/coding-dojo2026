---
title: Charte visuelle
tags:
  - moc
  - direction-artistique
statut: validée
mis-a-jour: 2026-09-04
---

# Charte visuelle

> [!info] Planche interactive
> La charte complète, avec swatches, spécimens et maquettes des trois écrans :
> **https://claude.ai/code/artifact/ed35a3d2-d686-46b7-b92d-d9c27e1d0c4c**
>
> Les notes de ce dossier enregistrent les **décisions et les valeurs** ; la planche montre le
> résultat. En cas de divergence, ce sont les notes qui font foi.

## La règle fondatrice

> [!quote] Fond pastel = j'apprends. Fond sombre = je code.
> L'élève sait où il est sans lire un mot.

Cette règle n'a pas été inventée : elle a été **relevée** dans les decks de cours, où le fond
s'inverse en sombre à chaque passage du raisonnement au vrai code Python (pages 28, 29, 33, 34,
37 du deck 1). L'interface ne fait que la rendre systématique.
Voir [[ADR-006 Palette dérivée des slides]].

## Les pièces

- [[Palette]] — les cinq familles, leurs valeurs et leurs contrastes
- [[Typographie]] — General Sans et JetBrains Mono, et la règle qui les sépare
- [[Composants signature]] — la carte de code, le soulignement tracé, les flèches

## Les cinq règles à ne pas enfreindre

1. **Le jaune Python `#FFC331` ne vit que sur fond sombre** — 1.60 sur blanc, 8.88 sur `#282A36`
2. **Les pastilles macOS ne sont pas des couleurs sémantiques** — sur pastel, `#0F5C23` pour le
   succès et `#9C1B15` pour l'erreur
3. **Un écran, une famille** — jamais deux fonds pastel sur le même écran
4. **Le sombre est réservé à l'action** — aucune page purement explicative ne passe en sombre
5. **La chasse fixe ne sort jamais du code** — voir [[Typographie]]

## Les trois écrans

| Écran | Fond | Note |
|---|---|---|
| Leçon | `tint` de la famille du concept | Court par principe : on explique vite |
| Exercice | `deep` de la **même** famille | Même concept, mode différent |
| Tableau de bord | neutre chaud `#FBF8F3` | Hors palette : c'est l'écran du professeur, pas celui des élèves |

> [!note] Ce que le tableau de bord n'affiche pas
> Le code écrit par l'élève. Écarté explicitement à la conception. L'alerte de blocage porte le
> **type** d'erreur et le test qui échoue, ce qui suffit à arriver en sachant quoi dire.
> Voir [[ADR-002 Identification par code d'agent]].

## Amendement du 4 septembre 2026 — la portée du pastel

> [!warning] Ce que « pastel = j'apprends » veut dire, et ne veut pas dire
> Dans les supports de cours, le pastel est le fond d'une **carte**, pas d'un écran. Appliqué en
> aplat plein écran, il fait ressembler l'interface à une maquette : le texte flotte sans surface,
> la couleur ne porte plus d'information, elle remplit de l'espace.
>
> **Règle appliquée** : le canevas est le neutre chaud, le contenu vit sur du blanc, et la couleur
> de la notion tient les accents — sur-titre, pastille, état actif du menu, filet des blocs
> « attention », bordure de la carte de code.
>
> L'écran d'exercice reste sombre : c'est la bascule « j'apprends / j'écris », et elle tient. La
> couleur profonde de la famille y est voilée d'un gris très sombre — un aplat saturé sur un écran
> entier fatigue et lit « prototype ».

Voir [[Pièges et invariants]].

## Amendement du 4 septembre 2026 — l'écran d'exercice se lit en une colonne

> [!warning] La consigne au-dessus du code, jamais à côté
> L'écran d'exercice a d'abord posé l'énoncé et l'éditeur **côte à côte** au-delà de 980 px. Deux
> panneaux de poids visuel égal, deux points de départ possibles pour le regard : l'élève balaye
> de gauche à droite entre chaque phrase lue et chaque ligne tapée, et rien ne dit lequel des deux
> vient d'abord.
>
> **Règle appliquée** : une seule colonne de **820 px**, centrée, sur tous les écrans. On lit la
> consigne, on voit les indices, puis on écrit. ==Le fil d'Ariane, l'en-tête, le rappel de
> réussite et le corps partagent la même largeur== — une variable, `--colonne`, la gouverne, et
> tout s'aligne sur le même bord.
>
> 820 px, pas la largeur de l'écran : au-delà, une ligne de prose dépasse la centaine de
> caractères et se relit mal. L'éditeur y tient largement — une ligne de Python de chapitre 1
> occupe rarement la moitié de la colonne.

## Le mouvement, et ses quatre usages

Rien ne bouge sans raison, et rien ne dure plus de 400 ms. Quatre usages, pas un de plus :

| Quoi | Durée | Pourquoi |
|---|---|---|
| L'arrivée d'une page | 220 ms | dit qu'on a changé d'endroit, là où un remplacement instantané laisse douter du clic |
| Le repli d'un chapitre | 260 ms | rend le pliage lisible ; sans lui le sommaire saute |
| L'apparition du verdict | 180 ms | c'est le seul retour que l'élève attend, il doit arriver et non surgir |
| L'avancement d'une jauge | 400 ms | rend le gain visible au moment où il est acquis |

> [!important] Deux règles techniques
> Le repli s'anime sur `grid-template-rows: 1fr → 0fr`, jamais sur `height` : c'est la seule
> façon d'animer vers une hauteur **automatique** sans la mesurer en JavaScript.
>
> La barre de lecture bouge par `transform: scaleX()`, jamais par `width` : la première est
> composée par le GPU, la seconde relance la mise en page à chaque pixel de défilement — et
> ==les machines des huit établissements ne sont pas des machines de développeur==.

`prefers-reduced-motion: reduce` désactive les quatre.
