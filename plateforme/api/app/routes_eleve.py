from __future__ import annotations

import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlmodel import Session, select

from .bdd import obtenir_session
from .modeles import Eleve, Tentative, maintenant
from .securite import creer_jeton, lire_jeton

routeur = APIRouter()
MOTIF_CODE = re.compile(r"^DOJO-[A-Z0-9]{4}$")
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
    # extra="forbid" : un champ mal nomme serait sinon ignore en silence, et la
    # requete refusee pour "code_acces manquant" — un message qui n'aide personne.
    model_config = ConfigDict(extra="forbid")

    code_acces: str = Field(pattern=MOTIF_CODE.pattern)


class ReponseSession(BaseModel):
    jeton: str
    code_acces: str


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


def eleve_courant(authorization: Annotated[str | None, Header()] = None) -> str:
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
    eleve = session.get(Eleve, demande.code_acces)
    if eleve is None:
        session.add(Eleve(code_acces=demande.code_acces))
    else:
        # `vu_le` alimente le compteur d'eleves connectes du tableau de bord :
        # sans cette mise a jour, il resterait egal a `cree_le` et mentirait.
        eleve.vu_le = maintenant()
        session.add(eleve)
    session.commit()
    return ReponseSession(jeton=creer_jeton(demande.code_acces), code_acces=demande.code_acces)


@routeur.get("/parcours")
def lire_parcours(
    code_acces: Annotated[str, Depends(eleve_courant)],
    session: Annotated[Session, Depends(obtenir_session)],
) -> dict:
    lignes = session.exec(
        select(Tentative)
        .where(Tentative.code_acces == code_acces)
        .where(Tentative.verdict.in_(("vert", "bleu")))  # type: ignore[attr-defined]
        .order_by(Tentative.horodatage)
    ).all()

    # Une reussite par exercice : la PREMIERE date — c'est celle que l'eleve
    # reconnait, « je l'avais fait mercredi » — et le MEILLEUR verdict, parce
    # qu'on ne retire pas une coche deja obtenue si l'eleve rejoue moins bien.
    reussis: dict[str, dict] = {}
    for t in lignes:
        deja = reussis.get(t.exercice_id)
        if deja is None:
            reussis[t.exercice_id] = {
                "exercice_id": t.exercice_id,
                "verdict": t.verdict,
                "le": t.horodatage.isoformat(),
            }
        elif deja["verdict"] == "bleu" and t.verdict == "vert":
            deja["verdict"] = "vert"

    return {"reussis": [reussis[cle] for cle in sorted(reussis)]}


@routeur.post("/tentative")
def enregistrer_tentative(
    demande: DemandeTentative,
    code_acces: Annotated[str, Depends(eleve_courant)],
    session: Annotated[Session, Depends(obtenir_session)],
) -> dict:
    session.add(Tentative(code_acces=code_acces, **demande.model_dump()))
    session.commit()
    return {"expert_debloque": f"{demande.exercice_id}-expert" if demande.verdict in ("vert", "bleu") else None}
