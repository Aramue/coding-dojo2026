"""Le compte professeur : premier lancement, connexion, oubli. Voir ADR-014."""

from conftest import MOT_DE_PASSE_TEST
from sqlmodel import select

from app.modeles import Reglage
from app.oublier_prof import oublier
from app.securite import (
    DUREE_JETON_PROF_S,
    creer_jeton_prof,
    hacher,
    jeton_prof_valide,
    verifier_mot_de_passe,
)


def test_au_premier_lancement_aucun_compte_n_existe(client):
    assert client.get("/prof/compte").json() == {"existe": False}


def test_creer_le_compte_rend_un_jeton_qui_ouvre_le_tableau(client):
    reponse = client.post("/prof/compte", json={"mot_de_passe": MOT_DE_PASSE_TEST})
    assert reponse.status_code == 201
    entetes = {"X-Jeton-Prof": reponse.json()["jeton"]}
    assert client.get("/prof/seance", headers=entetes).status_code == 200
    assert client.get("/prof/compte").json() == {"existe": True}


def test_un_second_compte_est_refuse(client, entetes_prof):
    reponse = client.post("/prof/compte", json={"mot_de_passe": "un-autre-mot-de-passe"})
    assert reponse.status_code == 409


def test_le_second_compte_refuse_ne_change_pas_le_mot_de_passe(client, entetes_prof):
    client.post("/prof/compte", json={"mot_de_passe": "un-autre-mot-de-passe"})
    reponse = client.post("/prof/connexion", json={"mot_de_passe": MOT_DE_PASSE_TEST})
    assert reponse.status_code == 200


def test_un_mot_de_passe_trop_court_est_refuse_par_le_serveur(client):
    assert client.post("/prof/compte", json={"mot_de_passe": "a" * 11}).status_code == 422
    assert client.get("/prof/compte").json() == {"existe": False}


def test_un_mot_de_passe_demesure_est_refuse(client):
    assert client.post("/prof/compte", json={"mot_de_passe": "a" * 201}).status_code == 422


def test_un_champ_inconnu_est_refuse(client):
    corps = {"mot_de_passe": MOT_DE_PASSE_TEST, "role": "admin"}
    assert client.post("/prof/compte", json=corps).status_code == 422


def test_le_bon_mot_de_passe_ouvre_une_session(client, entetes_prof):
    reponse = client.post("/prof/connexion", json={"mot_de_passe": MOT_DE_PASSE_TEST})
    assert reponse.status_code == 200
    entetes = {"X-Jeton-Prof": reponse.json()["jeton"]}
    assert client.get("/prof/eleves", headers=entetes).status_code == 200


def test_un_mauvais_mot_de_passe_est_refuse(client, entetes_prof):
    reponse = client.post("/prof/connexion", json={"mot_de_passe": "ce-n-est-pas-le-bon"})
    assert reponse.status_code == 401


def test_un_mot_de_passe_court_est_simplement_faux_a_la_connexion(client, entetes_prof):
    """La regle des douze caracteres vaut a la creation, pas a la connexion."""
    assert client.post("/prof/connexion", json={"mot_de_passe": "court"}).status_code == 401


def test_se_connecter_sans_compte_renvoie_a_la_creation(client):
    reponse = client.post("/prof/connexion", json={"mot_de_passe": MOT_DE_PASSE_TEST})
    assert reponse.status_code == 404


def test_le_mot_de_passe_n_est_jamais_stocke_en_clair(session_test, entetes_prof):
    for ligne in session_test.exec(select(Reglage)).all():
        assert MOT_DE_PASSE_TEST not in ligne.valeur


def test_l_empreinte_se_verifie_et_ne_se_repete_pas():
    premiere, seconde = hacher("mot-de-passe-long"), hacher("mot-de-passe-long")
    assert premiere != seconde  # un sel different a chaque fois
    assert verifier_mot_de_passe("mot-de-passe-long", premiere)
    assert not verifier_mot_de_passe("mot-de-passe-lonG", premiere)


def test_un_jeton_prof_expire_au_bout_de_douze_heures(session_test, entetes_prof):
    jeton = creer_jeton_prof(session_test, maintenant=1_000_000.0)
    assert jeton_prof_valide(session_test, jeton, maintenant=1_000_000.0 + DUREE_JETON_PROF_S - 1)
    assert not jeton_prof_valide(session_test, jeton, maintenant=1_000_000.0 + DUREE_JETON_PROF_S + 1)


def test_un_jeton_prof_retouche_est_refuse(client, entetes_prof):
    prefixe, expire, signature = entetes_prof["X-Jeton-Prof"].split(".")
    plus_tard = f"{prefixe}.{int(expire) + 86400}.{signature}"
    assert client.get("/prof/seance", headers={"X-Jeton-Prof": plus_tard}).status_code == 401


def test_un_jeton_mal_forme_est_refuse(client, entetes_prof):
    for faux in ("prof", "prof.demain.abc", "eleve.9999999999.abc", "prof.9999999999."):
        assert client.get("/prof/seance", headers={"X-Jeton-Prof": faux}).status_code == 401


def test_un_jeton_eleve_n_ouvre_pas_le_tableau(client, inscrire, entetes_prof):
    inscrire("DOJO-K7M2")
    jeton = client.post("/session", json={"code_acces": "DOJO-K7M2"}).json()["jeton"]
    assert client.get("/prof/seance", headers={"X-Jeton-Prof": jeton}).status_code == 401


def test_oublier_le_compte_ferme_les_sessions_et_rouvre_la_creation(
    client, session_test, entetes_prof
):
    assert oublier(session_test) is True
    assert client.get("/prof/compte").json() == {"existe": False}
    assert client.get("/prof/seance", headers=entetes_prof).status_code == 401


def test_un_compte_recree_n_accepte_pas_les_anciens_jetons(client, session_test, entetes_prof):
    oublier(session_test)
    client.post("/prof/compte", json={"mot_de_passe": "nouveau-mot-de-passe"})
    assert client.get("/prof/seance", headers=entetes_prof).status_code == 401


def test_oublier_sans_compte_ne_fait_rien(session_test):
    assert oublier(session_test) is False


def test_oublier_laisse_les_eleves_en_place(client, session_test, inscrire, entetes_prof):
    inscrire("DOJO-K7M2")
    oublier(session_test)
    assert client.post("/session", json={"code_acces": "DOJO-K7M2"}).status_code == 200


def test_la_commande_dit_ce_qu_elle_a_fait(tmp_path, monkeypatch, capsys):
    """`python -m app.oublier_prof`, sur une vraie base de fichier."""
    from sqlmodel import Session, create_engine

    from app import oublier_prof
    from app.securite import CLE_EMPREINTE

    moteur = create_engine(f"sqlite:///{(tmp_path / 'dojo.db').as_posix()}")
    monkeypatch.setattr(oublier_prof, "moteur", moteur)

    oublier_prof.main()
    assert "rien a effacer" in capsys.readouterr().out

    with Session(moteur) as session:
        session.add(Reglage(cle=CLE_EMPREINTE, valeur=hacher("mot-de-passe-long")))
        session.commit()
    oublier_prof.main()
    assert "efface" in capsys.readouterr().out
    with Session(moteur) as session:
        assert session.get(Reglage, CLE_EMPREINTE) is None
