from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.modeles import Agent, Tentative

# Adapte par rapport au brief : la valeur d'exemple "prof-test" (9 caracteres) ne
# passerait pas test_le_code_prof_par_defaut_n_est_pas_devinable, qui exige
# len(CODE_PROF) >= 12. Voir conftest.py pour la valeur reellement positionnee.
ENTETES = {"X-Code-Prof": "code-prof-test"}


def _tentative(session: Session, code: str, exercice: str, verdict: str, il_y_a_s: int, erreur=None):
    session.add(Agent(code_agent=code)) if session.get(Agent, code) is None else None
    session.add(
        Tentative(
            code_agent=code,
            exercice_id=exercice,
            verdict=verdict,
            type_erreur=erreur,
            duree_ms=40,
            horodatage=datetime.now(timezone.utc) - timedelta(seconds=il_y_a_s),
        )
    )
    session.commit()


def test_sans_code_prof_l_acces_est_refuse(client):
    assert client.get("/prof/seance").status_code == 401


def test_code_prof_errone_refuse(client):
    assert client.get("/prof/seance", headers={"X-Code-Prof": "faux"}).status_code == 401


def test_agent_avec_trois_echecs_consecutifs_est_bloque(client, session_test):
    for _ in range(3):
        _tentative(session_test, "AGENT-M3QP", "s1-21", "rouge", 60, "TypeError")
    donnees = client.get("/prof/seance", headers=ENTETES).json()
    ligne = next(a for a in donnees["agents"] if a["code_agent"] == "AGENT-M3QP")
    assert ligne["statut"] == "bloque"
    assert ligne["echecs_consecutifs"] == 3
    assert ligne["dernier_type_erreur"] == "TypeError"


def test_une_reussite_remet_le_compteur_a_zero(client, session_test):
    for _ in range(3):
        _tentative(session_test, "AGENT-K7M2", "s1-21", "rouge", 300, "TypeError")
    _tentative(session_test, "AGENT-K7M2", "s1-21", "vert", 60)
    ligne = next(
        a for a in client.get("/prof/seance", headers=ENTETES).json()["agents"]
        if a["code_agent"] == "AGENT-K7M2"
    )
    assert ligne["echecs_consecutifs"] == 0
    assert ligne["statut"] == "en_cours"


def test_agent_sans_activite_recente_est_inactif(client, session_test):
    _tentative(session_test, "AGENT-R8TV", "s1-02", "rouge", 900, "SyntaxError")
    ligne = next(
        a for a in client.get("/prof/seance", headers=ENTETES).json()["agents"]
        if a["code_agent"] == "AGENT-R8TV"
    )
    assert ligne["statut"] == "inactif"
    assert ligne["inactif_depuis_s"] >= 600


def test_les_bloques_remontent_en_tete(client, session_test):
    _tentative(session_test, "AGENT-AAAA", "s1-01", "vert", 30)
    for _ in range(3):
        _tentative(session_test, "AGENT-ZZZZ", "s1-21", "rouge", 30, "TypeError")
    agents = client.get("/prof/seance", headers=ENTETES).json()["agents"]
    assert agents[0]["code_agent"] == "AGENT-ZZZZ"


def test_la_reponse_ne_contient_jamais_de_code_source(client, session_test):
    _tentative(session_test, "AGENT-K7M2", "s1-01", "vert", 10)
    corps = client.get("/prof/seance", headers=ENTETES).text
    assert "print(" not in corps
    for cle in ("code", "source", "solution"):
        assert f'"{cle}"' not in corps


def test_verrouiller_puis_deverrouiller_un_concept(client):
    r = client.post("/prof/verrou", headers=ENTETES, json={"concept": "types", "ouvert": False})
    assert r.json() == {"concept": "types", "ouvert": False}
    r = client.post("/prof/verrou", headers=ENTETES, json={"concept": "types", "ouvert": True})
    assert r.json()["ouvert"] is True


def test_un_concept_inconnu_est_refuse(client):
    """Une liste déroulante côté client ne protège rien : la contrainte vit ici."""
    reponse = client.post(
        "/prof/verrou",
        headers=ENTETES,
        json={"concept": "texte_libre_choisi_par_l_appelant", "ouvert": False},
    )
    assert reponse.status_code == 422


def test_le_code_prof_par_defaut_n_est_pas_devinable():
    from app import routes_prof

    assert routes_prof.CODE_PROF != "prof-dev"
    assert len(routes_prof.CODE_PROF) >= 12
