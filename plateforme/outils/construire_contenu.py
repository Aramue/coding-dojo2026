"""Transforme le contenu YAML en JSON servi au navigateur.

Deux garanties : la construction echoue si le contenu est incoherent, et
la solution de reference n'est jamais publiee.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from schema import CHAPITRES, NOTIONS, Exercice, Lecon
from valider_contenu import verifier_racine

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


# Ce qui vit dans une table de contenu mais ne sort jamais vers le navigateur.
# `motif` sert au validateur a reperer une notion employee trop tot dans une
# lecon : c'est un outil d'auteur, il n'a rien a faire dans le menu de l'eleve.
CHAMPS_PRIVES = {"motif"}


def _table(registre: dict[str, dict]) -> list[dict]:
    """Une table du schema, triee par ordre, chaque entree avec son identifiant."""
    return [
        {
            "id": identifiant,
            **{cle: v for cle, v in details.items() if cle not in CHAMPS_PRIVES},
        }
        for identifiant, details in sorted(registre.items(), key=lambda paire: paire[1]["ordre"])
    ]


def _publier_objet(chemin: Path, donnees: dict) -> None:
    chemin.write_text(json.dumps(donnees, ensure_ascii=False, indent=2), encoding="utf-8")


def _publier(chemin: Path, donnees: list) -> None:
    chemin.write_text(json.dumps(donnees, ensure_ascii=False, indent=2), encoding="utf-8")


def construire(racine: Path, sortie: Path) -> int:
    # Les controles de valider_contenu.py, appeles et non recopies : un contenu
    # que le validateur refuse ne doit jamais pouvoir se publier.
    exercices, lecons, problemes = verifier_racine(racine)
    if problemes:
        for p in problemes:
            print(f"  PROBLEME  {p}", file=sys.stderr)
        raise SystemExit(f"{len(problemes)} probleme(s) : construction interrompue.")

    sortie.mkdir(parents=True, exist_ok=True)

    # Un fichier par nature de contenu, toutes seances confondues : le front
    # n'a pas a savoir combien de seances existent, ni a les demander une a une.

    # Le chapitre est le niveau de regroupement du menu.
    _publier(sortie / "chapitres.json", _table(CHAPITRES))

    # Publiee telle quelle pour que le front n'ait pas a la recopier : le titre
    # affiche et la couleur du menu viennent d'ici, et de nulle part ailleurs.
    _publier(sortie / "notions.json", _table(NOTIONS))

    _publier(
        sortie / "exercices.json",
        [
            {
                # exclude_none : un champ optionnel absent (valeur_attendue, expert...)
                # doit rester absent du JSON, pas devenir `null`. Le TypeScript le
                # declare avec `?:` (attend `undefined`) ; `null` passe le controle
                # `!== undefined` de evaluer.ts et fait echouer a tort tout test
                # `variable` qui ne fixe pas valeur_attendue, comme s1-10.
                **_convertir_cles(ex.model_dump(exclude={"solution"}, exclude_none=True)),
                "famille": NOTIONS[ex.notion]["famille"],
            }
            for ex in exercices
        ],
    )

    # Ecrit meme vide : un fichier absent repond 404 au navigateur, et la
    # connexion de l'eleve echouerait pour une seance qui n'a pas encore de lecon.
    _publier(
        sortie / "lecons.json",
        [
            {**_convertir_cles(l.model_dump()), "famille": NOTIONS[l.notion]["famille"]}
            for l in lecons
        ],
    )

    # Le schema se publie lui-meme. Le formulaire de l'atelier s'en nourrit —
    # enumerations, champs requis, variantes de tests — et aucune copie du
    # schema ne vit cote TypeScript. Meme traitement que notions.json.
    #
    # `Lecon.notion` n'y figure plus comme une enumeration depuis qu'il est
    # valide a l'execution : la liste des notions se lit dans notions.json, qui
    # en est de toute facon la seule source.
    _publier_objet(
        sortie / "schema.json",
        {"exercice": Exercice.model_json_schema(), "lecon": Lecon.model_json_schema()},
    )

    return len(exercices)


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Construit le contenu publiable.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../contenu"))
    parseur.add_argument("sortie", type=Path, nargs="?", default=Path("../web/public/contenu"))
    arguments = parseur.parse_args()
    total = construire(arguments.racine, arguments.sortie)
    print(f"{total} exercices publies dans {arguments.sortie}.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
