"""Valide tout le contenu. A lancer avant chaque cours et dans la construction.

Le controle qui sauve le plus de temps : executer la solution de reference contre
ses propres tests. Il empeche de publier un exercice impossible a valider, la
panne la plus couteuse en seance parce qu'elle envoie toute la classe lever la main.
"""

from __future__ import annotations

import argparse
import io
import re
import sys
import unicodedata
from contextlib import redirect_stdout
from pathlib import Path

from schema import MOTIF_EMOJI, Exercice, TestMotif, TestSortie, TestVariable, charger_tous


def _executer(code: str, entrees: list[str]) -> tuple[str, dict, str | None]:
    """Exécute du code avec input() simulé. Miroir Python du harnais du worker."""
    restantes = list(entrees)
    sortie = io.StringIO()

    def _input(invite: str = "") -> str:
        sortie.write(str(invite))
        if not restantes:
            raise EOFError("plus d'entree disponible")
        valeur = restantes.pop(0)
        sortie.write(valeur + "\n")
        return valeur

    espace: dict = {"__name__": "__main__", "input": _input}
    try:
        with redirect_stdout(sortie):
            exec(compile(code, "<solution>", "exec"), espace)
    except BaseException as e:  # noqa: BLE001 — on rapporte, on ne relance pas
        return sortie.getvalue(), espace, f"{type(e).__name__}: {e}"
    return sortie.getvalue(), espace, None


def _normaliser(texte: str) -> str:
    """Miroir Python de web/src/validation/normaliser.ts, pour le verdict bleu.

    Les deux implementations doivent se comporter a l'identique. Si elles divergent,
    un exercice peut passer la validation a la construction et se comporter autrement
    dans le navigateur de l'eleve. Toute modification ici en exige une la-bas, et le
    test de parite doit etre mis a jour dans les deux suites.
    """
    t = texte.replace("\r\n", "\n")
    t = "".join(c for c in unicodedata.normalize("NFD", t) if not unicodedata.combining(c))
    for apostrophe in ("‘", "’", "‛"):
        t = t.replace(apostrophe, "'")
    for guillemet in ("“", "”"):
        t = t.replace(guillemet, '"')
    for fleche in ("→", "➡", "->", ":"):
        t = t.replace(fleche, ">")
    t = MOTIF_EMOJI.sub("", t)
    t = t.lower()
    lignes = [re.sub(r"[ \t]+", " ", ligne).strip() for ligne in t.split("\n")]
    return "\n".join(l for l in lignes if l != "").strip()


def _passe(ex: Exercice, code: str) -> bool:
    """Le code satisfait-il tous les tests de l'exercice ?"""
    for test in ex.tests:
        if isinstance(test, TestMotif):
            if test.type == "interdit" and test.motif in code:
                return False
            if test.type == "contient" and test.motif not in code:
                return False
            continue
        if isinstance(test, TestSortie):
            stdout, _, erreur = _executer(code, test.entrees)
            if erreur:
                return False
            if test.exige_exact:
                if stdout.rstrip() != test.attendu.rstrip():
                    return False
            elif _normaliser(stdout) != _normaliser(test.attendu):
                return False
            continue
        if isinstance(test, TestVariable):
            _, espace, erreur = _executer(code, [])
            if erreur or test.nom not in espace:
                return False
            valeur = espace[test.nom]
            if test.type_attendu and type(valeur).__name__ != test.type_attendu:
                return False
            if test.valeur_attendue is not None and repr(valeur) != test.valeur_attendue:
                return False
    return True


def verifier_coherence(ex: Exercice) -> list[str]:
    problemes: list[str] = []

    for test in ex.tests:
        if isinstance(test, TestMotif) and test.type == "interdit" and test.motif in ex.solution:
            problemes.append(
                f"{ex.id} : la solution contient son propre motif interdit {test.motif!r}"
            )

    if ex.type != "predire" and not _passe(ex, ex.solution):
        problemes.append(f"{ex.id} : la solution de reference ne passe pas ses propres tests")

    if ex.type in ("ecrire", "completer", "debug") and ex.depart and _passe(ex, ex.depart):
        problemes.append(f"{ex.id} : le code de depart passe deja les tests, l'exercice est resolu")

    return problemes


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Valide tout le contenu du dojo.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../../contenu"))
    arguments = parseur.parse_args()

    exercices = charger_tous(arguments.racine)
    identifiants = {ex.id for ex in exercices}
    problemes: list[str] = []

    for ex in exercices:
        problemes += verifier_coherence(ex)
        if ex.expert and ex.expert not in identifiants:
            problemes.append(f"{ex.id} : renvoie vers un expert inexistant {ex.expert!r}")

    print(f"{len(exercices)} exercices charges.")
    for p in problemes:
        print(f"  PROBLEME  {p}")
    print("Contenu valide." if not problemes else f"{len(problemes)} probleme(s).")
    return 1 if problemes else 0


if __name__ == "__main__":
    sys.exit(principal())
