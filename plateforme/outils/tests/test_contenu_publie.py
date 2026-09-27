"""Le filet du palier 1 : deplacer les tables ne change pas ce qui est publie.

Les quatre fichiers de `reference/` ont ete produits par le code du
27 septembre 2026, avant que NOTIONS et CHAPITRES ne quittent schema.py. Si
l'un d'eux bouge, le deplacement a change autre chose que l'adresse des
tables — et c'est la reference qui a raison, jamais le nouveau resultat.

`schema.json`, ajoute plus tard dans le meme palier, n'est volontairement pas
dans le lot : il n'existait pas au moment du gel.
"""

from pathlib import Path

from construire_contenu import construire

REFERENCE = Path(__file__).parent / "reference"
CONTENU = Path(__file__).parent.parent.parent / "contenu"
PUBLIES = ("chapitres.json", "notions.json", "exercices.json", "lecons.json")


def test_les_quatre_fichiers_publies_ne_bougent_pas(tmp_path):
    construire(CONTENU, tmp_path)
    for nom in PUBLIES:
        attendu = (REFERENCE / nom).read_text(encoding="utf-8")
        obtenu = (tmp_path / nom).read_text(encoding="utf-8")
        assert obtenu == attendu, f"{nom} a change"
