---
title: Plan interface
tags:
  - plan
  - implementation
statut: à exécuter
date: 2026-09-03
---

# Interface cours et exercices — Plan d'implémentation

> **Exécution :** en ligne, étape par étape. Chaque tâche se termine par une validation humaine
> **avant** son commit. Les cases `- [ ]` servent au suivi.

**Goal:** Donner à l'élève un menu permanent, une page de cours et une page d'exercices par notion, en appliquant réellement la charte visuelle — et retirer la fiction d'agents secrets de **tout** le projet, code et base compris.

**Architecture:** Le contenu des leçons emprunte la chaîne des exercices — YAML validé à la construction, publié en JSON. Le routage est une fonction pure au-dessus de l'API History, sans dépendance. L'interface est découpée en un composant par page, chacun avec sa feuille de style.

**Tech Stack:** TypeScript · React 18 · Vite · Vitest + `@vitest/coverage-v8` · Python 3.12 · Pydantic · ruamel.yaml · pytest + `pytest-cov`

Spécification de référence : [[Spécification interface]].

## Global Constraints

- **Aucune fiction narrative**, nulle part : ni dans les textes, ni dans les noms de tables, de colonnes, de variables d'environnement ou de champs JSON. Le vocabulaire est `eleve`, `code_acces`, `DOJO-XXXX`, `DOJO_SECRET`. ==Deux exceptions, et deux seulement== : les ADR et `Plan palier 1.md`, qui enregistrent ce qui a été décidé et construit à l'époque — les réécrire falsifierait l'historique.
- **Français accentué correctement** dans tout ce que lit un élève. Si une assertion de test empêche d'écrire un mot correctement accentué, ==c'est l'assertion qui est fausse==.
- **Aucune dépendance nouvelle** hors outillage de test. Pas de routeur, pas de rendu markdown, pas de bibliothèque d'icônes.
- **Aucune ressource externe à l'exécution.** Polices et Pyodide servis depuis l'image.
- **Le code de l'élève ne quitte jamais son navigateur.**
- **Échelle typographique** : `0,82 / 0,94 / 1 / 1,15 / 1,4 / 2 / 2,6 rem`. Aucune taille hors échelle.
- **Rythme d'espacement** : `0,5 / 1 / 1,5 / 2 / 3 / 4 rem`.
- **Aucun emoji**, aucune icône importée : les symboles sont des SVG écrits à la main, trait 1,8.
- **Contrastes ≥ 4,5:1**, focus visible, cibles ≥ 44 px, `prefers-reduced-motion` respecté.
- **Chasse fixe réservée** au code, aux valeurs hexadécimales et aux identifiants.
- **Commits sans auto-attribution**, un par tâche, après validation humaine.

---

## Structure des fichiers

```
plateforme/
  outils/
    schema.py                     # + Lecon, BlocParagraphe, BlocCode, BlocAttention
    valider_contenu.py            # + verifier_lecon
    construire_contenu.py         # + publication des leçons, table NOTIONS
    tests/
      test_schema_lecon.py        # nouveau
      test_valider_lecon.py       # nouveau

  contenu/chapitre-1/seance-1/
    lecons/
      c1-afficher.yaml            # nouveaux
      c1-variables.yaml
      c1-types.yaml
      c1-saisie.yaml
    *.yaml                        # + champ `notion` sur chaque exercice

  web/src/
    routage.ts                    # analyser(), naviguer(), useRoute()
    contenu/
      types.ts                    # + Lecon, Bloc, Notion
      chargeur.ts                 # + chargerLecons()
    ui/
      texte.tsx                   # formaterTexte() — gras et code inline
      Menu.tsx / Menu.css
      PageCours.tsx / PageCours.css
      PageExercices.tsx / PageExercices.css
      BacASable.tsx               # bouton « Essayer » d'un bloc de code
      EcranExercice.tsx           # balisage seul, logique intacte
      app.css                     # réduit à l'ossature ; le reste part par composant
    app.tsx                       # coquille : menu + routage + alerte
  web/tests/
    routage.test.ts               # nouveau
    ui/texte.test.tsx             # nouveau
    ui/Menu.test.tsx              # nouveau
    ui/PageCours.test.tsx         # nouveau
    ui/PageExercices.test.tsx     # nouveau
    ui/EcranConnexion.test.tsx    # nouveau
    ui/app.test.tsx               # nouveau

  api/app/
    modeles.py                    # Agent -> Eleve, code_agent -> code_acces
    securite.py                   # jeton bati sur code_acces
    routes_eleve.py               # MOTIF_CODE -> ^DOJO-[A-Z0-9]{4}$
    routes_prof.py                # charge utile {"eleves": [...]}
    bdd.py                        # QG_BDD -> DOJO_BDD, qg.db -> dojo.db
  deploiement/
    docker-compose.yml            # QG_* -> DOJO_*
    Dockerfile.api
    Caddyfile
    .env                          # hors depot — a mettre a jour a la main

docs/vault/
  Accueil.md                      # ex-« Quartier Général »
  2-decisions/
    ADR-010 Abandon de la fiction narrative.md   # nouveau
    ADR-002 ...                   # amendee par un renvoi, jamais reecrite
  5-pedagogie/
    Bugs réels de la promotion 2025.md           # ex-« Archive des agents tombés »
```

**Frontières.** `routage.ts` et `texte.tsx` ne dépendent d'aucune API navigateur au-delà de
`history` : leur cœur est une fonction pure, testable sans DOM. Les composants de page ne
contiennent aucune logique de validation — ils affichent et délèguent.

**Ordre.** La tâche 1 passe en premier parce que tout le reste écrit du code qui emploie ce
vocabulaire. Les tâches 15 et 16 passent en dernier parce qu'elles sont longues, entièrement
rédactionnelles, et qu'elles ne bloquent rien : ==l'interface doit être debout avant qu'on écrive
25 énoncés dedans.==

---

## Tâche 1 : Retirer la fiction du code et de la base

La fiction ne vit pas que dans les textes : elle est le **nom d'une table**, celui d'une clé
étrangère, le préfixe du code que l'élève tape en premier, et celui de quatre variables
d'environnement. Tant qu'elle est là, chaque fichier touché la propage.

**Files:**
- Modify: `plateforme/api/app/modeles.py`, `securite.py`, `bdd.py`, `routes_eleve.py`, `routes_prof.py`
- Modify: `plateforme/api/tests/conftest.py` et les tests de l'API
- Modify: `plateforme/web/src/api/client.ts`, `src/app.tsx`, `src/ui/TableauDeBord.tsx`
- Modify: `plateforme/web/tests/api/client.test.ts`
- Modify: `plateforme/deploiement/docker-compose.yml`, `Dockerfile.api`, `Caddyfile`

**Interfaces:**
- Consumes: rien
- Produces: le vocabulaire que tout le reste du plan emploie — `Eleve`, `code_acces`, `DOJO-XXXX`

### La table de correspondance

| Aujourd'hui | Demain | Où |
|---|---|---|
| `class Agent`, table `agent` | `class Eleve`, table `eleve` | `modeles.py` |
| `code_agent` | `code_acces` | modèles, routes, JSON, front |
| `^AGENT-[A-Z0-9]{4}$` | `^DOJO-[A-Z0-9]{4}$` | `routes_eleve.py` |
| `agent_courant` | `eleve_courant` | dépendance FastAPI |
| `{"agents": [...]}` | `{"eleves": [...]}` | charge utile du tableau de bord |
| `codeAgent`, `LigneAgent` | `codeAcces`, `LigneEleve` | front |
| `QG_SECRET`, `QG_CODE_PROF`, `QG_BDD`, `QG_DOMAINE` | `DOJO_SECRET`, `DOJO_CODE_PROF`, `DOJO_BDD`, `DOJO_DOMAINE` | déploiement |
| `donnees/qg.db` | `donnees/dojo.db` | `bdd.py`, `Dockerfile.api` |

> [!danger] Le fichier `.env` n'est pas dans le dépôt
> `plateforme/deploiement/.env` est ignoré par git et contient le vrai secret de production.
> ==Renommer les variables sans le mettre à jour arrête les conteneurs au prochain démarrage==,
> avec un message `definir QG_SECRET dans .env` qui ne dira rien à personne dans six mois.
> Le Step 6 s'en occupe explicitement — ne le saute pas.

> [!note] La base peut être jetée
> Elle ne contient que trois codes de test créés pendant la vérification du palier 1
> (`AGENT-TEST`, `AGENT-RVW1`, `AGENT-TES2`) et 79 tentatives de recette. **Aucun élève, aucun code
> distribué** — la première séance est le 16 septembre. Pas de migration : on supprime le fichier
> et SQLModel recrée le schéma au démarrage.
>
> `Plan palier 1.md` garde ses anciens noms : c'est le compte rendu de ce qui a été construit à
> l'époque, pas une consigne. ==Le réécrire falsifierait l'historique.==

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `plateforme/api/tests/test_routes_eleve.py` :

```python
def test_un_code_au_nouveau_format_est_accepte(client):
    reponse = client.post("/api/session", json={"code_acces": "DOJO-K7M2"})
    assert reponse.status_code == 200
    assert reponse.json()["code_acces"] == "DOJO-K7M2"


def test_l_ancien_format_est_refuse(client):
    reponse = client.post("/api/session", json={"code_acces": "AGENT-K7M2"})
    assert reponse.status_code == 422


def test_le_champ_code_agent_n_existe_plus(client):
    reponse = client.post("/api/session", json={"code_agent": "DOJO-K7M2"})
    assert reponse.status_code == 422
```

Le dernier test vaut la peine d'être écrit : `model_config = ConfigDict(extra="forbid")` est déjà
posé sur `DemandeSession`, mais rien ne le vérifiait. ==Sans lui, un champ mal nommé passerait en
silence== et le code serait `None`.

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run : `cd plateforme/api && .venv/Scripts/python.exe -m pytest tests/test_routes_eleve.py -q`
Expected : FAIL — `code_acces` est un champ inconnu, `AGENT-K7M2` est encore accepté

- [ ] **Step 3 : Renommer côté API**

Applique la table de correspondance à `modeles.py`, `securite.py`, `bdd.py`, `routes_eleve.py`,
`routes_prof.py` et aux tests. Trois pièges :

1. `Tentative.code_acces` déclare `foreign_key="eleve.code_acces"` — ==la chaîne de la clé
   étrangère doit changer aussi==, elle n'est pas dérivée du nom de classe.
2. Les docstrings portent la fiction : `"""Jetons de session. Pas de mot de passe : le code
   d'agent EST le secret."""` devient `« le code d'accès EST le secret »`.
3. `securite.py` mentionne `AGENT-XXXX` dans un commentaire qui explique *pourquoi* aucun secret
   n'est en dur. Garde le raisonnement, change l'exemple.

- [ ] **Step 4 : Renommer côté front**

`client.ts` porte le message d'erreur que lit l'élève :

```ts
      throw new Error("Ce code d'accès n'est pas reconnu. Vérifie qu'il est de la forme DOJO-XXXX.")
```

`app.tsx` : `codeAgent` → `codeAcces`. `TableauDeBord.tsx` : `LigneAgent` → `LigneEleve`,
`donnees.agents` → `donnees.eleves`, et le compteur `{agents.length} agents connectés` devient
`{eleves.length} élèves connectés`.

- [ ] **Step 5 : Renommer les variables d'environnement**

Dans `docker-compose.yml`, `Dockerfile.api` et `Caddyfile`, `QG_` devient `DOJO_`. Le message
d'erreur du compose (`definir QG_SECRET dans .env`) suit.

- [ ] **Step 6 : Mettre à jour le `.env` local — hors dépôt**

```bash
sed -i 's/^QG_/DOJO_/' plateforme/deploiement/.env
cat plateforme/deploiement/.env
```

==Vérifie que les valeurs sont intactes== : seul le préfixe des clés change. Si ce fichier n'est
pas mis à jour, `docker compose up` refusera de démarrer.

Il existe probablement un `.env` équivalent sur le serveur UNIGE : note-le pour le déploiement,
il faudra y passer le même `sed`.

- [ ] **Step 7 : Jeter la base**

```bash
docker compose -f plateforme/deploiement/docker-compose.yml down -v
rm -f plateforme/api/donnees/qg.db
```

`down -v` supprime le volume `donnees` — c'est ce qui porte la vraie base servie par le conteneur.

- [ ] **Step 8 : Lancer tous les tests**

```bash
cd plateforme/api && .venv/Scripts/python.exe -m pytest -q
cd ../web && pnpm test
```

Expected : les 27 tests de l'API et les 66 du front passent. ==Aucun ne doit être supprimé pour
faire passer le renommage== : un test qui ne peut plus être écrit signale un comportement perdu.

- [ ] **Step 9 : Vérifier qu'il ne reste rien**

```bash
grep -rn "code_agent\|AGENT-\|codeAgent\|LigneAgent\|QG_\|qg\.db"   plateforme/api/app plateforme/api/tests plateforme/web/src plateforme/web/tests   plateforme/deploiement --include='*' | grep -v node_modules | grep -v '\.venv'
```

Expected : aucune ligne. Le mot « agent » peut subsister dans une phrase française légitime —
relis chaque occurrence plutôt que de supprimer en masse.

- [ ] **Step 10 : Vérifier dans le conteneur**

```bash
docker compose -f plateforme/deploiement/docker-compose.yml up -d --build
```

Se connecter avec `DOJO-TEST` : la session s'ouvre. Réessayer `AGENT-TEST` : le message d'erreur
parle bien de « code d'accès » et de la forme `DOJO-XXXX`.

- [ ] **Step 11 : Faire valider, puis commiter**

```bash
git add plateforme/api plateforme/web plateforme/deploiement
git commit -m "refactor: le code d'acces devient DOJO-XXXX, l'agent devient un eleve"
```

---

## Tâche 2 : Mesurer la couverture avant d'écrire du code

Le seuil doit exister **avant** le premier module, sinon il n'est jamais atteint.

**Files:**
- Modify: `plateforme/web/vitest.config.ts`
- Modify: `plateforme/web/package.json`
- Create: `plateforme/outils/pytest.ini`
- Modify: `plateforme/outils/requirements.txt`

**Interfaces:**
- Consumes: rien
- Produces: `pnpm test:couverture` et `pytest --cov` avec des seuils qui font échouer la commande

- [ ] **Step 1 : Installer les outils**

```bash
cd plateforme/web && pnpm add -D @vitest/coverage-v8
cd ../outils && .venv/Scripts/python.exe -m pip install pytest-cov
```

- [ ] **Step 2 : Configurer le seuil côté front**

`plateforme/web/vitest.config.ts` — remplacer le bloc `test` :

```ts
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/preparation.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      // Exclus : le worker (testé en navigateur, pas en jsdom), le point
      // d'entrée, et les définitions de types qui ne contiennent aucun code.
      exclude: ['src/main.tsx', 'src/execution/worker.ts', 'src/**/types.ts'],
      thresholds: {
        // Les modules de logique pure : rien ne justifie une ligne non couverte.
        'src/validation/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/routage.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/ui/texte.tsx': { statements: 100, branches: 100, functions: 100, lines: 100 },
        // Plancher global : les composants sont testés sur leur comportement,
        // pas ligne à ligne.
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
```

Ajouter dans `package.json` : `"test:couverture": "vitest run --coverage"`.

- [ ] **Step 3 : Configurer le seuil côté Python**

`plateforme/outils/pytest.ini` :

```ini
[pytest]
pythonpath = .
addopts = --cov=. --cov-report=term-missing --cov-fail-under=95
[coverage:run]
omit = tests/*, .venv/*
```

Ajouter `pytest-cov>=5.0` à `requirements.txt`.

- [ ] **Step 4 : Constater l'état de départ**

Run : `cd plateforme/web && pnpm test:couverture`
Expected : la commande **échoue** sur les seuils — c'est normal, elle mesure du code écrit avant
que les seuils n'existent. Note les chiffres obtenus, ils servent de point de départ.

Run : `cd plateforme/outils && .venv/Scripts/python.exe -m pytest -q`
Expected : couverture affichée ; note si elle passe 95 %.

- [ ] **Step 5 : Ajuster les seuils globaux au réel, sans toucher aux 100 %**

Si le plancher global de 80 % n'est pas atteint aujourd'hui, abaisse-le à la valeur mesurée
**arrondie à l'entier inférieur**, et note-la. ==Les seuils à 100 % sur les modules de logique
ne bougent pas== : s'ils échouent, c'est qu'il manque des tests, et c'est le travail des tâches
suivantes de les écrire.

- [ ] **Step 6 : Faire valider, puis commiter**

Montre les chiffres de couverture. Après accord :

```bash
git add plateforme/web/vitest.config.ts plateforme/web/package.json plateforme/web/pnpm-lock.yaml plateforme/outils/pytest.ini plateforme/outils/requirements.txt
git commit -m "chore: mesurer la couverture et poser des seuils qui font echouer la construction"
```

---

## Tâche 3 : Le schéma d'une leçon

**Files:**
- Modify: `plateforme/outils/schema.py`
- Test: `plateforme/outils/tests/test_schema_lecon.py`

**Interfaces:**
- Consumes: `MOTIF_EMOJI` (existant dans `schema.py`)
- Produces: `Lecon`, `BlocParagraphe`, `BlocCode`, `BlocAttention`, `charger_lecon(chemin)`, `charger_lecons(racine)`

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/outils/tests/test_schema_lecon.py` :

```python
import pytest
from pydantic import ValidationError

from schema import BlocCode, BlocParagraphe, Lecon


def lecon_minimale(**remplacements):
    base = dict(
        id="c1-variables",
        notion="variables",
        ordre=2,
        titre="Les variables",
        duree_min=3,
        blocs=[
            {"type": "paragraphe", "texte": "Une variable est une **boite** nommee."},
            {"type": "code", "legende": "Ranger une valeur", "python": 'nom = "Camille"'},
        ],
    )
    base.update(remplacements)
    return base


def test_lecon_valide_se_charge():
    lecon = Lecon(**lecon_minimale())
    assert lecon.id == "c1-variables"
    assert isinstance(lecon.blocs[0], BlocParagraphe)
    assert isinstance(lecon.blocs[1], BlocCode)
    assert lecon.blocs[1].executable is False


def test_notion_inconnue_rejetee():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(notion="algebre"))


def test_identifiant_mal_forme_rejete():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(id="lecon 1"))


def test_liste_de_blocs_vide_rejetee():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[]))


def test_bloc_vide_rejete():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[{"type": "paragraphe", "texte": "   "}]))


def test_bloc_de_type_inconnu_rejete():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[{"type": "video", "url": "..."}]))


def test_emoji_rejete_dans_un_paragraphe():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[{"type": "paragraphe", "texte": "Bravo ✅"}]))


def test_getpass_rejete_dans_un_bloc_de_code():
    with pytest.raises(ValidationError):
        Lecon(
            **lecon_minimale(
                blocs=[{"type": "code", "legende": "x", "python": "import getpass"}]
            )
        )


def test_bloc_attention_se_charge():
    lecon = Lecon(**lecon_minimale(blocs=[{"type": "attention", "texte": "Le signe = range."}]))
    assert lecon.blocs[0].type == "attention"


def test_bloc_de_code_executable():
    lecon = Lecon(
        **lecon_minimale(
            blocs=[{"type": "code", "legende": "x", "python": "print(1)", "executable": True}]
        )
    )
    assert lecon.blocs[0].executable is True
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run : `cd plateforme/outils && .venv/Scripts/python.exe -m pytest tests/test_schema_lecon.py -q`
Expected : FAIL — `ImportError: cannot import name 'Lecon'`

- [ ] **Step 3 : Écrire le schéma**

Ajouter à la fin de `plateforme/outils/schema.py` :

```python
MOTIF_LECON = re.compile(r"^c[123]-[a-z]+$")

# Les quatre notions de la seance 1. Une notion est l'unite de navigation :
# elle porte une lecon et un groupe d'exercices. Voir la note « Specification
# interface » du coffre — la couleur suit la notion, plus le concept.
#
# SEULE SOURCE de cette table : le schema la valide, construire_contenu.py
# l'importe pour publier, et le front la lit dans le JSON publie. Personne ne
# la recopie.
NOTIONS: dict[str, dict[str, object]] = {
    "afficher": {"ordre": 1, "titre": "Afficher un message", "famille": "conditions"},
    "variables": {"ordre": 2, "titre": "Les variables", "famille": "variables"},
    "types": {"ordre": 3, "titre": "Types et conversion", "famille": "types"},
    "saisie": {"ordre": 4, "titre": "Demander une information", "famille": "operateurs"},
}


def _sans_emoji(valeur: str) -> str:
    if MOTIF_EMOJI.search(valeur):
        raise ValueError("aucun emoji dans le contenu")
    return valeur


class BlocParagraphe(BaseModel):
    type: Literal["paragraphe"]
    texte: str = Field(min_length=1)

    @field_validator("texte")
    @classmethod
    def non_vide_et_sans_emoji(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("paragraphe vide")
        return _sans_emoji(v)


class BlocAttention(BaseModel):
    type: Literal["attention"]
    texte: str = Field(min_length=1)

    @field_validator("texte")
    @classmethod
    def non_vide_et_sans_emoji(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("bloc attention vide")
        return _sans_emoji(v)


class BlocCode(BaseModel):
    type: Literal["code"]
    legende: str = Field(min_length=1)
    python: str = Field(min_length=1)
    executable: bool = False

    @field_validator("python")
    @classmethod
    def code_utilisable(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("bloc de code vide")
        if "getpass" in v:
            raise ValueError("getpass est impossible sous Pyodide")
        return _sans_emoji(v)


BlocLecon = Annotated[
    Union[BlocParagraphe, BlocAttention, BlocCode], Field(discriminator="type")
]


class Lecon(BaseModel):
    id: str
    notion: Literal[tuple(NOTIONS)]  # type: ignore[valid-type]
    ordre: int = Field(ge=1, le=9)
    titre: str = Field(min_length=1)
    duree_min: int = Field(ge=1, le=30)
    blocs: list[BlocLecon] = Field(min_length=1)

    @field_validator("id")
    @classmethod
    def identifiant_bien_forme(cls, v: str) -> str:
        if not MOTIF_LECON.match(v):
            raise ValueError(f"identifiant de lecon invalide : {v!r} (attendu c1-variables)")
        return v


def charger_lecon(chemin: Path) -> Lecon:
    return Lecon(**yaml.safe_load(chemin.read_text(encoding="utf-8")))


def charger_lecons(racine: Path) -> list[Lecon]:
    lecons = [charger_lecon(p) for p in sorted(racine.rglob("*.yaml"))]
    return sorted(lecons, key=lambda l: l.ordre)
```

> [!warning] `Literal[tuple(NOTIONS)]`
> Pydantic accepte un `Literal` construit depuis un tuple de constantes, mais les vérificateurs
> de types s'en plaignent — d'où le `# type: ignore`. Si ta version de Python refuse cette forme,
> écris les quatre valeurs à la main dans le `Literal`, et ==ajoute un test qui vérifie que le
> `Literal` et les clés de `NOTIONS` coïncident== : deux listes écrites à la main divergeront.

Vérifie que `Annotated`, `Union`, `Literal`, `field_validator`, `Path` et `yaml` sont déjà importés
en tête de `schema.py` — ils le sont pour les exercices.

- [ ] **Step 4 : Lancer le test pour le voir passer**

Run : `.venv/Scripts/python.exe -m pytest tests/test_schema_lecon.py -q`
Expected : PASS — 10 tests

- [ ] **Step 5 : Vérifier que rien n'a cassé**

Run : `.venv/Scripts/python.exe -m pytest -q`
Expected : les 38 tests précédents passent, plus les 10 nouveaux

- [ ] **Step 6 : Faire valider, puis commiter**

```bash
git add plateforme/outils/schema.py plateforme/outils/tests/test_schema_lecon.py
git commit -m "feat: schema d'une lecon, blocs types et validation"
```

---

## Tâche 4 : Vérifier qu'une leçon tourne

Une leçon dont l'exemple plante est aussi grave qu'un exercice dont la solution échoue : l'élève
recopie un code qui ne marche pas.

**Files:**
- Modify: `plateforme/outils/valider_contenu.py`
- Test: `plateforme/outils/tests/test_valider_lecon.py`

**Interfaces:**
- Consumes: `_executer` (existant), `Lecon`, `BlocCode`, `charger_lecons`
- Produces: `verifier_lecon(lecon: Lecon) -> list[str]`

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/outils/tests/test_valider_lecon.py` :

```python
from schema import Lecon
from valider_contenu import verifier_lecon


def lecon(blocs):
    return Lecon(
        id="c1-variables",
        notion="variables",
        ordre=2,
        titre="Les variables",
        duree_min=3,
        blocs=blocs,
    )


def test_lecon_dont_les_exemples_tournent_ne_remonte_rien():
    assert verifier_lecon(
        lecon([{"type": "code", "legende": "x", "python": 'nom = "Camille"\nprint(nom)'}])
    ) == []


def test_exemple_qui_plante_est_signale():
    problemes = verifier_lecon(
        lecon([{"type": "code", "legende": "x", "python": "print(inexistant)"}])
    )
    assert len(problemes) == 1
    assert "c1-variables" in problemes[0]
    assert "NameError" in problemes[0]


def test_chaque_bloc_fautif_est_signale_separement():
    problemes = verifier_lecon(
        lecon(
            [
                {"type": "code", "legende": "a", "python": "print(pasla)"},
                {"type": "paragraphe", "texte": "Texte."},
                {"type": "code", "legende": "b", "python": "1/0"},
            ]
        )
    )
    assert len(problemes) == 2


def test_les_blocs_non_code_sont_ignores():
    assert verifier_lecon(
        lecon([{"type": "paragraphe", "texte": "Une variable est une boite."}])
    ) == []


def test_un_exemple_qui_attend_une_saisie_est_signale():
    """Une lecon n'a pas d'entrees simulees : input() y est toujours une erreur."""
    problemes = verifier_lecon(
        lecon([{"type": "code", "legende": "x", "python": 'nom = input("Nom : ")'}])
    )
    assert len(problemes) == 1
    assert "EOFError" in problemes[0]


def test_une_lecon_ne_peut_pas_utiliser_une_notion_enseignee_apres_elle():
    """La lecon 1 parle d'affichage : elle n'a pas encore le droit aux variables."""
    problemes = verifier_lecon(
        Lecon(
            id="c1-afficher",
            notion="afficher",
            ordre=1,
            titre="Afficher un message",
            duree_min=3,
            blocs=[{"type": "code", "legende": "x", "python": 'nom = "Camille"\nprint(nom)'}],
        )
    )
    assert len(problemes) == 1
    assert "variables" in problemes[0]


def test_une_lecon_peut_utiliser_une_notion_deja_enseignee():
    assert verifier_lecon(
        lecon([{"type": "code", "legende": "x", "python": 'nom = "Camille"\nprint(nom)'}])
    ) == []
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run : `.venv/Scripts/python.exe -m pytest tests/test_valider_lecon.py -q`
Expected : FAIL — `ImportError: cannot import name 'verifier_lecon'`

- [ ] **Step 3 : Écrire la vérification**

Ajouter à `plateforme/outils/valider_contenu.py`, après `verifier_coherence` :

```python
# Ce qui trahit une notion dans un exemple de code. Une lecon d'ordre N ne peut
# utiliser que les notions d'ordre <= N : montrer une variable dans la lecon
# « Afficher un message » demande a l'eleve de comprendre ce qu'il n'a pas
# encore vu. Le motif est volontairement grossier — il attrape les cas
# evidents, ce qui suffit pour quatre lecons relues a la main.
MOTIFS_NOTION = {
    "variables": re.compile(r"^\s*[a-z_][a-z0-9_]*\s*=(?!=)", re.MULTILINE),
    "types": re.compile(r"\b(?:int|float|str)\s*\(|\bf[\"']"),
    "saisie": re.compile(r"\binput\s*\("),
}


def verifier_lecon(lecon: Lecon) -> list[str]:
    """Chaque exemple de code d'une lecon doit tourner, et rester dans sa notion.

    Une lecon ne fournit aucune entree simulee : un exemple qui appelle input()
    leve EOFError et sera signale, ce qui est voulu. Un exemple de lecon se lit
    et se rejoue tel quel, il ne pose pas de question.
    """
    problemes: list[str] = []
    for bloc in lecon.blocs:
        if not isinstance(bloc, BlocCode):
            continue

        for notion, motif in MOTIFS_NOTION.items():
            if NOTIONS[notion]["ordre"] > lecon.ordre and motif.search(bloc.python):
                problemes.append(
                    f"{lecon.id} : l'exemple {bloc.legende!r} utilise la notion "
                    f"{notion!r}, enseignee apres celle-ci"
                )

        _, _, erreur = _executer(bloc.python, [])
        if erreur:
            problemes.append(f"{lecon.id} : l'exemple {bloc.legende!r} plante ({erreur})")
    return problemes
```

Compléter l'import en tête du fichier :

```python
from schema import (
    MOTIF_EMOJI,
    NOTIONS,
    BlocCode,
    Exercice,
    Lecon,
    TestMotif,
    TestSortie,
    TestVariable,
    charger_lecons,
    charger_tous,
)
```

> [!note] Pourquoi la notion `afficher` n'est pas dans `MOTIFS_NOTION`
> Elle est d'ordre 1 : sa condition `ordre > lecon.ordre` ne peut jamais être vraie. Une entrée
> pour elle serait du code mort.

- [ ] **Step 4 : Lancer les tests**

Run : `.venv/Scripts/python.exe -m pytest -q`
Expected : PASS — les 48 précédents plus les 7 nouveaux

- [ ] **Step 5 : Brancher la vérification sur la ligne de commande**

Dans `principal()` de `valider_contenu.py`, après le chargement des exercices :

```python
    dossier_lecons = arguments.racine / "seance-1" / "lecons"
    lecons = charger_lecons(dossier_lecons) if dossier_lecons.is_dir() else []
    for lecon in lecons:
        problemes += verifier_lecon(lecon)
    print(f"{len(lecons)} lecons chargees.")
```

- [ ] **Step 6 : Faire valider, puis commiter**

```bash
git add plateforme/outils
git commit -m "feat: une lecon dont l'exemple plante fait echouer la validation"
```

---

## Tâche 5 : Rattacher chaque exercice à une notion, publier les leçons

**Files:**
- Modify: `plateforme/outils/schema.py` (champ `notion` sur `Exercice`)
- Modify: `plateforme/outils/construire_contenu.py`
- Modify: les 25 fichiers de `plateforme/contenu/chapitre-1/seance-1/`
- Test: `plateforme/outils/tests/test_construire_contenu.py`

**Interfaces:**
- Consumes: `charger_tous`, `charger_lecons`, `verifier_coherence`, `verifier_lecon`
- Produces: `seance-1.json` (exercices, chacun avec `notion` et `famille`), `seance-1-lecons.json`,
  et `seance-1-notions.json` — la table des notions, ==publiée pour que le front n'ait pas à la
  recopier==

> [!important] Pourquoi publier la table des notions
> Le menu a besoin du titre affiché et de la couleur de chaque notion. Si le TypeScript porte sa
> propre copie de cette table, elle diverge de la version Python au premier changement de libellé.
> Une seule source — les fichiers YAML et la table Python — publiée en JSON comme le reste du
> contenu. Zéro duplication.

> [!danger] La table `FAMILLES` disparaît
> Elle mappait `print → variables` et `input → types` : la séance 1 n'aurait affiché que
> **deux couleurs pour quatre notions**. La couleur suit désormais la notion.
> Voir [[Spécification interface]], section 3.

- [ ] **Step 1 : Ajouter le champ `notion` au schéma d'exercice**

Dans `plateforme/outils/schema.py`, classe `Exercice`, après `concept` :

```python
    notion: Literal[tuple(NOTIONS)]  # type: ignore[valid-type]
```

- [ ] **Step 2 : Renseigner la notion des 25 exercices**

Le concept ne suffit pas à déduire la notion : `s1-29` et `s1-30` portent le concept `conversion`
mais appartiennent à la notion `saisie`. La table est donc explicite.

```bash
cd plateforme/outils
.venv/Scripts/python.exe - <<'EOF'
from pathlib import Path
from ruamel.yaml import YAML

NOTION_PAR_ID = {
    **{f"s1-0{n}": "afficher" for n in (1, 2, 3, 4, 5, 6, 7)},
    **{i: "variables" for i in ("s1-09", "s1-10", "s1-11", "s1-12", "s1-13", "s1-14")},
    **{i: "types" for i in ("s1-19", "s1-20", "s1-21", "s1-22", "s1-23", "s1-24")},
    **{i: "saisie" for i in ("s1-27", "s1-28", "s1-29", "s1-30", "s1-31", "s1-34")},
}

y = YAML(); y.preserve_quotes = True; y.width = 4096
y.indent(mapping=2, sequence=4, offset=2)

for chemin in sorted(Path("../contenu/chapitre-1/seance-1").glob("*.yaml")):
    d = y.load(chemin.read_text(encoding="utf-8"))
    if "notion" in d:
        continue
    d.insert(list(d.keys()).index("concept") + 1, "notion", NOTION_PAR_ID[d["id"]])
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        y.dump(d, f)
print(f"{len(NOTION_PAR_ID)} exercices rattaches")
EOF
```

Vérifie ensuite `git diff` : **seule** la ligne `notion:` doit avoir été ajoutée à chaque fichier.
Si l'indentation d'autres lignes a bougé, arrête-toi et signale-le — c'est le défaut que
`_yaml.indent(...)` est censé empêcher ([[Pièges et invariants]]).

- [ ] **Step 3 : Écrire le test de publication**

Ajouter à `plateforme/outils/tests/test_construire_contenu.py` :

```python
def test_la_notion_donne_la_famille_de_couleur(tmp_path):
    donnees = dict(BASE, notion="saisie")
    _ecrire(tmp_path / "seance-1", donnees)
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    exercice = json.loads((sortie / "seance-1.json").read_text(encoding="utf-8"))[0]
    assert exercice["notion"] == "saisie"
    assert exercice["famille"] == "operateurs"


def test_les_lecons_sont_publiees(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE, notion="variables"))
    dossier = tmp_path / "seance-1" / "lecons"
    dossier.mkdir(parents=True)
    (dossier / "c1-variables.yaml").write_text(
        yaml.safe_dump(
            {
                "id": "c1-variables",
                "notion": "variables",
                "ordre": 2,
                "titre": "Les variables",
                "duree_min": 3,
                "blocs": [{"type": "paragraphe", "texte": "Une boite nommee."}],
            },
            allow_unicode=True,
        ),
        encoding="utf-8",
    )
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    lecons = json.loads((sortie / "seance-1-lecons.json").read_text(encoding="utf-8"))
    assert len(lecons) == 1
    assert lecons[0]["titre"] == "Les variables"
    assert lecons[0]["famille"] == "variables"
    assert lecons[0]["blocs"][0]["type"] == "paragraphe"


def test_une_lecon_dont_l_exemple_plante_arrete_la_construction(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE, notion="variables"))
    dossier = tmp_path / "seance-1" / "lecons"
    dossier.mkdir(parents=True)
    (dossier / "c1-variables.yaml").write_text(
        yaml.safe_dump(
            {
                "id": "c1-variables",
                "notion": "variables",
                "ordre": 2,
                "titre": "Les variables",
                "duree_min": 3,
                "blocs": [{"type": "code", "legende": "x", "python": "print(pasla)"}],
            },
            allow_unicode=True,
        ),
        encoding="utf-8",
    )
    with pytest.raises(SystemExit):
        construire(tmp_path, tmp_path / "sortie")


def test_la_table_des_notions_est_publiee(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE, notion="types"))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    notions = json.loads((sortie / "seance-1-notions.json").read_text(encoding="utf-8"))
    assert [n["id"] for n in notions] == ["afficher", "variables", "types", "saisie"]
    assert notions[2] == {
        "id": "types",
        "ordre": 3,
        "titre": "Types et conversion",
        "famille": "types",
    }
```

Ajouter `notion="afficher"` au dictionnaire `BASE` du fichier de test.

- [ ] **Step 4 : Lancer les tests pour les voir échouer**

Run : `.venv/Scripts/python.exe -m pytest tests/test_construire_contenu.py -q`
Expected : FAIL — `seance-1-lecons.json` n'existe pas, et `famille` vaut encore autre chose

- [ ] **Step 5 : Réécrire la publication**

Dans `plateforme/outils/construire_contenu.py`, ==supprimer la table `FAMILLES`== et importer
celle du schéma — elle n'existe qu'à un seul endroit :

```python
from schema import NOTIONS, charger_lecons, charger_tous
```

La couleur suit désormais la notion, pas le concept : sinon la séance 1 n'afficherait que deux
couleurs pour quatre notions. Les clés de palette gardent leurs noms historiques (`variables`,
`types`, `operateurs`, `conditions`) — ce sont des noms de couleur, pas de sens.

Puis, dans `construire`, remplacer la construction des `publiables` et ajouter les leçons :

```python
        publiables = [
            {
                **_convertir_cles(ex.model_dump(exclude={"solution"})),
                "famille": NOTIONS[ex.notion]["famille"],
            }
            for ex in exercices
            if ex.seance == seance
        ]
        if publiables:
            (sortie / f"seance-{seance}.json").write_text(
                json.dumps(publiables, ensure_ascii=False, indent=2), encoding="utf-8"
            )

        dossier_lecons = racine / f"seance-{seance}" / "lecons"
        if dossier_lecons.is_dir():
            lecons = charger_lecons(dossier_lecons)
            problemes_lecons: list[str] = []
            for lecon in lecons:
                problemes_lecons += verifier_lecon(lecon)
            if problemes_lecons:
                for p in problemes_lecons:
                    print(f"  PROBLEME  {p}", file=sys.stderr)
                raise SystemExit(f"{len(problemes_lecons)} probleme(s) de lecon.")
            (sortie / f"seance-{seance}-lecons.json").write_text(
                json.dumps(
                    [
                        {
                            **_convertir_cles(l.model_dump()),
                            "famille": NOTIONS[l.notion]["famille"],
                        }
                        for l in lecons
                    ],
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
```

Compléter l'import de validation : `from valider_contenu import verifier_coherence, verifier_lecon`.

Enfin, publier la table elle-même, après la boucle sur les séances :

```python
    # Publiee telle quelle pour que le front n'ait pas a la recopier : titre
    # affiche et couleur du menu viennent d'ici, et de nulle part ailleurs.
    (sortie / "seance-1-notions.json").write_text(
        json.dumps(
            [
                {"id": identifiant, **details}
                for identifiant, details in sorted(
                    NOTIONS.items(), key=lambda paire: paire[1]["ordre"]
                )
            ],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
```

- [ ] **Step 6 : Lancer les tests**

Run : `.venv/Scripts/python.exe -m pytest -q`
Expected : PASS, couverture au-dessus du seuil

- [ ] **Step 7 : Reconstruire le contenu réel et vérifier**

```bash
.venv/Scripts/python.exe valider_contenu.py ../contenu/chapitre-1
.venv/Scripts/python.exe construire_contenu.py ../contenu/chapitre-1 ../web/public/contenu
```

Expected : `25 exercices charges.` `0 lecons chargees.` `Contenu valide.`
Vérifie dans `seance-1.json` que les quatre notions apparaissent et que `famille` prend bien
quatre valeurs distinctes.

- [ ] **Step 8 : Faire valider, puis commiter**

```bash
git add plateforme/outils plateforme/contenu plateforme/web/public/contenu
git commit -m "feat: la couleur suit la notion, et les lecons sont publiees"
```

---

## Tâche 6 : Les quatre leçons de la séance 1

**Files:**
- Create: `plateforme/contenu/chapitre-1/seance-1/lecons/c1-afficher.yaml`
- Create: `plateforme/contenu/chapitre-1/seance-1/lecons/c1-variables.yaml`
- Create: `plateforme/contenu/chapitre-1/seance-1/lecons/c1-types.yaml`
- Create: `plateforme/contenu/chapitre-1/seance-1/lecons/c1-saisie.yaml`

**Interfaces:**
- Consumes: le schéma `Lecon` de la tâche 2
- Produces: le contenu que la page Cours affichera

**Règles de rédaction.** Trois minutes de lecture au maximum. Tutoiement, phrases courtes, aucun
jargon anglais non expliqué. ==Aucune fiction== : pas d'agents, pas de Quartier Général. Chaque
exemple de code doit tourner seul — pas d'`input()` dans une leçon. Une notion n'utilise que ce
qui a été enseigné avant elle.

- [ ] **Step 1 : Écrire la leçon « Les variables », qui sert de modèle**

`plateforme/contenu/chapitre-1/seance-1/lecons/c1-variables.yaml` :

```yaml
id: c1-variables
notion: variables
ordre: 2
titre: Les variables
duree_min: 3
blocs:
  - type: paragraphe
    texte: >-
      Une variable, c'est une **boîte avec une étiquette**. Tu écris un nom
      dessus, tu ranges une valeur dedans, et tu la ressors quand tu en as besoin.
  - type: paragraphe
    texte: >-
      Le nom te sert à retrouver la valeur plus loin dans le programme, sans
      avoir à la réécrire.
  - type: code
    legende: Ranger puis ressortir
    executable: true
    python: |
      prenom = "Camille"
      age = 16

      print(prenom)
      print(age)
  - type: paragraphe
    texte: >-
      Ranger une nouvelle valeur dans la même boîte **efface l'ancienne**. La
      boîte ne garde qu'une seule valeur à la fois.
  - type: code
    legende: La deuxième valeur remplace la première
    executable: true
    python: |
      score = 10
      score = 25

      print(score)
  - type: attention
    texte: >-
      Le signe `=` ne veut pas dire « est égal à ». Il veut dire « range la
      valeur de droite dans la boîte de gauche ». C'est pour ça que
      `score = score + 1` a du sens en Python, alors que c'est impossible en
      mathématiques.
```

- [ ] **Step 2 : Vérifier qu'elle passe la validation**

Run : `cd plateforme/outils && .venv/Scripts/python.exe valider_contenu.py ../contenu/chapitre-1`
Expected : `1 lecons chargees.` `Contenu valide.`

Si un exemple plante, c'est l'exemple qu'il faut corriger, jamais la vérification.

- [ ] **Step 3 : Écrire les trois autres leçons**

Sur le même modèle, en respectant l'ordre d'enseignement :

| Fichier | ordre | Contenu attendu |
|---|---|---|
| `c1-afficher.yaml` | 1 | `print()`, les guillemets qui ne s'affichent pas, la virgule qui insère une espace, l'ordre des lignes |
| `c1-types.yaml` | 3 | `int` / `float` / `str`, le `+` qui n'a pas le même effet selon le type, `str()` pour convertir, le f-string |
| `c1-saisie.yaml` | 4 | `input()` qui rend toujours du texte, l'invite en argument, `int(input())` |

`c1-afficher` ne peut utiliser aucune variable — elle est enseignée à la notion 2.
`c1-saisie` ne met **aucun** `input()` dans un bloc `executable: true` : sans entrée simulée, il
lève `EOFError` et la validation le refuse. Montre-le en bloc `code` non exécutable, avec la
sortie attendue en commentaire.

- [ ] **Step 4 : Valider les quatre**

Run : `.venv/Scripts/python.exe valider_contenu.py ../contenu/chapitre-1`
Expected : `4 lecons chargees.` `Contenu valide.`

- [ ] **Step 5 : Construire et vérifier le JSON publié**

```bash
.venv/Scripts/python.exe construire_contenu.py ../contenu/chapitre-1 ../web/public/contenu
```

Vérifie que `seance-1-lecons.json` contient quatre leçons, dans l'ordre 1 à 4, chacune avec sa
`famille`.

- [ ] **Step 6 : Faire valider le contenu pédagogique, puis commiter**

==C'est une étape où la relecture humaine compte plus que les tests.== Montre les quatre leçons
et demande une relecture de fond avant de commiter.

```bash
git add plateforme/contenu plateforme/web/public/contenu
git commit -m "feat: les quatre lecons de la seance 1"
```

---

## Tâche 7 : Le routage

**Files:**
- Create: `plateforme/web/src/routage.ts`
- Test: `plateforme/web/tests/routage.test.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  - `type Destination = {vue:'connexion'} | {vue:'cours', notion:string} | {vue:'exercices', notion:string} | {vue:'exercice', notion:string, numero:number} | {vue:'inconnue'}`
  - `analyser(chemin: string): Destination`
  - `versChemin(d: Destination): string`
  - `naviguer(d: Destination): void`
  - `useRoute(): Destination`

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/web/tests/routage.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { analyser, versChemin } from '../src/routage'

describe('analyser', () => {
  it('reconnait la racine comme la connexion', () => {
    expect(analyser('/')).toEqual({ vue: 'connexion' })
    expect(analyser('')).toEqual({ vue: 'connexion' })
  })

  it('reconnait une page de cours', () => {
    expect(analyser('/variables/cours')).toEqual({ vue: 'cours', notion: 'variables' })
  })

  it('reconnait une liste d exercices', () => {
    expect(analyser('/types/exercices')).toEqual({ vue: 'exercices', notion: 'types' })
  })

  it('reconnait un exercice', () => {
    expect(analyser('/saisie/exercices/12')).toEqual({
      vue: 'exercice',
      notion: 'saisie',
      numero: 12,
    })
  })

  it('tolere une barre finale', () => {
    expect(analyser('/variables/cours/')).toEqual({ vue: 'cours', notion: 'variables' })
  })

  it('accepte tout identifiant de notion bien forme', () => {
    // Le routeur ne connait pas le vocabulaire des notions : c'est le contenu
    // publie qui le porte. Une notion absente donne une page « introuvable ».
    expect(analyser('/algebre/cours')).toEqual({ vue: 'cours', notion: 'algebre' })
  })

  it('rejette un identifiant de notion mal forme', () => {
    expect(analyser('/Variables/cours')).toEqual({ vue: 'inconnue' })
    expect(analyser('/var1/cours')).toEqual({ vue: 'inconnue' })
    expect(analyser('/a/cours')).toEqual({ vue: 'inconnue' })
  })

  it('rejette un numero non numerique', () => {
    expect(analyser('/saisie/exercices/abc')).toEqual({ vue: 'inconnue' })
  })

  it('rejette un numero hors bornes', () => {
    expect(analyser('/saisie/exercices/0')).toEqual({ vue: 'inconnue' })
    expect(analyser('/saisie/exercices/999')).toEqual({ vue: 'inconnue' })
  })

  it('rejette un chemin trop long', () => {
    expect(analyser('/variables/cours/en/trop')).toEqual({ vue: 'inconnue' })
  })

  it('rejette une page inconnue dans une notion connue', () => {
    expect(analyser('/variables/revision')).toEqual({ vue: 'inconnue' })
  })
})

describe('versChemin', () => {
  it('reconstruit chaque destination', () => {
    expect(versChemin({ vue: 'connexion' })).toBe('/')
    expect(versChemin({ vue: 'cours', notion: 'variables' })).toBe('/variables/cours')
    expect(versChemin({ vue: 'exercices', notion: 'types' })).toBe('/types/exercices')
    expect(versChemin({ vue: 'exercice', notion: 'saisie', numero: 12 })).toBe(
      '/saisie/exercices/12',
    )
    expect(versChemin({ vue: 'inconnue' })).toBe('/')
  })

  it('fait l aller-retour sans perte', () => {
    for (const chemin of ['/', '/variables/cours', '/types/exercices', '/saisie/exercices/12']) {
      expect(versChemin(analyser(chemin))).toBe(chemin)
    }
  })
})
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run : `cd plateforme/web && pnpm test routage`
Expected : FAIL — module `routage` introuvable

- [ ] **Step 3 : Écrire le module**

`plateforme/web/src/routage.ts` :

```ts
import { useEffect, useState } from 'react'

export type Destination =
  | { vue: 'connexion' }
  | { vue: 'cours'; notion: string }
  | { vue: 'exercices'; notion: string }
  | { vue: 'exercice'; notion: string; numero: number }
  | { vue: 'inconnue' }

// Le routeur valide la FORME d'un identifiant de notion, jamais son
// vocabulaire : la liste des notions vit dans le contenu publié
// (seance-1-notions.json), et la recopier ici la ferait diverger.
const MOTIF_NOTION = /^[a-z]{2,20}$/
const NUMERO_MAX = 99

/**
 * Traduit un chemin en destination. Fonction pure : c'est elle qui porte la
 * logique, le hook plus bas n'est qu'un abonnement à `popstate`.
 */
export function analyser(chemin: string): Destination {
  const morceaux = chemin.split('/').filter(Boolean)
  if (morceaux.length === 0) return { vue: 'connexion' }

  const [notion, page, numero] = morceaux
  if (!notion || !MOTIF_NOTION.test(notion)) return { vue: 'inconnue' }

  if (morceaux.length === 2 && page === 'cours') return { vue: 'cours', notion }
  if (morceaux.length === 2 && page === 'exercices') return { vue: 'exercices', notion }

  if (morceaux.length === 3 && page === 'exercices' && numero !== undefined) {
    if (!/^[0-9]{1,2}$/.test(numero)) return { vue: 'inconnue' }
    const n = Number(numero)
    if (n < 1 || n > NUMERO_MAX) return { vue: 'inconnue' }
    return { vue: 'exercice', notion, numero: n }
  }

  return { vue: 'inconnue' }
}

export function versChemin(destination: Destination): string {
  switch (destination.vue) {
    case 'cours':
      return `/${destination.notion}/cours`
    case 'exercices':
      return `/${destination.notion}/exercices`
    case 'exercice':
      return `/${destination.notion}/exercices/${destination.numero}`
    default:
      return '/'
  }
}

/** Change de page sans rechargement, et prévient les abonnés. */
export function naviguer(destination: Destination): void {
  history.pushState(null, '', versChemin(destination))
  dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): Destination {
  const [destination, setDestination] = useState<Destination>(() => analyser(location.pathname))
  useEffect(() => {
    const relire = () => setDestination(analyser(location.pathname))
    addEventListener('popstate', relire)
    return () => removeEventListener('popstate', relire)
  }, [])
  return destination
}
```

- [ ] **Step 4 : Lancer les tests et la couverture**

Run : `pnpm test:couverture`
Expected : les 13 tests passent, et `src/routage.ts` atteint **100 %**. S'il manque une branche,
le test correspondant manque : écris-le, ne baisse pas le seuil.

> [!note] `useRoute` et la couverture
> Le hook est couvert par les tests de la coquille (tâche 14). S'il reste découvert à cette
> étape, ajoute un test qui monte un composant minimal utilisant `useRoute` et vérifie qu'il
> réagit à `naviguer`.

- [ ] **Step 5 : Configurer le serveur pour les chemins profonds**

Un rechargement sur `/variables/cours` doit servir l'application, pas un 404.

En production, `Caddyfile` le fait déjà (`try_files {path} /index.html`). En développement,
ajouter à `vite.config.ts`, dans `server` : `appType` est déjà `spa` par défaut — vérifie
simplement qu'un rechargement sur `/variables/cours` fonctionne une fois la tâche 14 livrée.

- [ ] **Step 6 : Faire valider, puis commiter**

```bash
git add plateforme/web/src/routage.ts plateforme/web/tests/routage.test.ts
git commit -m "feat: routage par l'API History, sans dependance"
```

---

## Tâche 8 : Le formatage inline des paragraphes

**Files:**
- Create: `plateforme/web/src/ui/texte.tsx`
- Test: `plateforme/web/tests/ui/texte.test.tsx`

**Interfaces:**
- Consumes: rien
- Produces: `formaterTexte(texte: string): ReactNode[]`

Deux marques seulement : `**gras**` et `` `code` ``. Aucune bibliothèque de rendu markdown.

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/web/tests/ui/texte.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formaterTexte } from '../../src/ui/texte'

function rendre(texte: string) {
  return render(<p data-testid="p">{formaterTexte(texte)}</p>)
}

describe('formaterTexte', () => {
  it('laisse un texte simple intact', () => {
    rendre('Une variable est une boîte.')
    expect(screen.getByTestId('p')).toHaveTextContent('Une variable est une boîte.')
  })

  it('met en gras entre doubles etoiles', () => {
    const { container } = rendre('Une **boîte** nommée.')
    expect(container.querySelector('strong')).toHaveTextContent('boîte')
  })

  it('met en chasse fixe entre accents graves', () => {
    const { container } = rendre('Le signe `=` range une valeur.')
    expect(container.querySelector('code')).toHaveTextContent('=')
  })

  it('gere plusieurs marques dans le meme texte', () => {
    const { container } = rendre('**Range** avec `=` puis **relis**.')
    expect(container.querySelectorAll('strong')).toHaveLength(2)
    expect(container.querySelectorAll('code')).toHaveLength(1)
  })

  it('laisse une etoile isolee telle quelle', () => {
    rendre('2 * 3 vaut 6.')
    expect(screen.getByTestId('p')).toHaveTextContent('2 * 3 vaut 6.')
  })

  it('laisse un accent grave isole tel quel', () => {
    const { container } = rendre('Un accent ` tout seul.')
    expect(container.querySelector('code')).toBeNull()
  })

  it('ne rend jamais de balise HTML fournie dans le texte', () => {
    const { container } = rendre('<script>alert(1)</script> et **gras**')
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByTestId('p')).toHaveTextContent('<script>alert(1)</script>')
  })

  it('gere un texte vide', () => {
    rendre('')
    expect(screen.getByTestId('p')).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run : `pnpm test texte`
Expected : FAIL — module `texte` introuvable

- [ ] **Step 3 : Écrire la fonction**

`plateforme/web/src/ui/texte.tsx` :

```tsx
import type { ReactNode } from 'react'

// Deux marques, pas davantage : **gras** et `code`. Le contenu vient de nos
// propres fichiers YAML, mais on n'injecte jamais de HTML — React échappe
// chaque fragment de texte, donc une balise écrite dans une leçon s'affiche
// telle quelle au lieu de s'exécuter.
const MARQUES = /(\*\*[^*]+\*\*|`[^`]+`)/g

export function formaterTexte(texte: string): ReactNode[] {
  return texte
    .split(MARQUES)
    .filter((fragment) => fragment !== '')
    .map((fragment, index) => {
      if (fragment.startsWith('**') && fragment.endsWith('**')) {
        return <strong key={index}>{fragment.slice(2, -2)}</strong>
      }
      if (fragment.startsWith('`') && fragment.endsWith('`') && fragment.length > 1) {
        return (
          <code key={index} className="mono">
            {fragment.slice(1, -1)}
          </code>
        )
      }
      return fragment
    })
}
```

- [ ] **Step 4 : Lancer les tests et la couverture**

Run : `pnpm test:couverture`
Expected : les 8 tests passent, `src/ui/texte.tsx` à **100 %**

- [ ] **Step 5 : Faire valider, puis commiter**

```bash
git add plateforme/web/src/ui/texte.tsx plateforme/web/tests/ui/texte.test.tsx
git commit -m "feat: formatage inline des paragraphes, gras et chasse fixe"
```

---

## Tâche 9 : Charger et regrouper le contenu par notion

**Files:**
- Create: `plateforme/web/src/contenu/notions.ts`
- Modify: `plateforme/web/src/contenu/chargeur.ts`
- Modify: `plateforme/web/src/contenu/types.ts`
- Test: `plateforme/web/tests/contenu/notions.test.ts`

**Interfaces:**
- Consumes: `seance-1.json`, `seance-1-lecons.json`, `seance-1-notions.json` (tâche 4)
- Produces:
  - types `Notion`, `Lecon`, `Bloc`, `GroupeNotion`
  - `chargerJson<T>(chemin: string): Promise<T>`
  - `chargerNotions()`, `chargerLecons()` (et `chargerParcours()`, inchangée en surface)
  - `grouper(notions, exercices, lecons, reussis): GroupeNotion[]`
  - `premiereOuverte(groupes: GroupeNotion[]): GroupeNotion | null`

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/web/tests/contenu/notions.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { grouper, premiereOuverte } from '../../src/contenu/notions'
import type { Lecon, Notion } from '../../src/contenu/types'
import type { Exercice } from '../../src/contenu/types'

const NOTIONS: Notion[] = [
  { id: 'afficher', ordre: 1, titre: 'Afficher un message', famille: 'conditions' },
  { id: 'variables', ordre: 2, titre: 'Les variables', famille: 'variables' },
]

function ex(id: string, notion: string): Exercice {
  return {
    id,
    concept: 'print',
    notion,
    famille: 'conditions',
    seance: 1,
    niveau: 'normal',
    type: 'ecrire',
    titre: id,
    obligatoire: true,
    enonce: '',
    depart: '',
    indices: [],
    tests: [],
  }
}

const LECON: Lecon = {
  id: 'c1-afficher',
  notion: 'afficher',
  ordre: 1,
  titre: 'Afficher un message',
  dureeMin: 3,
  famille: 'conditions',
  blocs: [],
}

describe('grouper', () => {
  it('rend un groupe par notion, dans l ordre declare', () => {
    const groupes = grouper(NOTIONS, [], [], [])
    expect(groupes.map((g) => g.id)).toEqual(['afficher', 'variables'])
  })

  it('range chaque exercice dans sa notion, dans l ordre du fichier', () => {
    const groupes = grouper(NOTIONS, [ex('s1-09', 'variables'), ex('s1-01', 'afficher')], [], [])
    expect(groupes[0]!.exercices.map((e) => e.id)).toEqual(['s1-01'])
    expect(groupes[1]!.exercices.map((e) => e.id)).toEqual(['s1-09'])
  })

  it('ignore un exercice dont la notion n existe pas', () => {
    const groupes = grouper(NOTIONS, [ex('s1-99', 'algebre')], [], [])
    expect(groupes.flatMap((g) => g.exercices)).toHaveLength(0)
  })

  it('compte les exercices reussis de chaque notion', () => {
    const groupes = grouper(
      NOTIONS,
      [ex('s1-01', 'afficher'), ex('s1-02', 'afficher')],
      [],
      ['s1-01'],
    )
    expect(groupes[0]!.faits).toBe(1)
    expect(groupes[1]!.faits).toBe(0)
  })

  it('rattache la lecon de la notion, ou null', () => {
    const groupes = grouper(NOTIONS, [], [LECON], [])
    expect(groupes[0]!.lecon?.id).toBe('c1-afficher')
    expect(groupes[1]!.lecon).toBeNull()
  })
})

describe('premiereOuverte', () => {
  it('rend la premiere notion dont les exercices ne sont pas tous reussis', () => {
    const groupes = grouper(
      NOTIONS,
      [ex('s1-01', 'afficher'), ex('s1-09', 'variables')],
      [],
      ['s1-01'],
    )
    expect(premiereOuverte(groupes)?.id).toBe('variables')
  })

  it('rend la premiere notion quand tout est reussi', () => {
    const groupes = grouper(NOTIONS, [ex('s1-01', 'afficher')], [], ['s1-01'])
    expect(premiereOuverte(groupes)?.id).toBe('afficher')
  })

  it('rend null sans aucune notion', () => {
    expect(premiereOuverte([])).toBeNull()
  })

  it('considere une notion sans exercice comme terminee', () => {
    const groupes = grouper(NOTIONS, [ex('s1-09', 'variables')], [], [])
    expect(premiereOuverte(groupes)?.id).toBe('variables')
  })
})
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run : `pnpm test notions`
Expected : FAIL — module `notions` introuvable

- [ ] **Step 3 : Ajouter les types**

Dans `plateforme/web/src/contenu/types.ts`, ajouter `notion: string` au type `Exercice` (juste
après `concept`), puis :

```ts
export type Notion = {
  id: string
  ordre: number
  titre: string
  famille: Exercice['famille']
}

export type Bloc =
  | { type: 'paragraphe'; texte: string }
  | { type: 'attention'; texte: string }
  | { type: 'code'; legende: string; python: string; executable: boolean }

export type Lecon = {
  id: string
  notion: string
  ordre: number
  titre: string
  dureeMin: number
  famille: Exercice['famille']
  blocs: Bloc[]
}
```

- [ ] **Step 4 : Factoriser le chargement**

Trois fichiers JSON se chargent de la même façon. Une seule fonction, dans
`plateforme/web/src/contenu/chargeur.ts` :

```ts
/** Le contenu est construit dans l'image et servi en statique. */
export async function chargerJson<T>(chemin: string): Promise<T> {
  const reponse = await fetch(chemin)
  if (!reponse.ok) throw new Error(`Contenu introuvable (${reponse.status})`)
  return (await reponse.json()) as T
}

export const chargerParcours = (chemin = '/contenu/seance-1.json') =>
  chargerJson<Exercice[]>(chemin)

export const chargerNotions = (chemin = '/contenu/seance-1-notions.json') =>
  chargerJson<Notion[]>(chemin)

export const chargerLecons = (chemin = '/contenu/seance-1-lecons.json') =>
  chargerJson<Lecon[]>(chemin)
```

`nomsVariablesRequis` reste inchangée. Les tests existants de `chargeur` doivent continuer de
passer sans modification — c'est le signe que la surface publique n'a pas bougé.

- [ ] **Step 5 : Écrire le regroupement**

`plateforme/web/src/contenu/notions.ts` :

```ts
import type { Exercice, Lecon, Notion } from './types'

export type GroupeNotion = Notion & {
  exercices: Exercice[]
  lecon: Lecon | null
  faits: number
}

/**
 * Assemble la vue dont le menu et les pages ont besoin : une notion, sa leçon,
 * ses exercices dans l'ordre du fichier, et le compte de ceux déjà réussis.
 *
 * Fonction pure, sans état ni requête : c'est ici qu'est toute la logique de
 * navigation, et elle se teste sans DOM ni serveur.
 */
export function grouper(
  notions: Notion[],
  exercices: Exercice[],
  lecons: Lecon[],
  reussis: string[],
): GroupeNotion[] {
  const acquis = new Set(reussis)
  return [...notions]
    .sort((a, b) => a.ordre - b.ordre)
    .map((notion) => {
      const siens = exercices.filter((e) => e.notion === notion.id)
      return {
        ...notion,
        exercices: siens,
        lecon: lecons.find((l) => l.notion === notion.id) ?? null,
        faits: siens.filter((e) => acquis.has(e.id)).length,
      }
    })
}

/** Là où `/` envoie l'élève : la première notion qu'il n'a pas terminée. */
export function premiereOuverte(groupes: GroupeNotion[]): GroupeNotion | null {
  return groupes.find((g) => g.faits < g.exercices.length) ?? groupes[0] ?? null
}
```

- [ ] **Step 6 : Lancer les tests et la couverture**

Run : `pnpm test:couverture`
Expected : les 9 tests passent, `src/contenu/notions.ts` à **100 %**

- [ ] **Step 7 : Faire valider, puis commiter**

```bash
git add plateforme/web/src/contenu plateforme/web/tests/contenu
git commit -m "feat: regroupement du contenu par notion"
```

---

## Tâche 10 : Le menu permanent

**Files:**
- Create: `plateforme/web/src/ui/Menu.tsx`, `plateforme/web/src/ui/Menu.css`
- Create: `docs/vault/4-direction-artistique/maquette-cours-exercices.html`
- Test: `plateforme/web/tests/ui/Menu.test.tsx`

**Interfaces:**
- Consumes: `GroupeNotion` (tâche 8), `Destination`, `naviguer`, `versChemin` (tâche 6)
- Produces: `<Menu groupes={...} destination={...} />`

- [ ] **Step 1 : Mettre la maquette validée à l'abri**

La maquette relue avec toi vit dans un dossier temporaire de session, qui sera effacé. Copie-la
dans le vault, elle sert de référence visuelle à toutes les tâches suivantes :

```bash
cp "$TMP_MAQUETTE" "docs/vault/4-direction-artistique/maquette-cours-exercices.html"
```

où `$TMP_MAQUETTE` est le chemin du fichier `maquette-template.html` du scratchpad. Ajoute-lui en
tête un commentaire HTML disant qu'il s'agit d'une maquette de référence, non du code livré.
Référence-la depuis [[Charte visuelle]].

- [ ] **Step 2 : Écrire le test qui échoue**

`plateforme/web/tests/ui/Menu.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Menu } from '../../src/ui/Menu'
import type { GroupeNotion } from '../../src/contenu/notions'

const GROUPES: GroupeNotion[] = [
  {
    id: 'afficher',
    ordre: 1,
    titre: 'Afficher un message',
    famille: 'conditions',
    exercices: [],
    lecon: null,
    faits: 0,
  },
  {
    id: 'variables',
    ordre: 2,
    titre: 'Les variables',
    famille: 'variables',
    // Deux exercices, un seul réussi. Le menu ne lit que leur nombre : un objet
    // partiel suffit, et écrire un Exercice complet ici masquerait cette limite.
    exercices: [{ id: 's1-09' }, { id: 's1-10' }] as unknown as GroupeNotion['exercices'],
    lecon: null,
    faits: 1,
  },
]

describe('Menu', () => {
  it('liste chaque notion avec son avancement', () => {
    render(<Menu groupes={GROUPES} destination={{ vue: 'connexion' }} />)
    expect(screen.getByText('Les variables')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('donne deux liens par notion', () => {
    render(<Menu groupes={GROUPES} destination={{ vue: 'connexion' }} />)
    expect(screen.getAllByRole('link', { name: 'Cours' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Exercices' })).toHaveLength(2)
  })

  it('marque la destination courante', () => {
    render(<Menu groupes={GROUPES} destination={{ vue: 'cours', notion: 'variables' }} />)
    const courant = screen.getByRole('link', { current: 'page' })
    expect(courant).toHaveAccessibleName('Cours')
    expect(courant).toHaveAttribute('href', '/variables/cours')
  })

  it('navigue sans recharger la page', async () => {
    const pushState = vi.spyOn(history, 'pushState')
    render(<Menu groupes={GROUPES} destination={{ vue: 'connexion' }} />)
    await userEvent.click(screen.getAllByRole('link', { name: 'Exercices' })[1]!)
    expect(pushState).toHaveBeenCalledWith(null, '', '/variables/exercices')
    pushState.mockRestore()
  })

  it('porte la famille de couleur de chaque notion', () => {
    const { container } = render(<Menu groupes={GROUPES} destination={{ vue: 'connexion' }} />)
    expect(container.querySelector('[data-famille="variables"]')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3 : Lancer le test pour le voir échouer**

Run : `pnpm test Menu`
Expected : FAIL — module `Menu` introuvable

- [ ] **Step 4 : Écrire le composant**

`plateforme/web/src/ui/Menu.tsx` :

```tsx
import type { MouseEvent } from 'react'
import type { GroupeNotion } from '../contenu/notions'
import { naviguer, versChemin, type Destination } from '../routage'
import './Menu.css'

/**
 * Le menu est permanent : depuis n'importe où, l'élève atteint n'importe quelle
 * page. C'est ce qui manquait — l'application n'affichait que le premier
 * exercice non réussi, sans retour en arrière ni moyen de sauter un blocage.
 */
export function Menu({
  groupes,
  destination,
}: {
  groupes: GroupeNotion[]
  destination: Destination
}) {
  return (
    <nav className="menu" aria-label="Notions de la séance">
      <ol className="menu__liste">
        {groupes.map((groupe) => (
          <li key={groupe.id} className="menu__notion" data-famille={groupe.famille}>
            <span className="menu__pastille" aria-hidden="true" />
            <span className="menu__titre">{groupe.titre}</span>
            <span className="menu__avancement">
              {groupe.faits} / {groupe.exercices.length}
            </span>
            <span className="menu__liens">
              <Lien cible={{ vue: 'cours', notion: groupe.id }} destination={destination}>
                Cours
              </Lien>
              <Lien cible={{ vue: 'exercices', notion: groupe.id }} destination={destination}>
                Exercices
              </Lien>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Un vrai `<a href>` : il s'ouvre dans un nouvel onglet au clic du milieu, se
 * copie, s'annonce au lecteur d'écran. Le `preventDefault` n'intercepte que le
 * clic simple, pour éviter le rechargement complet.
 */
function Lien({
  cible,
  destination,
  children,
}: {
  cible: Destination
  destination: Destination
  children: string
}) {
  const chemin = versChemin(cible)
  const courant = versChemin(destination) === chemin

  function cliquer(evenement: MouseEvent<HTMLAnchorElement>) {
    if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey) return
    evenement.preventDefault()
    naviguer(cible)
  }

  return (
    <a
      className="menu__lien"
      href={chemin}
      onClick={cliquer}
      aria-current={courant ? 'page' : undefined}
    >
      {children}
    </a>
  )
}
```

- [ ] **Step 5 : Ajouter l'échelle d'espacement aux tokens**

`tokens.css` n'a que des couleurs et des polices. Le rythme 4/8 et les rayons exigés par la charte
n'existent nulle part, et sans eux chaque feuille réinventera ses valeurs. Ajouter au `:root` de
`plateforme/web/src/ui/tokens.css` :

```css
  /* Rythme 4/8 : toute marge de l'interface sort de cette echelle. */
  --e-1: 0.5rem; --e-2: 1rem; --e-3: 1.5rem; --e-4: 2rem; --e-5: 3rem; --e-6: 4rem;

  /* Echelle typographique a sept crans. Aucune taille hors de cette liste. */
  --t-1: 0.82rem; --t-2: 0.94rem; --t-3: 1rem; --t-4: 1.15rem;
  --t-5: 1.4rem; --t-6: 2rem; --t-7: 2.6rem;

  --rayon-1: 6px; --rayon-2: 10px; --rayon-3: 16px;
```

et le test qui empêche de les contourner, dans `tests/ui/tokens.test.ts` :

```ts
  it('les echelles d espacement et de typographie sont completes', () => {
    for (const nom of ['--e-1', '--e-6', '--t-1', '--t-7', '--rayon-1']) {
      expect(tokens).toContain(`${nom}:`)
    }
  })
```

- [ ] **Step 6 : Écrire la feuille de style**

`plateforme/web/src/ui/Menu.css`. Contraintes non négociables : colonne de 255 px sur le neutre
chaud, cibles ≥ 44 px, focus visible, aucune police en chasse fixe ==(voir la règle « pas de
chrome monospace » ci-dessus)==.

> [!important] `data-famille` fait déjà le travail
> `tokens.css` mappe déjà `[data-famille="variables"]` vers `--tint`, `--encre` et `--profond`.
> ==N'écris aucun bloc par famille dans `Menu.css`== : poser `data-famille` sur le `<li>` suffit,
> et `var(--encre)` prend la bonne couleur. Réécrire ces cinq lignes serait la duplication que ce
> palier cherche à éviter.

```css
.menu {
  grid-area: menu;
  background: var(--ground-2);
  border-right: 1px solid var(--rule);
  padding: var(--e-3) var(--e-2);
}

.menu__liste { list-style: none; margin: 0; padding: 0; }

.menu__notion {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--e-1);
  padding: var(--e-2) 0;
  border-bottom: 1px solid var(--rule);
}

.menu__pastille {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  background: var(--encre);
}

.menu__titre { font-size: var(--t-3); font-weight: 500; color: var(--ink); }
.menu__avancement { font-size: var(--t-1); color: var(--ink-soft); }
.menu__liens { grid-column: 1 / -1; display: flex; gap: var(--e-1); }

.menu__lien {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 var(--e-2);
  border-radius: var(--rayon-1);
  font-size: var(--t-2);
  color: var(--ink-soft);
  text-decoration: none;
}

.menu__lien:hover { background: var(--tint); color: var(--encre); }
.menu__lien:focus-visible { outline: 2px solid var(--encre); outline-offset: 2px; }
.menu__lien[aria-current='page'] { background: var(--encre); color: var(--ground); }

@media (max-width: 820px) {
  .menu { border-right: 0; border-bottom: 1px solid var(--rule); }
  .menu__liste { display: flex; overflow-x: auto; gap: var(--e-2); }
  .menu__notion { border-bottom: 0; flex: 0 0 auto; }
}
```

- [ ] **Step 7 : Lancer les tests**

Run : `pnpm test:couverture`
Expected : les 5 tests du menu passent, et `tokens.test.ts` compte un test de plus

- [ ] **Step 8 : Faire valider, puis commiter**

```bash
git add plateforme/web/src/ui plateforme/web/tests/ui docs/vault/4-direction-artistique
git commit -m "feat: menu permanent des notions"
```

---

## Tâche 11 : La page Cours et son bac à sable

**Files:**
- Create: `plateforme/web/src/ui/PageCours.tsx`, `plateforme/web/src/ui/PageCours.css`
- Create: `plateforme/web/src/ui/BacASable.tsx`
- Test: `plateforme/web/tests/ui/PageCours.test.tsx`

**Interfaces:**
- Consumes: `Lecon`, `Bloc` (tâche 8), `formaterTexte` (tâche 7), `Executeur`, `CarteCode`, `Editeur`
- Produces: `<PageCours groupe={...} executeur={...} />`, `<BacASable code={...} executeur={...} />`

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/web/tests/ui/PageCours.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageCours } from '../../src/ui/PageCours'
import type { GroupeNotion } from '../../src/contenu/notions'
import type { Bloc } from '../../src/contenu/types'
import type { Executeur } from '../../src/execution/executeur'

function groupe(blocs: Bloc[]): GroupeNotion {
  return {
    id: 'variables',
    ordre: 2,
    titre: 'Les variables',
    famille: 'variables',
    exercices: [],
    faits: 0,
    lecon: {
      id: 'c1-variables',
      notion: 'variables',
      ordre: 2,
      titre: 'Les variables',
      dureeMin: 3,
      famille: 'variables',
      blocs,
    },
  }
}

const EXECUTEUR = {
  executer: vi.fn(async () => ({
    stdout: 'Camille\n',
    erreur: null,
    variables: {},
    dureeMs: 12,
    timeout: false,
  })),
} as unknown as Executeur

describe('PageCours', () => {
  it('affiche le titre et la duree de lecture', () => {
    render(<PageCours groupe={groupe([])} executeur={EXECUTEUR} />)
    expect(screen.getByRole('heading', { name: 'Les variables' })).toBeInTheDocument()
    expect(screen.getByText(/3 min/)).toBeInTheDocument()
  })

  it('rend un paragraphe avec son formatage', () => {
    const { container } = render(
      <PageCours
        groupe={groupe([{ type: 'paragraphe', texte: 'Une **boîte** nommée.' }])}
        executeur={EXECUTEUR}
      />,
    )
    expect(container.querySelector('strong')).toHaveTextContent('boîte')
  })

  it('distingue un bloc attention', () => {
    const { container } = render(
      <PageCours
        groupe={groupe([{ type: 'attention', texte: 'Le signe = range.' }])}
        executeur={EXECUTEUR}
      />,
    )
    expect(container.querySelector('.attention')).toHaveTextContent('Le signe = range.')
  })

  it('affiche un bloc code avec sa legende', () => {
    render(
      <PageCours
        groupe={groupe([
          { type: 'code', legende: 'Ranger', python: 'prenom = "Camille"', executable: false },
        ])}
        executeur={EXECUTEUR}
      />,
    )
    expect(screen.getByText('Ranger')).toBeInTheDocument()
    expect(screen.getByText(/prenom = "Camille"/)).toBeInTheDocument()
  })

  it('n offre le bac a sable que sur un bloc executable', () => {
    render(
      <PageCours
        groupe={groupe([
          { type: 'code', legende: 'Lire', python: 'print(1)', executable: false },
        ])}
        executeur={EXECUTEUR}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Essayer' })).toBeNull()
  })

  it('execute le code du bac a sable et montre la sortie', async () => {
    render(
      <PageCours
        groupe={groupe([
          { type: 'code', legende: 'Ranger', python: 'print(prenom)', executable: true },
        ])}
        executeur={EXECUTEUR}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Essayer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exécuter' }))
    expect(await screen.findByText('Camille')).toBeInTheDocument()
  })

  it('annonce l absence de lecon sans planter', () => {
    const sansLecon = { ...groupe([]), lecon: null }
    render(<PageCours groupe={sansLecon} executeur={EXECUTEUR} />)
    expect(screen.getByText(/pas encore de cours/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run : `pnpm test PageCours`
Expected : FAIL — module `PageCours` introuvable

- [ ] **Step 3 : Écrire le bac à sable**

`plateforme/web/src/ui/BacASable.tsx` :

```tsx
import { useState } from 'react'
import type { Executeur } from '../execution/executeur'
import { Editeur } from './Editeur'

/**
 * Un éditeur sans verdict et sans enregistrement : l'élève modifie l'exemple de
 * la leçon et voit ce que ça change. Aucune progression n'est touchée — c'est la
 * différence avec un exercice, et elle doit rester visible dans le vocabulaire.
 */
export function BacASable({ code, executeur }: { code: string; executeur: Executeur }) {
  const [source, setSource] = useState(code)
  const [sortie, setSortie] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function executer() {
    setEnCours(true)
    const resultat = await executeur.executer({ code: source, entrees: [], nomsVariables: [] })
    setSortie(resultat.timeout ? 'Le programme a été trop long : il a été arrêté.' : resultat.stdout)
    setEnCours(false)
  }

  return (
    <div className="bac">
      <Editeur valeur={source} onChange={setSource} />
      <div className="bac__actions">
        <button type="button" className="bouton" onClick={executer} disabled={enCours}>
          {enCours ? 'Exécution…' : 'Exécuter'}
        </button>
        <span className="bac__note">rien n'est enregistré ici</span>
      </div>
      {sortie !== null && (
        <pre className="bac__sortie mono" aria-live="polite">
          {sortie.trimEnd() || '(aucune sortie)'}
        </pre>
      )}
    </div>
  )
}
```

> [!warning] Le bac à sable ne relaie pas l'erreur Python
> `resultat.erreur` contient un message qui cite le code de l'élève. Ici il ne sort pas du
> navigateur — rien n'est envoyé à l'API — donc l'afficher est sans danger. C'est le seul endroit
> de l'application où c'est vrai. Voir [[ADR-008 Validation serveur des champs libres]].
>
> Affiche donc le message d'erreur tel quel dans `.bac__sortie` quand `resultat.erreur` existe :
> sans lui, l'élève ne comprend pas pourquoi rien ne s'affiche.

- [ ] **Step 4 : Écrire la page**

`plateforme/web/src/ui/PageCours.tsx` :

```tsx
import { useState } from 'react'
import type { GroupeNotion } from '../contenu/notions'
import type { Bloc } from '../contenu/types'
import type { Executeur } from '../execution/executeur'
import { BacASable } from './BacASable'
import { CarteCode } from './CarteCode'
import { formaterTexte } from './texte'
import './PageCours.css'

export function PageCours({
  groupe,
  executeur,
}: {
  groupe: GroupeNotion
  executeur: Executeur
}) {
  const { lecon } = groupe

  if (!lecon) {
    return (
      <main className="cours" data-famille={groupe.famille}>
        <h1>{groupe.titre}</h1>
        <p className="cours__vide">
          Il n'y a pas encore de cours pour cette notion. Va directement aux exercices.
        </p>
      </main>
    )
  }

  return (
    <main className="cours" data-famille={groupe.famille}>
      <header className="cours__entete">
        <h1>{lecon.titre}</h1>
        <p className="cours__duree">{lecon.dureeMin} min de lecture</p>
      </header>
      <article className="cours__corps">
        {lecon.blocs.map((bloc, index) => (
          <BlocRendu key={index} bloc={bloc} executeur={executeur} />
        ))}
      </article>
    </main>
  )
}

function BlocRendu({ bloc, executeur }: { bloc: Bloc; executeur: Executeur }) {
  const [ouvert, setOuvert] = useState(false)

  if (bloc.type === 'paragraphe') return <p>{formaterTexte(bloc.texte)}</p>
  if (bloc.type === 'attention') return <p className="attention">{formaterTexte(bloc.texte)}</p>

  return (
    <div className="cours__exemple">
      <CarteCode legende={bloc.legende}>
        <pre>{bloc.python.trimEnd()}</pre>
      </CarteCode>
      {bloc.executable && !ouvert && (
        <button type="button" className="bouton" onClick={() => setOuvert(true)}>
          Essayer
        </button>
      )}
      {bloc.executable && ouvert && <BacASable code={bloc.python} executeur={executeur} />}
    </div>
  )
}
```

- [ ] **Step 5 : Écrire la feuille de style**

`plateforme/web/src/ui/PageCours.css`. La page de cours est ==sur fond pastel== : `data-famille`
fixe `--famille-tint` comme fond, `--famille-deep` pour les titres. Largeur de lecture bornée à
`68ch`. Le bloc `.attention` porte un filet gauche de 3 px dans `--encre`, sans icône ni
emoji. Les cartes de code gardent leur fond sombre Dracula — c'est la bascule
« pastel = j'apprends, sombre = je code » de [[Charte visuelle]].

- [ ] **Step 6 : Lancer les tests**

Run : `pnpm test:couverture`
Expected : les 7 tests passent

- [ ] **Step 7 : Faire valider, puis commiter**

```bash
git add plateforme/web/src/ui/PageCours.tsx plateforme/web/src/ui/PageCours.css \
        plateforme/web/src/ui/BacASable.tsx plateforme/web/tests/ui/PageCours.test.tsx
git commit -m "feat: page cours avec exemples executables"
```

---

## Tâche 12 : La page Exercices

**Files:**
- Create: `plateforme/web/src/ui/PageExercices.tsx`, `plateforme/web/src/ui/PageExercices.css`
- Test: `plateforme/web/tests/ui/PageExercices.test.tsx`

**Interfaces:**
- Consumes: `GroupeNotion` (tâche 8), `naviguer` (tâche 6)
- Produces: `<PageExercices groupe={...} reussis={...} />`

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/web/tests/ui/PageExercices.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageExercices } from '../../src/ui/PageExercices'
import type { GroupeNotion } from '../../src/contenu/notions'
import type { Exercice } from '../../src/contenu/types'

function ex(id: string, titre: string, type: Exercice['type']): Exercice {
  return {
    id,
    concept: 'variable',
    notion: 'variables',
    famille: 'variables',
    seance: 1,
    niveau: 'normal',
    type,
    titre,
    obligatoire: true,
    enonce: '',
    depart: '',
    indices: [],
    tests: [],
  }
}

const GROUPE: GroupeNotion = {
  id: 'variables',
  ordre: 2,
  titre: 'Les variables',
  famille: 'variables',
  lecon: null,
  faits: 1,
  exercices: [
    ex('s1-09', 'Ranger un prénom', 'ecrire'),
    ex('s1-10', 'Que vaut score ?', 'predire'),
  ],
}

describe('PageExercices', () => {
  it('liste tous les exercices de la notion, numerotes', () => {
    render(<PageExercices groupe={GROUPE} reussis={['s1-09']} />)
    expect(screen.getByText('Ranger un prénom')).toBeInTheDocument()
    expect(screen.getByText('Que vaut score ?')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('marque les exercices reussis', () => {
    const { container } = render(<PageExercices groupe={GROUPE} reussis={['s1-09']} />)
    expect(container.querySelectorAll('[data-etat="reussi"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-etat="a-faire"]')).toHaveLength(1)
  })

  it('nomme le type de chaque exercice en francais', () => {
    render(<PageExercices groupe={GROUPE} reussis={[]} />)
    expect(screen.getByText('À écrire')).toBeInTheDocument()
    expect(screen.getByText('À lire')).toBeInTheDocument()
  })

  it('rappelle l avancement de la notion', () => {
    render(<PageExercices groupe={GROUPE} reussis={['s1-09']} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('ouvre un exercice par son rang dans la notion', async () => {
    const pushState = vi.spyOn(history, 'pushState')
    render(<PageExercices groupe={GROUPE} reussis={[]} />)
    await userEvent.click(screen.getByRole('link', { name: /Que vaut score/ }))
    expect(pushState).toHaveBeenCalledWith(null, '', '/variables/exercices/2')
    pushState.mockRestore()
  })

  it('laisse ouvrir un exercice non reussi meme si le precedent l est pas', async () => {
    // Aucun cul-de-sac : un exercice bloquant ne doit jamais arreter l'eleve.
    render(<PageExercices groupe={GROUPE} reussis={[]} />)
    for (const lien of screen.getAllByRole('link')) {
      expect(lien).not.toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('annonce une notion sans exercice', () => {
    render(<PageExercices groupe={{ ...GROUPE, exercices: [], faits: 0 }} reussis={[]} />)
    expect(screen.getByText(/pas encore d'exercice/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run : `pnpm test PageExercices`
Expected : FAIL — module `PageExercices` introuvable

- [ ] **Step 3 : Écrire la page**

`plateforme/web/src/ui/PageExercices.tsx` :

```tsx
import type { MouseEvent } from 'react'
import type { GroupeNotion } from '../contenu/notions'
import type { Exercice } from '../contenu/types'
import { naviguer, versChemin } from '../routage'
import './PageExercices.css'

/** Le nom du type d'exercice, en français, tel que l'élève le lit. */
const TYPES: Record<Exercice['type'], string> = {
  predire: 'À lire',
  debug: 'À corriger',
  completer: 'À compléter',
  ecrire: 'À écrire',
}

export function PageExercices({
  groupe,
  reussis,
}: {
  groupe: GroupeNotion
  reussis: string[]
}) {
  const acquis = new Set(reussis)

  return (
    <main className="exercices" data-famille={groupe.famille}>
      <header className="exercices__entete">
        <h1>{groupe.titre}</h1>
        <p className="exercices__avancement">
          {groupe.faits} / {groupe.exercices.length}
        </p>
      </header>

      {groupe.exercices.length === 0 ? (
        <p className="exercices__vide">Il n'y a pas encore d'exercice pour cette notion.</p>
      ) : (
        <ol className="exercices__liste">
          {groupe.exercices.map((exercice, index) => (
            <li
              key={exercice.id}
              className="exercices__ligne"
              data-etat={acquis.has(exercice.id) ? 'reussi' : 'a-faire'}
            >
              <span className="exercices__rang">{index + 1}</span>
              <a
                className="exercices__lien"
                href={versChemin({ vue: 'exercice', notion: groupe.id, numero: index + 1 })}
                onClick={(evenement: MouseEvent<HTMLAnchorElement>) => {
                  if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey) return
                  evenement.preventDefault()
                  naviguer({ vue: 'exercice', notion: groupe.id, numero: index + 1 })
                }}
              >
                {exercice.titre}
              </a>
              <span className="exercices__type">{TYPES[exercice.type]}</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
```

> [!important] Aucun exercice n'est verrouillé
> [[Chapitre 1]] pose qu'aucun point de blocage ne doit arrêter un élève plus de quelques minutes.
> ==La liste n'a donc pas d'état « verrouillé ».== L'état `reussi` / `a-faire` informe, il
> n'interdit rien. Le verrouillage par le professeur, lui, est hors périmètre.

- [ ] **Step 4 : Écrire la feuille de style**

`plateforme/web/src/ui/PageExercices.css`. Fond pastel, comme la page Cours — on est encore du
côté « je choisis », pas « j'écris ». Le rang est une pastille circulaire de 2 rem : creuse en
`a-faire`, pleine en `--encre` avec une coche SVG tracée à la main en `reussi`. Aucun emoji.
Chaque ligne est une cible d'au moins 44 px de haut.

- [ ] **Step 5 : Lancer les tests**

Run : `pnpm test:couverture`
Expected : les 7 tests passent

- [ ] **Step 6 : Faire valider, puis commiter**

```bash
git add plateforme/web/src/ui/PageExercices.tsx plateforme/web/src/ui/PageExercices.css \
        plateforme/web/tests/ui/PageExercices.test.tsx
git commit -m "feat: page listant les exercices d'une notion"
```

---

## Tâche 13 : L'écran de connexion

**Files:**
- Modify: `plateforme/web/src/ui/EcranConnexion.tsx`
- Create: `plateforme/web/src/ui/EcranConnexion.css`
- Test: `plateforme/web/tests/ui/EcranConnexion.test.tsx`

**Interfaces:**
- Consumes: rien
- Produces: `<EcranConnexion onConnecte={...} />` (signature inchangée)

C'est la première chose que voient vingt-quatre élèves le 16 septembre, et elle n'a aujourd'hui
**aucune feuille de style** — elle référence des classes qui n'existent pas.

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/web/tests/ui/EcranConnexion.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EcranConnexion } from '../../src/ui/EcranConnexion'

describe('EcranConnexion', () => {
  it('refuse d envoyer un code trop court', () => {
    render(<EcranConnexion onConnecte={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeDisabled()
  })

  it('met le code en capitales et le debarrasse des espaces', async () => {
    const connecter = vi.fn(async () => {})
    render(<EcranConnexion onConnecte={connecter} />)
    await userEvent.type(screen.getByLabelText("Code d'accès"), '  dojo-k7m2  ')
    await userEvent.click(screen.getByRole('button', { name: 'Commencer' }))
    expect(connecter).toHaveBeenCalledWith('DOJO-K7M2')
  })

  it('affiche l erreur renvoyee, et la relie au champ', async () => {
    render(
      <EcranConnexion
        onConnecte={vi.fn(async () => {
          throw new Error('Code inconnu.')
        })}
      />,
    )
    await userEvent.type(screen.getByLabelText("Code d'accès"), 'DOJO-XXXX')
    await userEvent.click(screen.getByRole('button', { name: 'Commencer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Code inconnu.')
    expect(screen.getByLabelText("Code d'accès")).toHaveAttribute(
      'aria-describedby',
      'erreur-connexion',
    )
  })

  it('ne parle ni d agent ni de mission', () => {
    const { container } = render(<EcranConnexion onConnecte={vi.fn()} />)
    expect(container.textContent).not.toMatch(/agent|mission|quartier/i)
  })
})
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run : `pnpm test EcranConnexion`
Expected : FAIL — l'écran n'a pas encore de feuille de style, et le champ n'a pas de `<label>` lié

- [ ] **Step 3 : Reprendre le composant**

Dans `EcranConnexion.tsx`, ==la logique de `soumettre` ne change pas== : elle met déjà le code en
capitales et relie l'erreur au champ. Deux changements de surface :

- le titre et l'intro perdent tout vocabulaire de fiction — le texte actuel
  (`EcranConnexion.tsx:24-28`) est déjà neutre, le relire et le garder ;
- ajouter `import './EcranConnexion.css'` en tête.

> [!note] Le placeholder a déjà changé
> `placeholder="DOJO-K7M2"` a été posé à la **tâche 1**, en même temps que le format côté serveur
> et le message d'erreur de `client.ts`. ==Si le test du placeholder échoue ici, c'est la tâche 1
> qui est incomplète== — ne le corrige pas à cet endroit.

- [ ] **Step 4 : Écrire la feuille de style**

`plateforme/web/src/ui/EcranConnexion.css`. Carte centrée de 26 rem au maximum sur `--ground`,
titre en `--t-6`, intro en `--t-4` couleur `--ink-soft`. Le champ de saisie est le seul endroit de
l'interface hors code où la chasse fixe est justifiée — c'est un identifiant qu'on recopie
caractère par caractère : `font-family: var(--police-code)`, `letter-spacing: 0.08em`, hauteur
3 rem. Le bouton fait toute la largeur, focus visible, état désactivé lisible (pas seulement
grisé : contraste ≥ 4,5:1 pour que l'élève lise ce qui est écrit dessus).

- [ ] **Step 5 : Lancer les tests**

Run : `pnpm test:couverture`
Expected : les 4 tests passent

- [ ] **Step 6 : Faire valider, puis commiter**

```bash
git add plateforme/web/src/ui/EcranConnexion.tsx plateforme/web/src/ui/EcranConnexion.css \
        plateforme/web/tests/ui/EcranConnexion.test.tsx
git commit -m "feat: ecran de connexion redesigne"
```

---

## Tâche 14 : Assembler la coquille

**Files:**
- Modify: `plateforme/web/src/app.tsx` (réécriture complète)
- Modify: `plateforme/web/src/ui/EcranExercice.tsx` (==balisage seulement==)
- Modify: `plateforme/web/src/ui/app.css`
- Test: `plateforme/web/tests/ui/app.test.tsx`

**Interfaces:**
- Consumes: tout ce qui précède
- Produces: l'application

> [!danger] L'interdit absolu de cette tâche
> `EcranExercice` orchestre **une exécution par test**, séquentiellement, avec cache par jeu
> d'entrées (`EcranExercice.tsx:62-113`). Cette logique a coûté trois rondes de correction et un
> bug trouvé en résolvant les 25 exercices à la main.
> ==On ne touche qu'au JSX du `return`, jamais à `valider()`.== Voir [[Pièges et invariants]].

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/web/tests/ui/app.test.tsx` :

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app'

vi.mock('../../src/execution/executeur', () => ({
  Executeur: class {
    executer = vi.fn()
    detruire = vi.fn()
  },
}))

const NOTIONS = [
  { id: 'afficher', ordre: 1, titre: 'Afficher un message', famille: 'conditions' },
  { id: 'variables', ordre: 2, titre: 'Les variables', famille: 'variables' },
]

const EXERCICES = [
  {
    id: 's1-01',
    concept: 'print',
    notion: 'afficher',
    famille: 'conditions',
    seance: 1,
    niveau: 'normal',
    type: 'ecrire',
    titre: 'Dire bonjour',
    obligatoire: true,
    enonce: 'Affiche Bonjour.',
    depart: '',
    indices: [],
    tests: [],
  },
]

beforeEach(() => {
  history.pushState(null, '', '/')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('notions') ? NOTIONS : url.includes('lecons') ? [] : EXERCICES,
    })),
  )
})

describe('App', () => {
  it('demande le code d acces avant tout', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('affiche une page introuvable sur une notion qui n existe pas', async () => {
    history.pushState(null, '', '/algebre/cours')
    render(<App />)
    // Sans session, on reste sur la connexion : la route est memorisee, pas perdue.
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeInTheDocument()
  })
})
```

> [!note] Ce que ce test couvre, et ce qu'il ne couvre pas
> Le parcours complet — se connecter, naviguer, valider un exercice — est vérifié **en bout de
> chaîne dans le conteneur** (Step 6), pas ici. Un test qui simule Pyodide, l'API et le routeur en
> même temps teste surtout ses propres mocks. Ces deux cas-là vérifient le seul comportement de la
> coquille qui ne se voit nulle part ailleurs : ==la porte d'entrée est fermée avant connexion==.

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run : `pnpm test app`
Expected : FAIL — `App` n'a pas encore de menu ni de routage

- [ ] **Step 3 : Réécrire la coquille**

`plateforme/web/src/app.tsx` :

```tsx
import { useEffect, useMemo, useState } from 'react'
import { ClientApi } from './api/client'
import { chargerLecons, chargerNotions, chargerParcours } from './contenu/chargeur'
import { grouper, premiereOuverte, type GroupeNotion } from './contenu/notions'
import { Executeur } from './execution/executeur'
import { naviguer, useRoute } from './routage'
import { EcranConnexion } from './ui/EcranConnexion'
import { EcranExercice } from './ui/EcranExercice'
import { Menu } from './ui/Menu'
import { PageCours } from './ui/PageCours'
import { PageExercices } from './ui/PageExercices'

export function App() {
  const client = useMemo(() => new ClientApi(), [])
  const executeur = useMemo(
    () => new Executeur(() => new Worker(new URL('./execution/worker.ts', import.meta.url))),
    [],
  )
  const destination = useRoute()
  const [code, setCode] = useState<string | null>(null)
  const [groupes, setGroupes] = useState<GroupeNotion[]>([])
  const [reussis, setReussis] = useState<string[]>([])
  const [alerte, setAlerte] = useState<string | null>(null)

  useEffect(() => () => executeur.detruire(), [executeur])

  async function connecter(saisi: string) {
    const identifiant = await client.ouvrirSession(saisi)
    const [notions, exercices, lecons, acquis] = await Promise.all([
      chargerNotions(),
      chargerParcours(),
      chargerLecons(),
      client.lireParcours(),
    ])
    const assembles = grouper(notions, exercices, lecons, acquis)
    setGroupes(assembles)
    setReussis(acquis)
    setCode(identifiant)
    // Une URL profonde ouverte avant connexion est conservée ; sinon on envoie
    // l'élève là où il s'était arrêté.
    if (destination.vue === 'connexion') {
      const ouverte = premiereOuverte(assembles)
      if (ouverte) naviguer({ vue: 'cours', notion: ouverte.id })
    }
  }

  if (!code) {
    return (
      <div className="appli appli--seul">
        <Entete />
        <EcranConnexion onConnecte={connecter} />
      </div>
    )
  }

  return (
    <div className="appli">
      <Entete code={code} />
      <Menu groupes={groupes} destination={destination} />
      {alerte && (
        <p role="alert" className="alerte">
          {alerte}
        </p>
      )}
      <Vue
        destination={destination}
        groupes={groupes}
        reussis={reussis}
        executeur={executeur}
        onReussi={(id) => setReussis((liste) => [...liste, id])}
        onAlerte={setAlerte}
        client={client}
      />
    </div>
  )
}
```

et, dans le même fichier, l'aiguillage — il ne fait que choisir une page, toute la logique vit
dans les composants et dans `notions.ts` :

```tsx
function Vue({ destination, groupes, reussis, executeur, onReussi, onAlerte, client }: ProprietesVue) {
  const groupe = 'notion' in destination ? groupes.find((g) => g.id === destination.notion) : undefined

  if (!groupe) return <Introuvable />

  if (destination.vue === 'cours') return <PageCours groupe={groupe} executeur={executeur} />
  if (destination.vue === 'exercices') return <PageExercices groupe={groupe} reussis={reussis} />

  if (destination.vue === 'exercice') {
    const exercice = groupe.exercices[destination.numero - 1]
    if (!exercice) return <Introuvable />
    return (
      <EcranExercice
        key={exercice.id}
        exercice={exercice}
        executeur={executeur}
        onTentative={async (resultat, dureeMs, typeErreurPython) => {
          try {
            await client.enregistrerTentative({
              exerciceId: exercice.id,
              verdict: resultat.verdict,
              // Le NOM de l'exception, jamais le message : les messages
              // contiennent des identifiants tapés par l'élève.
              typeErreur: typeErreurPython,
              dureeMs,
            })
            onAlerte(null)
            if (resultat.verdict !== 'rouge') onReussi(exercice.id)
          } catch {
            // On ne fait PAS avancer l'élève sur une tentative non enregistrée :
            // il la croirait acquise et la retrouverait au rechargement.
            onAlerte(
              "Ta progression n'a pas pu être enregistrée. Préviens ton professeur avant de continuer.",
            )
          }
        }}
      />
    )
  }

  return <Introuvable />
}

function Introuvable() {
  return (
    <main className="introuvable">
      <h1>Cette page n'existe pas</h1>
      <p>Choisis une notion dans le menu à gauche.</p>
    </main>
  )
}
```

Le type `ProprietesVue` reprend exactement les propriétés listées ci-dessus. L'en-tête `Entete`
garde son balisage actuel (`app.tsx:119-140`), en retirant `concept`, `total` et `faits` : ces
informations vivent désormais dans le menu et dans la page Exercices. `Progression.tsx` n'a plus
d'appelant — **supprime le fichier**, plutôt que de le laisser mort.

- [ ] **Step 4 : Reprendre le balisage de l'exercice**

Dans `EcranExercice.tsx`, ==seul le `return` change==, plus l'import qu'il réclame :

```tsx
import { naviguer, versChemin } from '../routage'
```

Ajoute un fil d'Ariane en tête du `<main>`, qui rappelle la notion et ramène à la liste :

```tsx
      <nav className="exercice__fil" aria-label="Fil d'Ariane">
        <a
          href={versChemin({ vue: 'exercices', notion: exercice.notion })}
          onClick={(evenement) => {
            if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey) return
            evenement.preventDefault()
            naviguer({ vue: 'exercices', notion: exercice.notion })
          }}
        >
          Retour aux exercices
        </a>
      </nav>
```

Puis relance les tests existants d'`EcranExercice` : ==s'ils passent tous sans modification, la
logique n'a pas bougé==. S'il faut en changer un, arrête-toi et explique pourquoi.

- [ ] **Step 5 : Reprendre les feuilles de style**

`src/ui/app.css` porte désormais la grille de la coquille et rien d'autre — chaque page a la
sienne.

```css
.appli {
  display: grid;
  grid-template-areas: 'entete entete' 'menu contenu';
  grid-template-columns: 255px 1fr;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
}

.appli--seul { grid-template-areas: 'entete' 'contenu'; grid-template-columns: 1fr; }

.appli > main { grid-area: contenu; }

@media (max-width: 820px) {
  .appli { grid-template-areas: 'entete' 'menu' 'contenu'; grid-template-columns: 1fr; }
}
```

L'écran d'exercice reste **sur fond sombre** : c'est la bascule lecture → écriture. Les pages
Cours et Exercices sont sur le `tint` de leur famille. Vérifie que la règle tient en changeant de
page : le fond doit changer avec la vue, pas seulement avec la notion.

- [ ] **Step 6 : Vérifier de bout en bout dans le conteneur**

Les conteneurs tournent déjà. Reconstruire et relire :

```bash
docker compose -f plateforme/deploiement/docker-compose.yml up -d --build
```

Puis, dans le navigateur, vérifier — ==et ne rien cocher sans l'avoir vu== :

1. `/` demande le code d'accès et ne montre pas le menu.
2. Après connexion, le menu liste les quatre notions avec leur couleur et leur avancement.
3. `/variables/cours` affiche la leçon ; « Essayer » ouvre un éditeur ; « Exécuter » affiche la
   sortie.
4. `/variables/exercices` liste six exercices ; le premier réussi porte sa coche.
5. Un exercice `predire` ==affiche le programme à lire== — la régression qui rendait douze
   exercices impossibles.
6. Valider un exercice le marque réussi, et le menu s'incrémente.
7. **Recharger la page sur `/types/exercices` revient au même endroit.**
8. `/algebre/cours` affiche « Cette page n'existe pas », sans écran blanc.
9. Le bouton Précédent du navigateur revient à la page d'avant.

- [ ] **Step 7 : Vérifier la couverture et l'absence de duplication**

```bash
cd plateforme/web && pnpm test:couverture
cd ../outils && .venv/Scripts/python.exe -m pytest --cov --cov-report=term-missing
```

Expected : les seuils à 100 % tenus sur `src/validation/**`, `src/routage.ts`,
`src/contenu/notions.ts`, `src/ui/texte.tsx` ; plancher global tenu.

Relis `git diff --stat` de l'ensemble du palier : si un bloc de plus de cinq lignes apparaît deux
fois, factorise-le avant de commiter.

- [ ] **Step 8 : Mettre le vault à jour**

Avant le dernier commit, refléter ce qui a été construit :

- [[Vue d'ensemble]] : la carte des fichiers du front a changé
- [[Modèle de contenu]] : le modèle `Lecon` et les trois types de bloc
- [[Pièges et invariants]] : le fil d'Ariane touche `EcranExercice` — redire ce qui reste interdit
- [[Journal de décisions]] : deux entrées, le routage sans bibliothèque et la couleur par notion
- [[Spécification interface]] : passer `statut` de `à relire` à `livré`
- Créer `2-decisions/ADR-009 Routage maison sans bibliothèque.md`

- [ ] **Step 9 : Faire valider, puis commiter**

```bash
git add plateforme/web docs/vault
git commit -m "feat: coquille avec menu permanent, pages cours et exercices"
```

---

## Tâche 15 : Réécrire les 25 exercices sans fiction

**Files:**
- Modify: les 25 fichiers de `plateforme/contenu/chapitre-1/seance-1/`
- Modify: `plateforme/web/public/contenu/seance-1.json` (régénéré)

**Interfaces:**
- Consumes: la chaîne de validation existante — c'est elle qui rattrape les erreurs
- Produces: du contenu que 24 élèves de 15 à 19 ans peuvent lire sans adhérer à une histoire

### Ce qui change, et ce qui ne change pas

| Champ | Sort |
|---|---|
| `titre`, `enonce`, `indices` | réécrits |
| `depart`, `solution` | réécrits — ==les chaînes Python portent la fiction== (`print("Bienvenue au QG")`) |
| `attendu`, options de `qcm`, motifs `interdit` | réécrits **en cohérence** avec le nouveau code |
| `id`, `concept`, `notion`, `seance`, `niveau`, `type`, `obligatoire` | ==intouchables== |
| le **nombre** et le **type** des tests | intouchables |

> [!success] Le validateur est le filet
> `valider_contenu.py` exécute chaque `solution` contre ses propres `tests`. Si tu changes une
> chaîne dans `depart` sans corriger l'`attendu`, ==la construction échoue==. C'est ce qui rend
> cette tâche faisable : l'incohérence ne peut pas passer en silence.

### Le registre

Des exemples du quotidien, chaque exercice autonome. Prénoms, notes, courses, météo, âge, prix.
Pas de fil rouge, pas de personnage récurrent, aucune histoire à laquelle adhérer.

**Trois règles de rédaction.** Le tutoiement. Des prénoms variés et non genrés quand c'est
possible (`Camille`, `Alex`, `Sacha`). Aucune situation qui suppose un contexte familial,
économique ou culturel particulier — un exercice sur « l'argent de poche » exclut une partie de la
classe.

- [ ] **Step 1 : Trancher le sort de `s1-34`**

`s1-34` est de type `probleme narratif` : c'est l'assemblage final de la séance, et il construit
aujourd'hui le « badge d'agent » décrit dans [[Terminal QG]].

==Sans fil rouge, cet exercice perd son sujet, pas sa fonction.== Sa fonction — réunir `input()`,
`int()`, le f-string et un format de sortie exact dans un seul petit programme — reste la bonne
manière de finir la séance.

**Proposition à valider avant d'écrire** : le remplacer par une **carte de membre** — le programme
demande un prénom et un âge, puis affiche trois lignes au format exact. Mêmes notions, même
difficulté, même structure de tests, aucun univers à comprendre.

- [ ] **Step 2 : Réécrire un `predire` — le cas du QCM**

Les options du QCM sont des **sorties attendues** : elles changent avec le code. `s1-01` devient :

```yaml
id: s1-01
concept: print
notion: afficher
seance: 1
niveau: normal
type: predire
titre: Ce que Python affiche vraiment
obligatoire: true
enonce: |
  Tu n'as rien à écrire ici. Lis ce programme,
  puis choisis ce qui apparaît à l'écran quand on l'exécute.
depart: |
  print("Bonjour")
indices:
  - Les guillemets servent à marquer le début et la fin du texte. Demande-toi s'ils font partie du message.
  - Le mot print et les parenthèses sont l'ordre donné à Python, pas le message. Seul ce qui se trouve à l'intérieur des guillemets arrive à l'écran.
tests:
  - type: qcm
    options:
      - Bonjour
      - '"Bonjour"'
      - print("Bonjour")
    bonne_reponse: 0
solution: |
  print("Bonjour")
```

Les indices, eux, ne portaient pas la fiction : ==garde-les mot pour mot==. Ils ont été écrits avec
soin et rien ne justifie de les réécrire.

- [ ] **Step 3 : Réécrire un `debug` — le cas du motif interdit**

Le motif `interdit` empêche d'écrire la réponse en dur ; il est **dérivé de la sortie attendue** et
change donc avec elle. `s1-13` devient :

```yaml
id: s1-13
concept: variable
notion: variables
seance: 1
niveau: normal
type: debug
titre: La boîte qui n'existe pas encore
obligatoire: true
enonce: |
  Ce programme doit annoncer qui est de service aujourd'hui.
  Python refuse de le lancer. Il affiche ce message :
  NameError: name 'responsable' is not defined
  Cela veut dire : Python ne connaît pas encore la variable responsable.
  Répare le programme. Il doit afficher exactement :
  De service : Camille
  Garde la variable : n'écris pas Camille à l'intérieur du print().
depart: |
  print("De service :", responsable)
  responsable = "Camille"
indices:
  - Python lit les lignes de haut en bas, une par une. Quand il arrive au print(), la boîte responsable a-t-elle déjà été remplie ?
  - Une boîte doit être remplie AVANT la ligne qui vient la lire. Regarde dans quel ordre tes deux lignes sont écrites.
tests:
  - type: sortie
    entrees: []
    attendu: |-
      De service : Camille
  # Motif sans guillemet : il bloque toutes les manieres d'ecrire la reponse en
  # dur (guillemets simples, doubles, triples, f-string), la ou un motif termine
  # par un guillemet se contourne en changeant de ponctuation.
  # La solution ne contient jamais cette suite : elle ecrit "De service :", responsable
  - type: interdit
    motif: 'De service : Camille'
solution: |
  responsable = "Camille"
  print("De service :", responsable)
```

> [!danger] Le commentaire au-dessus du motif n'est pas décoratif
> Il explique pourquoi le motif ne contient pas de guillemet — un motif terminé par un guillemet se
> contourne en changeant de ponctuation. ==Ce piège a coûté un correctif== (`bdc6ca8`). Reporte le
> commentaire, adapté au nouveau texte, sur chaque exercice qui a un `interdit`.

- [ ] **Step 4 : Réécrire les 23 autres, par notion**

Traite-les groupe par groupe, en validant après chaque groupe plutôt qu'à la fin :

| Notion | Fichiers | Sujets proposés |
|---|---|---|
| `afficher` | `s1-01` à `s1-07` | messages simples, listes de courses, plusieurs lignes |
| `variables` | `s1-09` à `s1-14` | prénom, score d'un jeu, nombre de places |
| `types` | `s1-19` à `s1-24` | notes, prix, âge, températures |
| `saisie` | `s1-27` à `s1-31`, `s1-34` | questions posées à l'utilisateur, carte de membre |

Après chaque groupe :

```bash
cd plateforme/outils && .venv/Scripts/python.exe valider_contenu.py ../contenu/chapitre-1
```

- [ ] **Step 5 : Vérifier qu'il ne reste aucune trace**

```bash
grep -rniE "agent|mission|quartier|QG|secret|infiltr|espion" plateforme/contenu/
```

Expected : aucune ligne. Relis chaque occurrence avant de la supprimer — « secret » peut être un
mot français légitime dans un énoncé.

- [ ] **Step 6 : Valider et reconstruire**

```bash
cd plateforme/outils && .venv/Scripts/python.exe valider_contenu.py ../contenu/chapitre-1 && .venv/Scripts/python.exe construire_contenu.py ../contenu/chapitre-1 ../web/public/contenu
```

Expected : `25 exercices charges.` `4 lecons chargees.` `Contenu valide.`

- [ ] **Step 7 : Les faire à la main**

==Résous les 25 exercices dans le navigateur, comme un élève.== C'est ce qui a trouvé le bug
d'exécution multiple du palier 1, et aucun test automatique ne l'aurait attrapé. Note tout ce qui
accroche : un énoncé ambigu, un indice qui ne débloque rien, un attendu impossible à deviner.

- [ ] **Step 8 : Faire relire, puis commiter**

==C'est du contenu pédagogique : la relecture humaine compte plus que les tests.== Montre les 25
titres et énoncés avant de commiter.

```bash
git add plateforme/contenu plateforme/web/public/contenu
git commit -m "content: reecriture des 25 exercices sans fiction"
```

---

## Tâche 16 : Mettre le vault en accord avec ce qui existe

27 notes mentionnent la fiction. Elles ne se traitent pas toutes de la même façon — ==une note
d'architecture décrit le présent, une ADR enregistre le passé.==

**Files:**
- Modify: les notes descriptives de `docs/vault/`
- Create: `docs/vault/2-decisions/ADR-010 Abandon de la fiction narrative.md`
- Rename: `docs/vault/Quartier Général.md` → `docs/vault/Accueil.md`

### La règle de tri

| Type de note | Traitement |
|---|---|
| **Descriptive** (Vue d'ensemble, Modèle de contenu, Glossaire, Pièges et invariants, Moteurs) | mise à jour : elle doit dire `code_acces`, `eleve`, `DOJO-XXXX` |
| **ADR** (ADR-002, ADR-008) | ==jamais réécrite== : une décision prise reste une décision prise. On l'amende par un renvoi |
| **Plan livré** (Plan palier 1) | intouchée : c'est le compte rendu de ce qui a été construit |
| **Note de fiction** (Terminal QG, Archive des agents tombés) | voir les steps 3 et 4 : leur substance et leur habillage ne se valent pas |

- [ ] **Step 1 : Écrire l'ADR qui enregistre la décision**

`docs/vault/2-decisions/ADR-010 Abandon de la fiction narrative.md`, au format des ADR existantes
(frontmatter `title`/`tags`/`statut`/`date`, puis Contexte / Décision / Conséquences). Le contexte
à consigner :

- la fiction s'était installée dans le **code** (table `agent`, colonne `code_agent`, format
  `AGENT-XXXX`, variables `QG_*`), pas seulement dans les textes ;
- l'interface conçue en [[Spécification interface]] ne la porte plus ;
- ce qu'elle coûtait : un élève qui n'adhère pas à l'histoire lit deux fois plus de texte pour le
  même exercice, et le vocabulaire interne divergeait du produit.

Conséquence à écrire noir sur blanc : ADR-002 est **amendée**, pas annulée — le principe du code
pseudonyme sans donnée personnelle reste, seul son nom change.

- [ ] **Step 2 : Amender ADR-002 sans la réécrire**

Ajouter en tête de `2-decisions/ADR-002 Identification par code d'agent.md`, juste après le callout
de statut :

```markdown
> [!warning] Amendée le 4 septembre 2026 par [[ADR-010 Abandon de la fiction narrative]]
> Le format du code est passé de `AGENT-XXXX` à `DOJO-XXXX`, et la table `agent` s'appelle
> désormais `eleve`. ==La décision elle-même — un code pseudonyme, aucune donnée personnelle,
> aucun SSO — n'a pas changé.== Le texte ci-dessous est conservé tel qu'il a été écrit.
```

Ne touche à rien d'autre dans le fichier. Son titre reste `ADR-002 Identification par code
d'agent` : ==renommer une ADR casse les renvois et efface la trace de ce qui a été décidé==.

- [ ] **Step 3 : Sauver la substance de [[Archive des agents tombés]]**

Cette note dit que les exercices `debug` ne sont **pas des erreurs inventées** : ce sont les vrais
ratages de la promotion 2025, relevés dans les copies conservées. ==C'est la meilleure idée
pédagogique du dossier== et elle n'a rien de fictionnel — seul l'habillage (« transmissions
corrompues d'agents tombés ») l'était.

Renomme la note en `5-pedagogie/Bugs réels de la promotion 2025.md`, retire l'habillage, garde la
méthode et les sources. Mets à jour les renvois `[[Archive des agents tombés]]`.

- [ ] **Step 4 : Trancher le sort de [[Terminal QG]]**

Cette note décrit le fil rouge des trois séances : un programme unique, `acces_qg.py`, construit
bloc par bloc, dont la version finale reproduit `IDQuartierGénéralV1(Facile).py` du cours
précédent.

> [!danger] Ce point demande une décision, pas une réécriture
> ==Le choix « chaque exercice est autonome » supprime ce fil rouge.== Sa fonction pédagogique —
> finir chaque séance par un petit programme complet qui réunit les notions vues — reste bonne.
> Ne supprime pas cette note avant qu'on en ait parlé : elle est le seul endroit où le découpage
> des trois séances est écrit.

Selon la décision prise : soit la note est réécrite autour d'un programme d'assemblage neutre (la
carte de membre du step 1 de la tâche 15), soit elle est archivée avec une note expliquant
pourquoi.

- [ ] **Step 5 : Mettre à jour les notes descriptives**

`Vue d'ensemble`, `Modèle de contenu`, `Moteur d'exécution`, `Moteur de validation`,
`Pièges et invariants`, `Déploiement UNIGE`, `Glossaire`, `Chapitre 1`, `Types d'exercices`,
`Plan de production`, `Spécification chapitre 1`, `Bilan 2025-2026`, `Contraintes`.

Elles décrivent le système tel qu'il est : `code_acces`, table `eleve`, `DOJO-XXXX`, `DOJO_SECRET`.
Le `Glossaire` perd ses entrées de fiction et gagne `code d'accès`, `notion`, `leçon`.

- [ ] **Step 6 : Renommer la note d'accueil**

`Quartier Général.md` est la note d'accueil du vault — son nom est le dernier reste de la fiction,
et il est en haut de l'arborescence.

```bash
cd docs/vault && git mv "Quartier Général.md" "Accueil.md"
```

Puis remplacer `[[Quartier Général]]` par `[[Accueil]]` dans toutes les notes qui y renvoient.

- [ ] **Step 7 : Vérifier qu'aucun lien n'est cassé**

Rejouer le contrôle de liens du vault : pour chaque `[[cible]]` de chaque note, un fichier
`cible.md` doit exister.

Expected : aucun lien cassé. Le vault en comptait zéro avant cette tâche — il doit en compter zéro
après.

- [ ] **Step 8 : Vérifier ce qui reste**

```bash
grep -rniE "agent|quartier|QG" docs/vault/ | grep -v "Plan palier 1" | grep -v "ADR-002"
```

Expected : seulement des occurrences légitimes — `ADR-010` qui explique l'abandon, et les renvois
vers `ADR-002`. Relis-les une par une.

- [ ] **Step 9 : Faire valider, puis commiter**

```bash
git add docs/vault
git commit -m "docs: le vault decrit une plateforme sans fiction"
```

---

## Ce qui reste après ce plan

- Les **séances 2 et 3** : 87 exercices restants sur les 112 conçus dans [[Chapitre 1]].
- L'interface **professeur** de verrouillage : la route API existe, l'écran non.
- Les exercices **experts** : le champ existe dans le schéma, aucun n'est écrit.
