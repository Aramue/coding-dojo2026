"""Ce que les tests ne touchaient pas : le demarrage, la sante, les impasses.

La suite installe partout une session de test a la place de la vraie, et
construit le client sans declencher le cycle de vie. Tout ce qui ne tourne
qu'en production restait donc hors mesure — a commencer par la creation du
schema au demarrage, qui est ce qui fait qu'un conteneur neuf fonctionne.
"""

import sqlite3

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine

from app import bdd, eleves, main
from app.modeles import Eleve
from app.securite import lire_jeton


def test_la_route_de_sante_repond(client):
    """C'est elle qu'interroge une sonde de supervision."""
    assert client.get("/sante").json() == {"etat": "ok"}


def test_le_demarrage_cree_le_schema(monkeypatch):
    """Sans cela, un conteneur neuf repond « no such table » a la premiere requete."""
    appels: list[int] = []
    monkeypatch.setattr(main, "creer_schema", lambda: appels.append(1))

    with TestClient(main.application):
        pass

    assert appels == [1]


def test_obtenir_session_rend_une_session_sur_le_vrai_moteur():
    """La dependance reelle, celle que les tests remplacent partout ailleurs."""
    generateur = bdd.obtenir_session()
    session = next(generateur)
    assert isinstance(session, Session)
    generateur.close()


def test_la_migration_ne_touche_pas_une_table_absente(tmp_path):
    """PRAGMA sur une table inexistante ne rend rien : il n'y a rien a ajouter,
    et tenter un ALTER TABLE echouerait au demarrage d'une base neuve."""
    chemin = tmp_path / "vide.db"
    sqlite3.connect(chemin).close()
    moteur = create_engine(f"sqlite:///{chemin.as_posix()}")

    bdd.ajouter_colonnes_manquantes(moteur)

    verif = sqlite3.connect(chemin)
    assert verif.execute("SELECT name FROM sqlite_master").fetchall() == []
    verif.close()


def test_un_code_libre_introuvable_rend_une_erreur_claire(client, session_test, monkeypatch):
    """29^4 collisions d'affilee n'arriveront pas — mais un alphabet reduit par
    erreur, si. Mieux vaut un 503 nomme qu'une boucle qui rend un doublon."""
    monkeypatch.setattr(eleves.secrets, "choice", lambda alphabet: "A")
    session_test.add(Eleve(code_acces="DOJO-AAAA", prenom="Camille"))
    session_test.commit()

    with pytest.raises(Exception) as impasse:
        eleves.engendrer_code(session_test)
    assert "code libre" in str(impasse.value)


def test_un_jeton_sans_point_est_refuse(session_test):
    """`partition` rend une signature vide : sans cette garde, on comparerait
    une chaine vide a une signature calculee."""
    assert lire_jeton(session_test, "DOJO-K7M2") is None
    assert lire_jeton(session_test, "") is None
    assert lire_jeton(session_test, ".signature") is None
