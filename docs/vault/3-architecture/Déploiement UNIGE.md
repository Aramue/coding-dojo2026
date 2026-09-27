---
title: Déploiement UNIGE
tags:
  - architecture
  - exploitation
mis-a-jour: 2026-09-25
---

# Déploiement UNIGE

## Deux conteneurs, un `docker compose up`

| Service | Rôle |
|---|---|
| `caddy` | Sert le front statique, les exercices, les polices et Pyodide ; fait proxy vers l'API ; gère TLS |
| `api` | FastAPI + SQLite dans un volume monté |

Rien d'autre. Pas de file d'attente, pas de cache distribué, pas d'exécuteur de code : la
simplicité est une conséquence directe de [[ADR-001 Exécution du code dans le navigateur]].

## Ce que dit le dossier de sécurité

> [!success] Un argument simple à défendre
> ==La plateforme n'exécute aucun code fourni par un utilisateur sur l'infrastructure de
> l'Université.== Le Python des élèves tourne dans leur propre navigateur, dans le bac à sable
> WebAssembly. Le serveur ne fait que servir des fichiers statiques et enregistrer des compteurs
> de progression.
>
> Aucune donnée personnelle n'est stockée : ni nom, ni prénom, ni adresse électronique.
> Voir [[ADR-002 Identification par code d'agent]].

C'est très différent d'une demande d'hébergement pour un juge en ligne, qui aurait exigé de
défendre l'étanchéité d'un bac à sable serveur.

## Aucune dépendance externe à l'exécution

Tout est servi depuis la machine UNIGE :

- Les polices General Sans et JetBrains Mono — **pas** depuis Google Fonts ni Fontshare
- Le moteur Pyodide — **pas** depuis un CDN
- Les exercices, construits dans l'image

> [!note] Pourquoi c'est important ici
> Hotlinker Google Fonts transmet l'adresse IP des visiteurs à un tiers. Avec un public mineur
> et un hébergement universitaire, l'auto-hébergement n'est pas une optimisation de performance :
> c'est la position par défaut. Cela a aussi eu pour effet de rendre le choix typographique
> ==purement esthétique==, puisque aucune piste ne coûtait plus cher qu'une autre.
> Voir [[ADR-005 Typographie General Sans]].

## Développer dans Docker — 27 septembre 2026

`docker-compose.dev.yml` monte le même dojo, mais qui se recharge tout seul :
Vite à la place du front statique, `uvicorn --reload` à la place d'uvicorn.
==L'adresse reste `http://localhost`== — Caddy reste devant et relaie vers Vite,
websocket de rechargement compris.

Le fichier **se lit seul**, il ne surcharge pas `docker-compose.yml` : les deux
services y font des choses franchement différentes, et une fusion aurait caché
lesquelles.

> [!warning] Trois pièges, tous payés à l'essai
> **Le sondage.** Un montage depuis Windows ne transmet pas les événements
> d'inotify au conteneur. Sans `usePolling`, la page se charge et plus rien ne
> bouge — ==sans le moindre message==.
>
> **Le port du client.** Le navigateur joint Vite à travers Caddy, sur le port
> 80 ; son client de rechargement viserait 5173 par défaut et n'ouvrirait
> jamais son websocket. D'où `hmr.clientPort`.
>
> **Le `node_modules` de l'hôte.** Monter `plateforme/web` recouvre celui de
> l'image. Sous Windows c'est fatal : pnpm y construit une forêt de liens
> symboliques que Linux ne sait pas suivre. Un volume anonyme par-dessus le
> montage le protège.

> [!danger] L'étage `developpement` doit rester avant le dernier
> `docker build` sans `--target` prend le **dernier** étage du Dockerfile. Le
> mettre en fin donnerait une image de développement à la production, sans que
> rien ne le signale.

Le développement a son propre `name`, donc ses propres conteneurs et **son
propre volume de données** : il ne touche jamais la base de la production, mais
il a sa propre classe et son propre compte professeur. Les deux piles se
disputent le port 80 : arrêter l'autre avant.

Ce que le mode développement ne fait pas : **reconstruire le contenu**. Après
avoir modifié un YAML, relancer `construire_contenu.py` — le JSON publié est
versionné, et Vite le sert au rechargement suivant.

## Sauvegardes

Le fichier SQLite est copié chaque nuit et avant chaque déploiement. À 24 élèves, le volume est
négligeable ; l'enjeu est de ne pas perdre la progression d'une séance.

## Premier lancement — 25 septembre 2026

Plus aucun secret à préparer ([[ADR-014 Le compte professeur se crée au premier lancement]]).
`docker compose up -d --build` suffit, sur un poste neuf comme sur le serveur.

1. **La clé des jetons** est tirée par l'API au premier besoin et rangée dans la table `reglage`
   de la base SQLite, donc dans le volume `donnees`.
2. **Le compte professeur** se crée en ouvrant `/prof` : tant qu'aucun compte n'existe, la page
   propose de le créer. L'empreinte scrypt du mot de passe rejoint la clé dans `reglage`.

> [!danger] Le compte revient au premier qui ouvre `/prof`
> Sur un serveur joignable, ==ouvrir `/prof` et créer le compte dans la minute qui suit le
> déploiement==. Si quelqu'un l'a pris avant, `oublier_prof` le rend : il faut un accès au
> serveur, que l'intrus n'a pas.

> [!tip] Mot de passe oublié
> `docker compose exec api python -m app.oublier_prof` efface le compte ; `/prof` propose de
> nouveau de le créer. Les élèves, leurs codes et leur progression ne bougent pas.

> [!note] La sauvegarde nocturne emporte aussi le compte
> La clé, l'empreinte et la progression vivent dans le même fichier. Restaurer la base restaure
> les trois ; la perdre fait perdre les trois. Rien d'autre à sauvegarder.

## Points à vérifier avant la séance 1

- [ ] Compte professeur créé sur `/prof` juste après le premier déploiement
- [ ] Nom de domaine et certificat TLS en place
- [ ] Cache long sur Pyodide et les polices, pour absorber les 24 chargements simultanés
- [ ] Codes d'agent générés et imprimés — voir [[ADR-002 Identification par code d'agent]]
- [ ] Test de charge grossier : 24 onglets qui chargent en même temps
- [ ] Licence ITF Free Font jointe au dossier
- [ ] Un plan de repli si le réseau de la salle tombe

## Voir aussi

[[Vue d'ensemble]] · [[Contraintes]]

## Structure du dépôt — 4 septembre 2026

`docker-compose.yml` vit **à la racine** : `docker compose up -d --build` depuis la racine, sans
changer de dossier. Le fichier déclare `name: coding-dojo`, ce qui nomme les conteneurs
`coding-dojo-api-1` et `coding-dojo-web-1` — auparavant Docker prenait le nom du dossier qui
contenait le fichier, et ils s'appelaient `deploiement-*`.

> [!warning] Le contexte de build est la racine, donc `.dockerignore` est obligatoire
> Sans lui, `COPY plateforme/web .` recopiait le `node_modules` de la machine par-dessus
> l'installation faite dans l'image. Comme pnpm construit une forêt de liens symboliques, la copie
> arrivait cassée et `tsc` ne trouvait plus ses types. ==Le build dépendait de l'état du poste== :
> il passait chez l'un, échouait chez l'autre.

Les secrets vivaient alors dans `.env` à la racine, hors dépôt, documenté par `.env.example`.
Depuis le 25 septembre 2026, le `.env` ne porte plus que `DOJO_DOMAINE`, et il est facultatif —
voir « Premier lancement » ci-dessus.
