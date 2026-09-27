"""Les tables de contenu, lues depuis le YAML.

Voir Specification atelier de contenu, section 4.2.
"""

from datetime import date
from pathlib import Path

import pytest

from schema import charger_table, charger_tous

CHAPITRE_1 = Path(__file__).parent.parent.parent / "contenu" / "chapitre-1"

# Les trois epreuves de fidelite — « le YAML dit la meme chose que la table
# Python » — sont tombees avec les tables Python qu'elles comparaient. Ce
# qu'elles protegeaient l'est desormais par test_contenu_publie.py, qui compare
# la sortie reelle a une reference figee avant le deplacement.


def test_une_date_d_ouverture_reste_une_chaine():
    """YAML transforme une date nue en objet date, et verifier_chapitres attend
    une chaine. Sans guillemets, le controle de format ne verrait jamais rien."""
    ouverture = charger_table(CHAPITRE_1 / "chapitres.yaml")["decisions"]["ouverture"]
    assert isinstance(ouverture, str)
    assert not isinstance(ouverture, date)


def test_l_identifiant_sort_des_details(tmp_path):
    fichier = tmp_path / "t.yaml"
    fichier.write_text("- id: alpha\n  ordre: 1\n", encoding="utf-8")
    assert charger_table(fichier) == {"alpha": {"ordre": 1}}


def test_un_identifiant_en_double_est_refuse(tmp_path):
    fichier = tmp_path / "t.yaml"
    fichier.write_text("- id: alpha\n  ordre: 1\n- id: alpha\n  ordre: 2\n", encoding="utf-8")
    with pytest.raises(ValueError, match="alpha"):
        charger_table(fichier)


def test_les_tables_ne_sont_pas_chargees_comme_des_exercices():
    """`charger_tous` fait un rglob sur *.yaml : sans exclusion, il essaierait
    de lire notions.yaml comme un exercice et echouerait sur un fichier sain."""
    assert len(charger_tous(CHAPITRE_1)) == 112


def test_charger_tables_remplit_les_deux_registres():
    import schema

    schema.charger_tables(CHAPITRE_1.parent)
    assert len(schema.NOTIONS) == 14
    assert set(schema.CHAPITRES) == {"bases", "decisions", "boucles"}


def test_charger_tables_remplace_au_lieu_d_accumuler():
    """Deux appels de suite donnent le meme etat : les tests en dependent."""
    import schema

    schema.charger_tables(CHAPITRE_1.parent)
    schema.charger_tables(CHAPITRE_1.parent)
    assert len(schema.NOTIONS) == 14


def test_une_notion_declaree_dans_deux_chapitres_est_refusee(tmp_path):
    import schema

    for numero in (1, 2):
        dossier = tmp_path / f"chapitre-{numero}"
        dossier.mkdir()
        (dossier / "notions.yaml").write_text(
            "- id: variables\n  ordre: 1\n  titre: T\n  famille: variables\n  chapitre: c\n",
            encoding="utf-8",
        )
    with pytest.raises(ValueError, match="deja declare"):
        schema.charger_tables(tmp_path)


def test_une_lecon_sur_une_notion_inconnue_est_refusee():
    from pydantic import ValidationError

    import schema

    schema.charger_tables(CHAPITRE_1.parent)
    with pytest.raises(ValidationError, match="notion inconnue"):
        schema.Lecon(
            id="c1-fantome",
            notion="fantome",
            ordre=1,
            titre="T",
            duree_min=5,
            blocs=[{"type": "paragraphe", "texte": "Bonjour."}],
        )
