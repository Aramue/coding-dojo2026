"""Execute la solution de reference et ecrit lui-meme la sortie dans le YAML.

Le professeur ecrit la solution, jamais l'attendu. C'est le levier de production
numero un : il supprime l'erreur la plus probable, l'attendu tape a la main.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

from valider_contenu import _executer


def remplir_attendus(chemin: Path, ecrire_fichier: bool = True) -> list[str]:
    donnees = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    solution = donnees.get("solution", "")
    modifies: list[str] = []

    for index, test in enumerate(donnees.get("tests", [])):
        if test.get("type") != "sortie":
            continue
        stdout, _, erreur = _executer(solution, test.get("entrees", []))
        if erreur:
            print(f"  {donnees['id']}#{index} : la solution plante ({erreur}), attendu inchange")
            continue
        nouveau = stdout.rstrip("\n")
        if test.get("attendu") != nouveau:
            test["attendu"] = nouveau
            modifies.append(f"{donnees['id']}#{index}")

    if modifies and ecrire_fichier:
        chemin.write_text(
            yaml.safe_dump(donnees, allow_unicode=True, sort_keys=False, width=1000),
            encoding="utf-8",
        )
    return modifies


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Remplit le champ attendu depuis la solution.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../../contenu"))
    arguments = parseur.parse_args()

    cibles = [arguments.racine] if arguments.racine.is_file() else sorted(arguments.racine.rglob("*.yaml"))
    total: list[str] = []
    for chemin in cibles:
        total += remplir_attendus(chemin)

    print(f"{len(total)} attendu(s) mis a jour." if total else "Rien a mettre a jour.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
