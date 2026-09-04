"""Verrouille la parite entre _normaliser (Python) et normaliser.ts (TypeScript).

Les dix cas ci-dessous sont exactement ceux de
web/tests/validation/normaliser.test.ts. Si l'un des deux normaliseurs change,
ce test casse — c'est le but. Une divergence entre les deux ferait valider un
exercice a la construction et echouer le meme exercice dans le navigateur.
"""

import pytest

from valider_contenu import _normaliser

CAS = [
    ("Bonjour Camille   \nAge 17", "bonjour camille\nage 17"),
    ("Bonjour\n\n\n", "bonjour"),
    ("Bonjour    Camille", "bonjour camille"),
    ("ACCES AUTORISE", "acces autorise"),
    ("Accès autorisé", "acces autorise"),
    ("Acces autorise ✅", "acces autorise"),
    ("a\r\nb", "a\nb"),
    ("bonjour camille\nage 17", "bonjour camille\nage 17"),
]


@pytest.mark.parametrize("entree,attendu", CAS)
def test_parite_avec_le_normaliseur_typescript(entree, attendu):
    assert _normaliser(entree) == attendu


def test_les_trois_formes_de_fleche_convergent():
    assert _normaliser("Position 1 → 8") == _normaliser("Position 1 -> 8")
    assert _normaliser("Position 1 : 8") == _normaliser("Position 1 -> 8")


def test_les_deux_apostrophes_convergent():
    assert _normaliser("Ton code d'acces") == _normaliser("Ton code d’acces")


def test_un_texte_francais_accentue_ordinaire_survit():
    """La normalisation retire les accents mais ne doit rien manger d'autre."""
    assert _normaliser("Élève français : âge 17") == "eleve francais > age 17"
