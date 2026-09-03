"""Execute la solution de reference et ecrit lui-meme la sortie dans le YAML.

Le professeur ecrit la solution, jamais l'attendu. C'est le levier de production
numero un : il supprime l'erreur la plus probable, l'attendu tape a la main.

L'ecriture passe par ruamel.yaml en mode aller-retour, jamais par PyYAML : ces
fichiers sont edites a la main, et un safe_dump detruirait silencieusement les
commentaires du professeur et ses blocs litteraux `|`.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ruamel.yaml import YAML
from ruamel.yaml.scalarstring import LiteralScalarString

from valider_contenu import _executer

_yaml = YAML()
_yaml.preserve_quotes = True
_yaml.width = 4096
# Sans cela, ruamel realigne les tirets de TOUTES les listes du fichier a chaque
# ecriture, meme celles qu'on ne modifie pas. C'est le style d'indentation
# utilise dans les fichiers d'exercices ecrits a la main.
_yaml.indent(mapping=2, sequence=4, offset=2)


def _en_scalaire(texte: str) -> str | LiteralScalarString:
    """Une sortie multi-ligne s'ecrit en bloc litteral, pour rester lisible."""
    return LiteralScalarString(texte + "\n") if "\n" in texte else texte


def remplir_attendus(chemin: Path, ecrire_fichier: bool = True) -> list[str]:
    donnees = _yaml.load(chemin.read_text(encoding="utf-8"))
    solution = donnees.get("solution", "")
    modifies: list[str] = []

    for index, test in enumerate(donnees.get("tests", [])):
        if test.get("type") != "sortie":
            continue
        stdout, _, erreur = _executer(solution, test.get("entrees", []))
        if erreur:
            print(f"  {donnees['id']}#{index} : la solution plante ({erreur}), attendu inchangé")
            continue
        # Meme portee de nettoyage que evaluer.ts et valider_contenu._passe :
        # tout l'espace final, pas seulement les sauts de ligne.
        nouveau = stdout.rstrip()
        if str(test.get("attendu", "")).rstrip() != nouveau:
            test["attendu"] = _en_scalaire(nouveau)
            modifies.append(f"{donnees['id']}#{index}")

    if modifies and ecrire_fichier:
        with chemin.open("w", encoding="utf-8", newline="\n") as fichier:
            _yaml.dump(donnees, fichier)
    return modifies


def principal() -> int:
    # La console Windows n'est pas en UTF-8 par defaut : sans cela, les messages
    # accentues sortent en mojibake.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parseur = argparse.ArgumentParser(description="Remplit le champ attendu depuis la solution.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../../contenu"))
    arguments = parseur.parse_args()

    cibles = [arguments.racine] if arguments.racine.is_file() else sorted(arguments.racine.rglob("*.yaml"))
    total: list[str] = []
    for chemin in cibles:
        total += remplir_attendus(chemin)

    print(f"{len(total)} attendu(s) mis à jour." if total else "Rien à mettre à jour.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
