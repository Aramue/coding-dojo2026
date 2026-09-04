import json
from pathlib import Path

import pytest
import yaml

from construire_contenu import construire

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

    exercice = json.loads((sortie / "seance-1.json").read_text(encoding="utf-8"))[0]
    assert exercice["tests"][0]["typeAttendu"] == "int"
    assert exercice["tests"][1]["exigeExact"] is True
    assert "type_attendu" not in exercice["tests"][0]


def test_la_notion_donne_la_famille_de_couleur(tmp_path):
    """La couleur suit la notion, plus le concept : quatre notions, quatre couleurs."""
    _ecrire(tmp_path / "seance-1", dict(BASE, notion="saisie"))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    exercice = json.loads((sortie / "seance-1.json").read_text(encoding="utf-8"))[0]
    assert exercice["notion"] == "saisie"
    assert exercice["famille"] == "operateurs"


def test_la_table_des_notions_est_publiee(tmp_path):
    """Publiee pour que le front n'ait pas a la recopier — zero duplication."""
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

    lecons = json.loads((sortie / "seance-1-lecons.json").read_text(encoding="utf-8"))
    assert len(lecons) == 1
    assert lecons[0]["titre"] == "Les variables"
    assert lecons[0]["famille"] == "variables"
    assert lecons[0]["blocs"][0]["type"] == "paragraphe"
    # snake_case -> camelCase, comme pour les exercices
    assert lecons[0]["dureeMin"] == 3


def test_une_lecon_dont_l_exemple_plante_arrete_la_construction(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE, notion="variables"))
    _ecrire_lecon(
        tmp_path / "seance-1" / "lecons",
        {**LECON, "blocs": [{"type": "code", "legende": "x", "python": "print(pasla)"}]},
    )
    with pytest.raises(SystemExit):
        construire(tmp_path, tmp_path / "sortie")


def test_une_seance_sans_lecons_se_construit(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)
    assert not (sortie / "seance-1-lecons.json").exists()
