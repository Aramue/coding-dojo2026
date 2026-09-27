import os

# A positionner avant l'import de app.main : routes_prof.py lit DOJO_CODE_PROF au
# chargement du module pour fixer CODE_PROF. Sans defaut ici, un code aleatoire
# serait tire a chaque lancement et les tests ne pourraient pas le connaitre.
# "prof-test" (9 caracteres) suffirait a distinguer la valeur de "prof-dev" mais
# est trop court pour test_le_code_prof_par_defaut_n_est_pas_devinable, qui
# exige au moins 12 caracteres : d'ou une valeur plus longue.
os.environ.setdefault("DOJO_CODE_PROF", "code-prof-test")

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


@pytest.fixture(name="inscrire")
def fixture_inscrire(client):
    """Inscrit un eleve comme le ferait le professeur.

    Un code inconnu n'ouvre plus de session : chaque test qui a besoin d'un
    eleve doit donc le creer, exactement comme en vrai.
    """

    def inscrire(code: str, prenom: str = "Camille", **champs) -> None:
        from app import bdd
        from app.modeles import Eleve

        generateur = application.dependency_overrides[bdd.obtenir_session]()
        session = next(generateur)
        session.add(Eleve(code_acces=code, prenom=prenom, **champs))
        session.commit()
        session.close()

    return inscrire


@pytest.fixture(name="jeton")
def fixture_jeton(client, inscrire):
    inscrire("DOJO-K7M2")
    reponse = client.post("/session", json={"code_acces": "DOJO-K7M2"})
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


# --- Quiz en direct ---------------------------------------------------------

QUIZ_EXEMPLE = {
    "id": "q1-bases",
    "titre": "Les bases",
    "seance": 1,
    "questions": [
        {
            "enonce": "Qu'affiche ce programme ?",
            "code": 'print("2" + "2")',
            "options": ["4", "22", "Une erreur"],
            "bonne_reponse": 1,
            "duree_s": 20,
            "explication": "Deux textes se collent, ils ne s'additionnent pas.",
        },
        {
            "enonce": "Une variable garde-t-elle sa premiere valeur ?",
            "options": ["Oui", "Non"],
            "bonne_reponse": 1,
            "duree_s": 10,
        },
    ],
}


@pytest.fixture(name="catalogue")
def fixture_catalogue(client):
    """Un catalogue d'un seul quiz, a la place de celui construit sur disque."""
    from app.catalogue import obtenir_catalogue
    from app.quiz import QuizPublie

    quiz = {"q1-bases": QuizPublie(**QUIZ_EXEMPLE)}
    application.dependency_overrides[obtenir_catalogue] = lambda: quiz
    return quiz


class Horloge:
    """L'heure du serveur, reglee a la main : une echeance se teste a la milliseconde."""

    def __init__(self) -> None:
        from datetime import datetime, timezone

        self.maintenant = datetime(2026, 9, 30, 14, 0, tzinfo=timezone.utc)

    def avancer(self, secondes: float) -> None:
        from datetime import timedelta

        self.maintenant += timedelta(seconds=secondes)


@pytest.fixture(name="horloge")
def fixture_horloge(client):
    from app.routes_quiz import heure

    horloge = Horloge()
    application.dependency_overrides[heure] = lambda: horloge.maintenant
    return horloge
