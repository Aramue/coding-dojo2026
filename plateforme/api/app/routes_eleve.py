from __future__ import annotations

import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlmodel import Session, select

from .bdd import obtenir_session
from .modeles import Agent, Tentative, maintenant
from .securite import creer_jeton, lire_jeton

routeur = APIRouter()
MOTIF_CODE = re.compile(r"^AGENT-[A-Z0-9]{4}$")
MOTIF_EXERCICE = re.compile(r"^s[123]-[0-9]{2}(-expert)?$")

# Liste blanche des types d'erreur acceptés. Elle double celle du navigateur
# (web/src/execution/exceptions.ts) — et c'est CELLE-CI qui protège.
#
# Le filtrage cote client vit dans le JavaScript du navigateur de l'eleve, donc
# sur sa machine, sous son controle. Il lui suffit d'ouvrir la console, de
# recuperer son jeton via /session et de poster directement ici pour faire
# persister le texte de son choix. ==Verifie en conditions reelles.==
# Toute defense qui n'existe que cote client n'est pas une defense.
TYPES_ERREUR = frozenset(
    {
        "SyntaxError",
        "IndentationError",
        "TabError",
        "NameError",
        "UnboundLocalError",
        "TypeError",
        "ValueError",
        "ZeroDivisionError",
        "ArithmeticError",
        "OverflowError",
        "IndexError",
        "KeyError",
        "AttributeError",
        "ImportError",
        "ModuleNotFoundError",
        "EOFError",
        "RecursionError",
        "AssertionError",
        "StopIteration",
        "TimeoutError",
        "AutreErreur",
    }
)


class DemandeSession(BaseModel):
    code_agent: str = Field(pattern=MOTIF_CODE.pattern)


class ReponseSession(BaseModel):
    jeton: str
    code_agent: str


class DemandeTentative(BaseModel):
    # extra="forbid" refuse tout champ non declare, en particulier du code source.
    model_config = ConfigDict(extra="forbid")

    # Motif strict : sans lui, ce champ transporte 32 caractères libres.
    exercice_id: str = Field(pattern=MOTIF_EXERCICE.pattern)
    verdict: Literal["vert", "bleu", "rouge"]
    type_erreur: str | None = Field(default=None, max_length=64)
    duree_ms: int = Field(ge=0, le=600_000)

    @field_validator("type_erreur")
    @classmethod
    def type_erreur_connu(cls, valeur: str | None) -> str | None:
        if valeur is not None and valeur not in TYPES_ERREUR:
            raise ValueError("type d'erreur inconnu")
        return valeur


def agent_courant(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Jeton absent")
    code = lire_jeton(authorization.removeprefix("Bearer "))
    if not code:
        raise HTTPException(401, "Jeton invalide")
    return code


@routeur.post("/session", response_model=ReponseSession)
def ouvrir_session(
    demande: DemandeSession, session: Annotated[Session, Depends(obtenir_session)]
) -> ReponseSession:
    agent = session.get(Agent, demande.code_agent)
    if agent is None:
        session.add(Agent(code_agent=demande.code_agent))
    else:
        # `vu_le` alimente le compteur d'agents connectes du tableau de bord :
        # sans cette mise a jour, il resterait egal a `cree_le` et mentirait.
        agent.vu_le = maintenant()
        session.add(agent)
    session.commit()
    return ReponseSession(jeton=creer_jeton(demande.code_agent), code_agent=demande.code_agent)


@routeur.get("/parcours")
def lire_parcours(
    code_agent: Annotated[str, Depends(agent_courant)],
    session: Annotated[Session, Depends(obtenir_session)],
) -> dict:
    lignes = session.exec(
        select(Tentative.exercice_id)
        .where(Tentative.code_agent == code_agent)
        .where(Tentative.verdict.in_(("vert", "bleu")))  # type: ignore[attr-defined]
    ).all()
    return {"reussis": sorted(set(lignes))}


@routeur.post("/tentative")
def enregistrer_tentative(
    demande: DemandeTentative,
    code_agent: Annotated[str, Depends(agent_courant)],
    session: Annotated[Session, Depends(obtenir_session)],
) -> dict:
    session.add(Tentative(code_agent=code_agent, **demande.model_dump()))
    session.commit()
    return {"expert_debloque": f"{demande.exercice_id}-expert" if demande.verdict in ("vert", "bleu") else None}
