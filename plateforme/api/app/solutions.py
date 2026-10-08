"""Les solutions de reference, pour le professeur seulement.

La publication les retire de chaque exercice : tout ce que le navigateur d'un
eleve telecharge, il peut le lire. Elles arrivent donc ici par
outils/construire_solutions.py — dans l'image, sous /app/solutions (voir
Dockerfile.api) — et ne sortent que derriere `verifier_prof`.

Sans le fichier, il n'y a pas de solutions : le professeur lit les exercices
sans elles, rien ne plante.
"""

from __future__ import annotations

import json
import os
import warnings
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends

from .routes_prof import verifier_prof

FICHIER = Path(
    os.environ.get("DOJO_SOLUTIONS")
    or Path(__file__).resolve().parent.parent / "solutions" / "solutions.json"
)

# Tout le module est derriere la session professeur. Un jeton eleve n'y ouvre
# rien : c'est la seule chose qui separe un eleve de toutes les reponses.
routeur = APIRouter(prefix="/prof", dependencies=[Depends(verifier_prof)])


def charger(fichier: Path) -> dict[str, str]:
    """Identifiant d'exercice -> solution. Un fichier illisible est ecarte, pas fatal.

    Des solutions cassees ne doivent pas empecher l'API de demarrer : les
    eleves n'auraient plus acces aux exercices pour un confort du professeur.
    """
    if not fichier.is_file():
        warnings.warn(
            f"Aucune solution : {fichier} n'existe pas. Lance outils/construire_solutions.py.",
            stacklevel=2,
        )
        return {}
    try:
        donnees = json.loads(fichier.read_text(encoding="utf-8"))
    except ValueError as erreur:
        warnings.warn(f"Solutions ecartees, {fichier.name} illisible : {erreur}", stacklevel=2)
        return {}
    if not isinstance(donnees, dict) or not all(
        isinstance(cle, str) and isinstance(valeur, str) for cle, valeur in donnees.items()
    ):
        warnings.warn(f"Solutions ecartees, {fichier.name} n'a pas la forme attendue", stacklevel=2)
        return {}
    return donnees


@lru_cache(maxsize=1)
def obtenir_solutions() -> dict[str, str]:
    """Lues une fois par processus : elles changent au deploiement, pas en seance."""
    return charger(FICHIER)


@routeur.get("/solutions")
def lire_solutions(solutions: Annotated[dict[str, str], Depends(obtenir_solutions)]) -> dict:
    return {"solutions": solutions}
