"""Construit les quiz pour l'API. Jamais pour le navigateur.

Les exercices partent dans `web/public/contenu`, lisible par n'importe quel
eleve : c'est voulu, il s'entraine seul et la bonne reponse d'un QCM ne lui
apprend rien qu'il ne puisse trouver en essayant. Un quiz, lui, est une partie
avec un score. Sa bonne reponse doit rester sur le serveur jusqu'a la
correction — c'est donc l'image de l'API qui l'embarque, et elle seule.
Voir ADR-015.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from valider_contenu import verifier_tous_les_quiz


def refuser_le_contenu_publie(sortie: Path, quoi: str) -> None:
    """Garde-fou contre une commande mal recopiee.

    Tout ce qui est sous `web/public` est servi par Caddy, et le contenu y vit
    dans `contenu/`. Y ecrire mettrait les reponses sous les yeux de toute la
    classe. `construire_solutions.py` s'en sert aussi, pour la meme raison.
    """
    parties = sortie.resolve().parts
    if "public" in parties or "contenu" in parties[-2:]:
        raise SystemExit(
            f"{sortie} ressemble au contenu publie : {quoi} ne doivent jamais y aller."
        )


def construire_quiz(racine: Path, sortie: Path) -> int:
    refuser_le_contenu_publie(sortie, "les quiz")

    tous, problemes = verifier_tous_les_quiz(racine)
    if problemes:
        for p in problemes:
            print(f"  PROBLEME  {p}", file=sys.stderr)
        raise SystemExit(f"{len(problemes)} probleme(s) de quiz : construction interrompue.")

    sortie.mkdir(parents=True, exist_ok=True)
    for quiz in tous:
        # snake_case conserve : ce JSON est lu par l'API Python, pas par le
        # TypeScript. C'est l'API qui decide de ce que chaque ecran en recoit.
        (sortie / f"{quiz.id}.json").write_text(
            json.dumps(quiz.model_dump(), ensure_ascii=False, indent=2), encoding="utf-8"
        )
    return len(tous)


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Construit les quiz pour l'API.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../contenu/chapitre-1"))
    parseur.add_argument("sortie", type=Path, nargs="?", default=Path("../api/quiz"))
    arguments = parseur.parse_args()
    total = construire_quiz(arguments.racine, arguments.sortie)
    print(f"{total} quiz construits dans {arguments.sortie}.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
