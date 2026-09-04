from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.modeles import Eleve, Tentative

# Adapte par rapport au brief : la valeur d'exemple "prof-test" (9 caracteres) ne
# passerait pas test_le_code_prof_par_defaut_n_est_pas_devinable, qui exige
# len(CODE_PROF) >= 12. Voir conftest.py pour la valeur reellement positionnee.
ENTETES = {"X-Code-Prof": "code-prof-test"}


def _tentative(session: Session, code: str, exercice: str, verdict: str, il_y_a_s: int, erreur=None):
    session.add(Eleve(code_acces=code)) if session.get(Eleve, code) is None else None
    session.add(
        Tentative(
            code_acces=code,
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


def test_eleve_avec_trois_echecs_consecutifs_est_bloque(client, session_test):
    for _ in range(3):
        _tentative(session_test, "DOJO-M3QP", "s1-21", "rouge", 60, "TypeError")
    donnees = client.get("/prof/seance", headers=ENTETES).json()
    ligne = next(a for a in donnees["eleves"] if a["code_acces"] == "DOJO-M3QP")
    assert ligne["statut"] == "bloque"
    assert ligne["echecs_consecutifs"] == 3
    assert ligne["dernier_type_erreur"] == "TypeError"


def test_une_reussite_remet_le_compteur_a_zero(client, session_test):
    for _ in range(3):
        _tentative(session_test, "DOJO-K7M2", "s1-21", "rouge", 300, "TypeError")
    _tentative(session_test, "DOJO-K7M2", "s1-21", "vert", 60)
    ligne = next(
        a for a in client.get("/prof/seance", headers=ENTETES).json()["eleves"]
        if a["code_acces"] == "DOJO-K7M2"
    )
    assert ligne["echecs_consecutifs"] == 0
    assert ligne["statut"] == "en_cours"


def test_eleve_sans_activite_recente_est_inactif(client, session_test):
    _tentative(session_test, "DOJO-R8TV", "s1-02", "rouge", 900, "SyntaxError")
    ligne = next(
        a for a in client.get("/prof/seance", headers=ENTETES).json()["eleves"]
        if a["code_acces"] == "DOJO-R8TV"
    )
    assert ligne["statut"] == "inactif"
    assert ligne["inactif_depuis_s"] >= 600


def test_les_bloques_remontent_en_tete(client, session_test):
    _tentative(session_test, "DOJO-AAAA", "s1-01", "vert", 30)
    for _ in range(3):
        _tentative(session_test, "DOJO-ZZZZ", "s1-21", "rouge", 30, "TypeError")
    eleves = client.get("/prof/seance", headers=ENTETES).json()["eleves"]
    assert eleves[0]["code_acces"] == "DOJO-ZZZZ"


def test_la_reponse_ne_contient_jamais_de_code_source(client, session_test):
    _tentative(session_test, "DOJO-K7M2", "s1-01", "vert", 10)
    corps = client.get("/prof/seance", headers=ENTETES).text
    assert "print(" not in corps
    for cle in ("code", "source", "solution"):
        assert f'"{cle}"' not in corps


def test_le_code_prof_par_defaut_n_est_pas_devinable():
    from app import routes_prof

    assert routes_prof.CODE_PROF != "prof-dev"
    assert len(routes_prof.CODE_PROF) >= 12


def test_les_reussis_sont_la_liste_des_exercices_pas_leur_compte(client, session_test):
    """Le tableau de bord doit pouvoir ne compter que les obligatoires.

    L'API ignore lesquels le sont — le contenu vit cote front — donc elle
    renvoie les identifiants et laisse le tri a celui qui sait.
    """
    _tentative(session_test, "DOJO-L4XZ", "s1-02", "vert", 300)
    _tentative(session_test, "DOJO-L4XZ", "s1-05", "bleu", 200)
    _tentative(session_test, "DOJO-L4XZ", "s1-07", "rouge", 100, "NameError")
    ligne = next(
        a for a in client.get("/prof/seance", headers=ENTETES).json()["eleves"]
        if a["code_acces"] == "DOJO-L4XZ"
    )
    assert [r["exercice_id"] for r in ligne["reussis"]] == ["s1-02", "s1-05"]


def test_un_exercice_reussi_deux_fois_ne_compte_qu_une_fois(client, session_test):
    _tentative(session_test, "DOJO-P9WK", "s1-02", "bleu", 300)
    _tentative(session_test, "DOJO-P9WK", "s1-02", "vert", 100)
    ligne = next(
        a for a in client.get("/prof/seance", headers=ENTETES).json()["eleves"]
        if a["code_acces"] == "DOJO-P9WK"
    )
    assert [r["exercice_id"] for r in ligne["reussis"]] == ["s1-02"]


def _inscrire(session: Session, code: str, prenom: str = "Camille", nom: str = "Rey") -> None:
    session.add(Eleve(code_acces=code, prenom=prenom, nom=nom))
    session.commit()


def test_un_eleve_inscrit_qui_n_a_rien_soumis_apparait_quand_meme(client, session_test):
    """« Qui n'a pas commence » est ce qu'il faut voir dans le premier quart
    d'heure : construite depuis les tentatives, la liste l'ignorait."""
    _inscrire(session_test, "DOJO-N4WQ", "Enzo")
    ligne = client.get("/prof/seance", headers=ENTETES).json()["eleves"][0]
    assert ligne["code_acces"] == "DOJO-N4WQ"
    assert ligne["statut"] == "pas_commence"
    assert ligne["exercice_id"] is None
    assert ligne["reussis"] == []


def test_la_seance_porte_l_identite_de_l_eleve(client, session_test):
    _inscrire(session_test, "DOJO-N4WQ", "Enzo", "Poupard")
    ligne = client.get("/prof/seance", headers=ENTETES).json()["eleves"][0]
    assert ligne["prenom"] == "Enzo"
    assert ligne["nom"] == "Poupard"


def test_ceux_qui_n_ont_pas_commence_passent_apres_les_bloques(client, session_test):
    _inscrire(session_test, "DOJO-N4WQ", "Enzo")
    for _ in range(3):
        _tentative(session_test, "DOJO-ZZZZ", "s1-21", "rouge", 30, "TypeError")
    eleves = client.get("/prof/seance", headers=ENTETES).json()["eleves"]
    assert [e["statut"] for e in eleves] == ["bloque", "pas_commence"]


def test_un_eleve_retire_disparait_de_la_seance(client, session_test):
    _inscrire(session_test, "DOJO-N4WQ", "Enzo")
    client.delete("/prof/eleves/DOJO-N4WQ", headers=ENTETES)
    assert client.get("/prof/seance", headers=ENTETES).json()["eleves"] == []


def test_les_reussites_portent_leur_verdict(client, session_test):
    """Le professeur voit la meme chose que l'eleve : une coche ou deux."""
    _tentative(session_test, "DOJO-N4WQ", "s1-01", "vert", 300)
    _tentative(session_test, "DOJO-N4WQ", "s1-02", "bleu", 200)
    _tentative(session_test, "DOJO-N4WQ", "s1-03", "rouge", 100, "NameError")
    ligne = next(
        e for e in client.get("/prof/seance", headers=ENTETES).json()["eleves"]
        if e["code_acces"] == "DOJO-N4WQ"
    )
    assert ligne["reussis"] == [
        {"exercice_id": "s1-01", "verdict": "vert"},
        {"exercice_id": "s1-02", "verdict": "bleu"},
    ]


def test_le_meilleur_verdict_est_conserve_cote_prof(client, session_test):
    _tentative(session_test, "DOJO-N4WQ", "s1-01", "bleu", 300)
    _tentative(session_test, "DOJO-N4WQ", "s1-01", "vert", 200)
    _tentative(session_test, "DOJO-N4WQ", "s1-01", "bleu", 100)
    ligne = next(
        e for e in client.get("/prof/seance", headers=ENTETES).json()["eleves"]
        if e["code_acces"] == "DOJO-N4WQ"
    )
    assert ligne["reussis"] == [{"exercice_id": "s1-01", "verdict": "vert"}]
