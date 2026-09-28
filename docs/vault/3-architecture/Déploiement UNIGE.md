---
title: Déploiement UNIGE
tags:
  - architecture
  - exploitation
mis-a-jour: 2026-09-27
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

## Le quiz en direct — 27 septembre 2026

- Les quiz sont **construits dans l'image de l'API** (première étape de `Dockerfile.api`), jamais
  dans l'image web : leurs bonnes réponses ne doivent pas être lisibles par les élèves. Un quiz
  incohérent fait échouer `docker compose build`.
- L'API reste **un seul processus** uvicorn : la sonnette du quiz tient son registre en mémoire.
- Caddy relaie le WebSocket `/api/quiz/flux` sans configuration de plus.
- **Avant la première séance avec quiz**, hors séance :

  ```bash
  python deploiement/charge_quiz.py --url https://<domaine>/api --mot-de-passe <mot de passe professeur>
  ```

  Il se connecte avec le mot de passe du compte professeur ([[ADR-014 Le compte professeur se crée
  au premier lancement]]), inscrit 24 élèves d'essai, les fait jouer, puis les retire avec leurs
  réponses. Il refuse de
  démarrer si une partie est en cours. Sa partie, sans réponse une fois les élèves d'essai
  retirés, ne masque pas les « Derniers résultats » de la classe.
- **Depuis une vraie salle**, vérifier que le WebSocket passe le réseau de l'établissement. S'il
  ne passe pas, le quiz fonctionne quand même, en relisant chaque seconde.

Voir [[Quiz en direct]].
