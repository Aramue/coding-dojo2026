"""La sonnette : authentification au premier message, et « relis » a chaque changement."""

import asyncio
import json
import time

import pytest
from starlette.websockets import WebSocketDisconnect

from app.diffuseur import Diffuseur, diffuseur

PROF = {"X-Code-Prof": "code-prof-test"}


@pytest.fixture(autouse=True)
def registre_vide():
    """Le registre est un singleton de module : chaque test repart de zero."""
    diffuseur._abonnes.clear()
    yield
    diffuseur._abonnes.clear()


@pytest.fixture(name="jeton_eleve")
def fixture_jeton_eleve(client, inscrire):
    inscrire("DOJO-K7M2")
    return client.post("/session", json={"code_acces": "DOJO-K7M2"}).json()["jeton"]


def _fermeture(ws) -> int:
    with pytest.raises(WebSocketDisconnect) as fin:
        ws.receive_json()
    return fin.value.code


# --- Authentification -------------------------------------------------------


def test_le_professeur_se_presente_par_son_code(client):
    with client.websocket_connect("/quiz/flux") as ws:
        ws.send_text(json.dumps({"code_prof": "code-prof-test"}))
        assert ws.receive_json() == {"type": "pret"}
        assert len(diffuseur) == 1


def test_l_eleve_se_presente_par_son_jeton(client, jeton_eleve):
    with client.websocket_connect("/quiz/flux") as ws:
        ws.send_text(json.dumps({"jeton": jeton_eleve}))
        assert ws.receive_json() == {"type": "pret"}


@pytest.mark.parametrize(
    "message",
    [
        json.dumps({"code_prof": "faux"}),
        json.dumps({"jeton": "DOJO-K7M2.signature-inventee"}),
        json.dumps({"jeton": 42}),
        json.dumps(["code-prof-test"]),
        "pas du json",
        json.dumps({"code_prof": "x" * 600}),
    ],
)
def test_une_presentation_invalide_ferme_la_connexion(client, message):
    with client.websocket_connect("/quiz/flux") as ws:
        ws.send_text(message)
        assert _fermeture(ws) == 4401
    assert len(diffuseur) == 0


def test_une_presentation_en_binaire_est_refusee(client):
    with client.websocket_connect("/quiz/flux") as ws:
        ws.send_bytes(b'{"code_prof": "code-prof-test"}')
        assert _fermeture(ws) == 4401


def test_le_code_ne_passe_jamais_par_l_url(client):
    """Une URL finit dans les journaux : la route n'y lit rien."""
    with client.websocket_connect("/quiz/flux?code_prof=code-prof-test") as ws:
        ws.send_text("{}")
        assert _fermeture(ws) == 4401


def test_sans_presentation_la_connexion_se_ferme(client, monkeypatch):
    from app import routes_quiz

    monkeypatch.setattr(routes_quiz, "DELAI_AUTHENTIFICATION_S", 0.05)
    with client.websocket_connect("/quiz/flux") as ws:
        assert _fermeture(ws) == 4401


def test_au_dela_du_plafond_la_connexion_est_refusee(client, monkeypatch):
    monkeypatch.setattr(diffuseur, "maximum", 1)
    with client.websocket_connect("/quiz/flux") as premier:
        premier.send_text(json.dumps({"code_prof": "code-prof-test"}))
        assert premier.receive_json() == {"type": "pret"}
        with client.websocket_connect("/quiz/flux") as second:
            second.send_text(json.dumps({"code_prof": "code-prof-test"}))
            assert _fermeture(second) == 1013


def test_une_deconnexion_retire_l_abonne(client):
    with client.websocket_connect("/quiz/flux") as ws:
        ws.send_text(json.dumps({"code_prof": "code-prof-test"}))
        ws.receive_json()
        ws.send_text("un message ignore")
    # Le serveur a vu partir le client : le registre est vide.
    for _ in range(50):
        if len(diffuseur) == 0:
            break
        time.sleep(0.01)
    assert len(diffuseur) == 0


# --- La sonnette en situation -----------------------------------------------


def test_une_ecriture_du_professeur_sonne_chez_tout_le_monde(
    client, catalogue, horloge, jeton_eleve
):
    with client.websocket_connect("/quiz/flux") as ws:
        ws.send_text(json.dumps({"jeton": jeton_eleve}))
        ws.receive_json()
        client.post("/prof/quiz/parties", json={"quiz_id": "q1-bases"}, headers=PROF)
        assert ws.receive_json() == {"type": "changement"}


def test_chaque_ecriture_sonne_chez_qui_doit_relire(
    client, catalogue, horloge, jeton_eleve, inscrire, monkeypatch
):
    """Les reponses et les arrivees ne sonnent que chez le professeur.

    Un eleve n'a pas besoin de savoir que son voisin a repondu : vingt-quatre
    relectures par reponse ne serviraient a personne. Les changements de phase,
    eux, concernent tout le monde.
    """
    sonneries: list[tuple] = []

    async def noter(*roles):
        sonneries.append(roles)

    monkeypatch.setattr(diffuseur, "sonner", noter)
    eleve = {"Authorization": f"Bearer {jeton_eleve}"}
    inscrire("DOJO-M3QP", prenom="Alex")
    autre = client.post("/session", json={"code_acces": "DOJO-M3QP"}).json()["jeton"]

    client.post("/prof/quiz/parties", json={"quiz_id": "q1-bases"}, headers=PROF)
    client.post("/quiz/rejoindre", headers=eleve)
    client.post("/quiz/rejoindre", headers={"Authorization": f"Bearer {autre}"})
    client.post("/prof/quiz/partie/suivante", json={"question": -1}, headers=PROF)
    client.post("/quiz/reponse", json={"partie": 1, "question": 0, "choix": 1}, headers=eleve)
    # La derniere reponse attendue corrige la question : tout le monde relit.
    client.post(
        "/quiz/reponse",
        json={"partie": 1, "question": 0, "choix": 0},
        headers={"Authorization": f"Bearer {autre}"},
    )
    client.post("/prof/quiz/partie/terminer", headers=PROF)

    assert sonneries == [(), ("prof",), ("prof",), (), ("prof",), (), ()]


# --- Le registre, seul --------------------------------------------------------


class FauxWebSocket:
    def __init__(self, vivant: bool = True) -> None:
        self.vivant = vivant
        self.recus: list[dict] = []

    async def send_json(self, donnees: dict) -> None:
        if not self.vivant:
            raise RuntimeError("connexion close")
        self.recus.append(donnees)


def test_le_registre_sonne_par_role():
    registre = Diffuseur()
    prof, eleve = FauxWebSocket(), FauxWebSocket()
    registre.inscrire(prof, "prof")
    registre.inscrire(eleve, "eleve")

    asyncio.run(registre.sonner("prof"))
    assert (len(prof.recus), len(eleve.recus)) == (1, 0)

    asyncio.run(registre.sonner())
    assert (len(prof.recus), len(eleve.recus)) == (2, 1)


def test_une_connexion_morte_est_oubliee_sans_priver_les_autres():
    registre = Diffuseur()
    morte, vivante = FauxWebSocket(vivant=False), FauxWebSocket()
    registre.inscrire(morte, "eleve")
    registre.inscrire(vivante, "eleve")

    asyncio.run(registre.sonner())
    assert vivante.recus == [{"type": "changement"}]
    assert len(registre) == 1


def test_le_registre_a_un_plafond():
    registre = Diffuseur(maximum=1)
    assert registre.inscrire(FauxWebSocket(), "eleve") is True
    assert registre.inscrire(FauxWebSocket(), "eleve") is False
    registre.retirer(FauxWebSocket())  # un inconnu : rien ne se passe
    assert len(registre) == 1
