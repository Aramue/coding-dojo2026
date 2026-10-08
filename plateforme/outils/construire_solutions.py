"""Construit les solutions de reference pour l'API. Jamais pour le navigateur.

`construire_contenu.py` retire la solution de chaque exercice avant de publier :
tout ce qui part dans `web/public/contenu` est lisible par n'importe quel eleve.
Le professeur, lui, en a besoin en seance — pour comparer avec ce qu'un eleve a
ecrit, ou pour debloquer quelqu'un. Les solutions suivent donc le chemin des
quiz : c'est l'image de l'API qui les embarque, et elle ne les rend qu'a une
session professeur.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from construire_quiz import refuser_le_contenu_publie
from valider_contenu import verifier_racine

FICHIER = "solutions.json"


def construire_solutions(racine: Path, sortie: Path) -> int:
    refuser_le_contenu_publie(sortie, "les solutions")

    # Les memes controles que la publication : une solution qui ne passe pas
    # ses propres tests ne doit pas davantage arriver sous les yeux du
    # professeur que l'exercice sous ceux de l'eleve.
    exercices, _, problemes = verifier_racine(racine)
    if problemes:
        for p in problemes:
            print(f"  PROBLEME  {p}", file=sys.stderr)
        raise SystemExit(f"{len(problemes)} probleme(s) : construction interrompue.")

    sortie.mkdir(parents=True, exist_ok=True)
    # Un seul fichier, indexe par identifiant : l'interface a deja les titres et
    # les enonces, il ne lui manque que ce que la publication a retire.
    (sortie / FICHIER).write_text(
        json.dumps({ex.id: ex.solution for ex in exercices}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return len(exercices)


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Construit les solutions pour l'API.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../contenu/chapitre-1"))
    parseur.add_argument("sortie", type=Path, nargs="?", default=Path("../api/solutions"))
    arguments = parseur.parse_args()
    total = construire_solutions(arguments.racine, arguments.sortie)
    print(f"{total} solutions construites dans {arguments.sortie}.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
