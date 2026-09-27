"""La regle du jeu du quiz en direct. Fonctions pures : ni HTTP, ni base.

Tout ce qui decide — la phase d'une partie, les points d'une reponse, le
classement, ce que chacun a le droit de voir — vit ici et se teste sans
serveur. Les routes lisent la base, appellent ces fonctions, ecrivent le
resultat.

Deux regles portent tout le module :

- ==le serveur est l'arbitre==. Un eleve ne recoit ni la bonne reponse, ni la
  justesse de la sienne, ni des points qui la trahiraient, tant que la question
  n'est pas corrigee. Voir ADR-013 ;
- la correction ne s'ecrit pas, elle se DEDUIT de l'echeance. Aucun minuteur
  serveur. Voir ADR-014.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .modeles import PartieQuiz, ReponseQuiz

Phase = Literal["attente", "question", "correction", "terminee"]

# Une reponse partie a temps traverse le reseau. Sans cette marge, l'eleve qui
# clique a la derniere seconde serait refuse pour la latence de sa salle.
TOLERANCE = timedelta(milliseconds=500)

POINTS_MAX = 1000

# Garde-fou d'ADR-013 : l'ecran projete ne montre que le haut du tableau.
TAILLE_PODIUM = 5


class QuestionPublie(BaseModel):
    """Une question telle que construire_quiz.py l'ecrit pour l'API."""

    # `entrees`, `sortie`, `erreur` ne servent qu'a la validation du contenu.
    model_config = ConfigDict(extra="ignore")

    enonce: str
    code: str = ""
    options: list[str] = Field(min_length=2, max_length=4)
    bonne_reponse: int
    duree_s: int = Field(ge=1)
    explication: str = ""

    @model_validator(mode="after")
    def reponse_dans_les_options(self) -> "QuestionPublie":
        # Le fichier vient d'une construction validee ; ce controle protege
        # d'un fichier depose a la main dans le dossier des quiz.
        if not 0 <= self.bonne_reponse < len(self.options):
            raise ValueError("bonne_reponse hors des options")
        return self


class QuizPublie(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    titre: str
    seance: int
    questions: list[QuestionPublie] = Field(min_length=1)


class Refus(Exception):
    """L'action est bien formee mais arrive au mauvais moment (HTTP 409)."""


class Invalide(Exception):
    """L'action ne peut correspondre a rien dans cette partie (HTTP 422)."""


def utc(quand: datetime) -> datetime:
    """SQLite rend les horodatages sans fuseau : ils ont ete ecrits en UTC."""
    return quand.replace(tzinfo=timezone.utc) if quand.tzinfo is None else quand


def iso(quand: datetime | None) -> str | None:
    return utc(quand).isoformat() if quand is not None else None


# --- Phases -----------------------------------------------------------------


def phase_effective(partie: PartieQuiz, maintenant: datetime) -> Phase:
    """La phase vue par tout le monde, a cet instant.

    Une question dont l'echeance (plus la tolerance) est passee est corrigee,
    sans que rien ne l'ait ecrit. Un conteneur qui redemarre en pleine question
    retrouve donc la bonne phase a la premiere lecture.
    """
    if (
        partie.phase == "question"
        and partie.fin_a is not None
        and maintenant >= utc(partie.fin_a) + TOLERANCE
    ):
        return "correction"
    return partie.phase  # type: ignore[return-value]


def ouvrir_suivante(partie: PartieQuiz, quiz: QuizPublie, maintenant: datetime) -> None:
    """Ouvre la question suivante, ou termine la partie apres la derniere."""
    phase = phase_effective(partie, maintenant)
    if phase == "question":
        raise Refus("La question est encore ouverte : corrige-la d'abord.")
    if phase == "terminee":
        raise Refus("La partie est terminée.")

    rang = partie.question + 1
    if rang >= len(quiz.questions):
        terminer(partie, maintenant)
        return

    partie.phase = "question"
    partie.question = rang
    partie.ouverte_le = maintenant
    partie.fin_a = maintenant + timedelta(seconds=quiz.questions[rang].duree_s)


def fermer(partie: PartieQuiz, maintenant: datetime) -> None:
    """Corrige la question en cours sans attendre la fin du temps.

    On recule l'echeance plutot que d'ecrire une phase : la correction reste
    une deduction, et il n'existe qu'une seule facon d'y entrer.
    """
    if phase_effective(partie, maintenant) != "question":
        raise Refus("Aucune question n'est ouverte.")
    partie.fin_a = maintenant - TOLERANCE


def terminer(partie: PartieQuiz, maintenant: datetime) -> None:
    if partie.phase == "terminee":
        raise Refus("La partie est déjà terminée.")
    partie.phase = "terminee"
    partie.terminee_le = maintenant


# --- Reponses et points -----------------------------------------------------


def points(correcte: bool, delai_ms: int, duree_ms: int) -> int:
    """Le bareme de Kahoot : 1000 tout de suite, 500 a la derniere seconde.

    Une reponse juste lente vaut toujours plus qu'une reponse fausse rapide :
    la vitesse departage, elle ne remplace pas la justesse.
    """
    if not correcte:
        return 0
    part = min(max(delai_ms, 0), duree_ms) / duree_ms
    return round(POINTS_MAX * (1 - part / 2))


@dataclass(frozen=True)
class Evaluation:
    correcte: bool
    delai_ms: int
    points: int


def evaluer(
    partie: PartieQuiz, quiz: QuizPublie, rang: int, choix: int, maintenant: datetime
) -> Evaluation:
    """Juge une reponse. Le delai se mesure a la RECEPTION, depuis l'ouverture."""
    if rang != partie.question or partie.phase != "question":
        raise Refus("Cette question n'est plus en cours.")
    if phase_effective(partie, maintenant) != "question":
        raise Refus("Le temps de réponse est écoulé.")

    question = quiz.questions[rang]
    if not 0 <= choix < len(question.options):
        raise Invalide("Ce choix n'existe pas.")

    assert partie.ouverte_le is not None  # une question ouverte a toujours son heure
    delai = int((maintenant - utc(partie.ouverte_le)).total_seconds() * 1000)
    correcte = choix == question.bonne_reponse
    return Evaluation(correcte, delai, points(correcte, delai, question.duree_s * 1000))


def tous_ont_repondu(participants: Iterable[str], reponses: Iterable[ReponseQuiz], rang: int) -> bool:
    """Plus personne n'attend : la question peut se corriger sans finir le temps."""
    attendus = set(participants)
    recus = {r.code_acces for r in reponses if r.question == rang}
    return bool(attendus) and attendus <= recus


# --- Scores et classement ---------------------------------------------------


def questions_closes(partie: PartieQuiz, maintenant: datetime) -> int:
    """Combien de questions ont des points VISIBLES.

    Pendant une question, ses points restent caches : un score qui monte dirait
    a l'eleve que sa reponse est juste, et il le dirait a son voisin.
    """
    if phase_effective(partie, maintenant) in ("correction", "terminee"):
        return partie.question + 1
    return max(partie.question, 0)


@dataclass(frozen=True)
class Place:
    code_acces: str
    points: int
    rang: int
    bonnes: int


def classement(
    participants: Iterable[str], reponses: Iterable[ReponseQuiz], closes: int
) -> list[Place]:
    """Le classement sur les questions closes. Ex aequo, meme rang : 1, 1, 3."""
    totaux = {code: [0, 0] for code in participants}
    for r in reponses:
        if r.question < closes and r.code_acces in totaux:
            totaux[r.code_acces][0] += r.points
            totaux[r.code_acces][1] += int(r.correcte)

    places: list[Place] = []
    precedent: int | None = None
    rang = 0
    ordonnes = sorted(totaux.items(), key=lambda paire: (-paire[1][0], paire[0]))
    for position, (code, (total, bonnes)) in enumerate(ordonnes, start=1):
        if total != precedent:
            rang, precedent = position, total
        places.append(Place(code, total, rang, bonnes))
    return places


def podium(places: list[Place]) -> list[Place]:
    """Les cinq premiers, et jamais quelqu'un a zero point.

    Au premier tour, si personne n'a juste, tout le monde est premier ex aequo
    avec zero : sans ce filtre, l'ecran projete afficherait la classe entiere
    sous un score nul — exactement ce qu'ADR-011 refuse.
    """
    return [p for p in places if p.points > 0][:TAILLE_PODIUM]


# --- Ce que chacun voit -----------------------------------------------------


def _vue_question(partie: PartieQuiz, quiz: QuizPublie, corrigee: bool) -> dict:
    question = quiz.questions[partie.question]
    vue: dict = {
        "rang": partie.question,
        "total": len(quiz.questions),
        "enonce": question.enonce,
        "code": question.code,
        "options": question.options,
        "duree_s": question.duree_s,
        "ouverte_le": iso(partie.ouverte_le),
        "fin_a": iso(partie.fin_a),
    }
    if corrigee:
        vue["bonne_reponse"] = question.bonne_reponse
        vue["explication"] = question.explication
    return vue


def _repartition(reponses: Iterable[ReponseQuiz], rang: int, nombre_options: int) -> list[int]:
    comptes = [0] * nombre_options
    for r in reponses:
        if r.question == rang:
            comptes[r.choix] += 1
    return comptes


def vue_eleve(
    partie: PartieQuiz,
    quiz: QuizPublie,
    participants: list[str],
    reponses: list[ReponseQuiz],
    code: str,
    maintenant: datetime,
) -> dict:
    """La partie vue par UN eleve. Rien sur les autres, sauf leur nombre."""
    phase = phase_effective(partie, maintenant)
    corrigee = phase in ("correction", "terminee")
    en_jeu = phase in ("question", "correction")

    mienne = next(
        (r for r in reponses if r.code_acces == code and r.question == partie.question), None
    )
    ma_reponse = None
    if en_jeu and mienne is not None:
        ma_reponse = {"choix": mienne.choix}
        if corrigee:
            ma_reponse |= {"correcte": mienne.correcte, "points": mienne.points}

    moi = None
    if code in participants:
        closes = questions_closes(partie, maintenant)
        place = next(p for p in classement(participants, reponses, closes) if p.code_acces == code)
        moi = {
            "points": place.points,
            "bonnes": place.bonnes,
            "questions_closes": closes,
            # Pas de rang avant la premiere correction : tout le monde serait
            # premier ex aequo, ce qui ne dit rien.
            "rang": place.rang if closes > 0 else None,
            "participants": len(participants),
        }

    return {
        "partie": partie.id,
        "titre": quiz.titre,
        "phase": phase,
        "maintenant": iso(maintenant),
        "rejoint": code in participants,
        "question": _vue_question(partie, quiz, corrigee) if en_jeu else None,
        "ma_reponse": ma_reponse,
        "moi": moi,
    }


def vue_prof(
    partie: PartieQuiz,
    quiz: QuizPublie,
    participants: list[dict],
    reponses: list[ReponseQuiz],
    maintenant: datetime,
) -> dict:
    """La partie vue par le professeur — donc par toute la salle, projetee.

    `participants` : des dictionnaires `code_acces`, `prenom`, `nom`, dans
    l'ordre ou les eleves ont rejoint. La bonne reponse n'y figure qu'a la
    correction : cet ecran est au mur.
    """
    phase = phase_effective(partie, maintenant)
    en_jeu = phase in ("question", "correction")
    codes = [p["code_acces"] for p in participants]
    identites = {p["code_acces"]: p for p in participants}
    closes = questions_closes(partie, maintenant)

    vue: dict = {
        "partie": partie.id,
        "quiz_id": quiz.id,
        "titre": quiz.titre,
        "phase": phase,
        "maintenant": iso(maintenant),
        "total_questions": len(quiz.questions),
        "participants": participants,
        "question": _vue_question(partie, quiz, phase == "correction") if en_jeu else None,
        "derniere": partie.question == len(quiz.questions) - 1,
        "reponses_recues": sum(1 for r in reponses if r.question == partie.question)
        if en_jeu
        else 0,
        "repartition": None,
        "podium": [
            {**identites[p.code_acces], "points": p.points, "rang": p.rang}
            for p in podium(classement(codes, reponses, closes))
        ],
        "bilan": None,
    }
    if phase == "correction":
        vue["repartition"] = _repartition(
            reponses, partie.question, len(quiz.questions[partie.question].options)
        )
    if phase == "terminee":
        vue["bilan"] = bilan(quiz, reponses, jouees=partie.question + 1)
    return vue


def bilan(quiz: QuizPublie, reponses: list[ReponseQuiz], jouees: int) -> list[dict]:
    """Question par question, ce que la classe a repondu. Anonyme par construction.

    C'est ce que le professeur garde d'une partie : « 60 % pensent que "15" + "1"
    vaut 16 » dit quoi reexpliquer. Un palmares ne le dirait pas.
    """
    lignes = []
    for rang, question in enumerate(quiz.questions[:jouees]):
        repartition = _repartition(reponses, rang, len(question.options))
        lignes.append(
            {
                "rang": rang,
                "enonce": question.enonce,
                "code": question.code,
                "options": question.options,
                "bonne_reponse": question.bonne_reponse,
                "repartition": repartition,
                "reponses": sum(repartition),
            }
        )
    return lignes


def resume(quiz: QuizPublie) -> dict:
    """Une ligne du catalogue : de quoi choisir, rien de ce qui se joue."""
    return {
        "id": quiz.id,
        "titre": quiz.titre,
        "seance": quiz.seance,
        "questions": len(quiz.questions),
        "duree_s": sum(q.duree_s for q in quiz.questions),
    }
