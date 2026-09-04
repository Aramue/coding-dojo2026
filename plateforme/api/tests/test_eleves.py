"""Gestion de la classe par le professeur."""

import re

ENTETES = {"X-Code-Prof": "code-prof-test"}
MOTIF_CODE = re.compile(r"^DOJO-[A-Z0-9]{4}$")


def creer(client, prenom="Camille", **champs):
    return client.post(
        "/prof/eleves", headers=ENTETES, json={"prenom": prenom, **champs}
    )


def test_sans_code_prof_la_liste_est_refusee(client):
    assert client.get("/prof/eleves").status_code == 401


def test_sans_code_prof_la_creation_est_refusee(client):
    assert client.post("/prof/eleves", json={"prenom": "Camille"}).status_code == 401


def test_sans_code_prof_la_suppression_est_refusee(client):
    assert client.delete("/prof/eleves/DOJO-K7M2").status_code == 401


def test_la_classe_est_vide_au_depart(client):
    assert client.get("/prof/eleves", headers=ENTETES).json()["eleves"] == []


def test_creer_un_eleve_rend_un_code(client):
    reponse = creer(client, "Camille", nom="Rey", etablissement="Calvin")
    assert reponse.status_code == 201
    ligne = reponse.json()
    assert MOTIF_CODE.match(ligne["code_acces"])
    assert ligne["prenom"] == "Camille"
    assert ligne["nom"] == "Rey"
    assert ligne["etablissement"] == "Calvin"
    assert ligne["tentatives"] == 0


def test_le_code_n_est_jamais_choisi_par_l_appelant(client):
    """Un code devine d'avance, c'est la progression de quelqu'un d'autre."""
    reponse = client.post(
        "/prof/eleves", headers=ENTETES, json={"prenom": "Camille", "code_acces": "DOJO-AAAA"}
    )
    assert reponse.status_code == 422


def test_le_code_evite_les_caracteres_confondables(client):
    """Un code se recopie a la main depuis un tableau : O/0 et I/1 coutent une main levee."""
    codes = [creer(client, f"Eleve{i}").json()["code_acces"] for i in range(30)]
    for code in codes:
        assert not set(code.removeprefix("DOJO-")) & set("O0I1LS5")


def test_deux_eleves_ne_partagent_jamais_un_code(client):
    codes = {creer(client, f"Eleve{i}").json()["code_acces"] for i in range(40)}
    assert len(codes) == 40


def test_le_prenom_est_obligatoire(client):
    assert client.post("/prof/eleves", headers=ENTETES, json={"prenom": "  "}).status_code == 422


def test_les_espaces_de_bord_sont_retires(client):
    ligne = creer(client, "  Camille  ", nom="  Rey ").json()
    assert ligne["prenom"] == "Camille"
    assert ligne["nom"] == "Rey"


def test_un_champ_inconnu_est_refuse(client):
    reponse = client.post(
        "/prof/eleves", headers=ENTETES, json={"prenom": "Camille", "surnom": "Cam"}
    )
    assert reponse.status_code == 422


def test_un_champ_trop_long_est_refuse(client):
    assert creer(client, "C" * 200).status_code == 422


def test_la_liste_est_triee_par_prenom(client):
    for prenom in ("Zoe", "Enzo", "Iziz"):
        creer(client, prenom)
    liste = client.get("/prof/eleves", headers=ENTETES).json()["eleves"]
    assert [e["prenom"] for e in liste] == ["Enzo", "Iziz", "Zoe"]


def test_modifier_un_eleve(client):
    code = creer(client, "Camile").json()["code_acces"]
    reponse = client.patch(
        f"/prof/eleves/{code}",
        headers=ENTETES,
        json={"prenom": "Camille", "nom": "Rey", "etablissement": "Calvin"},
    )
    assert reponse.status_code == 200
    assert reponse.json()["prenom"] == "Camille"
    assert client.get("/prof/eleves", headers=ENTETES).json()["eleves"][0]["nom"] == "Rey"


def test_modifier_ne_change_jamais_le_code(client):
    """Le code est deja distribue : le changer couperait l'eleve de sa progression."""
    code = creer(client).json()["code_acces"]
    apres = client.patch(f"/prof/eleves/{code}", headers=ENTETES, json={"prenom": "Enzo"}).json()
    assert apres["code_acces"] == code


def test_modifier_un_eleve_inconnu_est_refuse(client):
    reponse = client.patch("/prof/eleves/DOJO-ZZZZ", headers=ENTETES, json={"prenom": "Enzo"})
    assert reponse.status_code == 404


def test_retirer_un_eleve(client):
    code = creer(client).json()["code_acces"]
    assert client.delete(f"/prof/eleves/{code}", headers=ENTETES).status_code == 200
    assert client.get("/prof/eleves", headers=ENTETES).json()["eleves"] == []


def test_retirer_un_eleve_inconnu_est_refuse(client):
    assert client.delete("/prof/eleves/DOJO-ZZZZ", headers=ENTETES).status_code == 404


def test_retirer_un_eleve_emporte_ses_tentatives(client):
    """Sans cela, des lignes orphelines fausseraient le tableau de bord sans plus
    jamais correspondre a personne."""
    code = creer(client).json()["code_acces"]
    jeton = client.post("/session", json={"code_acces": code}).json()["jeton"]
    client.post(
        "/tentative",
        headers={"Authorization": f"Bearer {jeton}"},
        json={"exercice_id": "s1-01", "verdict": "vert", "type_erreur": None, "duree_ms": 12},
    )

    reponse = client.delete(f"/prof/eleves/{code}", headers=ENTETES)
    assert reponse.json()["tentatives_supprimees"] == 1
    assert client.get("/prof/seance", headers=ENTETES).json()["eleves"] == []


def test_la_liste_compte_les_tentatives(client):
    code = creer(client).json()["code_acces"]
    jeton = client.post("/session", json={"code_acces": code}).json()["jeton"]
    for _ in range(3):
        client.post(
            "/tentative",
            headers={"Authorization": f"Bearer {jeton}"},
            json={"exercice_id": "s1-01", "verdict": "rouge", "type_erreur": None, "duree_ms": 9},
        )
    assert client.get("/prof/eleves", headers=ENTETES).json()["eleves"][0]["tentatives"] == 3


def test_un_eleve_cree_peut_ouvrir_une_session(client):
    code = creer(client, "Camille").json()["code_acces"]
    reponse = client.post("/session", json={"code_acces": code})
    assert reponse.status_code == 200
    assert reponse.json()["prenom"] == "Camille"
