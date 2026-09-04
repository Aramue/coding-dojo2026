import pytest
from pydantic import ValidationError

from schema import NOTIONS, BlocCode, BlocParagraphe, Lecon


def lecon_minimale(**remplacements):
    base = dict(
        id="c1-variables",
        notion="variables",
        ordre=2,
        titre="Les variables",
        duree_min=3,
        blocs=[
            {"type": "paragraphe", "texte": "Une variable est une **boite** nommee."},
            {"type": "code", "legende": "Ranger une valeur", "python": 'nom = "Camille"'},
        ],
    )
    base.update(remplacements)
    return base


def test_lecon_valide_se_charge():
    lecon = Lecon(**lecon_minimale())
    assert lecon.id == "c1-variables"
    assert isinstance(lecon.blocs[0], BlocParagraphe)
    assert isinstance(lecon.blocs[1], BlocCode)
    assert lecon.blocs[1].executable is False


def test_notion_inconnue_rejetee():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(notion="algebre"))


def test_identifiant_mal_forme_rejete():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(id="lecon 1"))


def test_liste_de_blocs_vide_rejetee():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[]))


def test_bloc_vide_rejete():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[{"type": "paragraphe", "texte": "   "}]))


def test_bloc_attention_vide_rejete():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[{"type": "attention", "texte": " \n "}]))


def test_bloc_de_code_vide_rejete():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[{"type": "code", "legende": "x", "python": "   "}]))


def test_bloc_de_type_inconnu_rejete():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[{"type": "video", "url": "..."}]))


def test_emoji_rejete_dans_un_paragraphe():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[{"type": "paragraphe", "texte": "Bravo ✅"}]))


def test_emoji_rejete_dans_un_bloc_attention():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[{"type": "attention", "texte": "Attention ⚠"}]))


def test_emoji_rejete_dans_un_bloc_de_code():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(blocs=[{"type": "code", "legende": "x", "python": "# ✅"}]))


def test_getpass_rejete_dans_un_bloc_de_code():
    with pytest.raises(ValidationError):
        Lecon(
            **lecon_minimale(
                blocs=[{"type": "code", "legende": "x", "python": "import getpass"}]
            )
        )


def test_bloc_attention_se_charge():
    lecon = Lecon(**lecon_minimale(blocs=[{"type": "attention", "texte": "Le signe = range."}]))
    assert lecon.blocs[0].type == "attention"


def test_bloc_de_code_executable():
    lecon = Lecon(
        **lecon_minimale(
            blocs=[{"type": "code", "legende": "x", "python": "print(1)", "executable": True}]
        )
    )
    assert lecon.blocs[0].executable is True


def test_ordre_hors_bornes_rejete():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(ordre=0))


def test_duree_hors_bornes_rejetee():
    with pytest.raises(ValidationError):
        Lecon(**lecon_minimale(duree_min=99))


def test_les_quatre_notions_de_la_seance_1_sont_declarees():
    """La table NOTIONS est l'unique source : le front la lit dans le JSON publie."""
    assert list(NOTIONS) == ["afficher", "variables", "types", "saisie"]
    assert [details["ordre"] for details in NOTIONS.values()] == [1, 2, 3, 4]
    # Chaque notion porte une couleur distincte, sinon le menu est monotone.
    assert len({details["famille"] for details in NOTIONS.values()}) == 4


def test_chaque_notion_est_acceptee_comme_valeur():
    for notion in NOTIONS:
        assert Lecon(**lecon_minimale(id=f"c1-{notion}", notion=notion)).notion == notion


def _ecrire(dossier, donnees):
    import yaml

    dossier.mkdir(parents=True, exist_ok=True)
    chemin = dossier / f"{donnees['id']}.yaml"
    chemin.write_text(yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8")
    return chemin


def test_charger_lecon_lit_un_fichier(tmp_path):
    from schema import charger_lecon

    chemin = _ecrire(tmp_path, lecon_minimale())
    assert charger_lecon(chemin).titre == "Les variables"


def test_charger_lecons_trie_par_ordre_et_pas_par_nom_de_fichier(tmp_path):
    """L'ordre d'enseignement est declare, pas devine du nom du fichier."""
    from schema import charger_lecons

    _ecrire(tmp_path, lecon_minimale(id="c1-afficher", notion="afficher", ordre=1))
    _ecrire(tmp_path, lecon_minimale(id="c1-saisie", notion="saisie", ordre=4))
    _ecrire(tmp_path, lecon_minimale(id="c1-types", notion="types", ordre=3))

    assert [l.id for l in charger_lecons(tmp_path)] == ["c1-afficher", "c1-types", "c1-saisie"]


def test_charger_lecons_sur_un_dossier_vide(tmp_path):
    from schema import charger_lecons

    assert charger_lecons(tmp_path) == []


def test_charger_tous_ignore_le_dossier_des_lecons(tmp_path):
    """Une lecon n'est pas un exercice : la charger comme tel casserait la validation."""
    import yaml

    from schema import charger_tous

    seance = tmp_path / "seance-1"
    (seance / "lecons").mkdir(parents=True)
    (seance / "s1-01.yaml").write_text(
        yaml.safe_dump(
            {
                "id": "s1-01",
                "concept": "print",
                "notion": "afficher",
                "seance": 1,
                "niveau": "normal",
                "type": "predire",
                "titre": "Lire",
                "obligatoire": True,
                "enonce": "Lis.",
                "depart": 'print("Bonjour")',
                "indices": [],
                "tests": [{"type": "qcm", "options": ["a", "b"], "bonne_reponse": 0}],
                "solution": 'print("Bonjour")',
            },
            allow_unicode=True,
        ),
        encoding="utf-8",
    )
    _ecrire(seance / "lecons", lecon_minimale())

    assert [ex.id for ex in charger_tous(tmp_path)] == ["s1-01"]
