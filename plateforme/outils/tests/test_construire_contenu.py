import json
from pathlib import Path

import pytest
import yaml

from construire_contenu import construire

BASE = dict(
    id="s1-01",
    concept="print",
    seance=1,
    niveau="normal",
    type="ecrire",
    titre="Ton indicatif",
    obligatoire=True,
    enonce="Affiche Corbeau.",
    depart="",
    indices=[],
    tests=[
        {"type": "sortie", "entrees": [], "attendu": "Corbeau"},
        {"type": "interdit", "motif": "xyzzy"},
    ],
    solution='print("Corbeau")',
)


def _ecrire(dossier: Path, donnees: dict) -> None:
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / f"{donnees['id']}.yaml").write_text(
        yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8"
    )


def test_construit_le_json_de_la_seance(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE))
    sortie = tmp_path / "sortie"
    assert construire(tmp_path, sortie) == 1

    exercices = json.loads((sortie / "seance-1.json").read_text(encoding="utf-8"))
    assert exercices[0]["id"] == "s1-01"


def test_la_solution_n_est_jamais_publiee(tmp_path):
    """La solution ne doit pas partir dans le navigateur de l'eleve."""
    _ecrire(tmp_path / "seance-1", dict(BASE))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    brut = (sortie / "seance-1.json").read_text(encoding="utf-8")
    assert "solution" not in brut
    assert "Corbeau" in brut  # l'attendu, lui, est bien present


def test_un_contenu_incoherent_fait_echouer_la_construction(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE, solution='print("Faucon")'))
    with pytest.raises(SystemExit):
        construire(tmp_path, tmp_path / "sortie")


def test_les_cles_sont_converties_en_camel_case(tmp_path):
    """Le YAML est en snake_case, l'evaluateur TypeScript lit du camelCase."""
    donnees = dict(BASE)
    donnees["tests"] = [
        {"type": "variable", "nom": "age", "type_attendu": "int"},
        {"type": "sortie", "entrees": [], "attendu": "Corbeau", "exige_exact": True},
    ]
    donnees["type"] = "completer"
    # La solution doit satisfaire ses propres tests (verifier_coherence
    # l'exige) : elle doit donc aussi definir `age`, sans quoi la construction
    # echoue avant meme d'atteindre la conversion camelCase que ce test vise.
    donnees["solution"] = 'age = 12\nprint("Corbeau")'
    _ecrire(tmp_path / "seance-1", donnees)
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    exercice = json.loads((sortie / "seance-1.json").read_text(encoding="utf-8"))[0]
    assert exercice["tests"][0]["typeAttendu"] == "int"
    assert exercice["tests"][1]["exigeExact"] is True
    assert "type_attendu" not in exercice["tests"][0]
