import json
from pathlib import Path

import pytest
import yaml

from construire_contenu import construire
from schema import CHAPITRES, NOTIONS

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


def _lire(sortie: Path, fichier: str):
    return json.loads((sortie / fichier).read_text(encoding="utf-8"))


def test_construit_le_json_des_exercices(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE))
    sortie = tmp_path / "sortie"
    assert construire(tmp_path, sortie) == 1

    assert _lire(sortie, "exercices.json")[0]["id"] == "s1-01"


def test_les_exercices_de_toutes_les_seances_partent_dans_un_seul_fichier(tmp_path):
    """Le front n'a pas a savoir combien de seances existent."""
    _ecrire(tmp_path / "seance-1", dict(BASE))
    _ecrire(tmp_path / "seance-2", dict(BASE, id="s2-01", seance=2))
    sortie = tmp_path / "sortie"
    assert construire(tmp_path, sortie) == 2

    assert [e["id"] for e in _lire(sortie, "exercices.json")] == ["s1-01", "s2-01"]


def test_la_solution_n_est_jamais_publiee(tmp_path):
    """La solution ne doit pas partir dans le navigateur de l'eleve."""
    _ecrire(tmp_path / "seance-1", dict(BASE))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    brut = (sortie / "exercices.json").read_text(encoding="utf-8")
    assert "solution" not in brut
    assert "Camille" in brut  # l'attendu, lui, est bien present


def test_un_contenu_incoherent_fait_echouer_la_construction(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE, solution='print("Faucon")'))
    with pytest.raises(SystemExit):
        construire(tmp_path, tmp_path / "sortie")


def test_les_cles_sont_converties_en_camel_case(tmp_path):
    """Le YAML est en snake_case, l'evaluateur TypeScript lit du camelCase."""
    donnees = dict(BASE)
    donnees["tests"] = [
        {"type": "variable", "nom": "age", "type_attendu": "int"},
        {"type": "sortie", "entrees": [], "attendu": "Camille", "exige_exact": True},
    ]
    donnees["type"] = "completer"
    # La solution doit satisfaire ses propres tests (verifier_coherence
    # l'exige) : elle doit donc aussi definir `age`, sans quoi la construction
    # echoue avant meme d'atteindre la conversion camelCase que ce test vise.
    donnees["solution"] = 'age = 12\nprint("Camille")'
    _ecrire(tmp_path / "seance-1", donnees)
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    exercice = _lire(sortie, "exercices.json")[0]
    assert exercice["tests"][0]["typeAttendu"] == "int"
    assert exercice["tests"][1]["exigeExact"] is True
    assert "type_attendu" not in exercice["tests"][0]


def test_la_notion_donne_la_famille_de_couleur(tmp_path):
    """La couleur suit la notion, plus le concept."""
    _ecrire(tmp_path / "seance-1", dict(BASE, notion="saisie"))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    exercice = _lire(sortie, "exercices.json")[0]
    assert exercice["notion"] == "saisie"
    assert exercice["famille"] == "operateurs"


def test_la_table_des_notions_est_publiee(tmp_path):
    """Publiee pour que le front n'ait pas a la recopier — zero duplication."""
    _ecrire(tmp_path / "seance-1", dict(BASE, notion="types"))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    notions = _lire(sortie, "notions.json")
    assert [n["id"] for n in notions] == list(NOTIONS)
    assert notions[2] == {
        "id": "types",
        "ordre": 3,
        "titre": "Types et conversion",
        "famille": "types",
        "chapitre": "bases",
    }


def _ecrire_lecon(dossier: Path, donnees: dict) -> None:
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / f"{donnees['id']}.yaml").write_text(
        yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8"
    )


LECON = {
    "id": "c1-variables",
    "notion": "variables",
    "ordre": 2,
    "titre": "Les variables",
    "duree_min": 3,
    "blocs": [{"type": "paragraphe", "texte": "Une boite nommee."}],
}


def test_les_lecons_sont_publiees(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE, notion="variables"))
    _ecrire_lecon(tmp_path / "seance-1" / "lecons", LECON)
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    lecons = _lire(sortie, "lecons.json")
    assert len(lecons) == 1
    assert lecons[0]["titre"] == "Les variables"
    assert lecons[0]["famille"] == "variables"
    assert lecons[0]["blocs"][0]["type"] == "paragraphe"
    # snake_case -> camelCase, comme pour les exercices
    assert lecons[0]["dureeMin"] == 3


def test_les_lecons_de_toutes_les_seances_partent_dans_un_seul_fichier(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE))
    _ecrire_lecon(
        tmp_path / "seance-1" / "lecons",
        {**LECON, "id": "c1-afficher", "notion": "afficher", "ordre": 1},
    )
    _ecrire_lecon(tmp_path / "seance-2" / "lecons", {**LECON, "id": "c2-variables"})
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    assert [l["id"] for l in _lire(sortie, "lecons.json")] == ["c1-afficher", "c2-variables"]


def test_une_lecon_dont_l_exemple_plante_arrete_la_construction(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE, notion="variables"))
    _ecrire_lecon(
        tmp_path / "seance-1" / "lecons",
        {**LECON, "blocs": [{"type": "code", "legende": "x", "python": "print(pasla)"}]},
    )
    with pytest.raises(SystemExit):
        construire(tmp_path, tmp_path / "sortie")


def test_sans_lecon_le_fichier_des_lecons_est_publie_vide(tmp_path):
    """Absent, il repondrait 404 au navigateur et la connexion echouerait."""
    _ecrire(tmp_path / "seance-1", dict(BASE))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)
    assert _lire(sortie, "lecons.json") == []


def test_la_table_des_chapitres_est_publiee(tmp_path):
    """Le chapitre est le niveau de regroupement du menu."""
    _ecrire(tmp_path / "seance-1", dict(BASE))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    chapitres = _lire(sortie, "chapitres.json")
    assert [c["id"] for c in chapitres] == list(CHAPITRES)
    assert chapitres[0] == {"id": "bases", "ordre": 1, "titre": "Les bases de Python", "seance": 1}


def test_chaque_notion_declare_son_chapitre(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    notions = _lire(sortie, "notions.json")
    assert {n["chapitre"] for n in notions} == set(CHAPITRES)
