"""Gestion de la classe par le professeur : creer, modifier, retirer un eleve.

Tout ce module est derriere `verifier_prof`. Les identites saisies ici ne
sortent jamais vers un autre eleve : `/session` ne rend que le prenom du
porteur du code, et `/parcours` n'en rend aucun.
"""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlmodel import Session, func, select

from .bdd import obtenir_session
from .modeles import Eleve, Tentative
from .routes_prof import verifier_prof

routeur = APIRouter(prefix="/prof", dependencies=[Depends(verifier_prof)])

# Alphabet sans O, 0, I, 1, L ni S : un code se lit a voix haute et se recopie a
# la main, souvent depuis un tableau, par quelqu'un qui n'a jamais tape de code
# de sa vie. Une seule confusion coute une minute de seance et une main levee.
ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789"
LONGUEUR_CODE = 4

# 29^4 fait 707 281 combinaisons pour une classe de vingt-quatre : la collision
# est rare, mais elle arrivera un jour, et deux eleves partageant un code
# seraient indiscernables. On retente plutot que de faire confiance au hasard.
TENTATIVES_CODE = 40

MAX_TEXTE = 80


def engendrer_code(session: Session) -> str:
    for _ in range(TENTATIVES_CODE):
        code = "DOJO-" + "".join(secrets.choice(ALPHABET) for _ in range(LONGUEUR_CODE))
        if session.get(Eleve, code) is None:
            return code
    raise HTTPException(503, "Impossible de tirer un code libre")


class ChampsEleve(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prenom: str = Field(default="", max_length=MAX_TEXTE)
    nom: str = Field(default="", max_length=MAX_TEXTE)
    etablissement: str = Field(default="", max_length=MAX_TEXTE)

    @field_validator("prenom", "nom", "etablissement")
    @classmethod
    def sans_bords(cls, valeur: str) -> str:
        return valeur.strip()


class DemandeCreation(ChampsEleve):
    """Le code n'est pas dans la demande : c'est le serveur qui le tire.

    Le laisser choisir par l'appelant ouvrirait la porte a un code devine
    d'avance, donc a une progression lue ou ecrite par quelqu'un d'autre.
    """

    @field_validator("prenom")
    @classmethod
    def prenom_obligatoire(cls, valeur: str) -> str:
        propre = valeur.strip()
        if not propre:
            raise ValueError("le prenom est obligatoire")
        return propre


def _rendre(eleve: Eleve, tentatives: int) -> dict:
    return {
        "code_acces": eleve.code_acces,
        "prenom": eleve.prenom,
        "nom": eleve.nom,
        "etablissement": eleve.etablissement,
        "cree_le": eleve.cree_le.isoformat(),
        "vu_le": eleve.vu_le.isoformat(),
        "tentatives": tentatives,
    }


def _comptes(session: Session) -> dict[str, int]:
    """Le nombre de tentatives par eleve, en une requete plutot qu'une par ligne."""
    lignes = session.exec(
        select(Tentative.code_acces, func.count()).group_by(Tentative.code_acces)  # type: ignore[arg-type]
    ).all()
    return {code: nombre for code, nombre in lignes}


def _lire(session: Session, code: str) -> Eleve:
    eleve = session.get(Eleve, code)
    if eleve is None:
        raise HTTPException(404, "Eleve inconnu")
    return eleve


@routeur.get("/eleves")
def lister(session: Annotated[Session, Depends(obtenir_session)]) -> dict:
    comptes = _comptes(session)
    eleves = session.exec(select(Eleve).order_by(Eleve.prenom, Eleve.nom)).all()  # type: ignore[arg-type]
    return {"eleves": [_rendre(e, comptes.get(e.code_acces, 0)) for e in eleves]}


@routeur.post("/eleves", status_code=201)
def creer(demande: DemandeCreation, session: Annotated[Session, Depends(obtenir_session)]) -> dict:
    eleve = Eleve(code_acces=engendrer_code(session), **demande.model_dump())
    session.add(eleve)
    session.commit()
    session.refresh(eleve)
    return _rendre(eleve, 0)


@routeur.patch("/eleves/{code}")
def modifier(
    code: str, demande: ChampsEleve, session: Annotated[Session, Depends(obtenir_session)]
) -> dict:
    eleve = _lire(session, code)
    eleve.prenom = demande.prenom
    eleve.nom = demande.nom
    eleve.etablissement = demande.etablissement
    session.add(eleve)
    session.commit()
    session.refresh(eleve)
    return _rendre(eleve, _comptes(session).get(code, 0))


@routeur.delete("/eleves/{code}")
def retirer(code: str, session: Annotated[Session, Depends(obtenir_session)]) -> dict:
    eleve = _lire(session, code)
    # Les tentatives portent une cle etrangere vers l'eleve : les laisser
    # derriere produirait des lignes orphelines qui fausseraient le tableau de
    # bord sans plus jamais correspondre a personne.
    tentatives = session.exec(select(Tentative).where(Tentative.code_acces == code)).all()
    for t in tentatives:
        session.delete(t)
    session.delete(eleve)
    session.commit()
    return {"code_acces": code, "tentatives_supprimees": len(tentatives)}
