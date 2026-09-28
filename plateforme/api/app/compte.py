"""Le compte professeur : le creer au premier lancement, puis s'y connecter.

Ce sont les seules routes de /prof ouvertes sans jeton : on ne peut pas en
avoir un avant d'avoir un compte. Tant qu'aucun compte n'existe, le premier
qui ouvre /prof le cree — un risque accepte et documente dans ADR-014.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session

from .bdd import obtenir_session
from .securite import (
    CLE_EMPREINTE,
    creer_jeton_prof,
    ecrire_reglage_neuf,
    hacher,
    lire_reglage,
    verifier_mot_de_passe,
)

routeur = APIRouter(prefix="/prof")

MIN_MOT_DE_PASSE = 12
MAX_MOT_DE_PASSE = 200


class DemandeCreation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mot_de_passe: str = Field(min_length=MIN_MOT_DE_PASSE, max_length=MAX_MOT_DE_PASSE)


class DemandeConnexion(BaseModel):
    """Pas de longueur minimale ici : un mot de passe trop court est simplement faux."""

    model_config = ConfigDict(extra="forbid")

    mot_de_passe: str = Field(min_length=1, max_length=MAX_MOT_DE_PASSE)


@routeur.get("/compte")
def etat_du_compte(session: Annotated[Session, Depends(obtenir_session)]) -> dict:
    return {"existe": lire_reglage(session, CLE_EMPREINTE) is not None}


@routeur.post("/compte", status_code=201)
def creer_le_compte(
    demande: DemandeCreation, session: Annotated[Session, Depends(obtenir_session)]
) -> dict:
    if not ecrire_reglage_neuf(session, CLE_EMPREINTE, hacher(demande.mot_de_passe)):
        raise HTTPException(409, "Un compte professeur existe deja")
    return {"jeton": creer_jeton_prof(session)}


@routeur.post("/connexion")
def se_connecter(
    demande: DemandeConnexion, session: Annotated[Session, Depends(obtenir_session)]
) -> dict:
    empreinte = lire_reglage(session, CLE_EMPREINTE)
    if empreinte is None:
        raise HTTPException(404, "Aucun compte professeur")
    if not verifier_mot_de_passe(demande.mot_de_passe, empreinte):
        raise HTTPException(401, "Mot de passe incorrect")
    return {"jeton": creer_jeton_prof(session)}
