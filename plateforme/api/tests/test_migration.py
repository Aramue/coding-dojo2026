"""La migration doit tourner sur une base ecrite par la version precedente."""

import sqlite3

from sqlmodel import create_engine

from app.bdd import creer_schema


def _ancienne_base(chemin) -> None:
    """La table `eleve` telle qu'elle etait avant les trois colonnes d'identite."""
    ancienne = sqlite3.connect(chemin)
    ancienne.execute("CREATE TABLE eleve (code_acces TEXT PRIMARY KEY, cree_le TEXT, vu_le TEXT)")
    ancienne.execute("INSERT INTO eleve VALUES ('DOJO-K7M2', '2026-09-01', '2026-09-01')")
    ancienne.commit()
    ancienne.close()


def test_les_colonnes_manquantes_sont_ajoutees(tmp_path):
    """create_all ne cree que les tables ABSENTES : sans migration, la premiere
    requete echouerait sur « no such column ». Une seance perdue."""
    chemin = tmp_path / "ancienne.db"
    _ancienne_base(chemin)

    creer_schema(create_engine(f"sqlite:///{chemin.as_posix()}"))

    verif = sqlite3.connect(chemin)
    colonnes = {ligne[1] for ligne in verif.execute("PRAGMA table_info(eleve)")}
    assert {"prenom", "nom", "etablissement"} <= colonnes
    verif.close()


def test_l_eleve_deja_en_base_survit_avec_des_champs_vides(tmp_path):
    chemin = tmp_path / "ancienne.db"
    _ancienne_base(chemin)

    creer_schema(create_engine(f"sqlite:///{chemin.as_posix()}"))

    verif = sqlite3.connect(chemin)
    ligne = verif.execute("SELECT prenom, nom FROM eleve WHERE code_acces='DOJO-K7M2'").fetchone()
    assert ligne == ("", "")
    verif.close()


def test_la_migration_se_rejoue_sans_rien_casser(tmp_path):
    """Un redemarrage la relance a chaque fois : elle doit etre idempotente."""
    moteur = create_engine(f"sqlite:///{(tmp_path / 'neuve.db').as_posix()}")
    creer_schema(moteur)
    creer_schema(moteur)


def test_une_partie_d_avant_la_pause_gagne_sa_colonne(tmp_path):
    """La v1.1 a deja des parties en base : sans la colonne, lire une partie echouerait."""
    chemin = tmp_path / "v1-1.db"
    ancienne = sqlite3.connect(chemin)
    ancienne.execute(
        "CREATE TABLE partiequiz (id INTEGER PRIMARY KEY, quiz_id TEXT, phase TEXT, question INTEGER,"
        " ouverte_le TEXT, fin_a TEXT, creee_le TEXT, terminee_le TEXT)"
    )
    ancienne.execute("INSERT INTO partiequiz VALUES (1, 'q1-bases', 'terminee', 3, NULL, NULL, '2026-10-01', '2026-10-01')")
    ancienne.commit()
    ancienne.close()

    creer_schema(create_engine(f"sqlite:///{chemin.as_posix()}"))

    verif = sqlite3.connect(chemin)
    assert verif.execute("SELECT pause_le FROM partiequiz WHERE id = 1").fetchone() == (None,)
    verif.close()
