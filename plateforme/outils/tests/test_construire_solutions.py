"""Les solutions partent vers l'API, jamais vers ce que les eleves telechargent."""

import json
import sys
from pathlib import Path

import pytest
import yaml

from construire_solutions import construire_solutions, principal

BASE = dict(
    id="s1-01",
    concept="print",
    notion="afficher",
    seance=1,
    niveau="normal",
    type="ecrire",
    titre="Ton indicatif",
    obligatoire=True,
    enonce="Affiche Camille.",
    depart="",
    indices=[],
    tests=[
        {"type": "sortie", "entrees": [], "attendu": "Camille"},
        {"type": "interdit", "motif": "xyzzy"},
    ],
    solution='print("Camille")',
)


def _ecrire(dossier: Path, donnees: dict) -> None:
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / f"{donnees['id']}.yaml").write_text(
        yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8"
    )


def test_construit_un_fichier_indexe_par_identifiant(tmp_path):
    _ecrire(tmp_path / "source" / "seance-1", dict(BASE))
    _ecrire(tmp_path / "source" / "seance-2", dict(BASE, id="s2-01", seance=2))
    sortie = tmp_path / "api" / "solutions"
    assert construire_solutions(tmp_path / "source", sortie) == 2

    solutions = json.loads((sortie / "solutions.json").read_text(encoding="utf-8"))
    assert solutions == {"s1-01": 'print("Camille")', "s2-01": 'print("Camille")'}


def test_une_solution_qui_ne_passe_pas_ses_tests_arrete_la_construction(tmp_path):
    """Le professeur ne doit pas lire une solution que le validateur refuse."""
    _ecrire(tmp_path / "source" / "seance-1", dict(BASE, solution='print("Faucon")'))
    with pytest.raises(SystemExit, match="1 probleme"):
        construire_solutions(tmp_path / "source", tmp_path / "api" / "solutions")
    assert not (tmp_path / "api" / "solutions").exists()


@pytest.mark.parametrize(
    "cible", ["web/public/contenu", "web/public/solutions", "sortie/contenu/solutions", "contenu"]
)
def test_les_solutions_ne_s_ecrivent_jamais_dans_le_contenu_publie(tmp_path, cible):
    """Sous web/public, toute la classe les lirait en ouvrant une adresse."""
    _ecrire(tmp_path / "source" / "seance-1", dict(BASE))
    with pytest.raises(SystemExit, match="les solutions ne doivent jamais"):
        construire_solutions(tmp_path / "source", tmp_path / cible)


def test_principal_construit_depuis_la_ligne_de_commande(tmp_path, monkeypatch, capsys):
    _ecrire(tmp_path / "source" / "seance-1", dict(BASE))
    sortie = tmp_path / "api" / "solutions"
    monkeypatch.setattr(
        sys, "argv", ["construire_solutions.py", str(tmp_path / "source"), str(sortie)]
    )
    assert principal() == 0
    assert "1 solutions construites" in capsys.readouterr().out
    assert (sortie / "solutions.json").exists()
