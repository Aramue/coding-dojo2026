import pytest
from pydantic import ValidationError

from schema import Exercice, TestSortie, TestVariable


def exercice_minimal(**remplacements):
    base = dict(
        id="s1-01",
        concept="print",
        seance=1,
        niveau="normal",
        type="ecrire",
        titre="Ton indicatif d'appel",
        obligatoire=True,
        enonce="Affiche ton nom de code.",
        depart="",
        indices=["Un texte s'ecrit entre guillemets."],
        # Un exercice de type "ecrire" exige un test "interdit" (cf.
        # Exercice.tests_coherents_avec_le_type) : sans lui, ce fixture minimal
        # serait lui-meme invalide et chaque test masquerait la vraie cause de
        # rejet derriere cette erreur de coherence. Ajoute pour rester coherent
        # avec le motif deja utilise dans test_valider_contenu.py::BASE.
        tests=[
            {"type": "sortie", "entrees": [], "attendu": "Corbeau"},
            {"type": "interdit", "motif": "xyzzy"},
        ],
        solution='print("Corbeau")',
    )
    base.update(remplacements)
    return base


def test_exercice_valide_se_charge():
    ex = Exercice(**exercice_minimal())
    assert ex.id == "s1-01"
    assert isinstance(ex.tests[0], TestSortie)


def test_niveau_inconnu_rejete():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(niveau="intermediaire"))


def test_type_inconnu_rejete():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(type="qcm_libre"))


def test_seance_hors_bornes_rejetee():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(seance=4))


def test_identifiant_mal_forme_rejete():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(id="exercice 1"))


def test_getpass_interdit_partout():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(solution="import getpass\nprint(getpass.getpass())"))
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(enonce="Utilise getpass pour masquer la saisie."))


def test_emoji_interdit_dans_une_sortie_attendue():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(tests=[{"type": "sortie", "entrees": [], "attendu": "Acces ✅"}]))


def test_test_variable_se_charge():
    ex = Exercice(
        **exercice_minimal(
            tests=[
                {"type": "variable", "nom": "age", "type_attendu": "int"},
                {"type": "interdit", "motif": "xyzzy"},
            ]
        )
    )
    assert isinstance(ex.tests[0], TestVariable)
    assert ex.tests[0].type_attendu == "int"


def test_emoji_avec_selecteur_de_variation_est_rejete():
    """✅ est un caractere emoji suivi d'un selecteur de variation (U+FE0F) ;
    la borne de la plage ne doit pas etre cassee par ce caractere invisible."""
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(tests=[{"type": "sortie", "entrees": [], "attendu": "✅"}]))


def test_texte_francais_accentue_ordinaire_est_accepte():
    ex = Exercice(
        **exercice_minimal(
            tests=[
                {"type": "sortie", "entrees": [], "attendu": "Accès autorisé"},
                {"type": "interdit", "motif": "xyzzy"},
            ],
        )
    )
    assert ex.tests[0].attendu == "Accès autorisé"
