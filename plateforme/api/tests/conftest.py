import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app import bdd
from app.main import application


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
