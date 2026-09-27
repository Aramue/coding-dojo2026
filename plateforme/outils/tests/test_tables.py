"""Les tables de contenu, lues depuis le YAML.

Voir Specification atelier de contenu, section 4.2.
"""

from datetime import date
from pathlib import Path

import pytest

from schema import CHAPITRES, NOTIONS, charger_table, charger_tous

CHAPITRE_1 = Path(__file__).parent.parent.parent / "contenu" / "chapitre-1"


def test_les_notions_yaml_disent_la_meme_chose_que_la_table_python():
    """L'epreuve de fidelite de la recopie. Elle disparait avec la table Python."""
    lues = charger_table(CHAPITRE_1 / "notions.yaml")
    sans_motif = {
        identifiant: {cle: v for cle, v in details.items() if cle != "motif"}
        for identifiant, details in lues.items()
    }
    assert sans_motif == NOTIONS


def test_les_chapitres_yaml_disent_la_meme_chose_que_la_table_python():
    assert charger_table(CHAPITRE_1 / "chapitres.yaml") == CHAPITRES


def test_les_motifs_yaml_disent_la_meme_chose_que_le_dictionnaire_python():
    from valider_contenu import MOTIFS_NOTION

    lues = charger_table(CHAPITRE_1 / "notions.yaml")
    motifs = {i: d["motif"] for i, d in lues.items() if "motif" in d}
    assert motifs == {i: m.pattern for i, m in MOTIFS_NOTION.items()}


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
