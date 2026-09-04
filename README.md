# Coding Dojo — Python

Plateforme d'exercices Python pour le Coding Dojo 2026-2027, à destination
d'élèves de gymnase genevois de 15 à 19 ans.

Le code de l'élève s'exécute **dans son navigateur** et se corrige tout seul :
il sait immédiatement s'il a juste, sans lever la main. C'est le goulot qui a
produit l'abandon de 18 élèves sur 24 en 2025 — le professeur était le seul
validateur de la salle.

## Démarrer

```bash
cp .env.example .env    # puis remplacer les deux secrets, voir le fichier
docker compose up -d --build
```

L'application est servie sur <http://localhost>.

| Où | Quoi |
|---|---|
| `/` | l'élève entre son code d'accès (`DOJO-XXXX`) |
| `/prof` | le tableau de bord professeur : qui avance, qui bloque, sur quoi |

Les codes d'accès n'ont pas besoin d'être créés à l'avance : le premier usage
d'un code bien formé ouvre le compte. Il suffit de les distribuer en séance.

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
pnpm test                # 196 tests
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

## Avant un déploiement

Le fichier `.env` n'est pas dans le dépôt : il porte les secrets de l'instance.
Sur un serveur, il doit exister et porter `DOJO_SECRET` et `DOJO_CODE_PROF`.
Sans eux, l'API tire des valeurs aléatoires au démarrage et les avertit — les
sessions ne survivent alors pas à un redémarrage.
