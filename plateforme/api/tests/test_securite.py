"""Les secrets de l'instance. Voir ADR-014."""

from app.modeles import Reglage
from app.securite import CLE_SECRET, creer_jeton, ecrire_reglage_neuf, lire_jeton, secret


def test_la_cle_est_tiree_au_premier_besoin_puis_gardee(session_test):
    assert session_test.get(Reglage, CLE_SECRET) is None
    premiere = secret(session_test)
    assert len(premiere) == 32
    assert secret(session_test) == premiere


def test_un_jeton_eleve_se_relit_avec_la_cle_de_la_base(session_test):
    jeton = creer_jeton(session_test, "DOJO-K7M2")
    assert lire_jeton(session_test, jeton) == "DOJO-K7M2"


def test_changer_la_cle_invalide_les_jetons(session_test):
    jeton = creer_jeton(session_test, "DOJO-K7M2")
    ligne = session_test.get(Reglage, CLE_SECRET)
    ligne.valeur = "00" * 32
    session_test.add(ligne)
    session_test.commit()
    assert lire_jeton(session_test, jeton) is None


def test_une_valeur_deja_ecrite_n_est_jamais_remplacee(session_test):
    assert ecrire_reglage_neuf(session_test, "essai", "premiere") is True
    assert ecrire_reglage_neuf(session_test, "essai", "seconde") is False
    assert session_test.get(Reglage, "essai").valeur == "premiere"


def test_le_perdant_d_une_course_n_ecrase_rien(monkeypatch, session_test):
    """Deux premieres requetes simultanees constatent toutes deux l'absence.

    La cle primaire tranche : la seconde ecriture echoue sans rien remplacer.
    """
    from sqlmodel import Session

    from app import securite

    ecrire_reglage_neuf(session_test, "essai", "gagnant")
    with Session(session_test.get_bind()) as perdant:
        # Le perdant a lu « absent » juste avant que le gagnant n'ecrive.
        monkeypatch.setattr(securite, "lire_reglage", lambda session, cle: None)
        assert ecrire_reglage_neuf(perdant, "essai", "perdant") is False
    monkeypatch.undo()
    assert securite.lire_reglage(session_test, "essai") == "gagnant"


def test_la_cle_ne_vient_plus_de_l_environnement(monkeypatch, session_test):
    monkeypatch.setenv("DOJO_SECRET", "ceci-ne-doit-plus-servir")
    assert secret(session_test) != b"ceci-ne-doit-plus-servir"
