from pathlib import Path

import yaml

from generer_attendu import remplir_attendus

BASE = dict(
    id="s1-03",
    concept="input",
    notion="saisie",
    seance=1,
    niveau="normal",
    type="ecrire",
    titre="Interrogatoire",
    obligatoire=True,
    enonce="Demande le nom puis affiche-le.",
    depart="",
    indices=[],
    tests=[
        {"type": "sortie", "entrees": ["Camille"], "attendu": "A REMPLIR"},
        {"type": "interdit", "motif": "xyzzy"},
    ],
    solution='nom = input("Nom : ")\nprint(f"Bonjour {nom}")',
)


def test_remplit_l_attendu_depuis_la_solution(tmp_path):
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(yaml.safe_dump(BASE, allow_unicode=True), encoding="utf-8")

    modifies = remplir_attendus(chemin)

    assert modifies == ["s1-03#0"]
    relu = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    assert relu["tests"][0]["attendu"] == "Nom : Camille\nBonjour Camille\n"


def test_ne_touche_pas_un_attendu_deja_correct(tmp_path):
    donnees = dict(BASE)
    donnees["tests"] = [
        {"type": "sortie", "entrees": ["Camille"], "attendu": "Nom : Camille\nBonjour Camille"},
        {"type": "interdit", "motif": "xyzzy"},
    ]
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8")

    assert remplir_attendus(chemin) == []


def test_signale_une_solution_qui_plante(tmp_path):
    donnees = dict(BASE, solution="print(inexistant)")
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8")

    modifies = remplir_attendus(chemin)

    assert modifies == []
    relu = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    assert relu["tests"][0]["attendu"] == "A REMPLIR"


def test_mode_lecture_seule_n_ecrit_rien(tmp_path):
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(yaml.safe_dump(BASE, allow_unicode=True), encoding="utf-8")
    avant = chemin.read_bytes()

    modifies = remplir_attendus(chemin, ecrire_fichier=False)

    assert modifies == ["s1-03#0"]
    assert chemin.read_bytes() == avant


SOURCE_ANNOTEE = """\
# Premier exercice de la seance 1 : ne pas reordonner les cles.
id: s1-03
concept: input
seance: 1
niveau: normal
type: ecrire
titre: Interrogatoire
obligatoire: true
enonce: |
  Demande le nom de l'eleve,
  puis affiche-le.
depart: ''
indices: []
tests:
  # Une seule entree simulee suffit.
  - type: sortie
    entrees:
      - Camille
    attendu: A REMPLIR
  - type: interdit
    motif: xyzzy
solution: |
  nom = input("Nom : ")
  print(f"Bonjour {nom}")
"""


def test_les_commentaires_et_les_blocs_litteraux_survivent(tmp_path):
    """L'outil edite les fichiers du professeur : il ne doit rien detruire."""
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(SOURCE_ANNOTEE, encoding="utf-8")

    assert remplir_attendus(chemin) == ["s1-03#0"]

    apres = chemin.read_text(encoding="utf-8")
    assert "# Premier exercice de la seance 1" in apres
    assert "# Une seule entree simulee suffit." in apres
    assert "enonce: |" in apres
    assert "solution: |" in apres
    # L'attendu genere est multi-ligne : il doit lui aussi etre un bloc litteral.
    assert "attendu: |" in apres
    # L'ordre des cles est preserve : id vient avant concept.
    assert apres.index("id: s1-03") < apres.index("concept: input")


def test_relance_idempotente(tmp_path):
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(SOURCE_ANNOTEE, encoding="utf-8")

    remplir_attendus(chemin)
    apres_premier = chemin.read_bytes()

    assert remplir_attendus(chemin) == []
    assert chemin.read_bytes() == apres_premier


def test_seul_le_champ_attendu_est_reecrit(tmp_path):
    """Une passe du generateur ne doit rien toucher d'autre que l'attendu.

    Verifier la presence de sous-chaines ne suffit pas : ruamel realigne
    l'indentation des sequences si elle n'est pas configuree, et le fichier du
    professeur est reformate sans que rien ne le signale. Ce test l'attrape.
    """
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(SOURCE_ANNOTEE, encoding="utf-8")

    remplir_attendus(chemin)

    avant = SOURCE_ANNOTEE.splitlines()
    apres = chemin.read_text(encoding="utf-8").splitlines()

    # La seule ligne qui doit disparaitre est l'ancien attendu.
    disparues = [ligne for ligne in avant if ligne not in apres]
    assert disparues == ["    attendu: A REMPLIR"]

    # Toutes les autres lignes doivent se retrouver a l'identique, indentation comprise.
    for ligne in avant:
        if ligne not in disparues:
            assert ligne in apres, f"ligne perdue ou reindentee : {ligne!r}"
