"""Le catalogue lit les quiz construits ; un fichier casse est ecarte, pas fatal."""

import json

import pytest

from app import catalogue
from app.catalogue import charger

from conftest import QUIZ_EXEMPLE


def test_charge_un_quiz_par_fichier(tmp_path):
    (tmp_path / "q1-bases.json").write_text(json.dumps(QUIZ_EXEMPLE), encoding="utf-8")
    quiz = charger(tmp_path)
    assert list(quiz) == ["q1-bases"]
    assert quiz["q1-bases"].questions[0].bonne_reponse == 1


def test_les_champs_de_validation_du_contenu_sont_ignores(tmp_path):
    """entrees, sortie, erreur servent a la construction, pas au jeu."""
    donnees = json.loads(json.dumps(QUIZ_EXEMPLE))
    donnees["questions"][0] |= {"sortie": True, "entrees": [], "erreur": None}
    (tmp_path / "q1-bases.json").write_text(json.dumps(donnees), encoding="utf-8")
    assert "sortie" not in charger(tmp_path)["q1-bases"].questions[0].model_dump()


def test_sans_dossier_le_catalogue_est_vide_et_le_dit(tmp_path):
    with pytest.warns(UserWarning, match="construire_quiz"):
        assert charger(tmp_path / "absent") == {}


@pytest.mark.parametrize(
    "contenu",
    [
        "{pas du json",
        "[1, 2]",
        json.dumps({**QUIZ_EXEMPLE, "questions": []}),
        json.dumps(
            {**QUIZ_EXEMPLE, "questions": [{**QUIZ_EXEMPLE["questions"][0], "bonne_reponse": 7}]}
        ),
    ],
)
def test_un_fichier_illisible_est_ecarte_sans_empecher_les_autres(tmp_path, contenu):
    (tmp_path / "a-casse.json").write_text(contenu, encoding="utf-8")
    (tmp_path / "q1-bases.json").write_text(json.dumps(QUIZ_EXEMPLE), encoding="utf-8")
    with pytest.warns(UserWarning, match="a-casse.json"):
        assert list(charger(tmp_path)) == ["q1-bases"]


def test_le_catalogue_est_lu_une_fois_par_processus(tmp_path, monkeypatch):
    (tmp_path / "q1-bases.json").write_text(json.dumps(QUIZ_EXEMPLE), encoding="utf-8")
    monkeypatch.setattr(catalogue, "DOSSIER", tmp_path)
    catalogue.obtenir_catalogue.cache_clear()
    try:
        premier = catalogue.obtenir_catalogue()
        (tmp_path / "q1-bases.json").unlink()
        assert catalogue.obtenir_catalogue() is premier
    finally:
        catalogue.obtenir_catalogue.cache_clear()
