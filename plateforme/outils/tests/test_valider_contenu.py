from pathlib import Path

import yaml

from schema import Exercice
from valider_contenu import verifier_coherence


def ecrire(tmp_path: Path, donnees: dict) -> Exercice:
    chemin = tmp_path / f"{donnees['id']}.yaml"
    chemin.write_text(yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8")
    from schema import charger_exercice

    return charger_exercice(chemin)


BASE = dict(
    id="s1-02",
    concept="print",
    seance=1,
    niveau="normal",
    type="ecrire",
    titre="Ton indicatif",
    obligatoire=True,
    enonce="Affiche Corbeau.",
    depart="",
    indices=[],
    tests=[
        {"type": "sortie", "entrees": [], "attendu": "Corbeau"},
        {"type": "interdit", "motif": "xyzzy"},
    ],
    solution='print("Corbeau")',
)


def test_exercice_correct_ne_remonte_aucun_probleme(tmp_path):
    assert verifier_coherence(ecrire(tmp_path, dict(BASE))) == []


def test_solution_qui_echoue_ses_propres_tests_est_signalee(tmp_path):
    ex = ecrire(tmp_path, dict(BASE, solution='print("Faucon")'))
    problemes = verifier_coherence(ex)
    assert any("solution" in p for p in problemes)


def test_depart_qui_passe_deja_est_signale(tmp_path):
    ex = ecrire(tmp_path, dict(BASE, depart='print("Corbeau")'))
    problemes = verifier_coherence(ex)
    assert any("depart" in p for p in problemes)


def test_solution_violant_son_propre_motif_interdit_est_signalee(tmp_path):
    ex = ecrire(
        tmp_path,
        dict(
            BASE,
            solution='print("Corbeau")',
            tests=[
                {"type": "sortie", "entrees": [], "attendu": "Corbeau"},
                {"type": "interdit", "motif": 'print("Corbeau'},
            ],
        ),
    )
    assert any("interdit" in p for p in verifier_coherence(ex))


def test_motif_interdit_avec_guillemet_est_signale(tmp_path):
    """Un motif ponctue ne bloque que sa ponctuation : l'eleve change de guillemet."""
    ex = ecrire(
        tmp_path,
        dict(
            BASE,
            solution='nom = "Corbeau"\nprint("Agent", nom)',
            tests=[
                {"type": "sortie", "entrees": [], "attendu": "Agent Corbeau"},
                {"type": "interdit", "motif": 'Corbeau")'},
            ],
        ),
    )
    problemes = verifier_coherence(ex)
    assert any("guillemet" in p for p in problemes)


def test_motif_interdit_nu_est_accepte(tmp_path):
    ex = ecrire(
        tmp_path,
        dict(
            BASE,
            solution='nom = "Corbeau"\nprint("Agent", nom)',
            tests=[
                {"type": "sortie", "entrees": [], "attendu": "Agent Corbeau"},
                {"type": "interdit", "motif": "Agent Corbeau"},
            ],
        ),
    )
    assert verifier_coherence(ex) == []
