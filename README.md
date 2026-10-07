# Coding Dojo — Python

[![Vérifications](https://github.com/Aramue/coding-dojo2026/actions/workflows/verifications.yml/badge.svg)](https://github.com/Aramue/coding-dojo2026/actions/workflows/verifications.yml)

Plateforme d'exercices Python pour le Coding Dojo 2026-2027, à destination
d'élèves de gymnase genevois de 15 à 19 ans.

Le code de l'élève s'exécute **dans son navigateur** et se corrige tout seul :
il sait immédiatement s'il a juste, sans lever la main. C'est le goulot qui a
produit l'abandon de 18 élèves sur 24 en 2025 — le professeur était le seul
validateur de la salle.

## Démarrer

```bash
docker compose up -d --build
```

L'application est servie sur <http://localhost>. Aucun fichier à préparer :
le `.env` est facultatif et ne porte plus aucun secret.

| Où | Quoi |
|---|---|
| `/` | l'élève entre son code d'accès (`DOJO-XXXX`) |
| `/prof` | le tableau de bord professeur : qui avance, qui bloque, sur quoi |
| `/prof/quiz` | l'écran projeté du quiz en direct : le professeur lance et mène une partie |
| `/quiz` | la partie de quiz côté élève ; un bandeau y mène dès qu'une partie est créée |

**Au premier lancement, `/prof` propose de créer le compte professeur** : un
mot de passe de douze caractères au moins. Le compte revient au premier qui
ouvre la page — sur un serveur, crée-le juste après le déploiement.

Les codes d'accès des élèves se créent ensuite dans « Ma classe », sur `/prof`.
Un code inconnu n'ouvre rien.

## Arborescence

```
docker-compose.yml        tout se lance d'ici
deploiement/              Dockerfiles et configuration Caddy
plateforme/
  web/                    interface élève et professeur — React 19 + TypeScript
  api/                    progression et tableau de bord — FastAPI + SQLite
  outils/                 schéma, validation et construction du contenu — Python
  contenu/                les exercices, les leçons et les quiz, en YAML versionné
docs/vault/               la documentation, sous forme de coffre Obsidian
```

## Développer

```bash
# Interface
cd plateforme/web
pnpm install
pnpm dev                 # serveur de développement
pnpm test                # 529 tests
pnpm test:couverture     # avec les seuils qui font échouer la construction

# API
cd plateforme/api
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m pytest

# Contenu
cd plateforme/outils
.venv/Scripts/python valider_contenu.py ../contenu/chapitre-1
.venv/Scripts/python construire_contenu.py ../contenu/chapitre-1 ../web/public/contenu
.venv/Scripts/python construire_quiz.py     # les quiz, pour l'API seulement -> ../api/quiz
.venv/Scripts/python construire_solutions.py   # les solutions, pour le professeur -> ../api/solutions
```

> [!WARNING]
> Les quiz ne vont **jamais** dans `web/public` : leurs bonnes réponses y seraient lisibles par
> toute la classe. Ils sont construits dans l'image de l'API. Voir
> [Quiz en direct](docs/vault/3-architecture/Quiz%20en%20direct.md).
>
> Même règle pour les **solutions de référence** : la publication les retire de chaque exercice,
> et seule une session professeur les lit, par l'API, repliées sous chaque exercice de « Voir
> l'espace élève ».

> [!IMPORTANT]
> `valider_contenu.py` **exécute la solution de référence de chaque exercice
> contre ses propres tests**, et chaque exemple de code de chaque leçon. Un
> contenu incohérent fait échouer la construction plutôt que d'atteindre les
> élèves. C'est le contrôle qui économise le plus de temps en séance.

## Vérifier

Trois contrôles tournent sur chaque PR et sur chaque poussée dans `main`. Ils
lancent les commandes ci-dessus, pas d'autres :

| Job | Ce qu'il lance |
|---|---|
| API | les 237 tests de `plateforme/api` |
| Contenu | les 150 tests de `plateforme/outils`, la validation du contenu, les trois constructions |
| Interface | les 529 tests **avec les seuils de couverture**, puis `tsc` et `vite build` |

Une minute de calcul en tout. Une release est un **tag** `vX.Y.Z` posé sur
`main` : il rejoue ces trois contrôles, puis construit et publie les deux images
sur GHCR. Aucune image publiée n'échappe aux tests, et ==la CI ne déploie
rien== — un déploiement se lance à la main, hors séance. Voir
[ADR-017](docs/vault/2-decisions/ADR-017%20Une%20seule%20branche,%20des%20releases%20par%20tag.md).

## Documentation

Tout est dans `docs/vault/`, un coffre Obsidian qui s'ouvre aussi très bien en
markdown ordinaire. Points d'entrée :

- [Accueil](docs/vault/Accueil.md) — la carte du projet
- [Vue d'ensemble](docs/vault/3-architecture/Vue%20d'ensemble.md) — l'architecture
- [Pièges et invariants](docs/vault/3-architecture/Pièges%20et%20invariants.md) —
  ==les choix qui ont l'air arbitraires et ne le sont pas==, chacun payé par un
  défaut réel
- [Journal de décisions](docs/vault/2-decisions/Journal%20de%20décisions.md) — les ADR

## Déployer

Aucun secret à écrire. La clé qui signe les sessions est tirée au premier
démarrage et rangée dans la base SQLite, avec l'empreinte du mot de passe
professeur. Les deux vivent dans le volume `donnees` : sauvegarder la base,
c'est sauvegarder la progression **et** le compte.

En production, la machine **ne construit rien** : les images viennent de GHCR, où
la CI les a construites et testées au tag.

```bash
/var/www/coding-dojo/deploiement/deployer.sh v1.1.0
```

Le script sauvegarde la base, passe le dépôt sur le tag, tire les images,
démarre sans construire, attend que `/api/sante` réponde, installe le bloc
nginx s'il a changé — `nginx -t` d'abord, l'ancien remis s'il échoue —, puis
supprime nos images anciennes au-delà des deux dernières. Le retour arrière est le même
script avec le tag précédent. Au premier déploiement seulement : ouvrir `/prof`
**tout de suite** et créer le compte professeur.

Le reste — nginx qui termine le TLS devant `127.0.0.1:3200`, le certificat, la
sauvegarde nocturne avec rétention, et les bornes qui empêchent la pile de
remplir un disque partagé avec un autre service — est dans
[Déploiement UNIGE](docs/vault/3-architecture/Déploiement%20UNIGE.md).

Mot de passe oublié :

```bash
docker compose exec api python -m app.oublier_prof
```

Le compte est effacé et `/prof` propose de nouveau de le créer. Les élèves,
leurs codes et leur progression ne bougent pas. Détail dans
[ADR-014](docs/vault/2-decisions/ADR-014%20Le%20compte%20professeur%20se%20crée%20au%20premier%20lancement.md).
