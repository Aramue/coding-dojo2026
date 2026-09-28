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
Depuis le 25 septembre 2026, il n'y a plus de secret du tout — voir « Premier lancement »
ci-dessus. Il porte désormais deux réglages d'exploitation, `DOJO_VERSION` et `DOJO_PUBLICATION` ;
`DOJO_DOMAINE` a disparu avec le TLS de Caddy. Voir « La VM de production » plus bas.

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

## La VM de production — 28 septembre 2026

==La machine n'est pas dédiée.== C'est un VPS (Ubuntu 22.04, 2 cœurs, 3,9 Go de mémoire, 58 Go de
disque) qui héberge déjà `aramue.com` et un autre service en production. Tout ce qui suit découle
de ce partage. Décision : [[ADR-017 Une seule branche, des releases par tag]].

### Ce que la machine tenait déjà

| Ce qui occupe | Détail |
|---|---|
| nginx | les ports **80 et 443**, cinq blocs de site, certificats certbot renouvelés par `certbot.timer` |
| Six conteneurs | un autre projet, production et préproduction, publiés sur `127.0.0.1:3000`, `:3001`, `:3100`, `:3101` |
| oauth2-proxy | `127.0.0.1:4180` et `:4181`, pour protéger leurs sites |
| Un cron | la sauvegarde de leur base, à 3h15 |

### Où le dojo se glisse

- Le dépôt est cloné dans `/var/www/coding-dojo`, à côté du voisin.
- Le conteneur web publie sur **`127.0.0.1:3200`** et rien d'autre. L'API n'est publiée nulle
  part : Caddy l'atteint par le réseau Docker.
- **nginx termine le TLS** pour `dojo.aramue.com` et relaie vers 3200 —
  `deploiement/nginx-dojo.aramue.com.conf`, calqué sur les blocs déjà en place.
- **Caddy ne fait plus de TLS.** Il écoute `:80` en clair et ne connaît plus le nom du site.
  `DOJO_DOMAINE` et le volume `caddy_data` ont disparu, ainsi que le bloc à deux schémas qu'il
  fallait déclarer pour échapper à sa redirection HTTPS automatique.

> [!danger] Le `proxy_read_timeout` par défaut ferme la sonnette toutes les minutes
> La sonnette du quiz ==ne dit rien entre deux questions==, et nginx ferme au bout de 60 s une
> connexion relayée restée silencieuse. Il faut un `location /api/quiz/flux` à part, avec
> `proxy_read_timeout 3600s`. Sans lui le quiz marche quand même — le repli est fait pour ça
> ([[ADR-016 Temps réel par sonnette WebSocket]]) — mais chaque élève se rebranche une fois par
> minute pendant toute la partie, pour rien.

> [!warning] Pas de `limit_req` sur ce site, contrairement aux autres de la machine
> Vingt-quatre élèves dont le WebSocket ne passe pas, c'est vingt-quatre requêtes par seconde, et
> c'est le fonctionnement **normal** du repli. Une limite réglée pour un site vitrine
> transformerait un réseau d'établissement capricieux en quiz cassé. Pas de `proxy_cache` non
> plus : Caddy pose déjà les bons en-têtes, et mettre `/api` en cache servirait à un élève l'état
> d'un autre.

### Installer, la première fois

1. **DNS** : `dojo.aramue.com` vers l'adresse de la VM.
2. Cloner dans `/var/www/coding-dojo`, puis écrire `.env` d'après `.env.example` —
   `DOJO_PUBLICATION=127.0.0.1:3200`.
3. Le dossier des sauvegardes, qui appartient à root et doit nous revenir :
   ```bash
   sudo mkdir -p /var/backups/coding-dojo
   sudo chown ubuntu:ubuntu /var/backups/coding-dojo
   sudo chmod 700 /var/backups/coding-dojo
   ```
   > [!warning] Oublier cette étape ne casse que le *deuxième* déploiement
   > `deployer.sh` sauvegarde avant tout et s'arrête à la moindre erreur. Au premier passage aucun
   > conteneur ne tourne encore, donc `sauvegarde.sh` sort avant d'écrire et le déploiement
   > réussit. ==C'est le suivant qui échoue==, des semaines plus tard, sur un `Permission denied`
   > qu'on ne relie pas au jour de l'installation. Le script nomme désormais la commande à lancer.
4. Un bloc nginx minimal en `:80` qui sert `/.well-known/acme-challenge/` depuis `/var/www/certbot`
   (le webroot que la machine utilise déjà), puis :
   ```bash
   sudo certbot certonly --webroot -w /var/www/certbot -d dojo.aramue.com
   ```
   ==Le certificat doit exister avant le bloc `443`==, sinon `nginx -t` échoue sur un fichier absent
   et refuse de recharger — ce qui couperait aussi les autres sites.
5. Poser le fichier complet, `sudo nginx -t`, `sudo systemctl reload nginx`.
6. `deploiement/deployer.sh v1.0.0`
7. **Ouvrir `/prof` tout de suite** et créer le compte professeur (voir le danger plus haut).
8. Le cron de sauvegarde, puis `charge_quiz.py` hors séance.

### Déployer, ensuite

```bash
/var/www/coding-dojo/deploiement/deployer.sh v1.1.0
```

Il sauvegarde la base, passe le dépôt sur le tag, tire les images, démarre **sans jamais
construire** (`--no-build`), attend que `/api/sante` réponde, puis supprime nos images anciennes en
gardant les deux dernières. Il demande confirmation : un déploiement coupe toutes les sonnettes en
cours. Le retour arrière est le même script avec le tag précédent, et son image est encore là.

### Les quatre façons de remplir un disque partagé

| Le risque | Ce qui le borne |
|---|---|
| Journaux de conteneurs | `logging` dans `docker-compose.yml` : 10 Mo × 3 par service. Cette machine n'a ==pas de `/etc/docker/daemon.json`==, donc rien ne les bornerait. On borne chez nous plutôt que de changer un démon qui n'est pas à nous. |
| Images périmées | `deployer.sh` supprime les nôtres au-delà des deux dernières, et ne fait **jamais** de `prune` global : les images du voisin ne nous regardent pas. |
| Cache de construction | Il n'y en a pas. La VM ne construit rien. |
| Sauvegardes | `sauvegarde.sh` garde 14 jours, et n'écrit rien si la base n'a pas changé. |

Et la mémoire : `mem_limit` à 512 Mo sur l'API, 256 Mo sur Caddy. Sur 3,9 Go partagés, cela
garantit qu'une fuite chez nous fait tuer **nos** conteneurs, et pas ceux du voisin — l'OOM killer
du noyau choisit sa victime sur la mémoire consommée, pas sur l'ancienneté.

### Sauvegardes

```bash
30 3 * * * /var/www/coding-dojo/deploiement/sauvegarde.sh >> /var/log/coding-dojo-sauvegarde.log 2>&1
```

3h30 et pas 3h15 : le voisin sauvegarde à 3h15, et deux `docker compose exec` en même temps sur
deux cœurs, ce n'est pas la peine. La copie passe par `sqlite3.backup` **dans le conteneur**,
jamais par `cp` : la base est ouverte pendant la copie, et un `cp` peut attraper un fichier à
moitié écrit — on ne s'en apercevrait qu'en essayant de restaurer.

Restaurer, conteneur arrêté :

```bash
cd /var/www/coding-dojo
COMPOSE="docker compose -f docker-compose.yml -f deploiement/production.yml"
gzip -dc /var/backups/coding-dojo/dojo-AAAAMMJJ-HHMMSS.db.gz > /tmp/dojo.db
$COMPOSE stop api
docker run --rm -v coding-dojo_donnees:/donnees -v /tmp:/depuis alpine \
  cp /depuis/dojo.db /donnees/dojo.db
$COMPOSE start api
rm /tmp/dojo.db
```

Cela restaure la progression, les codes d'accès, le compte professeur et la clé des jetons : ils
sont dans le même fichier.
