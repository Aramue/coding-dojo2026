import json

import pytest
import yaml
from pydantic import ValidationError

from construire_contenu import construire
from schema import Tp, charger_tous, charger_tps

TP = dict(
    id="stegano",
    chapitre="stegano",
    titre="Le message cache dans l'image",
    duree_min=90,
    introduction=[{"type": "paragraphe", "texte": "Une image cache un message."}],
    materiel=["image_with_message.png"],
    etapes=[
        {
            "titre": "Ouvrir l'image",
            "objectif": "Obtenir la matrice des pixels.",
            "blocs": [
                {"type": "code", "legende": "Charger", "python": "print(1)"},
                {"type": "indice", "texte": "Regarde la slide 5."},
                {"type": "verifier", "texte": "Tu vois trois valeurs."},
            ],
        }
    ],
)


def _ecrire_tp(racine, donnees=TP):
    (racine / "tp").mkdir(parents=True, exist_ok=True)
    (racine / "tp" / f"{donnees['id']}.yaml").write_text(
        yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8"
    )


def test_un_tp_complet_se_charge():
    tp = Tp(**TP)
    assert [b.type for b in tp.etapes[0].blocs] == ["code", "indice", "verifier"]


@pytest.mark.parametrize(
    "champ,valeur",
    [
        ("id", "tp-Stegano"),
        ("chapitre", "inconnu"),
        ("etapes", []),
        ("introduction", []),
        ("duree_min", 5),
    ],
)
def test_un_tp_mal_forme_est_refuse(champ, valeur):
    with pytest.raises(ValidationError):
        Tp(**{**TP, champ: valeur})


@pytest.mark.parametrize("sorte", ["indice", "verifier"])
def test_un_bloc_de_tp_vide_ou_avec_emoji_est_refuse(sorte):
    for texte in ["   ", "Bravo \U0001F389"]:
        etape = {**TP["etapes"][0], "blocs": [{"type": sorte, "texte": texte}]}
        with pytest.raises(ValidationError):
            Tp(**{**TP, "etapes": [etape]})


def test_un_schema_porte_un_nom_connu():
    etape = {**TP["etapes"][0], "blocs": [{"type": "schema", "nom": "binaire", "legende": "173"}]}
    assert Tp(**{**TP, "etapes": [etape]}).etapes[0].blocs[0].nom == "binaire"
    etape["blocs"] = [{"type": "schema", "nom": "inconnu", "legende": "x"}]
    with pytest.raises(ValidationError):
        Tp(**{**TP, "etapes": [etape]})


def test_les_tp_ne_sont_pas_pris_pour_des_exercices(tmp_path):
    _ecrire_tp(tmp_path)
    assert charger_tous(tmp_path) == []
    assert [tp.id for tp in charger_tps(tmp_path)] == ["stegano"]


def test_les_tp_sont_publies_en_camel_case(tmp_path):
    _ecrire_tp(tmp_path)
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)
    (tp,) = json.loads((sortie / "tps.json").read_text(encoding="utf-8"))
    assert tp["dureeMin"] == 90
    assert tp["etapes"][0]["blocs"][1] == {"type": "indice", "texte": "Regarde la slide 5."}


def test_sans_tp_le_fichier_est_publie_vide(tmp_path):
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)
    assert json.loads((sortie / "tps.json").read_text(encoding="utf-8")) == []
