---
title: Déploiement UNIGE
tags:
  - architecture
  - exploitation
mis-a-jour: 2026-09-03
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

## Sauvegardes

Le fichier SQLite est copié chaque nuit et avant chaque déploiement. À 24 élèves, le volume est
négligeable ; l'enjeu est de ne pas perdre la progression d'une séance.

## Points à vérifier avant la séance 1

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

Les secrets vivent dans `.env` à la racine, hors dépôt, documenté par `.env.example`.
