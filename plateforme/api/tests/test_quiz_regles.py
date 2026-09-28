"""La regle du jeu, sans HTTP ni base : phases, bareme, classement, vues."""

from datetime import datetime, timedelta, timezone

import pytest

from app.modeles import PartieQuiz, ReponseQuiz
from app.quiz import (
    TOLERANCE,
    Invalide,
    QuizPublie,
    Refus,
    classement,
    evaluer,
    fermer,
    ouvrir_suivante,
    nom_affiche,
    phase_effective,
    podium,
    points,
    questions_closes,
    resultats,
    resume,
    terminer,
    tous_ont_repondu,
    utc,
    vue_eleve,
    vue_prof,
)

T0 = datetime(2026, 9, 30, 14, 0, 0, tzinfo=timezone.utc)

QUIZ = QuizPublie(
    id="q1-bases",
    titre="Les bases",
    seance=1,
    questions=[
        {
            "enonce": "Qu'affiche ce programme ?",
            "code": 'print("2" + "2")',
            "options": ["4", "22", "Une erreur"],
            "bonne_reponse": 1,
            "duree_s": 20,
            "explication": "Deux textes se collent.",
            "sortie": True,
        },
        {
            "enonce": "Et celui-ci ?",
            "options": ["Oui", "Non"],
            "bonne_reponse": 0,
            "duree_s": 10,
        },
    ],
)


def partie(**champs) -> PartieQuiz:
    return PartieQuiz(id=1, quiz_id="q1-bases", **champs)


def en_question(rang=0, depuis_s=0) -> PartieQuiz:
    p = partie()
    p.question = rang - 1
    ouvrir_suivante(p, QUIZ, T0 - timedelta(seconds=depuis_s))
    return p


def reponse(code, question, choix, points_=0, correcte=False) -> ReponseQuiz:
    return ReponseQuiz(
        partie_id=1,
        question=question,
        code_acces=code,
        choix=choix,
        delai_ms=1000,
        correcte=correcte,
        points=points_,
    )


# --- Phases -----------------------------------------------------------------


def test_une_partie_neuve_attend():
    assert phase_effective(partie(), T0) == "attente"


def test_ouvrir_la_premiere_question_fixe_son_echeance():
    p = en_question()
    assert (p.phase, p.question) == ("question", 0)
    assert p.ouverte_le == T0
    assert p.fin_a == T0 + timedelta(seconds=20)


def test_la_correction_se_deduit_de_l_echeance_et_de_la_tolerance():
    p = en_question()
    fin = T0 + timedelta(seconds=20)
    assert phase_effective(p, fin) == "question"
    assert phase_effective(p, fin + TOLERANCE - timedelta(milliseconds=1)) == "question"
    assert phase_effective(p, fin + TOLERANCE) == "correction"
    assert p.phase == "question"  # rien n'a ete ecrit


def test_une_echeance_sans_fuseau_se_lit_en_utc():
    """SQLite rend des horodatages naifs."""
    p = en_question()
    p.fin_a = p.fin_a.replace(tzinfo=None)
    assert phase_effective(p, T0 + timedelta(seconds=21)) == "correction"
    assert utc(datetime(2026, 1, 1)).tzinfo == timezone.utc


def test_on_ne_passe_pas_a_la_suite_pendant_une_question():
    p = en_question()
    with pytest.raises(Refus, match="encore ouverte"):
        ouvrir_suivante(p, QUIZ, T0 + timedelta(seconds=5))


def test_apres_la_correction_la_question_suivante_s_ouvre():
    p = en_question()
    plus_tard = T0 + timedelta(seconds=30)
    ouvrir_suivante(p, QUIZ, plus_tard)
    assert p.question == 1
    assert p.fin_a == plus_tard + timedelta(seconds=10)


def test_apres_la_derniere_question_la_partie_se_termine():
    p = en_question(rang=1)
    plus_tard = T0 + timedelta(seconds=30)
    ouvrir_suivante(p, QUIZ, plus_tard)
    assert p.phase == "terminee"
    assert p.terminee_le == plus_tard
    assert p.question == 1


def test_une_partie_terminee_ne_repart_pas():
    p = partie(phase="terminee")
    with pytest.raises(Refus, match="terminée"):
        ouvrir_suivante(p, QUIZ, T0)
    with pytest.raises(Refus, match="déjà terminée"):
        terminer(p, T0)


def test_fermer_corrige_tout_de_suite():
    p = en_question()
    fermer(p, T0 + timedelta(seconds=3))
    assert phase_effective(p, T0 + timedelta(seconds=3)) == "correction"


def test_on_ne_ferme_que_ce_qui_est_ouvert():
    with pytest.raises(Refus, match="Aucune question"):
        fermer(partie(), T0)


def test_terminer_en_pleine_question():
    p = en_question()
    terminer(p, T0 + timedelta(seconds=2))
    assert phase_effective(p, T0 + timedelta(seconds=2)) == "terminee"


# --- Bareme -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("delai", "attendu"),
    [(0, 1000), (5_000, 875), (10_000, 750), (20_000, 500), (60_000, 500), (-50, 1000)],
)
def test_le_bareme_va_de_1000_a_500(delai, attendu):
    assert points(True, delai, 20_000) == attendu


def test_une_reponse_fausse_ne_rapporte_rien_meme_rapide():
    assert points(False, 0, 20_000) == 0


# --- Evaluation d'une reponse -------------------------------------------------


def test_une_reponse_juste_est_notee_a_la_reception():
    p = en_question()
    evaluation = evaluer(p, QUIZ, 0, 1, T0 + timedelta(seconds=5))
    assert evaluation.correcte
    assert evaluation.delai_ms == 5000
    assert evaluation.points == 875


def test_une_reponse_fausse_est_notee_zero():
    p = en_question()
    evaluation = evaluer(p, QUIZ, 0, 0, T0 + timedelta(seconds=1))
    assert (evaluation.correcte, evaluation.points) == (False, 0)


def test_une_reponse_dans_la_tolerance_est_acceptee():
    p = en_question()
    evaluation = evaluer(p, QUIZ, 0, 1, T0 + timedelta(seconds=20, milliseconds=400))
    assert evaluation.points == 500


def test_une_reponse_apres_la_tolerance_est_refusee():
    p = en_question()
    with pytest.raises(Refus, match="écoulé"):
        evaluer(p, QUIZ, 0, 1, T0 + timedelta(seconds=21))


def test_une_reponse_a_une_autre_question_est_refusee():
    p = en_question(rang=1)
    with pytest.raises(Refus, match="plus en cours"):
        evaluer(p, QUIZ, 0, 1, T0)


def test_une_reponse_en_salle_d_attente_est_refusee():
    with pytest.raises(Refus):
        evaluer(partie(), QUIZ, 0, 1, T0)


@pytest.mark.parametrize("choix", [-1, 3, 99])
def test_un_choix_hors_des_options_est_invalide(choix):
    p = en_question()
    with pytest.raises(Invalide):
        evaluer(p, QUIZ, 0, choix, T0)


def test_tous_ont_repondu():
    reponses = [reponse("A", 0, 1), reponse("B", 0, 0), reponse("A", 1, 0)]
    assert tous_ont_repondu(["A", "B"], reponses, 0)
    assert not tous_ont_repondu(["A", "B"], reponses, 1)
    assert not tous_ont_repondu([], reponses, 0)


# --- Classement -------------------------------------------------------------


def test_le_classement_additionne_les_questions_closes_seulement():
    reponses = [
        reponse("A", 0, 1, 900, True),
        reponse("B", 0, 1, 700, True),
        reponse("B", 1, 0, 1000, True),
    ]
    places = classement(["A", "B", "C"], reponses, closes=1)
    assert [(p.code_acces, p.points, p.rang, p.bonnes) for p in places] == [
        ("A", 900, 1, 1),
        ("B", 700, 2, 1),
        ("C", 0, 3, 0),
    ]


def test_les_ex_aequo_partagent_le_rang():
    reponses = [reponse("A", 0, 1, 800, True), reponse("B", 0, 1, 800, True)]
    places = classement(["C", "B", "A"], reponses, closes=1)
    assert [(p.code_acces, p.rang) for p in places] == [("A", 1), ("B", 1), ("C", 3)]


def test_une_reponse_d_un_eleve_sorti_de_la_partie_est_ignoree():
    places = classement(["A"], [reponse("Z", 0, 1, 900, True)], closes=1)
    assert [p.code_acces for p in places] == ["A"]


def test_le_podium_s_arrete_a_cinq():
    reponses = [reponse(f"E{i}", 0, 1, 1000 - i, True) for i in range(8)]
    places = classement([f"E{i}" for i in range(8)], reponses, closes=1)
    assert [p.code_acces for p in podium(places)] == ["E0", "E1", "E2", "E3", "E4"]


def test_le_podium_ne_montre_jamais_personne_a_zero():
    """Premier tour, personne n'a juste : l'ecran ne projette pas la classe a zero."""
    places = classement(["A", "B", "C"], [reponse("A", 0, 0)], closes=1)
    assert podium(places) == []


def test_questions_closes_selon_la_phase():
    assert questions_closes(partie(), T0) == 0
    p = en_question(rang=1)
    assert questions_closes(p, T0) == 1
    assert questions_closes(p, T0 + timedelta(seconds=11)) == 2


# --- Vue eleve --------------------------------------------------------------


def test_la_vue_eleve_ne_contient_jamais_la_bonne_reponse_avant_la_correction():
    """Le test de fuite : ni la reponse, ni sa justesse, ni des points qui la trahissent."""
    p = en_question()
    reponses = [reponse("A", 0, 1, 1000, True)]
    vue = vue_eleve(p, QUIZ, ["A"], reponses, "A", T0 + timedelta(seconds=2))

    assert vue["phase"] == "question"
    assert "bonne_reponse" not in vue["question"]
    assert "explication" not in vue["question"]
    assert vue["ma_reponse"] == {"choix": 1}
    assert vue["moi"]["points"] == 0
    assert vue["moi"]["bonnes"] == 0
    assert vue["moi"]["rang"] is None
    assert "Deux textes" not in str(vue)


def test_la_vue_eleve_apres_correction():
    p = en_question()
    reponses = [reponse("A", 0, 1, 900, True), reponse("B", 0, 0, 0, False)]
    vue = vue_eleve(p, QUIZ, ["A", "B"], reponses, "B", T0 + timedelta(seconds=30))

    assert vue["phase"] == "correction"
    assert vue["question"]["bonne_reponse"] == 1
    assert vue["question"]["explication"] == "Deux textes se collent."
    assert vue["ma_reponse"] == {"choix": 0, "correcte": False, "points": 0}
    assert vue["moi"] == {
        "points": 0,
        "bonnes": 0,
        "questions_closes": 1,
        "rang": 2,
        "participants": 2,
    }


def test_la_vue_eleve_ne_nomme_personne_d_autre():
    p = en_question()
    reponses = [reponse("DOJO-AAAA", 0, 1, 900, True)]
    vue = vue_eleve(p, QUIZ, ["DOJO-AAAA", "DOJO-BBBB"], reponses, "DOJO-BBBB", T0 + timedelta(seconds=30))
    assert "DOJO-AAAA" not in str(vue)


def test_la_vue_d_un_eleve_qui_n_a_pas_rejoint():
    vue = vue_eleve(partie(), QUIZ, ["A"], [], "B", T0)
    assert vue["rejoint"] is False
    assert vue["moi"] is None
    assert vue["question"] is None
    assert vue["maintenant"] == T0.isoformat()


def test_la_vue_eleve_en_fin_de_partie_donne_le_bilan_personnel():
    p = en_question(rang=1)
    terminer(p, T0 + timedelta(seconds=11))
    reponses = [reponse("A", 0, 1, 900, True), reponse("A", 1, 0, 800, True)]
    vue = vue_eleve(p, QUIZ, ["A", "B"], reponses, "A", T0 + timedelta(seconds=12))
    assert vue["phase"] == "terminee"
    assert vue["question"] is None
    assert vue["ma_reponse"] is None
    assert vue["moi"]["points"] == 1700
    assert vue["moi"]["bonnes"] == 2
    assert vue["moi"]["rang"] == 1


# --- Vue prof ---------------------------------------------------------------

PARTICIPANTS = [
    {"code_acces": "A", "prenom": "Camille", "nom": "Rey"},
    {"code_acces": "B", "prenom": "Alex", "nom": "Morel"},
]


def test_la_vue_prof_en_salle_d_attente():
    vue = vue_prof(partie(), QUIZ, PARTICIPANTS, [], T0)
    assert vue["phase"] == "attente"
    assert vue["participants"] == PARTICIPANTS
    assert vue["question"] is None
    assert vue["podium"] == []
    assert vue["total_questions"] == 2
    assert vue["derniere"] is False


def test_la_vue_prof_cache_la_reponse_pendant_la_question():
    """Cet ecran est projete : la salle le lit."""
    p = en_question()
    vue = vue_prof(p, QUIZ, PARTICIPANTS, [reponse("A", 0, 1)], T0 + timedelta(seconds=3))
    assert "bonne_reponse" not in vue["question"]
    assert vue["reponses_recues"] == 1
    assert vue["repartition"] is None


def test_la_vue_prof_a_la_correction():
    p = en_question()
    reponses = [reponse("A", 0, 1, 900, True), reponse("B", 0, 2)]
    vue = vue_prof(p, QUIZ, PARTICIPANTS, reponses, T0 + timedelta(seconds=30))
    assert vue["question"]["bonne_reponse"] == 1
    assert vue["repartition"] == [0, 1, 1]
    assert vue["podium"] == [
        {"code_acces": "A", "prenom": "Camille", "nom": "Rey", "points": 900, "rang": 1}
    ]


def test_la_vue_prof_signale_la_derniere_question():
    vue = vue_prof(en_question(rang=1), QUIZ, PARTICIPANTS, [], T0)
    assert vue["derniere"] is True


def test_le_bilan_de_fin_est_anonyme_et_couvre_les_questions_jouees():
    p = en_question()
    terminer(p, T0 + timedelta(seconds=5))
    reponses = [reponse("A", 0, 1, 900, True), reponse("B", 0, 0)]
    vue = vue_prof(p, QUIZ, PARTICIPANTS, reponses, T0 + timedelta(seconds=6))

    assert vue["phase"] == "terminee"
    assert vue["question"] is None
    assert vue["reponses_recues"] == 0
    assert len(vue["bilan"]) == 1
    ligne = vue["bilan"][0]
    assert ligne["repartition"] == [1, 1, 0]
    assert ligne["reponses"] == 2
    assert "A" not in {cle for cle in ligne}
    assert "Camille" not in str(vue["bilan"])


def test_le_resume_du_catalogue_ne_montre_rien_de_ce_qui_se_joue():
    ligne = resume(QUIZ)
    assert ligne == {
        "id": "q1-bases",
        "titre": "Les bases",
        "seance": 1,
        "questions": 2,
        "duree_s": 30,
    }


def test_un_quiz_publie_a_la_main_avec_une_reponse_hors_des_options_est_refuse():
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="hors des options"):
        QuizPublie(
            id="q1-bases",
            titre="Les bases",
            seance=1,
            questions=[{"enonce": "?", "options": ["a", "b"], "bonne_reponse": 2, "duree_s": 10}],
        )



def test_le_nom_affiche_ne_montre_jamais_le_code():
    assert nom_affiche("Camille", "Rey") == "Camille R."
    assert nom_affiche("  Noa ", "") == "Noa"
    assert nom_affiche("", "Rey") == "Élève"


def test_en_salle_d_attente_la_vue_eleve_nomme_les_joueurs_et_se_reconnait():
    identites = [
        {"code_acces": "A", "prenom": "Camille", "nom": "Rey"},
        {"code_acces": "B", "prenom": "Alex", "nom": "Morel"},
    ]
    vue = vue_eleve(partie(), QUIZ, ["A", "B"], [], "B", T0, identites)
    assert vue["joueurs"] == [{"nom": "Camille R.", "moi": False}, {"nom": "Alex M.", "moi": True}]


def test_en_jeu_la_vue_eleve_ne_nomme_plus_personne():
    identites = [{"code_acces": "A", "prenom": "Camille", "nom": "Rey"}]
    assert vue_eleve(en_question(), QUIZ, ["A"], [], "A", T0, identites)["joueurs"] == []


def test_les_resultats_comptent_les_reponses_donnees_seulement():
    reponses = [reponse("A", 0, 1, 900, True), reponse("B", 0, 0), reponse("A", 1, 0, 800, True)]
    bilan_partie = resultats(QUIZ, reponses, jouees=2, joueurs=2)
    assert (bilan_partie["reponses"], bilan_partie["reussite"]) == (3, 2 / 3)
    assert len(bilan_partie["bilan"]) == 2
    assert resultats(QUIZ, [], jouees=2, joueurs=0)["reussite"] is None
