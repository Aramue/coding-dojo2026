from schema import Lecon
from valider_contenu import verifier_lecon


def lecon(blocs, **remplacements):
    base = dict(
        id="c1-variables",
        notion="variables",
        ordre=2,
        titre="Les variables",
        duree_min=3,
        blocs=blocs,
    )
    base.update(remplacements)
    return Lecon(**base)


def test_lecon_dont_les_exemples_tournent_ne_remonte_rien():
    assert (
        verifier_lecon(
            lecon([{"type": "code", "legende": "x", "python": 'nom = "Camille"\nprint(nom)'}])
        )
        == []
    )


def test_exemple_qui_plante_est_signale():
    problemes = verifier_lecon(
        lecon([{"type": "code", "legende": "x", "python": "print(inexistant)"}])
    )
    assert len(problemes) == 1
    assert "c1-variables" in problemes[0]
    assert "NameError" in problemes[0]


def test_chaque_bloc_fautif_est_signale_separement():
    problemes = verifier_lecon(
        lecon(
            [
                {"type": "code", "legende": "a", "python": "print(pasla)"},
                {"type": "paragraphe", "texte": "Texte."},
                {"type": "code", "legende": "b", "python": "1/0"},
            ]
        )
    )
    assert len(problemes) == 2
    assert "'a'" in problemes[0]
    assert "'b'" in problemes[1]


def test_les_blocs_non_code_sont_ignores():
    assert (
        verifier_lecon(
            lecon(
                [
                    {"type": "paragraphe", "texte": "Une variable est une boite."},
                    {"type": "attention", "texte": "Le signe = range une valeur."},
                ]
            )
        )
        == []
    )


def test_un_exemple_qui_attend_une_saisie_est_signale():
    """Une lecon n'a pas d'entrees simulees : input() y est toujours une erreur."""
    problemes = verifier_lecon(
        lecon([{"type": "code", "legende": "x", "python": 'nom = input("Nom : ")'}], notion="saisie", ordre=4, id="c1-saisie")
    )
    assert len(problemes) == 1
    assert "EOFError" in problemes[0]


def test_une_lecon_ne_peut_pas_utiliser_une_notion_enseignee_apres_elle():
    """La lecon 1 parle d'affichage : elle n'a pas encore droit aux variables."""
    problemes = verifier_lecon(
        lecon(
            [{"type": "code", "legende": "x", "python": 'nom = "Camille"\nprint(nom)'}],
            id="c1-afficher",
            notion="afficher",
            ordre=1,
        )
    )
    assert len(problemes) == 1
    assert "variables" in problemes[0]


def test_une_lecon_peut_utiliser_une_notion_deja_enseignee():
    assert (
        verifier_lecon(
            lecon([{"type": "code", "legende": "x", "python": 'nom = "Camille"\nprint(nom)'}])
        )
        == []
    )


def test_la_conversion_est_signalee_avant_la_lecon_qui_l_enseigne():
    problemes = verifier_lecon(
        lecon(
            [{"type": "code", "legende": "x", "python": 'print(str(3))'}],
            id="c1-afficher",
            notion="afficher",
            ordre=1,
        )
    )
    assert len(problemes) == 1
    assert "types" in problemes[0]


def test_le_f_string_est_signale_avant_la_lecon_qui_l_enseigne():
    problemes = verifier_lecon(
        lecon(
            [{"type": "code", "legende": "x", "python": 'print(f"trois")'}],
            id="c1-afficher",
            notion="afficher",
            ordre=1,
        )
    )
    assert len(problemes) == 1
    assert "types" in problemes[0]


def test_une_comparaison_n_est_pas_prise_pour_une_affectation():
    """`==` n'est pas `=` : le motif ne doit pas se declencher dessus."""
    assert (
        verifier_lecon(
            lecon(
                [{"type": "code", "legende": "x", "python": "print(1 == 1)"}],
                id="c1-afficher",
                notion="afficher",
                ordre=1,
            )
        )
        == []
    )


def _ecrire_lecon(dossier, donnees):
    import yaml

    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / f"{donnees['id']}.yaml").write_text(
        yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8"
    )


EXERCICE = dict(
    id="s1-01",
    concept="print",
    notion="afficher",
    seance=1,
    niveau="normal",
    type="predire",
    titre="Lire un programme",
    obligatoire=True,
    enonce="Lis ce programme.",
    depart='print("Bonjour")',
    indices=[],
    tests=[{"type": "qcm", "options": ["Bonjour", "autre"], "bonne_reponse": 0}],
    solution='print("Bonjour")',
)


def test_verifier_racine_charge_exercices_et_lecons(tmp_path):
    import yaml

    from valider_contenu import verifier_racine

    seance = tmp_path / "seance-1"
    seance.mkdir(parents=True)
    (seance / "s1-01.yaml").write_text(yaml.safe_dump(EXERCICE, allow_unicode=True), encoding="utf-8")
    _ecrire_lecon(
        seance / "lecons",
        {
            "id": "c1-afficher",
            "notion": "afficher",
            "ordre": 1,
            "titre": "Afficher un message",
            "duree_min": 3,
            "blocs": [{"type": "code", "legende": "x", "python": 'print("Bonjour")'}],
        },
    )

    exercices, lecons, problemes = verifier_racine(tmp_path)
    assert len(exercices) == 1
    assert len(lecons) == 1
    assert problemes == []


def test_verifier_racine_remonte_le_probleme_d_une_lecon(tmp_path):
    import yaml

    from valider_contenu import verifier_racine

    seance = tmp_path / "seance-1"
    seance.mkdir(parents=True)
    (seance / "s1-01.yaml").write_text(yaml.safe_dump(EXERCICE, allow_unicode=True), encoding="utf-8")
    _ecrire_lecon(
        seance / "lecons",
        {
            "id": "c1-afficher",
            "notion": "afficher",
            "ordre": 1,
            "titre": "Afficher un message",
            "duree_min": 3,
            "blocs": [{"type": "code", "legende": "x", "python": "print(pasla)"}],
        },
    )

    _, _, problemes = verifier_racine(tmp_path)
    assert len(problemes) == 1
    assert "NameError" in problemes[0]


def test_verifier_racine_sans_dossier_de_lecons(tmp_path):
    """Une seance sans lecons reste valide : le dossier est optionnel."""
    import yaml

    from valider_contenu import verifier_racine

    seance = tmp_path / "seance-1"
    seance.mkdir(parents=True)
    (seance / "s1-01.yaml").write_text(yaml.safe_dump(EXERCICE, allow_unicode=True), encoding="utf-8")

    exercices, lecons, problemes = verifier_racine(tmp_path)
    assert len(exercices) == 1
    assert lecons == []
    assert problemes == []
