import json
import sys
from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

from construire_quiz import construire_quiz, principal
from schema import QuestionQuiz, Quiz, charger_quiz_tous, charger_tous
from valider_contenu import verifier_quiz, verifier_racine, verifier_tous_les_quiz


def question(**remplacements) -> dict:
    base = dict(
        enonce="Qu'affiche ce programme ?",
        code='print("2" + "2")',
        options=["4", "22", "Une erreur"],
        bonne_reponse=1,
        sortie=True,
    )
    base.update(remplacements)
    return base


def quiz(**remplacements) -> dict:
    base = dict(id="q1-bases", titre="Les bases", seance=1, questions=[question()])
    base.update(remplacements)
    return base


def _ecrire(dossier: Path, donnees: dict, nom: str | None = None) -> Path:
    dossier.mkdir(parents=True, exist_ok=True)
    chemin = dossier / f"{nom or donnees['id']}.yaml"
    chemin.write_text(yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8")
    return chemin


# --- Schema -----------------------------------------------------------------


def test_un_quiz_valide_se_charge():
    q = Quiz(**quiz())
    assert q.questions[0].duree_s == 20
    assert q.questions[0].explication == ""


def test_identifiant_de_quiz_mal_forme_rejete():
    with pytest.raises(ValidationError, match="identifiant de quiz"):
        Quiz(**quiz(id="bases"))


def test_un_quiz_sans_question_est_rejete():
    with pytest.raises(ValidationError):
        Quiz(**quiz(questions=[]))


def test_bonne_reponse_hors_des_options_rejetee():
    with pytest.raises(ValidationError, match="hors des options"):
        QuestionQuiz(**question(bonne_reponse=3))


def test_une_seule_option_ne_fait_pas_un_choix():
    with pytest.raises(ValidationError):
        QuestionQuiz(**question(options=["22"], bonne_reponse=0))


def test_cinq_options_ne_tiennent_pas_a_l_ecran():
    with pytest.raises(ValidationError):
        QuestionQuiz(**question(options=["1", "2", "3", "4", "5"]))


def test_deux_options_identiques_rejetees():
    with pytest.raises(ValidationError, match="identiques"):
        QuestionQuiz(**question(options=["22", "22", "4"]))


def test_option_vide_rejetee():
    with pytest.raises(ValidationError, match="vide"):
        QuestionQuiz(**question(options=["22", "  ", "4"]))


def test_option_trop_longue_rejetee():
    with pytest.raises(ValidationError, match="trop longue"):
        QuestionQuiz(**question(options=["22", "x" * 91, "4"]))


def test_emoji_rejete_dans_les_options_le_code_et_l_explication():
    with pytest.raises(ValidationError):
        QuestionQuiz(**question(options=["22", "4 \U0001F600", "5"]))
    with pytest.raises(ValidationError, match="emoji"):
        QuestionQuiz(**question(code='print("\U0001F600")'))
    with pytest.raises(ValidationError, match="emoji"):
        QuestionQuiz(**question(explication="Bravo \U0001F600"))


def test_getpass_banni_du_code():
    with pytest.raises(ValidationError, match="getpass"):
        QuestionQuiz(**question(code="import getpass"))


def test_duree_bornee():
    with pytest.raises(ValidationError):
        QuestionQuiz(**question(duree_s=5))
    with pytest.raises(ValidationError):
        QuestionQuiz(**question(duree_s=90))


def test_sortie_ou_erreur_sans_code_rejetees():
    with pytest.raises(ValidationError, match="code a executer"):
        QuestionQuiz(**question(code="", sortie=True))
    with pytest.raises(ValidationError, match="code a executer"):
        QuestionQuiz(**question(code="", sortie=False, erreur="TypeError"))


def test_sortie_et_erreur_s_excluent():
    with pytest.raises(ValidationError, match="a la fois"):
        QuestionQuiz(**question(erreur="TypeError"))


def test_nom_d_exception_libre_rejete():
    with pytest.raises(ValidationError, match="exception invalide"):
        QuestionQuiz(**question(sortie=False, erreur="texte libre"))


def test_une_question_sans_code_est_permise_et_n_execute_rien():
    q = QuestionQuiz(**question(code="", sortie=False))
    assert q.code == ""
    assert verifier_quiz(Quiz(**quiz(questions=[question(code="", sortie=False)]))) == []


def test_l_explication_accompagne_la_correction():
    q = QuestionQuiz(**question(explication="Deux textes se collent, ils ne s'additionnent pas."))
    assert q.explication.startswith("Deux textes")


# --- Verification par execution ---------------------------------------------


def test_un_quiz_juste_ne_remonte_aucun_probleme():
    assert verifier_quiz(Quiz(**quiz())) == []


def test_une_bonne_reponse_mal_recopiee_est_signalee():
    """Toute la classe perdrait ses points pour avoir eu raison."""
    q = Quiz(**quiz(questions=[question(bonne_reponse=0)]))
    problemes = verifier_quiz(q)
    assert len(problemes) == 1
    assert "question 1" in problemes[0] and "'22'" in problemes[0]


def test_la_sortie_sur_plusieurs_lignes_se_compare_entiere():
    q = Quiz(
        **quiz(
            questions=[
                question(
                    code='print("a")\nprint("b")',
                    options=["a\nb", "ab", "a b"],
                    bonne_reponse=0,
                )
            ]
        )
    )
    assert verifier_quiz(q) == []


def test_un_code_qui_plante_est_signale():
    q = Quiz(**quiz(questions=[question(code="print(inconnue)", sortie=False)]))
    assert "plante (NameError" in verifier_quiz(q)[0]


def test_un_code_sans_sortie_annoncee_doit_quand_meme_tourner():
    q = Quiz(**quiz(questions=[question(code='x = 1\nprint("ok")', sortie=False)]))
    assert verifier_quiz(q) == []


def test_les_entrees_simulees_alimentent_input():
    q = Quiz(
        **quiz(
            questions=[
                question(
                    code='age = input("Age : ")\nprint(age + age)',
                    entrees=["17"],
                    options=["Age : 17\n1717", "Age : 17\n34"],
                    bonne_reponse=0,
                )
            ]
        )
    )
    assert verifier_quiz(q) == []


def test_l_erreur_annoncee_doit_etre_levee():
    juste = question(code='print("a" + 1)', sortie=False, erreur="TypeError")
    assert verifier_quiz(Quiz(**quiz(questions=[juste]))) == []


def test_une_autre_erreur_que_celle_annoncee_est_signalee():
    fausse = question(code="print(inconnue)", sortie=False, erreur="TypeError")
    probleme = verifier_quiz(Quiz(**quiz(questions=[fausse])))[0]
    assert "devait lever TypeError, il leve NameError" in probleme


def test_une_erreur_annoncee_qui_n_arrive_pas_est_signalee():
    absente = question(code='print("ok")', sortie=False, erreur="TypeError")
    probleme = verifier_quiz(Quiz(**quiz(questions=[absente])))[0]
    assert "il s'execute sans erreur" in probleme


# --- Chargement et racine ---------------------------------------------------


def test_les_quiz_ne_sont_pas_charges_comme_des_exercices(tmp_path):
    _ecrire(tmp_path / "quiz", quiz())
    assert charger_tous(tmp_path) == []
    assert [q.id for q in charger_quiz_tous(tmp_path)] == ["q1-bases"]


def test_un_depot_range_dans_un_dossier_quiz_garde_ses_exercices(tmp_path):
    """Les parties du chemin se lisent sous la racine, pas au-dessus."""
    racine = tmp_path / "quiz" / "contenu"
    _ecrire(racine / "quiz", quiz())
    assert [q.id for q in charger_quiz_tous(racine)] == ["q1-bases"]
    assert charger_tous(racine) == []


def test_deux_quiz_de_meme_identifiant_sont_signales(tmp_path):
    _ecrire(tmp_path / "quiz", quiz(), nom="a")
    _ecrire(tmp_path / "quiz", quiz(), nom="b")
    _, problemes = verifier_tous_les_quiz(tmp_path)
    assert problemes == ["q1-bases : identifiant de quiz en double"]


def test_verifier_racine_remonte_les_problemes_de_quiz(tmp_path):
    _ecrire(tmp_path / "quiz", quiz(questions=[question(bonne_reponse=0)]))
    _, _, problemes = verifier_racine(tmp_path)
    assert any("q1-bases question 1" in p for p in problemes)


# --- Construction -----------------------------------------------------------


def test_construit_un_json_par_quiz_en_snake_case(tmp_path):
    _ecrire(tmp_path / "contenu" / "quiz", quiz())
    sortie = tmp_path / "api" / "quiz"
    assert construire_quiz(tmp_path / "contenu", sortie) == 1

    donnees = json.loads((sortie / "q1-bases.json").read_text(encoding="utf-8"))
    assert donnees["questions"][0]["bonne_reponse"] == 1
    assert donnees["questions"][0]["duree_s"] == 20


def test_un_quiz_incoherent_arrete_la_construction(tmp_path):
    _ecrire(tmp_path / "contenu" / "quiz", quiz(questions=[question(bonne_reponse=0)]))
    with pytest.raises(SystemExit, match="1 probleme"):
        construire_quiz(tmp_path / "contenu", tmp_path / "api" / "quiz")
    assert not (tmp_path / "api" / "quiz").exists()


@pytest.mark.parametrize(
    "cible", ["web/public/contenu", "web/public/quiz", "sortie/contenu/quiz", "contenu"]
)
def test_les_quiz_ne_s_ecrivent_jamais_dans_le_contenu_publie(tmp_path, cible):
    """Sous web/public, les bonnes reponses seraient lisibles par toute la classe."""
    _ecrire(tmp_path / "source" / "quiz", quiz())
    with pytest.raises(SystemExit, match="jamais"):
        construire_quiz(tmp_path / "source", tmp_path / cible)


def test_principal_construit_depuis_la_ligne_de_commande(tmp_path, monkeypatch, capsys):
    _ecrire(tmp_path / "source" / "quiz", quiz())
    sortie = tmp_path / "api" / "quiz"
    monkeypatch.setattr(sys, "argv", ["construire_quiz.py", str(tmp_path / "source"), str(sortie)])
    assert principal() == 0
    assert "1 quiz construits" in capsys.readouterr().out
    assert (sortie / "q1-bases.json").exists()
