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
    notion="afficher",
    seance=1,
    niveau="normal",
    type="ecrire",
    titre="Ton indicatif",
    obligatoire=True,
    enonce="Affiche Camille.",
    depart="",
    indices=[],
    tests=[
        {"type": "sortie", "entrees": [], "attendu": "Camille"},
        {"type": "interdit", "motif": "xyzzy"},
    ],
    solution='print("Camille")',
)


def test_exercice_correct_ne_remonte_aucun_probleme(tmp_path):
    assert verifier_coherence(ecrire(tmp_path, dict(BASE))) == []


def test_solution_qui_echoue_ses_propres_tests_est_signalee(tmp_path):
    ex = ecrire(tmp_path, dict(BASE, solution='print("Faucon")'))
    problemes = verifier_coherence(ex)
    assert any("solution" in p for p in problemes)


def test_depart_qui_passe_deja_est_signale(tmp_path):
    ex = ecrire(tmp_path, dict(BASE, depart='print("Camille")'))
    problemes = verifier_coherence(ex)
    assert any("depart" in p for p in problemes)


def test_solution_violant_son_propre_motif_interdit_est_signalee(tmp_path):
    ex = ecrire(
        tmp_path,
        dict(
            BASE,
            solution='print("Camille")',
            tests=[
                {"type": "sortie", "entrees": [], "attendu": "Camille"},
                {"type": "interdit", "motif": 'print("Camille'},
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
            solution='nom = "Camille"\nprint("Bonjour", nom)',
            tests=[
                {"type": "sortie", "entrees": [], "attendu": "Bonjour Camille"},
                {"type": "interdit", "motif": 'Camille")'},
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
            solution='nom = "Camille"\nprint("Bonjour", nom)',
            tests=[
                {"type": "sortie", "entrees": [], "attendu": "Bonjour Camille"},
                {"type": "interdit", "motif": "Bonjour Camille"},
            ],
        ),
    )
    assert verifier_coherence(ex) == []


MAITRISE = dict(
    BASE,
    enonce="Affiche le prenom range dans la variable.",
    depart='prenom = "Camille"',
    tests=[
        {"type": "sortie", "entrees": [], "attendu": "Bonjour Camille"},
        {"type": "interdit", "motif": "Bonjour Camille"},
        {"type": "contient", "motif": "{", "maitrise": True},
    ],
    solution='prenom = "Camille"\nprint(f"Bonjour {prenom}")',
)


def test_solution_qui_emploie_la_methode_recompensee_est_acceptee(tmp_path):
    assert verifier_coherence(ecrire(tmp_path, dict(MAITRISE))) == []


def test_solution_qui_ignore_son_critere_de_maitrise_est_signalee(tmp_path):
    """La solution de reference sert de modele : elle doit montrer la methode."""
    ex = ecrire(
        tmp_path,
        dict(MAITRISE, solution='prenom = "Camille"\nprint("Bonjour " + prenom)'),
    )
    assert any("solution" in p for p in verifier_coherence(ex))


def test_un_depart_deja_valide_est_signale_meme_sans_la_maitrise(tmp_path):
    """Le critere de maitrise ne bloque pas l'eleve : il ne doit pas masquer
    un code de depart qui resout deja l'exercice."""
    ex = ecrire(
        tmp_path,
        dict(MAITRISE, depart='prenom = "Camille"\nprint("Bonjour " + prenom)'),
    )
    assert any("depart" in p for p in verifier_coherence(ex))
