"""Les solutions de reference : au professeur, et a lui seul."""

import json

import pytest

from app import solutions
from app.main import application
from app.solutions import charger, obtenir_solutions

SOLUTIONS = {"s1-01": 'print("Bonjour")', "s1-02": "age = 15\nprint(age)\n"}


@pytest.fixture(name="solutions_construites")
def fixture_solutions_construites(client):
    """Les solutions d'exemple, a la place de celles construites sur disque."""
    application.dependency_overrides[obtenir_solutions] = lambda: SOLUTIONS
    return SOLUTIONS


def test_le_professeur_lit_toutes_les_solutions(client, entetes_prof, solutions_construites):
    reponse = client.get("/prof/solutions", headers=entetes_prof)
    assert reponse.status_code == 200
    assert reponse.json() == {"solutions": SOLUTIONS}


def test_sans_session_professeur_rien_ne_sort(client, entetes_prof, solutions_construites):
    assert client.get("/prof/solutions").status_code == 401


def test_un_jeton_eleve_n_ouvre_pas_les_solutions(client, jeton, entetes_prof, solutions_construites):
    """La seule chose qui separe un eleve de toutes les reponses, c'est cette porte."""
    for entetes in (
        {"X-Jeton-Prof": jeton},
        {"Authorization": f"Bearer {jeton}"},
    ):
        reponse = client.get("/prof/solutions", headers=entetes)
        assert reponse.status_code == 401
        assert "print" not in reponse.text


def test_aucune_route_eleve_ne_rend_de_solution(client, jeton, solutions_construites):
    """Le parcours et la session de l'eleve ne transportent aucune solution."""
    eleve = {"Authorization": f"Bearer {jeton}"}
    for reponse in (
        client.get("/parcours", headers=eleve),
        client.post("/session", json={"code_acces": "DOJO-K7M2"}),
    ):
        assert reponse.status_code == 200
        assert "solution" not in reponse.text


def test_charge_le_fichier_construit(tmp_path):
    fichier = tmp_path / "solutions.json"
    fichier.write_text(json.dumps(SOLUTIONS), encoding="utf-8")
    assert charger(fichier) == SOLUTIONS


def test_sans_fichier_il_n_y_a_pas_de_solutions_et_l_api_le_dit(tmp_path):
    with pytest.warns(UserWarning, match="construire_solutions"):
        assert charger(tmp_path / "absent.json") == {}


@pytest.mark.parametrize(
    "contenu",
    ["{pas du json", "[1, 2]", json.dumps({"s1-01": 42}), json.dumps({"s1-01": ["print()"]})],
)
def test_un_fichier_illisible_est_ecarte_sans_empecher_l_api_de_repondre(tmp_path, contenu):
    fichier = tmp_path / "solutions.json"
    fichier.write_text(contenu, encoding="utf-8")
    with pytest.warns(UserWarning, match="ecartees"):
        assert charger(fichier) == {}


def test_les_solutions_sont_lues_une_fois_par_processus(tmp_path, monkeypatch):
    fichier = tmp_path / "solutions.json"
    fichier.write_text(json.dumps(SOLUTIONS), encoding="utf-8")
    monkeypatch.setattr(solutions, "FICHIER", fichier)
    obtenir_solutions.cache_clear()
    try:
        premieres = obtenir_solutions()
        fichier.unlink()
        assert obtenir_solutions() is premieres
    finally:
        obtenir_solutions.cache_clear()
