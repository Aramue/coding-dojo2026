# Coding Dojo — Python

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
  contenu/                les exercices et les leçons, en YAML versionné
docs/vault/               la documentation, sous forme de coffre Obsidian
```

## Développer

```bash
# Interface
cd plateforme/web
pnpm install
pnpm dev                 # serveur de développement
pnpm test                # 412 tests
pnpm test:couverture     # avec les seuils qui font échouer la construction

# API
cd plateforme/api
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m pytest

# Contenu
cd plateforme/outils
.venv/Scripts/python valider_contenu.py ../contenu/chapitre-1
.venv/Scripts/python construire_contenu.py ../contenu/chapitre-1 ../web/public/contenu
```

> [!IMPORTANT]
> `valider_contenu.py` **exécute la solution de référence de chaque exercice
> contre ses propres tests**, et chaque exemple de code de chaque leçon. Un
> contenu incohérent fait échouer la construction plutôt que d'atteindre les
> élèves. C'est le contrôle qui économise le plus de temps en séance.

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

1. `docker compose up -d --build`, avec `DOJO_DOMAINE` dans un `.env` si le
   serveur a un nom (voir `.env.example`).
2. Ouvrir `/prof` **tout de suite** et créer le compte professeur.

Mot de passe oublié :

```bash
docker compose exec api python -m app.oublier_prof
```

Le compte est effacé et `/prof` propose de nouveau de le créer. Les élèves,
leurs codes et leur progression ne bougent pas. Détail dans
[ADR-014](docs/vault/2-decisions/ADR-014%20Le%20compte%20professeur%20se%20crée%20au%20premier%20lancement.md).
