"""Tableau de bord. Ne renvoie jamais le code ecrit par un eleve."""

from __future__ import annotations

import hmac
import os
import secrets
import warnings
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, field_validator
from sqlmodel import Session, select

from .bdd import obtenir_session
from .modeles import Tentative, Verrou

routeur = APIRouter(prefix="/prof")

_code_fourni = os.environ.get("DOJO_CODE_PROF")
if _code_fourni:
    CODE_PROF = _code_fourni
else:
    # Meme raisonnement que pour DOJO_SECRET : un code par defaut devinable
    # ("prof-dev") donnerait a n'importe quel eleve la progression de toute la
    # classe et la main sur les verrous. Un code aleatoire echoue de facon
    # visible ; un code publie echoue en silence.
    CODE_PROF = secrets.token_urlsafe(12)
    warnings.warn(
        "DOJO_CODE_PROF n'est pas defini : code professeur aleatoire pour cette "
        f"execution -> {CODE_PROF}. Definis DOJO_CODE_PROF en production.",
        stacklevel=2,
    )

ECHECS_POUR_BLOQUE = 3
SECONDES_POUR_INACTIF = 600

# Liste blanche : `concept` est ecrit en base puis relu. Sans contrainte, ce champ
# accepte n'importe quelle chaine. Une validation qui n'existerait que dans un
# <select> cote client ne protegerait rien — la lecon des rondes de la tache 11.
CONCEPTS = frozenset({"variables", "types", "operateurs", "conditions", "boucles"})


def verifier_prof(x_code_prof: Annotated[str | None, Header()] = None) -> None:
    # compare_digest : comparaison a temps constant, comme pour les jetons eleve.
    if not x_code_prof or not hmac.compare_digest(x_code_prof, CODE_PROF):
        raise HTTPException(401, "Code professeur invalide")


class DemandeVerrou(BaseModel):
    model_config = ConfigDict(extra="forbid")

    concept: str
    ouvert: bool

    @field_validator("concept")
    @classmethod
    def concept_connu(cls, valeur: str) -> str:
        if valeur not in CONCEPTS:
            raise ValueError("concept inconnu")
        return valeur


@routeur.get("/seance", dependencies=[Depends(verifier_prof)])
def lire_seance(session: Annotated[Session, Depends(obtenir_session)]) -> dict:
    tentatives = session.exec(select(Tentative).order_by(Tentative.horodatage)).all()

    par_eleve: dict[str, list[Tentative]] = {}
    for t in tentatives:
        par_eleve.setdefault(t.code_acces, []).append(t)

    maintenant = datetime.now(timezone.utc)
    eleves = []
    for code, liste in par_eleve.items():
        derniere = liste[-1]

        echecs = 0
        for t in reversed(liste):
            if t.verdict == "rouge":
                echecs += 1
            else:
                break

        horodatage = derniere.horodatage
        if horodatage.tzinfo is None:
            horodatage = horodatage.replace(tzinfo=timezone.utc)
        inactif_depuis = int((maintenant - horodatage).total_seconds())

        if echecs >= ECHECS_POUR_BLOQUE:
            statut = "bloque"
        elif inactif_depuis >= SECONDES_POUR_INACTIF:
            statut = "inactif"
        else:
            statut = "en_cours"

        eleves.append(
            {
                "code_acces": code,
                "exercice_id": derniere.exercice_id,
                "statut": statut,
                "echecs_consecutifs": echecs,
                "inactif_depuis_s": inactif_depuis,
                "dernier_type_erreur": derniere.type_erreur if derniere.verdict == "rouge" else None,
                # La LISTE, pas le compte. L'API ne sait pas quels exercices
                # sont obligatoires — le contenu vit cote front — donc elle ne
                # peut pas produire un decompte comparable a un total. Elle
                # renvoie les identifiants, et le tableau de bord fait le tri.
                "reussis": sorted({t.exercice_id for t in liste if t.verdict in ("vert", "bleu")}),
            }
        )

    # Pas de statut "termine" : le determiner supposerait de connaitre le nombre
    # total d'exercices de la seance, que l'API ne possede pas (le contenu est
    # construit cote front). Le faire remonter par le client reviendrait a
    # faire confiance au navigateur de l'eleve pour une donnee qui conditionne
    # l'affichage professeur — la lecon des rondes de la tache 11. Un statut
    # annonce mais jamais produit est pire qu'un statut absent : "reussis"
    # suffit deja a voir qui avance.
    ordre = {"bloque": 0, "inactif": 1, "en_cours": 2}
    eleves.sort(key=lambda a: (ordre[a["statut"]], -a["inactif_depuis_s"]))
    return {"eleves": eleves}


@routeur.post("/verrou", dependencies=[Depends(verifier_prof)])
def basculer_verrou(
    demande: DemandeVerrou, session: Annotated[Session, Depends(obtenir_session)]
) -> dict:
    verrou = session.get(Verrou, demande.concept)
    if verrou is None:
        verrou = Verrou(concept=demande.concept, ouvert=demande.ouvert)
        session.add(verrou)
    else:
        verrou.ouvert = demande.ouvert
        session.add(verrou)
    session.commit()
    return {"concept": demande.concept, "ouvert": demande.ouvert}
