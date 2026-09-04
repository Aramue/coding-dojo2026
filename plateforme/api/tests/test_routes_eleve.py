def entetes(jeton: str) -> dict:
    return {"Authorization": f"Bearer {jeton}"}


def test_un_code_inscrit_rend_un_jeton(client, inscrire):
    inscrire("DOJO-K7M2")
    reponse = client.post("/session", json={"code_acces": "DOJO-K7M2"})
    assert reponse.status_code == 200
    assert reponse.json()["code_acces"] == "DOJO-K7M2"
    assert reponse.json()["jeton"].startswith("DOJO-K7M2.")


def test_un_code_inconnu_n_ouvre_rien(client):
    """Il creait l'eleve a la volee : une faute de frappe donnait un compte vide,
    sans message, et l'eleve croyait avoir perdu sa progression."""
    reponse = client.post("/session", json={"code_acces": "DOJO-ZZZZ"})
    assert reponse.status_code == 404


def test_la_session_rend_le_prenom_de_l_eleve(client, inscrire):
    inscrire("DOJO-K7M2", prenom="Camille")
    assert client.post("/session", json={"code_acces": "DOJO-K7M2"}).json()["prenom"] == "Camille"


def test_un_eleve_sans_prenom_rend_une_chaine_vide(client, inscrire):
    inscrire("DOJO-K7M2", prenom="")
    assert client.post("/session", json={"code_acces": "DOJO-K7M2"}).json()["prenom"] == ""


def test_session_est_idempotente(client, inscrire):
    inscrire("DOJO-K7M2")
    client.post("/session", json={"code_acces": "DOJO-K7M2"})
    reponse = client.post("/session", json={"code_acces": "DOJO-K7M2"})
    assert reponse.status_code == 200


def test_code_acces_mal_forme_refuse(client):
    assert client.post("/session", json={"code_acces": "toto"}).status_code == 422


def test_parcours_sans_jeton_refuse(client):
    assert client.get("/parcours").status_code == 401


def test_jeton_falsifie_refuse(client):
    assert client.get("/parcours", headers=entetes("DOJO-XXXX.faux")).status_code == 401


def test_parcours_vide_au_depart(client, jeton):
    donnees = client.get("/parcours", headers=entetes(jeton)).json()
    assert donnees["reussis"] == []


def test_tentative_verte_marque_l_exercice_reussi(client, jeton):
    client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": "s1-01", "verdict": "vert", "type_erreur": None, "duree_ms": 42},
    )
    reussis = client.get("/parcours", headers=entetes(jeton)).json()["reussis"]
    assert [l["exercice_id"] for l in reussis] == ["s1-01"]


def test_tentative_bleue_marque_aussi_l_exercice_reussi(client, jeton):
    client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": "s1-01", "verdict": "bleu", "type_erreur": None, "duree_ms": 50},
    )
    reussis = client.get("/parcours", headers=entetes(jeton)).json()["reussis"]
    assert [l["exercice_id"] for l in reussis] == ["s1-01"]


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
    """Un secret publie dans le depot laisse forger un jeton pour n'importe quel eleve."""
    from pathlib import Path

    from app import securite

    source = Path(securite.__file__).read_text(encoding="utf-8")
    assert "dev-uniquement" not in source


def test_un_jeton_forge_avec_un_autre_secret_est_refuse(client):
    import hashlib
    import hmac

    faux = hmac.new(
        b"dev-uniquement-a-remplacer-en-production", b"DOJO-9999", hashlib.sha256
    ).hexdigest()[:32]
    reponse = client.get("/parcours", headers={"Authorization": f"Bearer DOJO-9999.{faux}"})
    assert reponse.status_code == 401


def test_une_seconde_session_met_a_jour_vu_le(client, inscrire):
    from app.modeles import Eleve

    inscrire("DOJO-K7M2")
    client.post("/session", json={"code_acces": "DOJO-K7M2"})
    client.post("/session", json={"code_acces": "DOJO-K7M2"})

    # Un seul eleve, et vu_le a bouge par rapport a cree_le.
    from sqlmodel import Session, select

    from app import bdd

    generateur = client.app.dependency_overrides[bdd.obtenir_session]()
    session: Session = next(generateur)
    eleves = session.exec(select(Eleve)).all()
    assert len(eleves) == 1
    assert eleves[0].vu_le >= eleves[0].cree_le


def test_un_code_au_nouveau_format_est_accepte(client, inscrire):
    inscrire("DOJO-K7M2")
    reponse = client.post("/session", json={"code_acces": "DOJO-K7M2"})
    assert reponse.status_code == 200
    assert reponse.json()["code_acces"] == "DOJO-K7M2"


def test_l_ancien_format_est_refuse(client):
    """Le prefixe AGENT- appartient a la fiction abandonnee : il ne doit plus ouvrir."""
    assert client.post("/session", json={"code_acces": "AGENT-K7M2"}).status_code == 422


def test_un_champ_inconnu_est_refuse(client):
    """Sans extra="forbid", un champ mal nomme passerait en silence.

    La requete serait acceptee avec code_acces manquant plutot que refusee, et
    l'eleve verrait une erreur incomprehensible au lieu du vrai probleme.
    """
    reponse = client.post(
        "/session", json={"code_acces": "DOJO-K7M2", "code_agent": "DOJO-K7M2"}
    )
    assert reponse.status_code == 422


def _valider(client, jeton, exercice, verdict="vert"):
    return client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": exercice, "verdict": verdict, "type_erreur": None, "duree_ms": 42},
    )


def test_le_parcours_porte_la_date_et_le_verdict(client, jeton):
    _valider(client, jeton, "s1-01", "bleu")
    ligne = client.get("/parcours", headers=entetes(jeton)).json()["reussis"][0]
    assert ligne["exercice_id"] == "s1-01"
    assert ligne["verdict"] == "bleu"
    assert ligne["le"].startswith("20")


def test_le_meilleur_verdict_est_conserve(client, jeton):
    """Rejouer moins bien ne retire pas une coche deja obtenue."""
    _valider(client, jeton, "s1-01", "bleu")
    _valider(client, jeton, "s1-01", "vert")
    _valider(client, jeton, "s1-01", "bleu")
    reussis = client.get("/parcours", headers=entetes(jeton)).json()["reussis"]
    assert len(reussis) == 1
    assert reussis[0]["verdict"] == "vert"


def test_la_date_est_celle_de_la_premiere_reussite(client, jeton):
    _valider(client, jeton, "s1-01", "bleu")
    premier = client.get("/parcours", headers=entetes(jeton)).json()["reussis"][0]["le"]
    _valider(client, jeton, "s1-01", "vert")
    apres = client.get("/parcours", headers=entetes(jeton)).json()["reussis"][0]["le"]
    assert apres == premier


def test_une_tentative_rouge_n_apparait_pas(client, jeton):
    _valider(client, jeton, "s1-01", "rouge")
    assert client.get("/parcours", headers=entetes(jeton)).json()["reussis"] == []
