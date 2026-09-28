---
title: ADR-017 Une seule branche, des releases par tag
tags:
  - decision
  - exploitation
statut: acceptée
date: 2026-09-28
---

# ADR-017 — Une seule branche, des releases par tag

> [!success] Statut : acceptée le 28 septembre 2026

## Contexte

Le dépôt n'avait ==aucune intégration continue== : pas de `.github/workflows`. Les quatre suites
— 222 tests d'API, 143 tests d'outils, 514 tests d'interface, la validation du contenu — ne
tournaient que sur la machine du mainteneur, et un commit poussé avec un test rouge est déjà
arrivé.

La plateforme doit maintenant passer en production, pour que les élèves y accèdent. La question
posée était : faut-il **deux branches longues**, chacune déployée — une préproduction et une
production ? C'est le modèle de l'autre projet du même mainteneur, qui vit sur la même VM et
publie deux jeux d'images, `:main` pour sa préproduction et `:release` pour sa production.

La VM pèse dans la réponse. Elle est ==partagée== :

- 2 cœurs, 4 Go de mémoire, 60 Go de disque, dont 28 libres ;
- nginx tient déjà les ports 80 et 443, avec cinq blocs de site et des certificats certbot ;
- six conteneurs d'un autre service en production y tournent, publiés sur `127.0.0.1` seulement ;
- une sauvegarde nocturne de leur base tourne déjà en cron.

## Décision

**Une seule branche longue, `main`. Une release est un tag. La VM tourne sur un tag.**

1. **`main` est la seule branche longue.** Branche courte, PR, CI verte, fusion — le rythme
   actuel, inchangé.
2. **Une release est un tag annoté `vX.Y.Z` sur `main`**, avec deux lignes sur ce qu'il change.
3. **La VM tourne sur un tag, jamais sur une branche.** Donc `main` peut avancer pendant une
   séance sans que le serveur des élèves ne change de lui-même.
4. **La préproduction est la pile Docker locale** : même `docker-compose.yml`, mêmes Dockerfile,
   mêmes images. C'est déjà là que les vérifications de bout en bout et le test de charge à
   vingt-quatre élèves ont été faits.
5. **La CI tient en trois contrôles**, sur chaque PR et sur chaque poussée dans `main` :
   `verifications.yml` lance l'API, le contenu et l'interface — les commandes du README, pas
   d'autres. Une minute de calcul.
6. **Un tag construit et publie les deux images sur GHCR**, après avoir rejoué ces trois
   contrôles : `publication.yml` appelle `verifications.yml`, donc ==aucune image publiée
   n'échappe aux tests==.
7. **Le déploiement n'est jamais automatique.** Un humain le lance sur la VM, hors séance.
8. **Une branche `release/vX.Y` se crée le jour où elle sert**, depuis le tag concerné, et pas
   avant.

## Pourquoi

**Une release n'a pas besoin d'une branche.** Une deuxième branche longue existe pour servir la
version N pendant que la N+1 se prépare, par des gens et sur un calendrier qu'on ne contrôle pas.
Ici une personne écrit, relit et déploie, et la fenêtre de déploiement est « entre deux séances ».
Un tag annoté fait tout le travail : il nomme une version, il est immuable, et il permet le retour
arrière.

**Le deuxième environnement coûterait une deuxième base.** Tout l'état vit dans un seul fichier
SQLite : codes d'accès, progression, compte professeur, clé des jetons
([[ADR-014 Le compte professeur se crée au premier lancement]]). Une préproduction aurait le sien,
donc ==jamais les données de la classe==, et vingt-quatre élèves à recréer à chaque essai. Or
`deploiement/charge_quiz.py` fait déjà exactement cela contre la production, hors séance, et se
retire ensuite.

**Et un deuxième nom, un deuxième certificat, un deuxième jeu de ports.** Sur cette VM, 80 et 443
sont pris : une seconde pile voudrait d'autres ports et un second bloc nginx, pour un bénéfice que
la pile locale donne déjà gratuitement.

**Le vrai risque n'est pas le code non testé, c'est le déploiement à la mauvaise heure.** Un
redémarrage coupe toutes les sonnettes du quiz. La partie survit — elle est en base
([[ADR-016 Temps réel par sonnette WebSocket]]) — et les écrans se rebranchent seuls en relisant
chaque seconde, mais la coupure se voit. Le tag protège de cela, une branche non.

**Les images sont construites par la CI, pas par la VM.** Un `pnpm install` et un `vite build`
chez elle, c'est de la mémoire prise à l'autre service sur 4 Go, et un cache de construction qui
grossit à chaque déploiement sur un disque partagé. La VM ne fait que tirer.

## Ce qui en découle

> [!danger] Un tag ne se pose que sur `main`
> `publication.yml` rejoue les tests, donc un tag posé ailleurs serait quand même testé — mais il
> publierait du code que personne n'a relu en PR. Le tag est le dernier geste après la fusion,
> jamais un raccourci pour éviter la PR.

- **La CI exécute les mêmes commandes que le README et que les Dockerfile**, à commencer par
  `construire_contenu.py` et `construire_quiz.py`. Quand l'une des trois change, les autres
  changent : c'est le prix de n'avoir pas de script unique, et c'est voulu — un développeur doit
  pouvoir tout lancer à la main.
- **pnpm s'installe directement, jamais par corepack**, dans la CI comme dans l'image :
  `devEngines.packageManager` porte un intervalle semver là où corepack exige une version exacte.
- **Les paquets GHCR doivent être rendus publics une fois**, à la main, après la première
  publication. Sinon la VM aurait besoin d'un jeton pour tirer.
- **Le retour arrière est le tag précédent**, et son image est encore dans le cache de la VM.
- Les seuils de couverture de `vitest.config.ts` sont vérifiés par la CI : la porte est là, plus
  seulement sur la machine du développeur.

> [!warning] Les bonnes réponses des quiz sont dans un dépôt public
> `plateforme/contenu/chapitre-1/quiz/` est lisible par quiconque trouve le dépôt, et l'image de
> l'API le sera aussi sur GHCR. [[ADR-015 Quiz en direct et classement encadré]] empêche l'API de
> livrer une bonne réponse avant la correction, ce qui traite le cas de l'élève ==dans la
> séance== ; cela n'a jamais rendu les fichiers secrets. Rien à corriger dans le code : c'est une
> propriété du dépôt, à connaître avant de publier l'adresse du dépôt à une classe.

## Alternatives écartées

- **Deux branches longues, chacune déployée** — le modèle de l'autre projet. Écarté pour les
  raisons ci-dessus : deux bases, deux noms, deux jeux de ports, et deux PR par changement quand
  celui qui écrit est celui qui relit.
- **Le déploiement automatique à la fusion.** Il tomberait un jour en pleine séance. Rien dans ce
  projet n'a besoin d'être en ligne dans la minute.
- **Construire les images sur la VM** (`git checkout <tag> && docker compose up -d --build`).
  Zéro registre à gérer, et c'est tentant. Écarté : la mémoire et le disque sont partagés avec un
  service en production.
- **Une CI qui construit les images à chaque PR.** Elle doublerait le temps de chaque PR pour
  refaire un `pnpm build` que le job d'interface vient de faire. Les images se construisent au
  tag, et un tag qui ne construit pas se refait en une minute.
- **Garder le statu quo, sans CI.** C'est ce qui a laissé passer un test rouge.

## Voir aussi

[[Déploiement UNIGE]] · [[Vue d'ensemble]] · [[Pièges et invariants]] ·
[[ADR-016 Temps réel par sonnette WebSocket]]
