"""Transforme le contenu YAML en JSON servi au navigateur.

Deux garanties : la construction echoue si un exercice est incoherent, et
la solution de reference n'est jamais publiee.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from schema import CHAPITRES, NOTIONS, charger_lecons, charger_tous
from valider_contenu import verifier_coherence, verifier_lecon

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

    # Le chapitre est le niveau de regroupement du menu.
    (sortie / "seance-1-chapitres.json").write_text(
        json.dumps(
            [
                {"id": identifiant, **details}
                for identifiant, details in sorted(
                    CHAPITRES.items(), key=lambda paire: paire[1]["ordre"]
                )
            ],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    # Publiee telle quelle pour que le front n'ait pas a la recopier : le titre
    # affiche et la couleur du menu viennent d'ici, et de nulle part ailleurs.
    (sortie / "seance-1-notions.json").write_text(
        json.dumps(
            [
                {"id": identifiant, **details}
                for identifiant, details in sorted(
                    NOTIONS.items(), key=lambda paire: paire[1]["ordre"]
                )
            ],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    for seance in (1, 2, 3):
        publiables = [
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
            if ex.seance == seance
        ]
        if publiables:
            (sortie / f"seance-{seance}.json").write_text(
                json.dumps(publiables, ensure_ascii=False, indent=2), encoding="utf-8"
            )

        dossier_lecons = racine / f"seance-{seance}" / "lecons"
        if not dossier_lecons.is_dir():
            continue
        lecons = charger_lecons(dossier_lecons)
        problemes_lecons: list[str] = []
        for lecon in lecons:
            problemes_lecons += verifier_lecon(lecon)
        if problemes_lecons:
            for p in problemes_lecons:
                print(f"  PROBLEME  {p}", file=sys.stderr)
            raise SystemExit(f"{len(problemes_lecons)} probleme(s) de lecon.")
        if lecons:
            (sortie / f"seance-{seance}-lecons.json").write_text(
                json.dumps(
                    [
                        {
                            **_convertir_cles(l.model_dump()),
                            "famille": NOTIONS[l.notion]["famille"],
                        }
                        for l in lecons
                    ],
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
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
