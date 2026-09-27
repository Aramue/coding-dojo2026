"""Valide tout le contenu. A lancer avant chaque cours et dans la construction.

Le controle qui sauve le plus de temps : executer la solution de reference contre
ses propres tests. Il empeche de publier un exercice impossible a valider, la
panne la plus couteuse en seance parce qu'elle envoie toute la classe lever la main.
"""

from __future__ import annotations

import argparse
import ast
import io
import re
import sys
import unicodedata
from contextlib import redirect_stdout
from datetime import date
from pathlib import Path

from schema import (
    CHAPITRES,
    MOTIF_EMOJI,
    NOTIONS,
    BlocCode,
    Exercice,
    Lecon,
    TestMotif,
    TestSortie,
    TestVariable,
    charger_lecons,
    charger_tables,
    charger_tous,
)


# Un programme qui ne s'arrete pas ne doit pas bloquer la construction : la
# boucle infinie de la seance 3 est un exercice, pas un accident. Le navigateur
# coupe au bout de 5 secondes ; ici, on compte les tours de boucle, ce qui rend
# le meme verdict sans dependre de la vitesse de la machine.
TOURS_MAX = 100_000


class _CompteurDeTours(ast.NodeTransformer):
    """Place un appel a __tour__() en tete du corps de chaque boucle.

    Plutot qu'un traceur installe avec sys.settrace : il prenait la place de
    celui de coverage, et la mesure des fonctions appelant _executer s'arretait
    net apres chaque execution.
    """

    def _compter(self, boucle: ast.For | ast.While) -> ast.For | ast.While:
        self.generic_visit(boucle)
        boucle.body.insert(0, ast.Expr(ast.Call(ast.Name("__tour__", ast.Load()), [], [])))
        return boucle

    visit_For = visit_While = _compter


def _executer(code: str, entrees: list[str]) -> tuple[str, dict, str | None]:
    """Exécute du code avec input() simulé. Miroir Python du harnais du worker."""
    restantes = list(entrees)
    sortie = io.StringIO()
    tours = 0

    def _input(invite: str = "") -> str:
        sortie.write(str(invite))
        if not restantes:
            raise EOFError("plus d'entree disponible")
        valeur = restantes.pop(0)
        sortie.write(valeur + "\n")
        return valeur

    def _tour() -> None:
        nonlocal tours
        tours += 1
        if tours > TOURS_MAX:
            raise TimeoutError("le programme ne s'arrête pas")

    espace: dict = {"__name__": "__main__", "input": _input, "__tour__": _tour}
    try:
        arbre = ast.fix_missing_locations(_CompteurDeTours().visit(ast.parse(code, "<solution>")))
        with redirect_stdout(sortie):
            exec(compile(arbre, "<solution>", "exec"), espace)
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


def _passe(ex: Exercice, code: str, *, exiger_maitrise: bool = True) -> bool:
    """Le code satisfait-il tous les tests de l'exercice ?

    `exiger_maitrise` distingue les deux questions que l'outil pose :

    - de la solution de reference, on exige TOUT, criteres de maitrise compris.
      Une solution qui n'emploie pas la methode que l'exercice recompense ne
      sert de modele a personne.
    - du code de depart, on demande seulement s'il est deja VALIDE aux yeux de
      l'eleve. Un critere de maitrise manquant ne bloque pas dans le navigateur
      (il coute la seconde coche) : le compter ici masquerait un depart qui
      resout deja l'exercice.
    """
    for test in ex.tests:
        if isinstance(test, TestMotif):
            if test.type == "interdit" and test.motif in code:
                return False
            if test.type == "contient" and test.motif not in code:
                if test.maitrise and not exiger_maitrise:
                    continue
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
        if not isinstance(test, TestMotif) or test.type != "interdit":
            continue

        if test.motif in ex.solution:
            problemes.append(
                f"{ex.id} : la solution contient son propre motif interdit {test.motif!r}"
            )

        # Un motif qui contient un guillemet ne bloque que cette ponctuation-la.
        # L'eleve ecrit la meme reponse en dur avec des guillemets simples, des
        # triples guillemets ou un f-string, et passe au vert sans rien resoudre.
        # Un motif nu bloque toutes les formes d'un coup.
        if any(guillemet in test.motif for guillemet in "\"'"):
            problemes.append(
                f"{ex.id} : le motif interdit {test.motif!r} contient un guillemet, "
                "il se contourne en changeant de ponctuation"
            )

    if ex.type != "predire" and not _passe(ex, ex.solution):
        problemes.append(f"{ex.id} : la solution de reference ne passe pas ses propres tests")

    if (
        ex.type in ("ecrire", "completer", "debug")
        and ex.depart
        and _passe(ex, ex.depart, exiger_maitrise=False)
    ):
        problemes.append(f"{ex.id} : le code de depart passe deja les tests, l'exercice est resolu")

    return problemes


def verifier_lecon(lecon: Lecon) -> list[str]:
    """Chaque exemple d'une lecon doit tourner, et rester dans sa notion.

    Une lecon ne fournit aucune entree simulee : un exemple qui appelle input()
    leve EOFError et sera signale, ce qui est voulu. Un exemple de lecon se lit
    et se rejoue tel quel, il ne pose pas de question.
    """
    problemes: list[str] = []
    for bloc in lecon.blocs:
        if not isinstance(bloc, BlocCode):
            continue

        for notion, details in sorted(NOTIONS.items()):
            # Ce qui trahit une notion dans un exemple de code : une lecon
            # d'ordre N ne peut utiliser que les notions d'ordre <= N. Montrer
            # une variable dans la lecon « Afficher un message » demande a
            # l'eleve de comprendre ce qu'il n'a pas encore vu. Le motif est
            # volontairement grossier — il attrape les cas evidents.
            #
            # MULTILINE toujours : un seul motif en a besoin (l'affectation en
            # debut de ligne), et il est inoffensif pour les autres.
            motif = details.get("motif")
            if motif and details["ordre"] > lecon.ordre and re.search(motif, bloc.python, re.MULTILINE):
                problemes.append(
                    f"{lecon.id} : l'exemple {bloc.legende!r} utilise la notion "
                    f"{notion!r}, enseignee apres celle-ci"
                )

        _, _, erreur = _executer(bloc.python, bloc.entrees)
        if erreur:
            problemes.append(f"{lecon.id} : l'exemple {bloc.legende!r} plante ({erreur})")
    return problemes


MOTIF_DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


def verifier_chapitres(chapitres: dict[str, dict]) -> list[str]:
    """Une date d'ouverture mal ecrite ne plante rien : c'est tout le danger.

    Le front compare des chaines `AAAA-MM-JJ`. « 23/09/2026 » s'y compare
    quand meme, et la seance reste fermee ou s'ouvre trop tot, en silence, le
    matin du cours. Voir ADR-013.
    """
    problemes: list[str] = []
    for identifiant, details in chapitres.items():
        ouverture = details.get("ouverture")
        if ouverture is None:
            continue
        try:
            # Le motif d'abord : Python lit aussi « 20260923 », le front non.
            lisible = bool(MOTIF_DATE.match(ouverture)) and bool(date.fromisoformat(ouverture))
        except (TypeError, ValueError):
            lisible = False
        if not lisible:
            problemes.append(
                f"chapitre {identifiant} : date d'ouverture illisible {ouverture!r}, "
                "attendu AAAA-MM-JJ"
            )
    return problemes


def verifier_tables(notions: dict[str, dict], chapitres: dict[str, dict]) -> list[str]:
    """Deux regles que quatorze notions ont tenues a la main.

    La couleur oriente dans le menu : deux notions de la meme famille dans un
    chapitre le rendent illisible. Il n'existe que cinq familles, ce qui borne
    un chapitre a cinq notions — et c'est voulu.
    """
    problemes: list[str] = []
    vues: dict[tuple[str, str], str] = {}

    for identifiant, details in sorted(notions.items()):
        chapitre = details["chapitre"]
        if chapitre not in chapitres:
            problemes.append(f"la notion {identifiant!r} pointe un chapitre inconnu {chapitre!r}")
            continue
        cle = (chapitre, details["famille"])
        if cle in vues:
            problemes.append(
                f"les notions {vues[cle]!r} et {identifiant!r} partagent la famille "
                f"{details['famille']!r} dans le chapitre {chapitre!r}"
            )
        else:
            vues[cle] = identifiant

    return problemes


def verifier_racine(racine: Path) -> tuple[list[Exercice], list[Lecon], list[str]]:
    """Charge tout le contenu d'une racine et rend les problemes trouves.

    Separee de principal() pour etre testable : c'est cette fonction qui decide
    si la construction passe, et une regression ici publierait du contenu casse.
    """
    # Avant tout chargement : les modeles valident contre ces registres, et un
    # registre vide refuserait toutes les lecons. La racine est `contenu/`,
    # qui contient les dossiers `chapitre-*`, chacun avec ses deux tables.
    charger_tables(racine)

    exercices = charger_tous(racine)
    identifiants = {ex.id for ex in exercices}
    problemes: list[str] = verifier_chapitres(CHAPITRES) + verifier_tables(NOTIONS, CHAPITRES)

    # Les identifiants d'exercice sont uniques a travers TOUS les chapitres.
    # `identifiants` est un ensemble : deux `s1-01` dans deux chapitres s'y
    # fondaient en un seul, et le second ecrasait le premier a l'affichage
    # sans que rien ne le signale.
    vus: set[str] = set()
    for ex in exercices:
        if ex.id in vus:
            problemes.append(f"l'identifiant {ex.id} apparait deux fois dans le contenu")
        vus.add(ex.id)

    for ex in exercices:
        problemes += verifier_coherence(ex)
        if ex.expert and ex.expert not in identifiants:
            problemes.append(f"{ex.id} : renvoie vers un expert inexistant {ex.expert!r}")

    lecons: list[Lecon] = []
    for dossier in sorted(racine.glob("chapitre-*/seance-*/lecons")):
        lecons += charger_lecons(dossier)
    for lecon in lecons:
        problemes += verifier_lecon(lecon)

    return exercices, lecons, problemes


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Valide tout le contenu du dojo.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../contenu"))
    arguments = parseur.parse_args()

    exercices, lecons, problemes = verifier_racine(arguments.racine)

    print(f"{len(exercices)} exercices charges.")
    print(f"{len(lecons)} lecons chargees.")
    for p in problemes:
        print(f"  PROBLEME  {p}")
    print("Contenu valide." if not problemes else f"{len(problemes)} probleme(s).")
    return 1 if problemes else 0


if __name__ == "__main__":
    sys.exit(principal())
