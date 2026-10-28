"""Tout identifiant que le contenu publie, l'API doit l'accepter.

Le 27 octobre 2026, la seance 4 a ete publiee : le schema du contenu acceptait
`s4-01`, l'API, elle, ne connaissait que `s1` a `s3`. Chaque validation d'un
exercice de la seance 4 repondait 422 et ne s'enregistrait pas — l'eleve
lisait « Ta progression n'a pas pu etre enregistree », et le tableau de bord
du professeur ne bougeait plus. Aucun test ne le voyait : les deux motifs
vivaient dans deux dossiers, sans rien qui les compare.

Celui-ci les compare sur le contenu reel, pas sur des exemples : une seance 5
publiee demain echouera ici, dans la CI, plutot qu'en classe.
"""

import re
from pathlib import Path

import pytest

from app.routes_eleve import MOTIF_EXERCICE
from app.routes_quiz import MOTIF_QUIZ

CONTENU = Path(__file__).resolve().parents[2] / "contenu"

EXERCICES = sorted(
    chemin.stem
    for chemin in CONTENU.rglob("*.yaml")
    if chemin.parent.name.startswith("seance-")  # ni les lecons, ni les quiz
)
QUIZ = sorted(chemin.stem for chemin in CONTENU.rglob("*.yaml") if chemin.parent.name == "quiz")


def test_le_contenu_est_bien_la():
    """Un chemin faux rendrait les deux tests suivants vides, donc verts pour rien."""
    assert len(EXERCICES) > 100
    assert any(identifiant.startswith("s4-") for identifiant in EXERCICES)
    assert QUIZ


@pytest.mark.parametrize("identifiant", EXERCICES)
def test_l_api_accepte_chaque_exercice_publie(identifiant):
    assert MOTIF_EXERCICE.match(identifiant), f"{identifiant} serait refuse a l'enregistrement"


@pytest.mark.parametrize("identifiant", QUIZ)
def test_l_api_accepte_chaque_quiz_publie(identifiant):
    assert re.match(MOTIF_QUIZ, identifiant), f"{identifiant} serait refuse par l'API"
