from pathlib import Path

import yaml

from generer_attendu import remplir_attendus

BASE = dict(
    id="s1-03",
    concept="input",
    seance=1,
    niveau="normal",
    type="ecrire",
    titre="Interrogatoire",
    obligatoire=True,
    enonce="Demande le nom puis affiche-le.",
    depart="",
    indices=[],
    tests=[
        {"type": "sortie", "entrees": ["Corbeau"], "attendu": "A REMPLIR"},
        {"type": "interdit", "motif": "xyzzy"},
    ],
    solution='nom = input("Nom : ")\nprint(f"Agent {nom}")',
)


def test_remplit_l_attendu_depuis_la_solution(tmp_path):
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(yaml.safe_dump(BASE, allow_unicode=True), encoding="utf-8")

    modifies = remplir_attendus(chemin)

    assert modifies == ["s1-03#0"]
    relu = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    assert relu["tests"][0]["attendu"] == "Nom : Corbeau\nAgent Corbeau"


def test_ne_touche_pas_un_attendu_deja_correct(tmp_path):
    donnees = dict(BASE)
    donnees["tests"] = [
        {"type": "sortie", "entrees": ["Corbeau"], "attendu": "Nom : Corbeau\nAgent Corbeau"},
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
