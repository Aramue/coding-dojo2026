"""Le quiz de bout en bout, par HTTP : le professeur mene, les eleves repondent."""

import pytest
from sqlmodel import select

from app.modeles import Eleve, ParticipantQuiz, PartieQuiz, ReponseQuiz

PROF = {"X-Code-Prof": "code-prof-test"}


@pytest.fixture(name="eleve")
def fixture_eleve(client, inscrire):
    """Inscrit un eleve et rend les en-tetes de sa session."""

    def eleve(code: str, prenom: str = "Camille", nom: str = "Rey") -> dict:
        inscrire(code, prenom=prenom, nom=nom)
        jeton = client.post("/session", json={"code_acces": code}).json()["jeton"]
        return {"Authorization": f"Bearer {jeton}"}

    return eleve


@pytest.fixture(name="partie")
def fixture_partie(client, catalogue, horloge):
    """Une partie creee, en salle d'attente."""
    reponse = client.post("/prof/quiz/parties", json={"quiz_id": "q1-bases"}, headers=PROF)
    assert reponse.status_code == 201
    return reponse.json()


def suivante(client, question: int):
    return client.post("/prof/quiz/partie/suivante", json={"question": question}, headers=PROF)


def repondre(client, entetes, partie: int, question: int, choix: int):
    return client.post(
        "/quiz/reponse",
        json={"partie": partie, "question": question, "choix": choix},
        headers=entetes,
    )


# --- Catalogue et creation --------------------------------------------------


def test_le_catalogue_est_reserve_au_professeur(client, catalogue):
    assert client.get("/prof/quiz").status_code == 401
    assert client.get("/prof/quiz", headers={"X-Code-Prof": "faux"}).status_code == 401


def test_le_catalogue_resume_chaque_quiz(client, catalogue):
    assert client.get("/prof/quiz", headers=PROF).json() == {
        "quiz": [{"id": "q1-bases", "titre": "Les bases", "seance": 1, "questions": 2, "duree_s": 30}]
    }


def test_une_partie_neuve_attend_ses_joueurs(partie):
    assert partie["phase"] == "attente"
    assert partie["participants"] == []
    assert partie["question"] is None


def test_un_quiz_inconnu_ne_se_lance_pas(client, catalogue, horloge):
    reponse = client.post("/prof/quiz/parties", json={"quiz_id": "q2-absent"}, headers=PROF)
    assert reponse.status_code == 404


@pytest.mark.parametrize(
    "corps",
    [{"quiz_id": "../etc/passwd"}, {"quiz_id": "q1-bases", "texte": "libre"}, {}],
)
def test_la_demande_de_partie_est_validee_cote_serveur(client, catalogue, corps):
    assert client.post("/prof/quiz/parties", json=corps, headers=PROF).status_code == 422


def test_une_seule_partie_a_la_fois(client, partie):
    reponse = client.post("/prof/quiz/parties", json={"quiz_id": "q1-bases"}, headers=PROF)
    assert reponse.status_code == 409


def test_une_partie_terminee_laisse_place_a_la_suivante(client, partie):
    assert client.post("/prof/quiz/partie/terminer", headers=PROF).json()["phase"] == "terminee"
    reponse = client.post("/prof/quiz/parties", json={"quiz_id": "q1-bases"}, headers=PROF)
    assert reponse.status_code == 201
    assert reponse.json()["partie"] == partie["partie"] + 1


def test_une_partie_dont_le_quiz_a_disparu_est_close_a_la_creation(
    client, catalogue, horloge, session_test
):
    session_test.add(PartieQuiz(quiz_id="q9-disparu", phase="question", question=0))
    session_test.commit()
    reponse = client.post("/prof/quiz/parties", json={"quiz_id": "q1-bases"}, headers=PROF)
    assert reponse.status_code == 201
    orpheline = session_test.exec(select(PartieQuiz).where(PartieQuiz.quiz_id == "q9-disparu")).one()
    session_test.refresh(orpheline)
    assert orpheline.phase == "terminee"


def test_sans_partie_le_professeur_lit_une_partie_nulle(client, catalogue, horloge):
    donnees = client.get("/prof/quiz/partie", headers=PROF).json()
    assert donnees["partie"] is None


def test_une_action_sans_partie_en_cours_est_refusee(client, catalogue, horloge):
    assert suivante(client, -1).status_code == 409


# --- Rejoindre --------------------------------------------------------------


def test_l_etat_exige_une_session_eleve(client, catalogue):
    assert client.get("/quiz/etat").status_code == 401


def test_sans_partie_l_eleve_ne_voit_rien(client, catalogue, horloge, eleve):
    assert client.get("/quiz/etat", headers=eleve("DOJO-K7M2")).json()["partie"] is None


def test_on_ne_rejoint_pas_une_partie_qui_n_existe_pas(client, catalogue, horloge, eleve):
    assert client.post("/quiz/rejoindre", headers=eleve("DOJO-K7M2")).status_code == 404


def test_rejoindre_ajoute_l_eleve_avec_son_nom_a_l_ecran_du_professeur(client, partie, eleve):
    entetes = eleve("DOJO-K7M2", "Camille", "Rey")
    vue = client.post("/quiz/rejoindre", headers=entetes).json()
    assert vue["rejoint"] is True
    assert vue["phase"] == "attente"

    prof = client.get("/prof/quiz/partie", headers=PROF).json()
    assert prof["participants"] == [{"code_acces": "DOJO-K7M2", "prenom": "Camille", "nom": "Rey"}]


def test_rejoindre_deux_fois_ne_compte_qu_une_fois(client, partie, eleve):
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=entetes)
    client.post("/quiz/rejoindre", headers=entetes)
    assert len(client.get("/prof/quiz/partie", headers=PROF).json()["participants"]) == 1


def test_un_eleve_retire_ne_rentre_pas_avec_un_vieux_jeton(client, partie, eleve, session_test):
    entetes = eleve("DOJO-K7M2")
    session_test.delete(session_test.get(Eleve, "DOJO-K7M2"))
    session_test.commit()
    assert client.post("/quiz/rejoindre", headers=entetes).status_code == 404
    assert client.get("/quiz/etat", headers=entetes).status_code == 404


# --- Une question -----------------------------------------------------------


def test_la_premiere_question_s_ouvre_pour_tout_le_monde(client, partie, eleve):
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=entetes)
    prof = suivante(client, -1).json()
    assert prof["phase"] == "question"
    assert prof["question"]["rang"] == 0

    vue = client.get("/quiz/etat", headers=entetes).json()
    assert vue["phase"] == "question"
    assert vue["question"]["options"] == ["4", "22", "Une erreur"]
    assert vue["question"]["fin_a"] == "2026-09-30T14:00:20+00:00"


def test_aucune_photographie_ne_trahit_la_reponse_avant_la_correction(client, partie, eleve, horloge):
    """Le test de fuite, par HTTP : ni l'eleve, ni l'ecran projete."""
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=entetes)
    # Un second joueur qui n'a pas repondu : sans lui, la reponse unique
    # corrigerait la question aussitot.
    client.post("/quiz/rejoindre", headers=eleve("DOJO-M3QP"))
    suivante(client, -1)
    horloge.avancer(2)
    repondre(client, entetes, partie["partie"], 0, 1)

    for texte in (
        client.get("/quiz/etat", headers=entetes).text,
        client.get("/prof/quiz/partie", headers=PROF).text,
    ):
        assert "bonne_reponse" not in texte
        assert "correcte" not in texte
        assert "Deux textes se collent" not in texte


def test_une_reponse_est_enregistree_sans_dire_si_elle_est_juste(client, partie, eleve, horloge):
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=entetes)
    client.post("/quiz/rejoindre", headers=eleve("DOJO-M3QP"))
    suivante(client, -1)
    horloge.avancer(5)
    vue = repondre(client, entetes, partie["partie"], 0, 1).json()
    assert vue["ma_reponse"] == {"choix": 1}
    assert client.get("/prof/quiz/partie", headers=PROF).json()["reponses_recues"] == 1


def test_on_ne_repond_qu_une_fois(client, partie, eleve):
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=eleve("DOJO-M3QP"))
    suivante(client, -1)
    assert repondre(client, entetes, partie["partie"], 0, 0).status_code == 200
    second = repondre(client, entetes, partie["partie"], 0, 1)
    assert second.status_code == 409
    assert second.json()["detail"] == "Tu as déjà répondu à cette question."


def test_repondre_vaut_rejoindre(client, partie, eleve):
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=eleve("DOJO-M3QP"))
    suivante(client, -1)
    assert repondre(client, entetes, partie["partie"], 0, 1).json()["rejoint"] is True


def test_une_reponse_trop_tardive_est_refusee(client, partie, eleve, horloge):
    entetes = eleve("DOJO-K7M2")
    suivante(client, -1)
    horloge.avancer(21)
    reponse = repondre(client, entetes, partie["partie"], 0, 1)
    assert reponse.status_code == 409
    assert reponse.json()["detail"] == "Le temps de réponse est écoulé."


def test_une_reponse_pour_une_autre_partie_est_refusee(client, partie, eleve):
    entetes = eleve("DOJO-K7M2")
    suivante(client, -1)
    assert repondre(client, entetes, partie["partie"] + 1, 0, 1).status_code == 409


def test_une_reponse_a_une_question_pas_encore_ouverte_est_refusee(client, partie, eleve):
    entetes = eleve("DOJO-K7M2")
    suivante(client, -1)
    assert repondre(client, entetes, partie["partie"], 1, 0).status_code == 409


def test_un_choix_hors_des_options_de_la_question_est_invalide(client, partie, eleve):
    """La question 1 a trois options : le schema accepte 3, la regle non."""
    entetes = eleve("DOJO-K7M2")
    suivante(client, -1)
    assert repondre(client, entetes, partie["partie"], 0, 3).status_code == 422


@pytest.mark.parametrize(
    "corps",
    [
        {"partie": 1, "question": 0, "choix": 9},
        {"partie": 1, "question": 0, "choix": -1},
        {"partie": 0, "question": 0, "choix": 1},
        {"partie": 1, "question": 0, "choix": 1, "reponse": "22"},
        {"partie": 1, "question": 0},
    ],
)
def test_la_reponse_est_validee_cote_serveur(client, partie, eleve, corps):
    entetes = eleve("DOJO-K7M2")
    suivante(client, -1)
    assert client.post("/quiz/reponse", json=corps, headers=entetes).status_code == 422


# --- Correction -------------------------------------------------------------


def test_quand_tout_le_monde_a_repondu_la_question_se_corrige(client, partie, eleve, horloge):
    camille = eleve("DOJO-K7M2", "Camille", "Rey")
    alex = eleve("DOJO-M3QP", "Alex", "Morel")
    for entetes in (camille, alex):
        client.post("/quiz/rejoindre", headers=entetes)
    suivante(client, -1)

    horloge.avancer(4)
    repondre(client, camille, partie["partie"], 0, 1)
    vue = repondre(client, alex, partie["partie"], 0, 0).json()
    assert vue["phase"] == "correction"
    assert vue["ma_reponse"] == {"choix": 0, "correcte": False, "points": 0}
    assert vue["moi"]["rang"] == 2

    prof = client.get("/prof/quiz/partie", headers=PROF).json()
    assert prof["phase"] == "correction"
    assert prof["question"]["bonne_reponse"] == 1
    assert prof["repartition"] == [1, 1, 0]
    assert prof["podium"] == [
        {"code_acces": "DOJO-K7M2", "prenom": "Camille", "nom": "Rey", "points": 900, "rang": 1}
    ]


def test_a_l_echeance_la_correction_arrive_sans_que_personne_n_ecrive(client, partie, eleve, horloge):
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=entetes)
    suivante(client, -1)
    horloge.avancer(20.5)
    vue = client.get("/quiz/etat", headers=entetes).json()
    assert vue["phase"] == "correction"
    assert vue["question"]["bonne_reponse"] == 1
    assert vue["ma_reponse"] is None


def test_le_professeur_peut_corriger_avant_la_fin_du_temps(client, partie, eleve):
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=entetes)
    suivante(client, -1)
    corrigee = client.post("/prof/quiz/partie/corriger", json={"question": 0}, headers=PROF)
    assert corrigee.json()["phase"] == "correction"
    assert client.get("/quiz/etat", headers=entetes).json()["phase"] == "correction"


def test_on_ne_corrige_pas_deux_fois(client, partie):
    suivante(client, -1)
    client.post("/prof/quiz/partie/corriger", json={"question": 0}, headers=PROF)
    second = client.post("/prof/quiz/partie/corriger", json={"question": 0}, headers=PROF)
    assert second.status_code == 409


def test_un_double_clic_sur_suivante_ne_saute_pas_de_question(client, partie):
    assert suivante(client, -1).status_code == 200
    second = suivante(client, -1)
    assert second.status_code == 409
    assert second.json()["detail"] == "La partie a déjà avancé."


def test_on_ne_passe_pas_a_la_suite_pendant_une_question(client, partie):
    suivante(client, -1)
    reponse = suivante(client, 0)
    assert reponse.status_code == 409
    assert "encore ouverte" in reponse.json()["detail"]


# --- Fin de partie ----------------------------------------------------------


def _jouer_jusqu_au_bout(client, partie, horloge, entetes):
    suivante(client, -1)
    horloge.avancer(2)
    repondre(client, entetes, partie["partie"], 0, 1)
    suivante(client, 0)
    horloge.avancer(3)
    repondre(client, entetes, partie["partie"], 1, 1)
    return suivante(client, 1).json()


def test_apres_la_derniere_question_le_podium_et_le_bilan(client, partie, eleve, horloge):
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=entetes)
    fin = _jouer_jusqu_au_bout(client, partie, horloge, entetes)

    assert fin["phase"] == "terminee"
    assert [p["points"] for p in fin["podium"]] == [950 + 850]
    assert [ligne["repartition"] for ligne in fin["bilan"]] == [[0, 1, 0], [0, 1]]

    moi = client.get("/quiz/etat", headers=entetes).json()["moi"]
    assert (moi["points"], moi["bonnes"], moi["rang"]) == (1800, 2, 1)


def test_une_partie_finie_ne_se_montre_qu_a_ceux_qui_l_ont_jouee(client, partie, eleve, horloge):
    joueur = eleve("DOJO-K7M2")
    absent = eleve("DOJO-M3QP")
    client.post("/quiz/rejoindre", headers=joueur)
    _jouer_jusqu_au_bout(client, partie, horloge, joueur)

    assert client.get("/quiz/etat", headers=joueur).json()["phase"] == "terminee"
    assert client.get("/quiz/etat", headers=absent).json()["partie"] is None


def test_une_partie_finie_disparait_au_bout_d_un_quart_d_heure(client, partie, eleve, horloge):
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=entetes)
    _jouer_jusqu_au_bout(client, partie, horloge, entetes)
    horloge.avancer(16 * 60)
    assert client.get("/quiz/etat", headers=entetes).json()["partie"] is None
    # Le professeur, lui, garde son bilan jusqu'a la partie suivante.
    assert client.get("/prof/quiz/partie", headers=PROF).json()["phase"] == "terminee"


def test_on_ne_rejoint_pas_une_partie_terminee(client, partie, eleve):
    client.post("/prof/quiz/partie/terminer", headers=PROF)
    assert client.post("/quiz/rejoindre", headers=eleve("DOJO-K7M2")).status_code == 404


# --- Donnees personnelles ---------------------------------------------------


def test_retirer_un_eleve_emporte_ses_participations_et_ses_reponses(
    client, partie, eleve, session_test
):
    entetes = eleve("DOJO-K7M2")
    client.post("/quiz/rejoindre", headers=eleve("DOJO-M3QP"))
    suivante(client, -1)
    repondre(client, entetes, partie["partie"], 0, 1)

    assert client.delete("/prof/eleves/DOJO-K7M2", headers=PROF).status_code == 200
    for modele in (ParticipantQuiz, ReponseQuiz):
        restantes = session_test.exec(select(modele).where(modele.code_acces == "DOJO-K7M2")).all()
        assert restantes == []
