"""Les tables de contenu sont chargees avant chaque test.

Depuis le 27 septembre 2026, NOTIONS et CHAPITRES ne vivent plus en dur dans
schema.py : elles se chargent depuis contenu/chapitre-*/notions.yaml et
chapitres.yaml. Un modele valide contre des registres vides refuse toutes les
lecons, et la moitie de la suite construit des Lecon a la main.

Avant CHAQUE test, et non une fois pour toutes : plusieurs tests appellent
`charger_tables` sur un dossier temporaire pour eprouver le chargeur lui-meme,
et laisseraient le registre dans un etat qui ferait echouer le suivant.
"""

from pathlib import Path

import pytest

from schema import charger_tables

CONTENU = Path(__file__).parent.parent.parent / "contenu"


@pytest.fixture(autouse=True)
def tables_chargees():
    charger_tables(CONTENU)


def chapitre_temporaire(racine: Path, nom: str = "chapitre-1") -> Path:
    """Fabrique un dossier de chapitre sous `racine`, avec les vraies tables.

    La racine de construction est desormais `contenu/`, qui contient des
    `chapitre-*`. Un test qui ecrit ses exercices directement sous la racine
    ne publierait plus rien, et sans tables aucune notion ne serait connue.

    Les tables sont copiees telles quelles depuis le depot : ces tests
    eprouvent la PUBLICATION, pas le contenu des tables.
    """
    source = CONTENU / "chapitre-1"
    dossier = racine / nom
    dossier.mkdir(parents=True, exist_ok=True)
    for fichier in ("notions.yaml", "chapitres.yaml"):
        (dossier / fichier).write_text(
            (source / fichier).read_text(encoding="utf-8"), encoding="utf-8"
        )
    return dossier
