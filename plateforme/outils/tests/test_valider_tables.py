"""Trois regles tenues a la main sur quatorze notions, et desormais verifiees."""

from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

import schema
from conftest import CONTENU
from valider_contenu import verifier_racine, verifier_tables

CHAPITRES = {"bases": {"ordre": 1, "titre": "Bases", "seance": 1}}


def _notion(chapitre="bases", famille="variables", ordre=1):
    return {"ordre": ordre, "titre": "T", "famille": famille, "chapitre": chapitre}


def test_deux_notions_de_meme_famille_dans_un_chapitre_echouent():
    notions = {"a": _notion(famille="types"), "b": _notion(famille="types", ordre=2)}
    (probleme,) = verifier_tables(notions, CHAPITRES)
    assert "types" in probleme and "bases" in probleme


def test_deux_familles_differentes_passent():
    notions = {"a": _notion(famille="types"), "b": _notion(famille="conditions", ordre=2)}
    assert verifier_tables(notions, CHAPITRES) == []


def test_la_meme_famille_dans_deux_chapitres_differents_passe():
    chapitres = {**CHAPITRES, "suite": {"ordre": 2, "titre": "S", "seance": 2}}
    notions = {"a": _notion(famille="types"), "b": _notion("suite", "types", 2)}
    assert verifier_tables(notions, chapitres) == []


def test_une_notion_qui_pointe_un_chapitre_inconnu_echoue():
    (probleme,) = verifier_tables({"a": _notion(chapitre="fantome")}, CHAPITRES)
    assert "fantome" in probleme


def test_les_tables_du_depot_passent():
    assert verifier_tables(schema.NOTIONS, schema.CHAPITRES) == []


def test_un_exercice_sur_une_notion_inconnue_est_refuse():
    with pytest.raises(ValidationError, match="notion inconnue"):
        schema.Exercice(
            id="s1-01",
            concept="print",
            notion="fantome",
            seance=1,
            niveau="normal",
            type="ecrire",
            titre="T",
            obligatoire=True,
            enonce="Affiche Camille.",
            tests=[{"type": "interdit", "motif": "xyzzy"}],
            solution='print("Camille")\n',
        )


def test_deux_exercices_de_meme_identifiant_dans_deux_chapitres_echouent(tmp_path):
    """Rien ne les distinguerait : le second ecrasait le premier a l'affichage."""
    exercice = dict(
        id="s1-01",
        concept="print",
        seance=1,
        niveau="normal",
        type="ecrire",
        titre="T",
        obligatoire=True,
        enonce="Affiche Camille.",
        tests=[{"type": "interdit", "motif": "xyzzy"}],
        solution='print("Camille")\n',
    )
    for numero, notion in ((1, "a"), (2, "b")):
        dossier = tmp_path / f"chapitre-{numero}"
        (dossier / "seance-1").mkdir(parents=True)
        (dossier / "notions.yaml").write_text(
            yaml.safe_dump(
                [
                    {
                        "id": notion,
                        "ordre": numero,
                        "titre": "T",
                        "famille": "variables",
                        "chapitre": f"c{numero}",
                    }
                ],
                sort_keys=False,
            ),
            encoding="utf-8",
        )
        (dossier / "chapitres.yaml").write_text(
            yaml.safe_dump(
                [{"id": f"c{numero}", "ordre": numero, "titre": "T", "seance": numero}],
                sort_keys=False,
            ),
            encoding="utf-8",
        )
        (dossier / "seance-1" / "s1-01.yaml").write_text(
            yaml.safe_dump({**exercice, "notion": notion}, allow_unicode=True), encoding="utf-8"
        )

    _, _, problemes = verifier_racine(tmp_path)
    assert any("s1-01" in p and "deux fois" in p for p in problemes)


def test_le_contenu_du_depot_ne_remonte_aucun_probleme():
    _, _, problemes = verifier_racine(Path(CONTENU))
    assert problemes == []


def test_un_renvoi_vers_un_expert_inexistant_est_signale(tmp_path):
    """Le bouton « Mode expert » menerait a une page vide."""
    exercice = dict(
        id="s1-01",
        concept="print",
        notion="afficher",
        seance=1,
        niveau="normal",
        type="ecrire",
        titre="T",
        obligatoire=True,
        enonce="Affiche Camille.",
        tests=[{"type": "interdit", "motif": "xyzzy"}],
        solution='print("Camille")\n',
        expert="s1-99-expert",
    )
    from conftest import chapitre_temporaire

    seance = chapitre_temporaire(tmp_path) / "seance-1"
    seance.mkdir(parents=True, exist_ok=True)
    (seance / "s1-01.yaml").write_text(
        yaml.safe_dump(exercice, allow_unicode=True), encoding="utf-8"
    )

    _, _, problemes = verifier_racine(tmp_path)
    assert any("expert inexistant" in p for p in problemes)
