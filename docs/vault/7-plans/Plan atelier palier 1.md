---
title: Plan atelier palier 1
tags:
  - plan
  - implementation
  - contenu
statut: à exécuter
date: 2026-09-27
---

# Atelier de contenu, palier 1 — Plan d'implémentation

> **Exécution :** en ligne, tâche par tâche, un commit par tâche. Les cases `- [ ]` servent au
> suivi.

**Goal:** Ouvrir la chaîne de contenu pour qu'un chapitre 2 soit possible, et publier le schéma en JSON pour que l'atelier puisse s'y adosser — sans qu'un seul octet du contenu déjà publié ne change.

**Architecture:** Les bornes de séance passent de 3 à 99. Les tables `NOTIONS` et `CHAPITRES` quittent `schema.py` pour un `notions.yaml` et un `chapitres.yaml` par dossier de chapitre, chargés à l'exécution dans un registre que le schéma et le validateur consultent. `construire_contenu.py` prend `plateforme/contenu/` pour racine, parcourt les `chapitre-*/`, et publie un cinquième fichier, `schema.json`, produit par Pydantic lui-même.

**Tech Stack:** Python 3.12 · Pydantic v2 · PyYAML · pytest + `pytest-cov` · FastAPI (une ligne) · Docker

Spécification de référence : [[Spécification atelier de contenu]], sections 2 à 4.

## Global Constraints

- **Aucune dépendance nouvelle** dans ce palier. `yaml` côté navigateur arrive au palier 2.
- **Les quatre fichiers publiés — `chapitres.json`, `notions.json`, `exercices.json`, `lecons.json` — sont identiques octet pour octet avant et après ce palier.** C'est l'épreuve qui décide de tout ; la tâche 3 la met en place avant la première modification de fond.
- Le Python de `outils/` et de `api/` reste **en ASCII** dans ses commentaires et ses messages, comme le reste de ces dossiers. Les fichiers de contenu YAML, eux, sont en français accentué.
- **Pas de zéro en tête** dans un identifiant de séance : `s1-01` et `s99-01` sont valides, `s0-01` et `s01-01` ne le sont pas.
- La couverture de `outils/` ne descend pas sous son seuil actuel de 82 % (`.coveragerc`).
- Les messages de commit suivent la convention du dépôt : `type: sujet`, **sans scope**, en ASCII, au présent descriptif. Aucune ligne d'attribution.

## Structure des fichiers

| Fichier | Responsabilité après ce palier |
|---|---|
| `plateforme/contenu/chapitre-1/notions.yaml` | **Créé.** Les quatorze notions du chapitre 1 : ordre, titre, famille, chapitre, et le motif facultatif qui les trahit dans une leçon |
| `plateforme/contenu/chapitre-1/chapitres.yaml` | **Créé.** Les trois chapitres de navigation : ordre, titre, séance, date d'ouverture |
| `plateforme/outils/schema.py` | Les modèles, plus un **chargeur de tables** et le registre qu'il remplit. Ne contient plus aucune table en dur |
| `plateforme/outils/valider_contenu.py` | Les contrôles. Lit le registre ; `MOTIFS_NOTION` disparaît au profit du champ `motif` |
| `plateforme/outils/construire_contenu.py` | Racine = `contenu/`, parcourt les chapitres, publie cinq fichiers |
| `plateforme/api/app/routes_eleve.py` | Une expression régulière élargie, miroir assumé de celle du schéma |
| `plateforme/outils/tests/reference/*.json` | **Créé.** Le filet : les quatre fichiers publiés, figés |

---

### Tâche 1 : les bornes s'ouvrent aux séances 1 à 99

**Files:**
- Modify: `plateforme/outils/schema.py` (`MOTIF_ID` ligne 12, `seance` ligne 87, `MOTIF_LECON` ligne 142)
- Modify: `plateforme/api/app/routes_eleve.py` (`MOTIF_EXERCICE` ligne 16)
- Test: `plateforme/outils/tests/test_schema.py`, `plateforme/api/tests/test_routes_eleve.py`

**Interfaces:**
- Produces: `MOTIF_ID` et `MOTIF_EXERCICE`, deux expressions identiques dans deux dépôts de code qui ne se voient pas.

- [ ] **Étape 1 : écrire les tests qui échouent** — ajouter à `outils/tests/test_schema.py` :

Le fichier possède déjà `exercice_minimal(**remplacements)`, qui rend un exercice valide ; c'est
lui qu'on emploie, il n'y a pas de `BASE` ici.

```python
@pytest.mark.parametrize("identifiant, seance", [("s1-01", 1), ("s9-01", 9), ("s99-01", 99)])
def test_une_seance_au_dela_de_trois_est_acceptee(identifiant, seance):
    ex = exercice_minimal(id=identifiant, seance=seance)
    assert ex.id == identifiant


@pytest.mark.parametrize("identifiant", ["s0-01", "s01-01", "s100-01", "s1-1", "x1-01"])
def test_un_identifiant_mal_forme_reste_refuse(identifiant):
    with pytest.raises(ValidationError):
        exercice_minimal(id=identifiant)


def test_une_lecon_de_la_seance_dix_est_acceptee():
    from schema import MOTIF_LECON

    assert MOTIF_LECON.match("c10-variables")
    assert not MOTIF_LECON.match("c0-variables")
    assert not MOTIF_LECON.match("c01-variables")
```

  Et à `api/tests/test_routes_eleve.py` :

```python
def test_une_tentative_sur_une_seance_au_dela_de_trois_est_acceptee(client, jeton):
    reponse = client.post(
        "/tentative",
        headers={"Authorization": f"Bearer {jeton}"},
        json={"exercice_id": "s4-01", "verdict": "vert", "duree_ms": 42},
    )
    assert reponse.status_code == 200


def test_un_identifiant_d_exercice_mal_forme_reste_refuse(client, jeton):
    for faux in ("s0-01", "s01-01", "s100-01"):
        reponse = client.post(
            "/tentative",
            headers={"Authorization": f"Bearer {jeton}"},
            json={"exercice_id": faux, "verdict": "vert", "duree_ms": 42},
        )
        assert reponse.status_code == 422, faux
```

- [ ] **Étape 2 : les lancer** — depuis `plateforme/outils` : `.venv/Scripts/python -m pytest tests/test_schema.py -q`, puis depuis `plateforme/api` : `.venv/Scripts/python -m pytest tests/test_routes_eleve.py -q`.
  Attendu : échec sur `s9-01`, `s99-01`, `c10-variables` et `s4-01`.

- [ ] **Étape 3 : élargir le schéma** — dans `schema.py` :

```python
# Une a 99 seances. La borne ne commande plus le calendrier : elle n'est la
# que pour attraper une faute de frappe. Pas de zero en tete, sinon `s01-01`
# et `s1-01` designeraient le meme exercice sous deux noms.
MOTIF_ID = re.compile(r"^s([1-9][0-9]?)-[0-9]{2}(-expert)?$")
```

  ligne 87 : `seance: int = Field(ge=1, le=99)`

```python
MOTIF_LECON = re.compile(r"^c([1-9][0-9]?)-[a-z]+$")
```

- [ ] **Étape 4 : élargir la liste blanche de l'API** — dans `routes_eleve.py` :

```python
# Miroir de outils/schema.py::MOTIF_ID. L'image de l'API ne contient pas
# `outils/`, donc les deux expressions ne peuvent pas s'importer : elles se
# recopient, et les deux suites de tests fixent les memes cas limites.
MOTIF_EXERCICE = re.compile(r"^s([1-9][0-9]?)-[0-9]{2}(-expert)?$")
```

  Et dans `schema.py`, au-dessus de `MOTIF_ID`, la réciproque : `# Miroir dans api/app/routes_eleve.py::MOTIF_EXERCICE.`

- [ ] **Étape 5 : les deux suites entières** — `outils` puis `api`. Attendu : tout passe.

- [ ] **Étape 6 : commit**

```bash
git add plateforme/outils/schema.py plateforme/outils/tests/test_schema.py plateforme/api/app/routes_eleve.py plateforme/api/tests/test_routes_eleve.py
git commit -m "feat: les seances vont jusqu'a 99, pas jusqu'a trois

Le premier exercice du chapitre 2 etait refuse par la validation. Les deux
expressions vivent dans deux images qui ne se voient pas : elles se recopient,
et chaque suite fixe les memes cas limites."
```

---

### Tâche 2 : le champ `seance` s'accorde avec l'identifiant

`s2-14` doit porter `seance: 2`. Rien ne le vérifie aujourd'hui, et les 112 fichiers se sont suivis à la main. Un exercice rangé dans la mauvaise séance n'échoue nulle part — il apparaît le mauvais jour.

**Files:**
- Modify: `plateforme/outils/schema.py` (classe `Exercice`)
- Test: `plateforme/outils/tests/test_schema.py`

**Interfaces:**
- Consumes: `MOTIF_ID` élargi (tâche 1).
- Produces: `Exercice.seance_accordee_a_l_identifiant`, un `model_validator(mode="after")`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```python
def test_la_seance_doit_suivre_l_identifiant():
    with pytest.raises(ValidationError, match="s2-14 annonce la seance 3"):
        exercice_minimal(id="s2-14", seance=3)


def test_un_expert_suit_aussi_son_identifiant():
    ex = exercice_minimal(id="s12-07-expert", seance=12, niveau="expert")
    assert ex.seance == 12


def test_les_112_exercices_du_depot_sont_deja_accordes():
    """La regle est ajoutee apres coup : elle ne doit rien casser d'existant."""
    from pathlib import Path

    from schema import charger_tous

    racine = Path(__file__).parent.parent.parent / "contenu" / "chapitre-1"
    assert len(charger_tous(racine)) == 112
```

- [ ] **Étape 2 : les lancer** — `.venv/Scripts/python -m pytest tests/test_schema.py -q`. Attendu : le premier échoue, aucune exception n'est levée.

- [ ] **Étape 3 : la règle** — dans `Exercice`, après `identifiant_bien_forme` :

```python
    @model_validator(mode="after")
    def seance_accordee_a_l_identifiant(self) -> "Exercice":
        # `s2-14` avec `seance: 3` ne fait echouer personne : l'exercice
        # apparait simplement le mauvais jour, et c'est invisible jusqu'au
        # cours. Les deux se sont suivis a la main sur 112 fichiers.
        annoncee = int(self.id.split("-")[0][1:])
        if annoncee != self.seance:
            raise ValueError(f"{self.id} annonce la seance {self.seance}, pas {annoncee}")
        return self
```

- [ ] **Étape 4 : la suite entière de `outils`.** Attendu : tout passe, les 112 exercices compris.

- [ ] **Étape 5 : commit**

```bash
git add plateforme/outils/schema.py plateforme/outils/tests/test_schema.py
git commit -m "feat: la seance d'un exercice s'accorde a son identifiant

s2-14 doit porter seance 2. Personne ne le verifiait, et un exercice mal range
n'echoue nulle part : il apparait le mauvais jour, ce qui ne se voit qu'en
cours. Les 112 fichiers du depot sont deja accordes."
```

---

### Tâche 3 : le filet — les quatre fichiers publiés sont figés

**À faire avant toute modification de fond.** Les tâches 4 à 8 déplacent la source des tables ; cette épreuve est ce qui prouve que le déplacement n'a changé que l'adresse.

**Files:**
- Create: `plateforme/outils/tests/reference/{chapitres,notions,exercices,lecons}.json`
- Create: `plateforme/outils/tests/test_contenu_publie.py`

**Interfaces:**
- Consumes: `construire(racine: Path, sortie: Path) -> int` de `construire_contenu.py`.
- Produces: `test_contenu_publie.py`, qui reconstruit et compare octet pour octet.

- [ ] **Étape 1 : geler la sortie actuelle** — depuis `plateforme/outils`, **sur le code d'aujourd'hui, avant tout changement de tâche 4** :

```bash
.venv/Scripts/python -c "from pathlib import Path; from construire_contenu import construire; print(construire(Path('../contenu/chapitre-1'), Path('tests/reference')))"
```

  Attendu : `112`, et quatre fichiers dans `tests/reference/`.

- [ ] **Étape 2 : écrire l'épreuve**

```python
"""Le filet du palier 1 : deplacer les tables ne change pas ce qui est publie.

Les quatre fichiers de `reference/` ont ete produits par le code du
25 septembre 2026, avant que NOTIONS et CHAPITRES ne quittent schema.py. Si
l'un d'eux bouge, le deplacement a change autre chose que l'adresse des
tables. `schema.json`, ajoute plus tard, n'est volontairement pas dans le lot.
"""

from pathlib import Path

from construire_contenu import construire

REFERENCE = Path(__file__).parent / "reference"
CONTENU = Path(__file__).parent.parent.parent / "contenu"
PUBLIES = ("chapitres.json", "notions.json", "exercices.json", "lecons.json")


def test_les_quatre_fichiers_publies_ne_bougent_pas(tmp_path):
    construire(CONTENU / "chapitre-1", tmp_path)
    for nom in PUBLIES:
        attendu = (REFERENCE / nom).read_text(encoding="utf-8")
        obtenu = (tmp_path / nom).read_text(encoding="utf-8")
        assert obtenu == attendu, f"{nom} a change"
```

- [ ] **Étape 3 : la lancer** — `.venv/Scripts/python -m pytest tests/test_contenu_publie.py -q`. Attendu : PASSE. Une épreuve qui échoue ici veut dire que l'étape 1 n'a pas été jouée sur le code d'origine.

- [ ] **Étape 4 : commit**

```bash
git add plateforme/outils/tests/reference plateforme/outils/tests/test_contenu_publie.py
git commit -m "test: les quatre fichiers publies sont figes avant le deplacement des tables

NOTIONS et CHAPITRES vont quitter schema.py. Cette epreuve est ce qui prouvera
que le deplacement n'a change que leur adresse."
```

---

### Tâche 4 : les tables deviennent du contenu, et un chargeur les lit

Les fichiers et le chargeur seulement. Personne ne les consomme encore : `schema.py` garde ses dictionnaires, et une épreuve compare les deux. C'est la preuve que la recopie est fidèle.

**Files:**
- Create: `plateforme/contenu/chapitre-1/notions.yaml`, `plateforme/contenu/chapitre-1/chapitres.yaml`
- Modify: `plateforme/outils/schema.py` (`charger_table`, et l'exclusion dans `charger_tous`)
- Test: `plateforme/outils/tests/test_tables.py`

**Interfaces:**
- Produces: `charger_table(chemin: Path) -> dict[str, dict]` — lit une liste YAML dont chaque entrée porte un `id`, et rend un dictionnaire indexé par cet `id`, l'`id` retiré des détails. C'est exactement la forme de `NOTIONS` et de `CHAPITRES`.

- [ ] **Étape 1 : écrire l'épreuve qui échoue** — `tests/test_tables.py`

```python
"""Les tables de contenu, lues depuis le YAML. Voir Specification atelier."""

from datetime import date
from pathlib import Path

import pytest

from schema import CHAPITRES, NOTIONS, charger_table

CHAPITRE_1 = Path(__file__).parent.parent.parent / "contenu" / "chapitre-1"


def test_les_notions_yaml_disent_la_meme_chose_que_la_table_python():
    """L'epreuve de fidelite de la recopie. Elle disparait avec la table Python."""
    lues = charger_table(CHAPITRE_1 / "notions.yaml")
    sans_motif = {
        identifiant: {cle: v for cle, v in details.items() if cle != "motif"}
        for identifiant, details in lues.items()
    }
    assert sans_motif == NOTIONS


def test_les_chapitres_yaml_disent_la_meme_chose_que_la_table_python():
    assert charger_table(CHAPITRE_1 / "chapitres.yaml") == CHAPITRES


def test_une_date_d_ouverture_reste_une_chaine():
    """YAML transforme une date nue en objet date, et verifier_chapitres attend
    une chaine. Sans guillemets, le controle de format ne verrait jamais rien."""
    ouverture = charger_table(CHAPITRE_1 / "chapitres.yaml")["decisions"]["ouverture"]
    assert isinstance(ouverture, str)
    assert not isinstance(ouverture, date)


def test_l_identifiant_sort_des_details(tmp_path):
    fichier = tmp_path / "t.yaml"
    fichier.write_text("- id: alpha\n  ordre: 1\n", encoding="utf-8")
    assert charger_table(fichier) == {"alpha": {"ordre": 1}}


def test_un_identifiant_en_double_est_refuse(tmp_path):
    fichier = tmp_path / "t.yaml"
    fichier.write_text("- id: alpha\n  ordre: 1\n- id: alpha\n  ordre: 2\n", encoding="utf-8")
    with pytest.raises(ValueError, match="alpha"):
        charger_table(fichier)


def test_les_tables_ne_sont_pas_chargees_comme_des_exercices():
    """`charger_tous` fait un rglob sur *.yaml : sans exclusion, il essaierait
    de lire notions.yaml comme un exercice et echouerait sur un fichier sain."""
    from schema import charger_tous

    assert len(charger_tous(CHAPITRE_1)) == 112
```

- [ ] **Étape 2 : la lancer** — `.venv/Scripts/python -m pytest tests/test_tables.py -q`. Attendu : échec sur `charger_table` introuvable.

- [ ] **Étape 3 : écrire `notions.yaml`** — `plateforme/contenu/chapitre-1/notions.yaml`

```yaml
# Les notions du chapitre 1, dans l'ordre du cours. Une notion est l'unité de
# navigation : elle porte une leçon, un groupe d'exercices et une couleur.
#
# SEULE SOURCE de cette table. Le schéma la charge, construire_contenu.py la
# publie dans notions.json, et le front la lit là. Personne ne la recopie.
#
# `famille` est un nom de couleur, pas un nom de sens : la couleur suit la
# NOTION, pas le concept. Les cinq familles doivent être distinctes à
# l'intérieur d'un chapitre, ce qui borne un chapitre à cinq notions.
#
# `motif` est facultatif : c'est ce qui trahit la notion dans un exemple de
# leçon. Une leçon d'ordre N ne peut employer que des notions d'ordre ≤ N.
# Le motif est compilé avec re.MULTILINE. Il n'est jamais publié.

- id: afficher
  ordre: 1
  titre: Afficher un message
  famille: conditions
  chapitre: bases

- id: variables
  ordre: 2
  titre: Les variables
  famille: variables
  chapitre: bases
  # Une affectation en début de ligne, mais pas une comparaison `==`.
  motif: '^\s*[a-z_][a-z0-9_]*\s*=(?!=)'

- id: types
  ordre: 3
  titre: Types et conversion
  famille: types
  chapitre: bases
  motif: '\b(?:int|float|str)\s*\(|\bf["'']'

- id: saisie
  ordre: 4
  titre: Demander une information
  famille: operateurs
  chapitre: bases
  motif: '\binput\s*\('

# --- Séance 2 ---
# Une notion à part pour les trois exercices de réactivation : la conception
# exige un créneau NOMMÉ, qu'on ne peut pas sacrifier quand la séance déborde.
- id: reveil
  ordre: 5
  titre: Se remettre en route
  famille: variables
  chapitre: decisions

- id: calculer
  ordre: 6
  titre: Calculer
  famille: operateurs
  chapitre: decisions

- id: comparer
  ordre: 7
  titre: Comparer
  famille: types
  chapitre: decisions

- id: combiner
  ordre: 8
  titre: Combiner des conditions
  famille: boucles
  chapitre: decisions

- id: decider
  ordre: 9
  titre: Décider avec if et else
  famille: conditions
  chapitre: decisions

# --- Séance 3 ---
- id: rappels
  ordre: 10
  titre: Rappels
  famille: variables
  chapitre: boucles

- id: repeter
  ordre: 11
  titre: Répéter avec for
  famille: boucles
  chapitre: boucles

- id: parcourir
  ordre: 12
  titre: Parcourir un texte
  famille: types
  chapitre: boucles

- id: compter
  ordre: 13
  titre: Compter et cumuler
  famille: operateurs
  chapitre: boucles

- id: tantque
  ordre: 14
  titre: Répéter tant que
  famille: conditions
  chapitre: boucles
```

> ⚠️ **Les titres ci-dessus doivent être recopiés depuis `NOTIONS`, pas retapés.** Une lettre qui
> diverge fait échouer l'épreuve de l'étape 1, ce qui est le comportement voulu — mais autant ne
> pas la provoquer. Relire la table avec :
> `.venv/Scripts/python -c "import json;from schema import NOTIONS;print(json.dumps(NOTIONS,ensure_ascii=False,indent=1))"`

- [ ] **Étape 4 : écrire `chapitres.yaml`**

```yaml
# Les chapitres de navigation. ATTENTION au vocabulaire : ici, un « chapitre »
# vaut UNE SÉANCE — `bases` est la séance 1 — alors que le dossier
# `contenu/chapitre-1/` désigne le chapitre du cours, qui en contient trois.
# Les renommer ferait bouger chapitres.json et tout l'ADR-013.
#
# `ouverture` est facultative. Avant ce jour, le chapitre n'existe ni pour
# l'élève ni dans les comptes du tableau de bord — voir ADR-013. Elle est
# ENTRE GUILLEMETS : sans eux, YAML en fait un objet date, et le contrôle de
# format ne verrait jamais rien passer.

- id: bases
  ordre: 1
  titre: Les bases de Python
  seance: 1

- id: decisions
  ordre: 2
  titre: Calculer, comparer, décider
  seance: 2
  ouverture: "2026-09-23"

- id: boucles
  ordre: 3
  titre: Répéter, parcourir, compter
  seance: 3
  ouverture: "2026-09-30"
```

- [ ] **Étape 5 : le chargeur** — dans `schema.py`, juste avant `NOTIONS` :

```python
def charger_table(chemin: Path) -> dict[str, dict]:
    """Lit une table de contenu : une liste d'entrees portant chacune un `id`.

    Rend un dictionnaire indexe par cet identifiant, l'identifiant retire des
    details — exactement la forme qu'avaient NOTIONS et CHAPITRES quand elles
    vivaient ici en dur.
    """
    table: dict[str, dict] = {}
    for entree in yaml.safe_load(chemin.read_text(encoding="utf-8")):
        details = dict(entree)
        identifiant = details.pop("id")
        if identifiant in table:
            raise ValueError(f"{chemin.name} : l'identifiant {identifiant!r} apparait deux fois")
        table[identifiant] = details
    return table
```

- [ ] **Étape 6 : exclure les tables du chargement des exercices** — dans `charger_tous` :

```python
# Les tables de contenu vivent a la racine du chapitre et ne sont PAS des
# exercices : les charger ici ferait echouer la validation sur un fichier
# parfaitement sain, avec un message parlant de champs d'exercice manquants.
# Meme raison que pour les lecons.
TABLES = {"notions.yaml", "chapitres.yaml"}


def charger_tous(racine: Path) -> list[Exercice]:
    return [
        charger_exercice(p)
        for p in sorted(racine.rglob("*.yaml"))
        if "lecons" not in p.parts and p.name not in TABLES
    ]
```

- [ ] **Étape 7 : lancer `tests/test_tables.py`, puis la suite entière.** Attendu : tout passe, `test_contenu_publie.py` compris.

- [ ] **Étape 8 : commit**

```bash
git add plateforme/contenu/chapitre-1/notions.yaml plateforme/contenu/chapitre-1/chapitres.yaml plateforme/outils/schema.py plateforme/outils/tests/test_tables.py
git commit -m "feat: les notions et les chapitres deviennent des fichiers de contenu

Un titre, un ordre, une couleur, une date d'ouverture : c'est du contenu, pas
du code. Les deux fichiers coexistent pour l'instant avec les tables Python,
et une epreuve verifie qu'ils disent exactement la meme chose."
```

---

### Tâche 5 : le schéma et le validateur lisent les tables chargées

**Files:**
- Modify: `plateforme/outils/schema.py` (suppression des littéraux, registre, `Lecon.notion`)
- Modify: `plateforme/outils/valider_contenu.py` (`MOTIFS_NOTION` disparaît, `verifier_racine` charge)
- Modify: `plateforme/outils/tests/test_tables.py` (les deux épreuves de fidélité disparaissent)
- Test: `plateforme/outils/tests/test_schema_lecon.py`, `tests/test_valider_lecon.py`

**Interfaces:**
- Consumes: `charger_table` (tâche 4).
- Produces: `NOTIONS: dict[str, dict]` et `CHAPITRES: dict[str, dict]`, **vides au chargement du module** et remplis par `charger_tables(racine: Path) -> None`, qui lit tous les `chapitre-*/`.

> [!warning] Le piège central de ce palier
> `Lecon.notion` est déclaré `Literal[tuple(NOTIONS)]`, ==évalué à la définition de la classe==.
> Dès que la table est vide au chargement du module, ce `Literal` devient vide et **toutes** les
> leçons sont refusées. Il doit devenir un `field_validator`.

- [ ] **Étape 1 : écrire les épreuves qui échouent** — ajouter à `tests/test_tables.py` :

```python
def test_le_registre_est_vide_avant_chargement(monkeypatch):
    """Rien ne doit dependre d'une table remplie a l'import du module."""
    import schema

    monkeypatch.setattr(schema, "NOTIONS", {})
    monkeypatch.setattr(schema, "CHAPITRES", {})
    assert schema.NOTIONS == {}


def test_charger_tables_remplit_les_deux_registres():
    import schema

    schema.charger_tables(CHAPITRE_1.parent)
    assert len(schema.NOTIONS) == 14
    assert set(schema.CHAPITRES) == {"bases", "decisions", "boucles"}


def test_une_lecon_sur_une_notion_inconnue_est_refusee():
    import pytest
    from pydantic import ValidationError

    import schema

    schema.charger_tables(CHAPITRE_1.parent)
    with pytest.raises(ValidationError, match="notion inconnue"):
        schema.Lecon(
            id="c1-fantome",
            notion="fantome",
            ordre=1,
            titre="T",
            duree_min=5,
            blocs=[{"type": "paragraphe", "texte": "Bonjour."}],
        )
```

- [ ] **Étape 2 : les lancer.** Attendu : échec sur `charger_tables` introuvable.

- [ ] **Étape 3 : le registre** — dans `schema.py`, remplacer les deux dictionnaires littéraux par :

```python
# Les tables de contenu, remplies par `charger_tables`. Vides au chargement du
# module : elles vivent desormais dans contenu/chapitre-*/notions.yaml et
# chapitres.yaml. Rien ne doit donc les lire au moment de DEFINIR une classe —
# seulement au moment de valider une instance.
NOTIONS: dict[str, dict] = {}
CHAPITRES: dict[str, dict] = {}


def charger_tables(racine: Path) -> None:
    """Remplit les registres depuis tous les chapitres sous `racine`.

    Remplace le contenu au lieu de l'accumuler : deux appels de suite donnent
    le meme etat, ce dont les tests dependent.
    """
    NOTIONS.clear()
    CHAPITRES.clear()
    for dossier in sorted(racine.glob("chapitre-*")):
        for nom, registre in (("notions.yaml", NOTIONS), ("chapitres.yaml", CHAPITRES)):
            chemin = dossier / nom
            if not chemin.exists():
                continue
            for identifiant, details in charger_table(chemin).items():
                if identifiant in registre:
                    raise ValueError(
                        f"{chemin} : {identifiant!r} est deja declare dans un autre chapitre"
                    )
                registre[identifiant] = details
```

- [ ] **Étape 4 : `Lecon.notion` devient un champ validé**

```python
    notion: str
```

  et, parmi les validateurs de `Lecon` :

```python
    @field_validator("notion")
    @classmethod
    def notion_connue(cls, v: str) -> str:
        # Etait un Literal[tuple(NOTIONS)], evalue a la definition de la
        # classe. Les notions se chargent maintenant a l'execution : un
        # Literal serait fige sur une table vide, et refuserait tout.
        if v not in NOTIONS:
            raise ValueError(f"notion inconnue : {v!r}")
        return v
```

- [ ] **Étape 5 : le motif remplace `MOTIFS_NOTION`** — dans `valider_contenu.py`, supprimer le dictionnaire et son commentaire, puis dans `verifier_lecon` :

```python
    for bloc in lecon.blocs:
        if not isinstance(bloc, BlocCode):
            continue

        for notion, details in NOTIONS.items():
            motif = details.get("motif")
            # MULTILINE toujours : un seul motif en a besoin (l'affectation en
            # debut de ligne), et il est inoffensif pour les autres.
            if (
                motif
                and details["ordre"] > lecon.ordre
                and re.search(motif, bloc.python, re.MULTILINE)
            ):
                problemes.append(
                    f"{lecon.id} : l'exemple {bloc.legende!r} utilise la notion "
                    f"{notion!r}, enseignee apres celle-ci"
                )
```

- [ ] **Étape 6 : `verifier_racine` charge les tables en premier** — première ligne du corps :

```python
    # Avant tout chargement d'exercice ou de lecon : les modeles valident
    # contre ces registres. La racine est `contenu/`, et elle contient les
    # dossiers `chapitre-*`.
    charger_tables(racine if racine.name != "chapitre-1" else racine.parent)
```

> Cette ligne est **provisoire** : elle accepte encore une racine de chapitre pour que la tâche 5 passe seule. La tâche 6 la réduit à `charger_tables(racine)` une fois la racine devenue `contenu/`.

- [ ] **Étape 7 : retirer les deux épreuves de fidélité** de `tests/test_tables.py` — `test_les_notions_yaml_disent_la_meme_chose_que_la_table_python` et sa jumelle. Elles comparaient le YAML aux littéraux Python, qui n'existent plus. Ce qu'elles protégeaient est désormais protégé par `test_contenu_publie.py`, qui compare la sortie réelle.

- [ ] **Étape 8 : la suite entière de `outils`.** Attendu : tout passe, `test_contenu_publie.py` en tête. **Si ce dernier échoue, ne pas ajuster la référence** : c'est le déplacement qui a changé quelque chose.

- [ ] **Étape 9 : commit**

```bash
git add plateforme/outils/schema.py plateforme/outils/valider_contenu.py plateforme/outils/tests/test_tables.py
git commit -m "feat: le schema et le validateur lisent les tables chargees

Les dictionnaires en dur disparaissent. Lecon.notion etait un Literal evalue a
la definition de la classe : il devient un validateur, sans quoi une table
remplie a l'execution arriverait trop tard et refuserait toutes les lecons.

MOTIFS_NOTION disparait au profit du champ motif de notions.yaml. Il etait fige
sur les notions du chapitre 1 et levait une KeyError si l'une disparaissait.

Les deux epreuves de fidelite tombent avec les tables Python qu'elles
comparaient : le contenu publie est desormais tenu par test_contenu_publie."
```

---

### Tâche 6 : le constructeur prend `contenu/` pour racine

**Files:**
- Modify: `plateforme/outils/construire_contenu.py`, `plateforme/outils/valider_contenu.py`
- Modify: `deploiement/Dockerfile.web`, `README.md`
- Test: `plateforme/outils/tests/test_contenu_publie.py`, `tests/test_construire_contenu.py`

**Interfaces:**
- Consumes: `charger_tables(racine)` (tâche 5).
- Produces: `construire(racine: Path, sortie: Path) -> int` où `racine` est désormais `plateforme/contenu/`.

- [ ] **Étape 1 : faire échouer l'épreuve en la pointant sur la nouvelle racine** — dans `test_contenu_publie.py`, remplacer l'appel :

```python
    construire(CONTENU, tmp_path)
```

- [ ] **Étape 2 : la lancer.** Attendu : ÉCHEC — `charger_tous` ne trouve rien, ou la comparaison diverge.

- [ ] **Étape 3 : `verifier_racine` parcourt les chapitres** — dans `valider_contenu.py` :

Deux lignes seulement changent dans le corps. La première est celle que la tâche 5 avait laissée
provisoire, qui redescendait d'un cran quand on lui passait un dossier de chapitre :

```python
    # Etait : charger_tables(racine if racine.name != "chapitre-1" else racine.parent)
    # La racine est desormais `contenu/`, qui contient les `chapitre-*`.
    charger_tables(racine)
```

La seconde est le parcours des leçons, qui gagne un niveau :

```python
    # Etait : racine.glob("seance-*/lecons")
    for dossier in sorted(racine.glob("chapitre-*/seance-*/lecons")):
        lecons += charger_lecons(dossier)
```

  `charger_tous` fait déjà un `rglob`, il descend donc dans les chapitres sans changement.

- [ ] **Étape 4 : les valeurs par défaut des deux scripts** — `Path("../contenu")` dans `construire_contenu.py` et dans `valider_contenu.py`. Les anciennes (`../../contenu/chapitre-1`) désignaient un dossier qui n'existe pas ; seuls les appels explicites fonctionnaient.

- [ ] **Étape 5 : le Dockerfile** — dans `deploiement/Dockerfile.web`, la ligne de construction :

```dockerfile
 && cd outils && python construire_contenu.py ../contenu /build/public-contenu
```

- [ ] **Étape 6 : le README** — les deux commandes de la section « Développer » :

```bash
.venv/Scripts/python valider_contenu.py ../contenu
.venv/Scripts/python construire_contenu.py ../contenu ../web/public/contenu
```

- [ ] **Étape 7 : adapter `tests/test_construire_contenu.py`.** Chacun de ses tests construit depuis un `tmp_path` qui figurait un dossier de chapitre ; ce `tmp_path` devient `contenu/`, et il lui faut un chapitre avec ses tables. Ajouter en tête du fichier :

```python
NOTIONS_MINIMALES = [
    {
        "id": "afficher",
        "ordre": 1,
        "titre": "Afficher un message",
        "famille": "conditions",
        "chapitre": "bases",
    }
]
CHAPITRES_MINIMAUX = [{"id": "bases", "ordre": 1, "titre": "Les bases", "seance": 1}]


def _chapitre(racine: Path, nom: str = "chapitre-1") -> Path:
    """Un dossier de chapitre avec ses deux tables.

    La racine de construction est desormais `contenu/`, qui contient des
    `chapitre-*`. Un test qui ecrit ses exercices directement sous la racine
    ne publierait plus rien, et sans tables aucune notion ne serait connue.
    """
    dossier = racine / nom
    dossier.mkdir(parents=True, exist_ok=True)
    for fichier, table in (
        ("notions.yaml", NOTIONS_MINIMALES),
        ("chapitres.yaml", CHAPITRES_MINIMAUX),
    ):
        (dossier / fichier).write_text(
            yaml.safe_dump(table, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )
    return dossier
```

  Puis, dans chaque test, remplacer `_ecrire(tmp_path / "seance-1", …)` par
  `_ecrire(_chapitre(tmp_path) / "seance-1", …)`. L'appel `construire(tmp_path, sortie)` ne change
  pas : `tmp_path` est maintenant la racine `contenu/`.

  Les trois tests qui vérifient les tables publiées (`chapitres.json`, `notions.json`) comparaient
  leur contenu à `CHAPITRES` et `NOTIONS` importés de `schema` ; ces registres sont désormais
  remplis par la construction elle-même, à partir des tables minimales. Les comparer à
  `NOTIONS_MINIMALES` et `CHAPITRES_MINIMAUX` dit la même chose et ne dépend plus d'un import qui
  change sous les pieds du test.

- [ ] **Étape 8 : relancer l'épreuve, puis la suite entière.** Attendu : les quatre fichiers de `test_contenu_publie.py` sont **identiques**, et `test_construire_contenu.py` passe.

- [ ] **Étape 9 : vérifier la construction réelle de l'image**

```bash
docker compose build web
```

  Attendu : l'étape `contenu` affiche `112 exercices publies`.

- [ ] **Étape 10 : commit**

```bash
git add plateforme/outils README.md deploiement/Dockerfile.web
git commit -m "feat: la construction part de contenu, pas d'un seul chapitre

Chaque chapitre porte desormais ses tables. Construire le chapitre 1 seul
effacerait les notions du 2 de tout ce qui est publie. Les quatre fichiers
sortent identiques, octet pour octet."
```

---

### Tâche 7 : trois contrôles que rien n'imposait

**Files:**
- Modify: `plateforme/outils/valider_contenu.py` (`verifier_tables`, appelée par `verifier_racine`)
- Modify: `plateforme/outils/schema.py` (`Exercice.notion`)
- Test: `plateforme/outils/tests/test_valider_tables.py`

**Interfaces:**
- Produces: `verifier_tables(notions: dict[str, dict], chapitres: dict[str, dict]) -> list[str]`, sur le modèle de `verifier_chapitres`, appelée depuis `verifier_racine`.

- [ ] **Étape 1 : écrire les épreuves qui échouent** — `tests/test_valider_tables.py`

```python
"""Deux regles tenues a la main sur quatorze notions, et desormais verifiees."""

import pytest
from pydantic import ValidationError

from valider_contenu import verifier_tables

CHAPITRES = {"bases": {"ordre": 1, "titre": "Bases", "seance": 1}}


def _notion(chapitre="bases", famille="variables", ordre=1):
    return {"ordre": ordre, "titre": "T", "famille": famille, "chapitre": chapitre}


def test_deux_notions_de_meme_famille_dans_un_chapitre_echouent():
    notions = {"a": _notion(famille="types"), "b": _notion(famille="types", ordre=2)}
    (probleme,) = verifier_tables(notions, CHAPITRES)
    assert "types" in probleme and "bases" in probleme


def test_deux_familles_differentes_passent():
    notions = {"a": _notion(famille="types"), "b": _notion(famille="conditions", ordre=2)}
    assert verifier_tables(notions, CHAPITRES) == []


def test_la_meme_famille_dans_deux_chapitres_differents_passe():
    chapitres = {**CHAPITRES, "suite": {"ordre": 2, "titre": "S", "seance": 2}}
    notions = {"a": _notion(famille="types"), "b": _notion("suite", "types", 2)}
    assert verifier_tables(notions, chapitres) == []


def test_une_notion_qui_pointe_un_chapitre_inconnu_echoue():
    (probleme,) = verifier_tables({"a": _notion(chapitre="fantome")}, CHAPITRES)
    assert "fantome" in probleme


def test_les_tables_du_depot_passent():
    from pathlib import Path

    import schema

    schema.charger_tables(Path(__file__).parent.parent.parent / "contenu")
    assert verifier_tables(schema.NOTIONS, schema.CHAPITRES) == []


def test_deux_exercices_de_meme_identifiant_dans_deux_chapitres_echouent(tmp_path):
    """Rien ne les distinguerait : le second ecrasait le premier a l'affichage."""
    import yaml

    from valider_contenu import verifier_racine

    exercice = dict(
        id="s1-01",
        concept="print",
        notion="a",
        seance=1,
        niveau="normal",
        type="ecrire",
        titre="T",
        obligatoire=True,
        enonce="Affiche Camille.",
        tests=[{"type": "interdit", "motif": "xyzzy"}],
        solution='print("Camille")\n',
    )
    for numero, notion in ((1, "a"), (2, "b")):
        dossier = tmp_path / f"chapitre-{numero}"
        (dossier / "seance-1").mkdir(parents=True)
        (dossier / "notions.yaml").write_text(
            yaml.safe_dump(
                [
                    {
                        "id": notion,
                        "ordre": numero,
                        "titre": "T",
                        "famille": "variables",
                        "chapitre": f"c{numero}",
                    }
                ],
                sort_keys=False,
            ),
            encoding="utf-8",
        )
        (dossier / "chapitres.yaml").write_text(
            yaml.safe_dump(
                [{"id": f"c{numero}", "ordre": numero, "titre": "T", "seance": numero}],
                sort_keys=False,
            ),
            encoding="utf-8",
        )
        (dossier / "seance-1" / "s1-01.yaml").write_text(
            yaml.safe_dump({**exercice, "notion": notion}, allow_unicode=True), encoding="utf-8"
        )

    _, _, problemes = verifier_racine(tmp_path)
    assert any("s1-01" in p and "deux fois" in p for p in problemes)


def test_un_exercice_sur_une_notion_inconnue_est_refuse():
    from pathlib import Path

    import schema

    schema.charger_tables(Path(__file__).parent.parent.parent / "contenu")
    with pytest.raises(ValidationError, match="notion inconnue"):
        schema.Exercice(
            id="s1-01",
            concept="print",
            notion="fantome",
            seance=1,
            niveau="normal",
            type="ecrire",
            titre="T",
            obligatoire=True,
            enonce="Affiche Camille.",
            tests=[{"type": "interdit", "motif": "Camille"}],
            solution='print("Camille")\n',
        )
```

- [ ] **Étape 2 : les lancer.** Attendu : échec sur `verifier_tables` introuvable.

- [ ] **Étape 3 : le contrôle des tables** — dans `valider_contenu.py`, à côté de `verifier_chapitres` :

```python
def verifier_tables(notions: dict[str, dict], chapitres: dict[str, dict]) -> list[str]:
    """Deux regles que quatorze notions ont tenues a la main.

    La couleur oriente dans le menu : deux notions de la meme famille dans un
    chapitre le rendent illisible. Il n'existe que cinq familles, ce qui borne
    un chapitre a cinq notions — et c'est voulu.
    """
    problemes: list[str] = []
    vues: dict[tuple[str, str], str] = {}

    for identifiant, details in sorted(notions.items()):
        chapitre = details["chapitre"]
        if chapitre not in chapitres:
            problemes.append(f"la notion {identifiant!r} pointe un chapitre inconnu {chapitre!r}")
            continue
        cle = (chapitre, details["famille"])
        if cle in vues:
            problemes.append(
                f"les notions {vues[cle]!r} et {identifiant!r} partagent la famille "
                f"{details['famille']!r} dans le chapitre {chapitre!r}"
            )
        else:
            vues[cle] = identifiant

    return problemes
```

  Et dans `verifier_racine`, à la suite de `verifier_chapitres` :

```python
    problemes: list[str] = verifier_chapitres(CHAPITRES) + verifier_tables(NOTIONS, CHAPITRES)

    # Les identifiants d'exercice sont uniques a travers TOUS les chapitres.
    # `identifiants` est un ensemble : deux `s1-01` dans deux chapitres s'y
    # fondaient en un seul, et le second ecrasait le premier a l'affichage
    # sans que rien ne le signale.
    vus: set[str] = set()
    for ex in exercices:
        if ex.id in vus:
            problemes.append(f"l'identifiant {ex.id} apparait deux fois dans le contenu")
        vus.add(ex.id)
```

  Cette boucle doit venir **après** `exercices = charger_tous(racine)`. Déplacer la ligne
  `problemes: list[str] = …` sous le chargement si ce n'est pas déjà le cas.

- [ ] **Étape 4 : l'exercice aussi vérifie sa notion** — dans `Exercice`, à côté des autres validateurs :

```python
    @field_validator("notion")
    @classmethod
    def notion_connue(cls, v: str) -> str:
        # construire_contenu lit NOTIONS[ex.notion]["famille"] : une notion
        # inconnue y levait une KeyError nue, au milieu d'une compréhension,
        # sans dire quel exercice la portait.
        if v not in NOTIONS:
            raise ValueError(f"notion inconnue : {v!r}")
        return v
```

- [ ] **Étape 5 : la suite entière.** Attendu : tout passe, `test_contenu_publie.py` compris.

- [ ] **Étape 6 : commit**

```bash
git add plateforme/outils
git commit -m "feat: les familles de couleur et les notions d'un exercice sont verifiees

Les quatorze notions du chapitre 1 ont des familles distinctes par chapitre, et
rien ne l'imposait : deux notions de la meme couleur rendent le menu illisible.
Une notion inconnue sur un exercice levait une KeyError nue dans le
constructeur, sans nommer l'exercice."
```

---

### Tâche 8 : le schéma se publie en JSON

**Files:**
- Modify: `plateforme/outils/construire_contenu.py`
- Test: `plateforme/outils/tests/test_construire_contenu.py`

`_chapitre`, `_ecrire` et `BASE` sont les auxiliaires de `tests/test_construire_contenu.py` ;
`_chapitre` y a été ajouté à la tâche 6.

**Interfaces:**
- Produces: `sortie/schema.json`, de forme `{"exercice": {...}, "lecon": {...}}`, chacun le résultat de `model_json_schema()`.

- [ ] **Étape 1 : écrire les épreuves qui échouent** — ajouter à `tests/test_construire_contenu.py` :

```python
def test_le_schema_est_publie_avec_ses_quatre_types_de_tests(tmp_path):
    _ecrire(_chapitre(tmp_path) / "seance-1", dict(BASE))
    construire(tmp_path, tmp_path / "sortie")

    publie = json.loads((tmp_path / "sortie" / "schema.json").read_text(encoding="utf-8"))
    assert set(publie) == {"exercice", "lecon"}
    assert set(publie["exercice"]["$defs"]) == {
        "TestMotif",
        "TestQcm",
        "TestSortie",
        "TestVariable",
    }


def test_le_schema_porte_les_enumerations_dont_le_formulaire_a_besoin(tmp_path):
    _ecrire(_chapitre(tmp_path) / "seance-1", dict(BASE))
    construire(tmp_path, tmp_path / "sortie")

    exercice = json.loads((tmp_path / "sortie" / "schema.json").read_text(encoding="utf-8"))[
        "exercice"
    ]
    assert exercice["properties"]["type"]["enum"] == ["predire", "debug", "completer", "ecrire"]
    assert exercice["properties"]["niveau"]["enum"] == ["normal", "expert"]
    assert "solution" in exercice["required"]


def test_le_discriminant_des_tests_est_publie(tmp_path):
    """Le formulaire s'en sert pour savoir quels champs porte chaque carte."""
    _ecrire(_chapitre(tmp_path) / "seance-1", dict(BASE))
    construire(tmp_path, tmp_path / "sortie")

    tests = json.loads((tmp_path / "sortie" / "schema.json").read_text(encoding="utf-8"))[
        "exercice"
    ]["properties"]["tests"]
    assert tests["items"]["discriminator"]["propertyName"] == "type"
    assert set(tests["items"]["discriminator"]["mapping"]) == {
        "sortie",
        "variable",
        "qcm",
        "interdit",
        "contient",
    }
```

- [ ] **Étape 2 : les lancer.** Attendu : échec, `schema.json` n'existe pas.

- [ ] **Étape 3 : publier** — dans `construire`, après `lecons.json` :

```python
    # Le schema se publie lui-meme. Le formulaire de l'atelier s'en nourrit —
    # enumerations, champs requis, variantes de tests — et aucune copie du
    # schema ne vit cote TypeScript. Meme traitement que notions.json.
    #
    # `Lecon.notion` n'y apparait plus comme une enumeration depuis qu'il est
    # valide a l'execution : la liste des notions se lit dans notions.json, qui
    # est de toute facon la seule source.
    _publier_objet(sortie / "schema.json", {
        "exercice": Exercice.model_json_schema(),
        "lecon": Lecon.model_json_schema(),
    })
```

  avec, à côté de `_publier` :

```python
def _publier_objet(chemin: Path, donnees: dict) -> None:
    chemin.write_text(json.dumps(donnees, ensure_ascii=False, indent=2), encoding="utf-8")
```

  et l'import `from schema import CHAPITRES, NOTIONS, Exercice, Lecon, charger_tables`.

- [ ] **Étape 4 : la suite entière.** Attendu : tout passe. `test_contenu_publie.py` ne compare que quatre fichiers : le cinquième ne le dérange pas.

- [ ] **Étape 5 : vérifier à l'œil ce que le formulaire recevra**

```bash
.venv/Scripts/python -c "from pathlib import Path; from construire_contenu import construire; construire(Path('../contenu'), Path('../web/public/contenu'))"
```

  Attendu : `web/public/contenu/schema.json` existe et pèse environ 5 Ko.

- [ ] **Étape 6 : commit**

```bash
git add plateforme/outils plateforme/web/public/contenu
git commit -m "feat: le schema se publie en JSON, pour que le formulaire s'y adosse

Pydantic le produit lui-meme : enumerations, champs requis, bornes, et le
discriminant des quatre types de tests. L'atelier pourra piloter son formulaire
dessus sans qu'aucune copie du schema ne vive cote TypeScript."
```

---

### Tâche 9 : ADR-015, et le coffre suit

**Files:**
- Create: `docs/vault/2-decisions/ADR-015 L'atelier écrit des fichiers, pas des lignes de base.md`
- Modify: `docs/vault/2-decisions/Journal de décisions.md`, `docs/vault/3-architecture/Modèle de contenu.md`, `docs/vault/3-architecture/Pièges et invariants.md`, `docs/vault/Accueil.md`

- [ ] **Étape 1 : ADR-015.** Format des autres ADR — contexte, décision, conséquences, alternatives écartées, voir aussi. Il doit dire :
  - Ce qu'[[ADR-003 Exercices versionnés en YAML]] gardait et que ce palier **ne renverse pas** : Git reste la source, un exercice reste un fichier, aucune base de contenu.
  - Ce qui change : une surface qui **aide à écrire** le fichier, là où ADR-003 refusait une surface qui le **remplacerait**.
  - Les tables de contenu passent en YAML : un titre, un ordre, une couleur et une date sont du contenu, pas du code — et sans cela l'atelier ne peut pas déclarer un chapitre.
  - La dépendance `yaml` côté navigateur au palier 2, et pourquoi un analyseur maison serait pire : il accepterait des fichiers que la construction refuse.
  - Alternatives écartées : la base avec administration web (déjà écartée par ADR-003, pour la même raison) ; l'atelier qui affiche du Python à coller dans `schema.py` ; laisser les bornes à trois séances.

- [ ] **Étape 2 : le journal** — une entrée `**015**` après ADR-014, datée du 27 septembre 2026.

- [ ] **Étape 3 : [[Modèle de contenu]]** — la section des fichiers publiés passe de quatre à cinq et décrit `schema.json` ; l'arborescence gagne `notions.yaml` et `chapitres.yaml` ; la racine de construction est `contenu/`.

- [ ] **Étape 4 : [[Pièges et invariants]]** — trois entrées, chacune avec son « ce qui casse » :
  - Les deux sens du mot « chapitre », et pourquoi on ne renomme pas.
  - Une date d'ouverture non quotée devient un objet `date` et échappe au contrôle de format.
  - Rien ne doit lire `NOTIONS` au moment de **définir** une classe : c'était le cas de `Lecon.notion`, et une table vide au chargement du module refusait toutes les leçons.

- [ ] **Étape 5 : [[Accueil]]** — une ligne d'état pour le palier 1, les nombres de tests remis à jour, et [[Spécification atelier de contenu]] dans les cartes du coffre.

- [ ] **Étape 6 : commit**

```bash
git add docs/vault
git commit -m "docs: ADR-015, et le coffre enregistre l'ouverture de la chaine de contenu"
```

---

## Ce qui reste après ce palier

Les paliers 2 et 3 de [[Spécification atelier de contenu]] — l'atelier des exercices puis celui
des leçons — auront leur propre plan, écrit **une fois ce palier fusionné**. Raison : leur
formulaire se pilote sur `schema.json`, et écrire leur code avant d'avoir le fichier sous les yeux
reviendrait à le deviner.
