def entetes(jeton: str) -> dict:
    return {"Authorization": f"Bearer {jeton}"}


def test_session_cree_l_agent_et_rend_un_jeton(client):
    reponse = client.post("/session", json={"code_agent": "AGENT-K7M2"})
    assert reponse.status_code == 200
    assert reponse.json()["code_agent"] == "AGENT-K7M2"
    assert reponse.json()["jeton"].startswith("AGENT-K7M2.")


def test_session_est_idempotente(client):
    client.post("/session", json={"code_agent": "AGENT-K7M2"})
    reponse = client.post("/session", json={"code_agent": "AGENT-K7M2"})
    assert reponse.status_code == 200


def test_code_agent_mal_forme_refuse(client):
    assert client.post("/session", json={"code_agent": "toto"}).status_code == 422


def test_parcours_sans_jeton_refuse(client):
    assert client.get("/parcours").status_code == 401


def test_jeton_falsifie_refuse(client):
    assert client.get("/parcours", headers=entetes("AGENT-XXXX.faux")).status_code == 401


def test_parcours_vide_au_depart(client, jeton):
    donnees = client.get("/parcours", headers=entetes(jeton)).json()
    assert donnees["reussis"] == []


def test_tentative_verte_marque_l_exercice_reussi(client, jeton):
    client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": "s1-01", "verdict": "vert", "type_erreur": None, "duree_ms": 42},
    )
    assert client.get("/parcours", headers=entetes(jeton)).json()["reussis"] == ["s1-01"]


def test_tentative_bleue_marque_aussi_l_exercice_reussi(client, jeton):
    client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": "s1-01", "verdict": "bleu", "type_erreur": None, "duree_ms": 50},
    )
    assert client.get("/parcours", headers=entetes(jeton)).json()["reussis"] == ["s1-01"]


def test_tentative_rouge_ne_marque_pas_reussi(client, jeton):
    client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": "s1-01", "verdict": "rouge", "type_erreur": "NameError", "duree_ms": 30},
    )
    assert client.get("/parcours", headers=entetes(jeton)).json()["reussis"] == []


def test_verdict_inconnu_refuse(client, jeton):
    reponse = client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": "s1-01", "verdict": "orange", "type_erreur": None, "duree_ms": 1},
    )
    assert reponse.status_code == 422


def test_la_route_tentative_refuse_tout_champ_de_code(client, jeton):
    """Le code de l'eleve ne doit jamais atteindre le serveur."""
    reponse = client.post(
        "/tentative",
        headers=entetes(jeton),
        json={
            "exercice_id": "s1-01",
            "verdict": "vert",
            "type_erreur": None,
            "duree_ms": 1,
            "code": "print('secret')",
        },
    )
    assert reponse.status_code == 422
