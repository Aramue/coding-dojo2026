import pytest
from pydantic import ValidationError

from schema import Exercice, TestSortie, TestVariable


def exercice_minimal(**remplacements):
    base = dict(
        id="s1-01",
        concept="print",
        notion="afficher",
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
            {"type": "sortie", "entrees": [], "attendu": "Camille"},
            {"type": "interdit", "motif": "xyzzy"},
        ],
        solution='print("Camille")',
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
    # La borne est passee de 3 a 99 le 27 septembre 2026 : une seance 4 est
    # desormais legitime, c'est tout l'objet du chapitre 2.
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(seance=100))


@pytest.mark.parametrize("identifiant, seance", [("s1-01", 1), ("s9-01", 9), ("s99-01", 99)])
def test_une_seance_au_dela_de_trois_est_acceptee(identifiant, seance):
    ex = Exercice(**exercice_minimal(id=identifiant, seance=seance))
    assert ex.id == identifiant


@pytest.mark.parametrize("identifiant", ["s0-01", "s01-01", "s100-01", "s1-1", "x1-01"])
def test_un_identifiant_mal_forme_reste_refuse(identifiant):
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(id=identifiant))


def test_une_lecon_de_la_seance_dix_est_acceptee():
    from schema import MOTIF_LECON

    assert MOTIF_LECON.match("c10-variables")
    assert not MOTIF_LECON.match("c0-variables")
    assert not MOTIF_LECON.match("c01-variables")


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


def test_un_contient_peut_porter_maitrise():
    ex = Exercice(
        **exercice_minimal(
            tests=[
                {"type": "sortie", "entrees": [], "attendu": "Bonjour Camille"},
                {"type": "interdit", "motif": "Bonjour Camille"},
                {"type": "contient", "motif": "{", "maitrise": True},
            ],
        )
    )
    assert ex.tests[2].maitrise is True


def test_un_interdit_ne_peut_pas_porter_maitrise():
    """Un interdit disqualifie, par definition : le marquer 'maitrise' n'aurait
    pas de sens et laisserait croire qu'il ne fait que couter une coche."""
    with pytest.raises(ValidationError, match="maitrise"):
        Exercice(
            **exercice_minimal(
                tests=[
                    {"type": "sortie", "entrees": [], "attendu": "Bonjour"},
                    {"type": "interdit", "motif": "Bonjour", "maitrise": True},
                ],
            )
        )


def test_un_motif_est_exigeant_par_defaut():
    ex = Exercice(
        **exercice_minimal(
            tests=[
                {"type": "sortie", "entrees": [], "attendu": "Bonjour"},
                {"type": "interdit", "motif": "xyzzy"},
                {"type": "contient", "motif": "input("},
            ],
        )
    )
    assert ex.tests[2].maitrise is False


def test_la_seance_doit_suivre_l_identifiant():
    with pytest.raises(ValidationError, match="s2-14 annonce la seance 3"):
        Exercice(**exercice_minimal(id="s2-14", seance=3))


def test_un_expert_suit_aussi_son_identifiant():
    ex = Exercice(**exercice_minimal(id="s12-07-expert", seance=12, niveau="expert"))
    assert ex.seance == 12


def test_les_112_exercices_du_depot_sont_deja_accordes():
    """La regle est ajoutee apres coup : elle ne doit rien casser d'existant."""
    from pathlib import Path

    from schema import charger_tous

    racine = Path(__file__).parent.parent.parent / "contenu" / "chapitre-1"
    assert len(charger_tous(racine)) == 112
