"""Tableau de bord. Ne renvoie jamais le code ecrit par un eleve."""

from __future__ import annotations

import hmac
import os
import secrets
import warnings
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select

from .bdd import obtenir_session
from .modeles import Eleve, Tentative

routeur = APIRouter(prefix="/prof")

_code_fourni = os.environ.get("DOJO_CODE_PROF")
if _code_fourni:
    CODE_PROF = _code_fourni
else:
    # Meme raisonnement que pour DOJO_SECRET : un code par defaut devinable
    # ("prof-dev") donnerait a n'importe quel eleve la progression de toute la
    # classe. Un code aleatoire echoue de facon visible ; un code publie echoue
    # en silence.
    CODE_PROF = secrets.token_urlsafe(12)
    warnings.warn(
        "DOJO_CODE_PROF n'est pas defini : code professeur aleatoire pour cette "
        f"execution -> {CODE_PROF}. Definis DOJO_CODE_PROF en production.",
        stacklevel=2,
    )

ECHECS_POUR_BLOQUE = 3
SECONDES_POUR_INACTIF = 600


def verifier_prof(x_code_prof: Annotated[str | None, Header()] = None) -> None:
    # compare_digest : comparaison a temps constant, comme pour les jetons eleve.
    if not x_code_prof or not hmac.compare_digest(x_code_prof, CODE_PROF):
        raise HTTPException(401, "Code professeur invalide")


@routeur.get("/seance", dependencies=[Depends(verifier_prof)])
def lire_seance(session: Annotated[Session, Depends(obtenir_session)]) -> dict:
    tentatives = session.exec(select(Tentative).order_by(Tentative.horodatage)).all()  # type: ignore[arg-type]

    par_eleve: dict[str, list[Tentative]] = {}
    for t in tentatives:
        par_eleve.setdefault(t.code_acces, []).append(t)

    maintenant = datetime.now(timezone.utc)
    eleves = []
    # On part de la CLASSE, pas des tentatives : un eleve inscrit qui n'a rien
    # soumis n'apparaissait nulle part, alors que « qui n'a pas commence » est
    # justement ce qu'il faut voir dans le premier quart d'heure d'une seance.
    for inscrit in session.exec(select(Eleve)).all():
        liste = par_eleve.get(inscrit.code_acces, [])
        identite = {
            "code_acces": inscrit.code_acces,
            "prenom": inscrit.prenom,
            "nom": inscrit.nom,
        }

        if not liste:
            eleves.append(
                {
                    **identite,
                    "exercice_id": None,
                    "statut": "pas_commence",
                    "echecs_consecutifs": 0,
                    "inactif_depuis_s": _ecoule(maintenant, inscrit.vu_le),
                    "dernier_type_erreur": None,
                    "reussis": [],
                }
            )
            continue

        derniere = liste[-1]

        echecs = 0
        for t in reversed(liste):
            if t.verdict == "rouge":
                echecs += 1
            else:
                break

        inactif_depuis = _ecoule(maintenant, derniere.horodatage)

        if echecs >= ECHECS_POUR_BLOQUE:
            statut = "bloque"
        elif inactif_depuis >= SECONDES_POUR_INACTIF:
            statut = "inactif"
        else:
            statut = "en_cours"

        eleves.append(
            {
                **identite,
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
    ordre = {"bloque": 0, "inactif": 1, "pas_commence": 2, "en_cours": 3}
    eleves.sort(key=lambda a: (ordre[a["statut"]], -a["inactif_depuis_s"]))
    return {"eleves": eleves}


def _ecoule(maintenant: datetime, quand: datetime) -> int:
    """Secondes ecoulees, en tolerant un horodatage sans fuseau (SQLite en rend)."""
    if quand.tzinfo is None:
        quand = quand.replace(tzinfo=timezone.utc)
    return int((maintenant - quand).total_seconds())
