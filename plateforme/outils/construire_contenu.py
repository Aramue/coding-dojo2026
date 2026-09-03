"""Transforme le contenu YAML en JSON servi au navigateur.

Deux garanties : la construction echoue si un exercice est incoherent, et
la solution de reference n'est jamais publiee.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from schema import charger_tous
from valider_contenu import verifier_coherence

# Familles de couleur par concept — voir la note Palette du coffre.
FAMILLES = {
    "print": "variables",
    "execution": "variables",
    "variable": "variables",
    "variables": "variables",
    "reaffectation": "variables",
    "erreurs": "variables",
    "format exact": "variables",
    "types": "types",
    "conversion": "types",
    "f-string": "types",
    "input": "types",
    "operateurs": "operateurs",
    "conditions": "conditions",
    "boucles": "boucles",
    "probleme narratif": "variables",
}


def _en_camel(nom: str) -> str:
    tete, *reste = nom.split("_")
    return tete + "".join(mot.capitalize() for mot in reste)


def _convertir_cles(valeur):
    """Le YAML est en snake_case, le TypeScript attend du camelCase.

    Sans cette conversion, `type_attendu` arrive dans le navigateur alors que
    l'evaluateur lit `typeAttendu` : tous les tests `variable` echouent en
    silence, et l'exercice devient impossible a valider.
    """
    if isinstance(valeur, dict):
        return {_en_camel(cle): _convertir_cles(v) for cle, v in valeur.items()}
    if isinstance(valeur, list):
        return [_convertir_cles(v) for v in valeur]
    return valeur


def construire(racine: Path, sortie: Path) -> int:
    exercices = charger_tous(racine)

    problemes: list[str] = []
    for ex in exercices:
        problemes += verifier_coherence(ex)
    if problemes:
        for p in problemes:
            print(f"  PROBLEME  {p}", file=sys.stderr)
        raise SystemExit(f"{len(problemes)} probleme(s) : construction interrompue.")

    sortie.mkdir(parents=True, exist_ok=True)
    for seance in (1, 2, 3):
        publiables = [
            {
                **_convertir_cles(ex.model_dump(exclude={"solution"})),
                "famille": FAMILLES.get(ex.concept, "variables"),
            }
            for ex in exercices
            if ex.seance == seance
        ]
        if publiables:
            (sortie / f"seance-{seance}.json").write_text(
                json.dumps(publiables, ensure_ascii=False, indent=2), encoding="utf-8"
            )
    return len(exercices)


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Construit le contenu publiable.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../../contenu/chapitre-1"))
    parseur.add_argument("sortie", type=Path, nargs="?", default=Path("../web/public/contenu"))
    arguments = parseur.parse_args()
    total = construire(arguments.racine, arguments.sortie)
    print(f"{total} exercices publies dans {arguments.sortie}.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
