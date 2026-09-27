"""Le quiz en direct : routes eleve, routes professeur, et la sonnette.

L'etat d'une partie vit en base et se lit par GET ; le WebSocket ne dit que
« relis » (ADR-014). La regle du jeu est entierement dans quiz.py : ce module
lit la base, appelle la regle, ecrit le resultat, et fait sonner.
"""

from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from datetime import datetime, timedelta
from typing import Annotated, Callable

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, WebSocket
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .bdd import obtenir_session
from .catalogue import obtenir_catalogue
from .diffuseur import Role, diffuseur
from .modeles import Eleve, ParticipantQuiz, PartieQuiz, ReponseQuiz, maintenant
from .quiz import (
    Invalide,
    QuizPublie,
    Refus,
    evaluer,
    fermer,
    iso,
    ouvrir_suivante,
    resultats,
    resume,
    terminer,
    tous_ont_repondu,
    utc,
    vue_eleve,
    vue_prof,
)
from .routes_eleve import eleve_courant
from .routes_prof import code_prof_valide, verifier_prof
from .securite import lire_jeton

routeur = APIRouter()
routeur_prof = APIRouter(prefix="/prof/quiz", dependencies=[Depends(verifier_prof)])

MOTIF_QUIZ = r"^q[123]-[a-z]+(-[a-z]+)*$"

# Une partie terminee reste visible un quart d'heure : le temps pour chacun de
# lire son resultat, pas celui de le retrouver la semaine suivante.
VISIBLE_APRES_FIN = timedelta(minutes=15)

# La sonnette attend son premier message — l'authentification — cinq secondes,
# pas plus, et jamais plus de 512 caracteres.
DELAI_AUTHENTIFICATION_S = 5
LONGUEUR_MAX_MESSAGE = 512

SessionBdd = Annotated[Session, Depends(obtenir_session)]
Catalogue = Annotated[dict[str, QuizPublie], Depends(obtenir_catalogue)]


def heure() -> datetime:
    """L'heure du serveur, en dependance : les tests la reglent a la milliseconde."""
    return maintenant()


Heure = Annotated[datetime, Depends(heure)]


def eleve_inscrit(
    code: Annotated[str, Depends(eleve_courant)], session: SessionBdd
) -> str:
    """Un jeton valide ne suffit pas : l'eleve a pu etre retire depuis.

    SQLite n'applique pas les cles etrangeres par defaut. Sans ce controle, un
    onglet reste ouvert sur un eleve supprime entrerait dans la partie sans
    identite, et le professeur verrait une ligne sans nom.
    """
    if session.get(Eleve, code) is None:
        raise HTTPException(404, "Code d'accès inconnu")
    return code


EleveInscrit = Annotated[str, Depends(eleve_inscrit)]


class DemandeReponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # La partie est rappelee : une reponse partie juste avant la fin d'une
    # partie ne doit pas atterrir dans la suivante.
    partie: int = Field(ge=1)
    question: int = Field(ge=0, le=29)
    choix: int = Field(ge=0, le=3)


class DemandePartie(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quiz_id: str = Field(pattern=MOTIF_QUIZ)


class DemandeAction(BaseModel):
    """Le rang de la question que le professeur CROIT courante.

    Un double clic sur « Question suivante » enverrait deux fois la meme
    demande : la seconde porte un rang depasse et se fait refuser, au lieu de
    sauter une question devant toute la classe.
    """

    model_config = ConfigDict(extra="forbid")

    question: int = Field(ge=-1, le=29)


# --- Lectures ---------------------------------------------------------------


def _derniere(session: Session) -> PartieQuiz | None:
    return session.exec(select(PartieQuiz).order_by(PartieQuiz.id.desc())).first()  # type: ignore[union-attr]


def _en_cours(session: Session, catalogue: dict[str, QuizPublie]) -> tuple[PartieQuiz, QuizPublie] | None:
    """La partie non terminee, si son quiz existe encore."""
    partie = _derniere(session)
    if partie is None or partie.phase == "terminee" or partie.quiz_id not in catalogue:
        return None
    return partie, catalogue[partie.quiz_id]


def _identites(session: Session, partie_id: int) -> list[dict]:
    """Les participants dans l'ordre d'arrivee, avec leur nom pour l'ecran projete."""
    lignes = session.exec(
        select(ParticipantQuiz, Eleve)
        .join(Eleve, Eleve.code_acces == ParticipantQuiz.code_acces)  # type: ignore[arg-type]
        .where(ParticipantQuiz.partie_id == partie_id)
        .order_by(ParticipantQuiz.rejoint_le, ParticipantQuiz.code_acces)  # type: ignore[arg-type]
    ).all()
    return [{"code_acces": e.code_acces, "prenom": e.prenom, "nom": e.nom} for _, e in lignes]


def _reponses(session: Session, partie_id: int) -> list[ReponseQuiz]:
    return list(session.exec(select(ReponseQuiz).where(ReponseQuiz.partie_id == partie_id)).all())


def _vue_eleve(session: Session, partie: PartieQuiz, quiz: QuizPublie, code: str, quand: datetime) -> dict:
    identites = _identites(session, partie.id)  # type: ignore[arg-type]
    codes = [p["code_acces"] for p in identites]
    return vue_eleve(
        partie, quiz, codes, _reponses(session, partie.id), code, quand, identites  # type: ignore[arg-type]
    )


def _derniere_jouee(session: Session, quiz: QuizPublie) -> dict | None:
    """Les resultats de la derniere partie terminee de ce quiz qui a eu des reponses.

    Une partie annulee en salle d'attente, ou celle du test de charge — dont
    les eleves d'essai sont partis avec leurs reponses —, ne dit rien de la
    classe : on remonte a la precedente.
    """
    parties = session.exec(
        select(PartieQuiz)
        .where(PartieQuiz.quiz_id == quiz.id)
        .where(PartieQuiz.phase == "terminee")
        .order_by(PartieQuiz.id.desc())  # type: ignore[union-attr]
    ).all()
    for partie in parties:
        reponses = _reponses(session, partie.id)  # type: ignore[arg-type]
        if not reponses:
            continue
        joueurs = len(_identites(session, partie.id))  # type: ignore[arg-type]
        return {
            "partie": partie.id,
            "terminee_le": iso(partie.terminee_le),
            **resultats(quiz, reponses, partie.question + 1, joueurs),
        }
    return None


def _vue_prof(session: Session, partie: PartieQuiz, quiz: QuizPublie, quand: datetime) -> dict:
    return vue_prof(
        partie, quiz, _identites(session, partie.id), _reponses(session, partie.id), quand  # type: ignore[arg-type]
    )


def _aucune(quand: datetime) -> dict:
    return {"partie": None, "maintenant": iso(quand)}


# --- Eleve ------------------------------------------------------------------


@routeur.get("/quiz/etat")
def lire_etat(code: EleveInscrit, session: SessionBdd, catalogue: Catalogue, quand: Heure) -> dict:
    partie = _derniere(session)
    if partie is None or partie.quiz_id not in catalogue:
        return _aucune(quand)
    if partie.phase == "terminee":
        # Une partie finie ne se montre qu'a ceux qui l'ont jouee, et pas
        # indefiniment : l'eleve qui arrive la semaine suivante ne doit pas
        # tomber sur le resultat d'un quiz auquel il n'etait pas.
        joue = session.get(ParticipantQuiz, (partie.id, code)) is not None
        recente = partie.terminee_le is not None and utc(partie.terminee_le) + VISIBLE_APRES_FIN > quand
        if not (joue and recente):
            return _aucune(quand)
    return _vue_eleve(session, partie, catalogue[partie.quiz_id], code, quand)


@routeur.post("/quiz/rejoindre")
def rejoindre(
    code: EleveInscrit,
    session: SessionBdd,
    catalogue: Catalogue,
    quand: Heure,
    taches: BackgroundTasks,
) -> dict:
    en_cours = _en_cours(session, catalogue)
    if en_cours is None:
        raise HTTPException(404, "Aucun quiz en cours.")
    partie, quiz = en_cours
    if session.get(ParticipantQuiz, (partie.id, code)) is None:
        session.add(ParticipantQuiz(partie_id=partie.id, code_acces=code, rejoint_le=quand))  # type: ignore[arg-type]
        try:
            session.commit()
        except IntegrityError:
            # Deux clics simultanes : le second arrive apres le premier, et
            # l'eleve est deja dedans. Ce n'est pas une erreur a lui montrer.
            session.rollback()
        else:
            taches.add_task(diffuseur.sonner, "prof")
    return _vue_eleve(session, partie, quiz, code, quand)


@routeur.post("/quiz/reponse")
def repondre(
    demande: DemandeReponse,
    code: EleveInscrit,
    session: SessionBdd,
    catalogue: Catalogue,
    quand: Heure,
    taches: BackgroundTasks,
) -> dict:
    en_cours = _en_cours(session, catalogue)
    if en_cours is None or en_cours[0].id != demande.partie:
        raise HTTPException(409, "Cette partie est terminée.")
    partie, quiz = en_cours

    try:
        evaluation = evaluer(partie, quiz, demande.question, demande.choix, quand)
    except Refus as refus:
        raise HTTPException(409, str(refus)) from refus
    except Invalide as invalide:
        raise HTTPException(422, str(invalide)) from invalide

    deja = session.exec(
        select(ReponseQuiz)
        .where(ReponseQuiz.partie_id == partie.id)
        .where(ReponseQuiz.question == demande.question)
        .where(ReponseQuiz.code_acces == code)
    ).first()
    if deja is not None:
        raise HTTPException(409, "Tu as déjà répondu à cette question.")

    # Repondre vaut rejoindre : l'eleve arrive en pleine question, il clique,
    # il est dans la partie. Pas d'etape de plus.
    if session.get(ParticipantQuiz, (partie.id, code)) is None:
        session.add(ParticipantQuiz(partie_id=partie.id, code_acces=code, rejoint_le=quand))  # type: ignore[arg-type]
    session.add(
        ReponseQuiz(
            partie_id=partie.id,  # type: ignore[arg-type]
            question=demande.question,
            code_acces=code,
            choix=demande.choix,
            delai_ms=evaluation.delai_ms,
            correcte=evaluation.correcte,
            points=evaluation.points,
            recue_le=quand,
        )
    )
    try:
        session.commit()
    except IntegrityError as doublon:
        # La contrainte d'unicite a vu ce que la lecture plus haut a manque :
        # deux clics partis en meme temps.
        session.rollback()
        raise HTTPException(409, "Tu as déjà répondu à cette question.") from doublon

    codes = [p["code_acces"] for p in _identites(session, partie.id)]  # type: ignore[arg-type]
    if tous_ont_repondu(codes, _reponses(session, partie.id), partie.question):  # type: ignore[arg-type]
        # Plus personne n'attend : on corrige sans laisser courir le temps.
        fermer(partie, quand)
        session.add(partie)
        session.commit()
        session.refresh(partie)
        taches.add_task(diffuseur.sonner)
    else:
        taches.add_task(diffuseur.sonner, "prof")
    return _vue_eleve(session, partie, quiz, code, quand)


# --- Professeur -------------------------------------------------------------


@routeur_prof.get("")
def lister_quiz(session: SessionBdd, catalogue: Catalogue) -> dict:
    """Le catalogue, et pour chaque quiz le taux de reussite de sa derniere partie."""
    ordonnes = sorted(catalogue.values(), key=lambda q: (q.seance, q.id))
    lignes = []
    for quiz in ordonnes:
        derniere = _derniere_jouee(session, quiz)
        if derniere is not None:
            derniere = {cle: valeur for cle, valeur in derniere.items() if cle != "bilan"}
        lignes.append({**resume(quiz), "derniere": derniere})
    return {"quiz": lignes}


@routeur_prof.get("/{quiz_id}/resultats")
def lire_resultats(
    quiz_id: Annotated[str, Path(pattern=MOTIF_QUIZ)],
    session: SessionBdd,
    catalogue: Catalogue,
) -> dict:
    """Le bilan de la derniere partie jouee de ce quiz. Anonyme, comme en fin de partie."""
    quiz = catalogue.get(quiz_id)
    if quiz is None:
        raise HTTPException(404, "Quiz inconnu.")
    derniere = _derniere_jouee(session, quiz)
    if derniere is None:
        raise HTTPException(404, "Ce quiz n'a pas encore été joué.")
    return {"quiz_id": quiz.id, "titre": quiz.titre, **derniere}


@routeur_prof.post("/parties", status_code=201)
def creer_partie(
    demande: DemandePartie,
    session: SessionBdd,
    catalogue: Catalogue,
    quand: Heure,
    taches: BackgroundTasks,
) -> dict:
    if demande.quiz_id not in catalogue:
        raise HTTPException(404, "Quiz inconnu.")

    derniere = _derniere(session)
    if derniere is not None and derniere.phase != "terminee":
        if derniere.quiz_id in catalogue:
            raise HTTPException(409, "Une partie est déjà en cours.")
        # Son quiz a disparu au deploiement : plus personne ne peut la jouer
        # ni la finir. Sans cette cloture, elle bloquerait toute partie neuve.
        terminer(derniere, quand)
        session.add(derniere)

    partie = PartieQuiz(quiz_id=demande.quiz_id, creee_le=quand)
    session.add(partie)
    session.commit()
    session.refresh(partie)
    taches.add_task(diffuseur.sonner)
    return _vue_prof(session, partie, catalogue[partie.quiz_id], quand)


@routeur_prof.get("/partie")
def lire_partie(session: SessionBdd, catalogue: Catalogue, quand: Heure) -> dict:
    """La derniere partie, meme terminee : son bilan reste lisible jusqu'a la suivante."""
    partie = _derniere(session)
    if partie is None or partie.quiz_id not in catalogue:
        return _aucune(quand)
    return _vue_prof(session, partie, catalogue[partie.quiz_id], quand)


def _agir(
    session: Session,
    catalogue: dict[str, QuizPublie],
    quand: datetime,
    taches: BackgroundTasks,
    question_attendue: int | None,
    action: Callable[[PartieQuiz, QuizPublie], None],
) -> dict:
    en_cours = _en_cours(session, catalogue)
    if en_cours is None:
        raise HTTPException(409, "Aucune partie en cours.")
    partie, quiz = en_cours
    if question_attendue is not None and partie.question != question_attendue:
        raise HTTPException(409, "La partie a déjà avancé.")
    try:
        action(partie, quiz)
    except Refus as refus:
        raise HTTPException(409, str(refus)) from refus
    session.add(partie)
    session.commit()
    session.refresh(partie)
    taches.add_task(diffuseur.sonner)
    return _vue_prof(session, partie, quiz, quand)


@routeur_prof.post("/partie/suivante")
def question_suivante(
    demande: DemandeAction,
    session: SessionBdd,
    catalogue: Catalogue,
    quand: Heure,
    taches: BackgroundTasks,
) -> dict:
    return _agir(
        session, catalogue, quand, taches, demande.question,
        lambda partie, quiz: ouvrir_suivante(partie, quiz, quand),
    )


@routeur_prof.post("/partie/corriger")
def corriger(
    demande: DemandeAction,
    session: SessionBdd,
    catalogue: Catalogue,
    quand: Heure,
    taches: BackgroundTasks,
) -> dict:
    return _agir(
        session, catalogue, quand, taches, demande.question,
        lambda partie, _quiz: fermer(partie, quand),
    )


@routeur_prof.post("/partie/terminer")
def terminer_partie(
    session: SessionBdd,
    catalogue: Catalogue,
    quand: Heure,
    taches: BackgroundTasks,
) -> dict:
    return _agir(
        session, catalogue, quand, taches, None,
        lambda partie, _quiz: terminer(partie, quand),
    )


# --- La sonnette ------------------------------------------------------------


async def _fermer(ws: WebSocket, code: int) -> None:
    # Le client a pu partir le premier : fermer une connexion deja close leve
    # RuntimeError, et il n'y a plus rien a lui dire de toute facon.
    with suppress(RuntimeError):
        await ws.close(code=code)


async def _authentifier(ws: WebSocket) -> Role | None:
    """Le premier message dit qui ouvre la connexion. Jamais l'URL.

    Une URL finit dans les journaux du proxy et du serveur : un jeton ou un
    code professeur n'a rien a y faire. Voir ADR-014.
    """
    try:
        message = await asyncio.wait_for(ws.receive(), DELAI_AUTHENTIFICATION_S)
    except asyncio.TimeoutError:
        return None
    texte = message.get("text")
    if not isinstance(texte, str) or len(texte) > LONGUEUR_MAX_MESSAGE:
        return None
    try:
        donnees = json.loads(texte)
    except ValueError:
        return None
    if not isinstance(donnees, dict):
        return None

    code_prof, jeton = donnees.get("code_prof"), donnees.get("jeton")
    if isinstance(code_prof, str) and code_prof_valide(code_prof):
        return "prof"
    if isinstance(jeton, str) and lire_jeton(jeton):
        return "eleve"
    return None


@routeur.websocket("/quiz/flux")
async def flux(ws: WebSocket) -> None:
    await ws.accept()
    role = await _authentifier(ws)
    if role is None:
        await _fermer(ws, 4401)
        return
    if not diffuseur.inscrire(ws, role):
        await _fermer(ws, 1013)  # « reessaie plus tard » : le client relit en attendant
        return
    try:
        await ws.send_json({"type": "pret"})
        # Le client ne dit plus rien apres s'etre presente : on attend son
        # depart pour l'oublier. Tout message suivant est ignore.
        while (await ws.receive())["type"] != "websocket.disconnect":
            pass
    finally:
        diffuseur.retirer(ws)
