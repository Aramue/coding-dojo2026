"""Les trois points d'entree en ligne de commande.

Ce sont eux que le Dockerfile appelle, et eux qu'aucun test ne touchait : une
regression dans `principal()` ne casse pas la suite, elle casse la
construction de l'image. Chacun est eprouve sur ses deux issues.
"""

import sys
from pathlib import Path

import yaml

import construire_contenu
import generer_attendu
import valider_contenu
from conftest import chapitre_temporaire

EXERCICE = dict(
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


def _racine_valide(tmp_path: Path) -> Path:
    seance = chapitre_temporaire(tmp_path) / "seance-1"
    seance.mkdir(parents=True, exist_ok=True)
    (seance / "s1-01.yaml").write_text(
        yaml.safe_dump(EXERCICE, allow_unicode=True), encoding="utf-8"
    )
    return tmp_path


def test_construire_en_ligne_de_commande_publie_et_rend_zero(tmp_path, monkeypatch, capsys):
    racine, sortie = _racine_valide(tmp_path / "contenu"), tmp_path / "sortie"
    monkeypatch.setattr(sys, "argv", ["construire_contenu.py", str(racine), str(sortie)])

    assert construire_contenu.principal() == 0
    assert "1 exercices publies" in capsys.readouterr().out
    assert (sortie / "schema.json").exists()


def test_valider_en_ligne_de_commande_rend_zero_sur_un_contenu_sain(
    tmp_path, monkeypatch, capsys
):
    monkeypatch.setattr(sys, "argv", ["valider_contenu.py", str(_racine_valide(tmp_path))])

    assert valider_contenu.principal() == 0
    sortie = capsys.readouterr().out
    assert "1 exercices charges" in sortie
    assert "Contenu valide." in sortie


def test_valider_en_ligne_de_commande_rend_un_sur_un_contenu_casse(
    tmp_path, monkeypatch, capsys
):
    """Le code de retour est ce que lit le Dockerfile : 1 arrete la construction."""
    racine = _racine_valide(tmp_path)
    casse = dict(EXERCICE, id="s1-02", solution='print("Faucon")')
    (racine / "chapitre-1" / "seance-1" / "s1-02.yaml").write_text(
        yaml.safe_dump(casse, allow_unicode=True), encoding="utf-8"
    )
    monkeypatch.setattr(sys, "argv", ["valider_contenu.py", str(racine)])

    assert valider_contenu.principal() == 1
    sortie = capsys.readouterr().out
    assert "PROBLEME" in sortie
    assert "1 probleme(s)." in sortie


def test_generer_en_ligne_de_commande_remplit_un_attendu(tmp_path, monkeypatch, capsys):
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(
        yaml.safe_dump(
            dict(
                EXERCICE,
                id="s1-03",
                tests=[
                    {"type": "sortie", "entrees": [], "attendu": "A REMPLIR"},
                    {"type": "interdit", "motif": "xyzzy"},
                ],
            ),
            allow_unicode=True,
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(sys, "argv", ["generer_attendu.py", str(chemin)])

    assert generer_attendu.principal() == 0
    assert "1 attendu(s) mis à jour." in capsys.readouterr().out
    assert "Camille" in chemin.read_text(encoding="utf-8")


def test_generer_en_ligne_de_commande_ne_dit_rien_a_faire_quand_tout_est_a_jour(
    tmp_path, monkeypatch, capsys
):
    """Un dossier sans rien a corriger : le message doit rester rassurant."""
    monkeypatch.setattr(sys, "argv", ["generer_attendu.py", str(tmp_path)])

    assert generer_attendu.principal() == 0
    assert "Rien à mettre à jour." in capsys.readouterr().out
