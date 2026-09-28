"""Les quiz disponibles, tels que outils/construire_quiz.py les a ecrits.

Dans l'image, ils sont dans /app/quiz (voir Dockerfile.api). En developpement,
dans plateforme/api/quiz, apres un `python construire_quiz.py` lance depuis
outils/. Sans eux, le catalogue est vide : le professeur le lit a l'ecran,
rien ne plante.
"""

from __future__ import annotations

import json
import os
import warnings
from functools import lru_cache
from pathlib import Path

from .quiz import QuizPublie

DOSSIER = Path(os.environ.get("DOJO_QUIZ") or Path(__file__).resolve().parent.parent / "quiz")


def charger(dossier: Path) -> dict[str, QuizPublie]:
    """Un quiz par fichier JSON. Un fichier illisible est ecarte, pas fatal.

    Un quiz casse ne doit pas empecher l'API de demarrer : les eleves
    n'auraient plus acces aux exercices pour une partie qu'ils n'ont pas
    lancee.
    """
    if not dossier.is_dir():
        warnings.warn(
            f"Aucun quiz : {dossier} n'existe pas. Lance outils/construire_quiz.py.",
            stacklevel=2,
        )
        return {}

    catalogue: dict[str, QuizPublie] = {}
    for chemin in sorted(dossier.glob("*.json")):
        try:
            quiz = QuizPublie(**json.loads(chemin.read_text(encoding="utf-8")))
        except (ValueError, TypeError) as erreur:
            # ValidationError et JSONDecodeError derivent de ValueError ; un
            # JSON qui n'est pas un objet leve TypeError au deballage.
            warnings.warn(f"Quiz ecarte, {chemin.name} illisible : {erreur}", stacklevel=2)
            continue
        catalogue[quiz.id] = quiz
    return catalogue


@lru_cache(maxsize=1)
def obtenir_catalogue() -> dict[str, QuizPublie]:
    """Lu une fois par processus : les quiz changent au deploiement, pas en seance."""
    return charger(DOSSIER)
