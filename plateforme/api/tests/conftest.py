import os

# A positionner avant l'import de app.main : routes_prof.py lit QG_CODE_PROF au
# chargement du module pour fixer CODE_PROF. Sans defaut ici, un code aleatoire
# serait tire a chaque lancement et les tests ne pourraient pas le connaitre.
# "prof-test" (9 caracteres) suffirait a distinguer la valeur de "prof-dev" mais
# est trop court pour test_le_code_prof_par_defaut_n_est_pas_devinable, qui
# exige au moins 12 caracteres : d'ou une valeur plus longue.
os.environ.setdefault("QG_CODE_PROF", "code-prof-test")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session, SQLModel, create_engine  # noqa: E402
from sqlmodel.pool import StaticPool  # noqa: E402

from app import bdd  # noqa: E402
from app.main import application  # noqa: E402


@pytest.fixture(name="client")
def fixture_client():
    moteur = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(moteur)

    def session_de_test():
        with Session(moteur) as session:
            yield session

    application.dependency_overrides[bdd.obtenir_session] = session_de_test
    yield TestClient(application)
    application.dependency_overrides.clear()


@pytest.fixture(name="jeton")
def fixture_jeton(client):
    reponse = client.post("/session", json={"code_agent": "AGENT-K7M2"})
    return reponse.json()["jeton"]


@pytest.fixture(name="session_test")
def fixture_session_test(client):
    """Session partagee avec le client, pour preparer des donnees.

    `client` est demande en argument (sans etre utilise directement) pour que
    `application.dependency_overrides` soit deja en place : c'est `fixture_client`
    qui l'installe. Le moteur sous-jacent est un `StaticPool` SQLite en memoire,
    donc cette session voit — et rend visibles — les memes lignes que celles
    ouvertes par le client de test au fil des requetes.
    """
    generateur = application.dependency_overrides[bdd.obtenir_session]()
    session = next(generateur)
    yield session
    session.close()
