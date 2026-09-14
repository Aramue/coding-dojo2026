import pytest

import valider_contenu
from schema import CHAPITRES
from valider_contenu import verifier_chapitres, verifier_racine


def test_la_table_du_cours_est_valide():
    assert verifier_chapitres(CHAPITRES) == []


def test_un_chapitre_sans_date_est_valide():
    assert verifier_chapitres({"bases": {"ordre": 1}}) == []


def test_une_date_au_format_attendu_est_valide():
    assert verifier_chapitres({"decisions": {"ouverture": "2026-09-23"}}) == []


@pytest.mark.parametrize(
    "ouverture",
    [
        "23/09/2026",  # l'ordre francais : le front la compare quand meme, et se trompe
        "20260923",  # la forme compacte : Python la lit, le front non
        "2026-02-30",  # bien formee, mais ce jour n'existe pas
        20260923,  # un nombre, pas une chaine
    ],
)
def test_une_date_illisible_est_signalee(ouverture):
    problemes = verifier_chapitres({"decisions": {"ouverture": ouverture}})
    assert len(problemes) == 1
    assert "decisions" in problemes[0]


def test_la_validation_du_contenu_verifie_aussi_les_chapitres(tmp_path, monkeypatch):
    monkeypatch.setattr(valider_contenu, "CHAPITRES", {"decisions": {"ouverture": "bientot"}})
    _, _, problemes = verifier_racine(tmp_path)
    assert len(problemes) == 1
    assert "decisions" in problemes[0]
