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


def test_un_type_erreur_inconnu_est_refuse(client, jeton):
    """Le filtrage du navigateur ne protège rien : l'élève contrôle son navigateur."""
    reponse = client.post(
        "/tentative",
        headers=entetes(jeton),
        json={
            "exercice_id": "s1-01",
            "verdict": "rouge",
            "type_erreur": "BYPASS_texte_libre_choisi_par_l_eleve",
            "duree_ms": 42,
        },
    )
    assert reponse.status_code == 422


def test_un_exercice_id_libre_est_refuse(client, jeton):
    reponse = client.post(
        "/tentative",
        headers=entetes(jeton),
        json={
            "exercice_id": "texte_libre_dans_exercice_id",
            "verdict": "rouge",
            "type_erreur": None,
            "duree_ms": 42,
        },
    )
    assert reponse.status_code == 422


def test_les_types_erreur_legitimes_passent(client, jeton):
    for type_erreur in ("NameError", "TimeoutError", "AutreErreur", None):
        reponse = client.post(
            "/tentative",
            headers=entetes(jeton),
            json={
                "exercice_id": "s1-01",
                "verdict": "rouge",
                "type_erreur": type_erreur,
                "duree_ms": 42,
            },
        )
        assert reponse.status_code == 200, type_erreur


def test_aucun_secret_en_dur_dans_le_code():
    """Un secret publie dans le depot laisse forger un jeton pour n'importe quel agent."""
    from pathlib import Path

    from app import securite

    source = Path(securite.__file__).read_text(encoding="utf-8")
    assert "dev-uniquement" not in source


def test_un_jeton_forge_avec_un_autre_secret_est_refuse(client):
    import hashlib
    import hmac

    faux = hmac.new(
        b"dev-uniquement-a-remplacer-en-production", b"AGENT-9999", hashlib.sha256
    ).hexdigest()[:32]
    reponse = client.get("/parcours", headers={"Authorization": f"Bearer AGENT-9999.{faux}"})
    assert reponse.status_code == 401


def test_une_seconde_session_met_a_jour_vu_le(client):
    from app.modeles import Agent

    client.post("/session", json={"code_agent": "AGENT-K7M2"})
    client.post("/session", json={"code_agent": "AGENT-K7M2"})

    # Un seul agent, et vu_le a bouge par rapport a cree_le.
    from sqlmodel import Session, select

    from app import bdd

    generateur = client.app.dependency_overrides[bdd.obtenir_session]()
    session: Session = next(generateur)
    agents = session.exec(select(Agent)).all()
    assert len(agents) == 1
    assert agents[0].vu_le >= agents[0].cree_le
