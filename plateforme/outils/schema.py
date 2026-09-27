"""Modele d'un exercice. Toute violation ici fait echouer la construction."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated, Literal, Union

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator

# Une a 99 seances. La borne ne commande plus le calendrier : elle n'est la que
# pour attraper une faute de frappe. Pas de zero en tete, sinon `s01-01` et
# `s1-01` designeraient le meme exercice sous deux noms.
# Miroir dans api/app/routes_eleve.py::MOTIF_EXERCICE.
MOTIF_ID = re.compile(r"^s([1-9][0-9]?)-[0-9]{2}(-expert)?$")

# Construit a partir de points de code explicites plutot que recopie depuis des
# emoji litteraux : un selecteur de variation invisible (U+FE0F) s'etait glisse
# dans la forme "☀-➿️⬀-⯿" et cassait la borne superieure de la plage ☀-➿.
MOTIF_EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0000FE0F\U00002B00-\U00002BFF]"
)


class TestSortie(BaseModel):
    type: Literal["sortie"]
    entrees: list[str] = Field(default_factory=list)
    attendu: str
    exige_exact: bool = False

    @field_validator("attendu")
    @classmethod
    def sans_emoji(cls, v: str) -> str:
        if MOTIF_EMOJI.search(v):
            raise ValueError("aucun emoji dans une sortie comparee")
        return v


class TestVariable(BaseModel):
    type: Literal["variable"]
    nom: str
    valeur_attendue: str | None = None
    type_attendu: Literal["int", "float", "str", "bool"] | None = None


class TestQcm(BaseModel):
    type: Literal["qcm"]
    options: list[str] = Field(min_length=2)
    bonne_reponse: int

    @model_validator(mode="after")
    def indice_dans_les_bornes(self) -> "TestQcm":
        if not 0 <= self.bonne_reponse < len(self.options):
            raise ValueError("bonne_reponse hors des options")
        return self


class TestMotif(BaseModel):
    type: Literal["interdit", "contient"]
    motif: str
    # Ce que l'eleve lit quand le motif se declenche. Le message par defaut
    # parle de reponse ecrite en dur — vrai pour la plupart des interdits, faux
    # quand le motif interdit une TECHNIQUE (s1-18 : l'echange en une ligne).
    # Un message trompeur envoie l'eleve chercher un probleme qu'il n'a pas.
    message: str | None = None
    # Un `contient` marque `maitrise` n'est PAS exige pour valider : il donne
    # la seconde coche. L'exercice reste reussi sans lui — c'est la difference
    # entre « ca marche » et « ca marche de la bonne facon ».
    maitrise: bool = False

    @model_validator(mode="after")
    def maitrise_reservee_au_contient(self) -> "TestMotif":
        if self.maitrise and self.type != "contient":
            raise ValueError("seul un test 'contient' peut porter maitrise")
        return self


TestExercice = Annotated[
    Union[TestSortie, TestVariable, TestQcm, TestMotif], Field(discriminator="type")
]


class Exercice(BaseModel):
    id: str
    concept: str
    # La notion est l'unite de navigation : elle porte une lecon, un groupe
    # d'exercices et une couleur. Le concept, lui, reste libre et sert au
    # regroupement pedagogique fin. Voir NOTIONS plus bas.
    notion: str
    seance: int = Field(ge=1, le=99)
    niveau: Literal["normal", "expert"]
    type: Literal["predire", "debug", "completer", "ecrire"]
    titre: str
    obligatoire: bool
    enonce: str
    depart: str = ""
    indices: list[str] = Field(default_factory=list)
    tests: list[TestExercice] = Field(min_length=1)
    solution: str
    expert: str | None = None

    @field_validator("id")
    @classmethod
    def identifiant_bien_forme(cls, v: str) -> str:
        if not MOTIF_ID.match(v):
            raise ValueError(f"identifiant invalide : {v!r} (attendu s1-01 ou s1-01-expert)")
        return v

    @field_validator("notion")
    @classmethod
    def notion_connue(cls, v: str) -> str:
        # construire_contenu lit NOTIONS[ex.notion]["famille"] : une notion
        # inconnue y levait une KeyError nue, au milieu d'une comprehension,
        # sans dire quel exercice la portait.
        if v not in NOTIONS:
            raise ValueError(f"notion inconnue : {v!r}")
        return v

    @model_validator(mode="after")
    def seance_accordee_a_l_identifiant(self) -> "Exercice":
        # `s2-14` avec `seance: 3` ne fait echouer personne : l'exercice
        # apparait simplement le mauvais jour, et c'est invisible jusqu'au
        # cours. Les deux se sont suivis a la main sur 112 fichiers.
        annoncee = int(self.id.split("-")[0][1:])
        if annoncee != self.seance:
            raise ValueError(f"{self.id} annonce la seance {self.seance}, pas {annoncee}")
        return self

    @model_validator(mode="after")
    def sans_getpass(self) -> "Exercice":
        # getpass est impossible sous Pyodide et a coute deux rendus en 2025.
        for champ in (self.enonce, self.depart, self.solution):
            if "getpass" in champ:
                raise ValueError("getpass est impossible sous Pyodide, il est banni")
        return self

    @model_validator(mode="after")
    def tests_coherents_avec_le_type(self) -> "Exercice":
        types = {t.type for t in self.tests}
        if self.type == "predire" and "qcm" not in types:
            raise ValueError("un exercice 'predire' exige un test 'qcm'")
        if self.type == "ecrire" and "interdit" not in types:
            raise ValueError(
                "un exercice 'ecrire' exige un motif 'interdit', sinon la reponse peut etre ecrite en dur"
            )
        return self


def charger_exercice(chemin: Path) -> Exercice:
    donnees = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    return Exercice(**donnees)


# Les tables de contenu vivent a la racine d'un chapitre et ne sont pas des
# exercices non plus. Meme raison que pour les lecons.
TABLES = {"notions.yaml", "chapitres.yaml"}


def charger_tous(racine: Path) -> list[Exercice]:
    # Les lecons vivent dans `seance-N/lecons/` et ne sont PAS des exercices :
    # les charger ici ferait echouer la validation sur un fichier parfaitement
    # valide, avec un message parlant de champs d'exercice manquants.
    return [
        charger_exercice(p)
        for p in sorted(racine.rglob("*.yaml"))
        if "lecons" not in p.parts and p.name not in TABLES
    ]


def charger_table(chemin: Path) -> dict[str, dict]:
    """Lit une table de contenu : une liste d'entrees portant chacune un `id`.

    Rend un dictionnaire indexe par cet identifiant, l'identifiant retire des
    details — exactement la forme qu'avaient NOTIONS et CHAPITRES quand elles
    vivaient ici en dur.
    """
    table: dict[str, dict] = {}
    for entree in yaml.safe_load(chemin.read_text(encoding="utf-8")):
        details = dict(entree)
        identifiant = details.pop("id")
        if identifiant in table:
            raise ValueError(f"{chemin.name} : l'identifiant {identifiant!r} apparait deux fois")
        table[identifiant] = details
    return table


MOTIF_LECON = re.compile(r"^c([1-9][0-9]?)-[a-z]+$")

# Les tables de contenu, remplies par `charger_tables`. Vides au chargement du
# module : elles vivent desormais dans contenu/chapitre-*/notions.yaml et
# chapitres.yaml, et c'est la leur SEULE source.
#
# Rien ne doit donc les lire au moment de DEFINIR une classe — seulement au
# moment de valider une instance. `Lecon.notion` etait un
# `Literal[tuple(NOTIONS)]`, evalue a la definition : sur une table vide, il
# refusait toutes les lecons.
NOTIONS: dict[str, dict] = {}
CHAPITRES: dict[str, dict] = {}


def charger_tables(racine: Path) -> None:
    """Remplit les registres depuis tous les chapitres sous `racine`.

    Remplace le contenu au lieu de l'accumuler : deux appels de suite donnent
    le meme etat, ce dont les tests dependent.
    """
    NOTIONS.clear()
    CHAPITRES.clear()
    for dossier in sorted(racine.glob("chapitre-*")):
        for nom, registre in (("notions.yaml", NOTIONS), ("chapitres.yaml", CHAPITRES)):
            chemin = dossier / nom
            if not chemin.exists():
                continue
            for identifiant, details in charger_table(chemin).items():
                if identifiant in registre:
                    raise ValueError(
                        f"{chemin} : {identifiant!r} est deja declare dans un autre chapitre"
                    )
                registre[identifiant] = details


def _texte_utilisable(valeur: str, quoi: str) -> str:
    if not valeur.strip():
        raise ValueError(f"{quoi} vide")
    if MOTIF_EMOJI.search(valeur):
        raise ValueError(f"aucun emoji dans {quoi}")
    return valeur


class BlocParagraphe(BaseModel):
    type: Literal["paragraphe"]
    texte: str = Field(min_length=1)

    @field_validator("texte")
    @classmethod
    def utilisable(cls, v: str) -> str:
        return _texte_utilisable(v, "un paragraphe")


class BlocAttention(BaseModel):
    type: Literal["attention"]
    texte: str = Field(min_length=1)

    @field_validator("texte")
    @classmethod
    def utilisable(cls, v: str) -> str:
        return _texte_utilisable(v, "un bloc attention")


class BlocCode(BaseModel):
    type: Literal["code"]
    legende: str = Field(min_length=1)
    python: str = Field(min_length=1)
    # Un bloc executable porte un bouton « Essayer » : l'eleve modifie l'exemple
    # et l'execute, sans verdict ni progression enregistree.
    executable: bool = False
    # Entrees simulees, pour un exemple qui appelle input(). Sans elles, la
    # validation le refuse — un exemple de lecon doit tourner. Un bloc qui en
    # declare ne peut PAS etre executable : le bac a sable du navigateur n'a
    # aucun moyen de les fournir, et l'eleve tomberait sur une EOFError.
    entrees: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def entrees_incompatibles_avec_le_bac_a_sable(self) -> "BlocCode":
        if self.entrees and self.executable:
            raise ValueError(
                "un bloc avec des entrees simulees ne peut pas etre executable : "
                "le bac a sable ne sait pas les fournir"
            )
        return self

    @field_validator("python")
    @classmethod
    def utilisable(cls, v: str) -> str:
        _texte_utilisable(v, "un bloc de code")
        if "getpass" in v:
            raise ValueError("getpass est impossible sous Pyodide, il est banni")
        return v


BlocLecon = Annotated[
    Union[BlocParagraphe, BlocAttention, BlocCode], Field(discriminator="type")
]


class Lecon(BaseModel):
    """Une lecon : ce que l'eleve lit avant d'attaquer les exercices d'une notion."""

    id: str
    notion: str
    ordre: int
    titre: str = Field(min_length=1)
    duree_min: int = Field(ge=1, le=30)
    blocs: list[BlocLecon] = Field(min_length=1)

    @field_validator("notion")
    @classmethod
    def notion_connue(cls, v: str) -> str:
        # Etait un Literal[tuple(NOTIONS)], evalue a la definition de la
        # classe. Les notions se chargent maintenant a l'execution : un
        # Literal serait fige sur une table vide, et refuserait tout.
        if v not in NOTIONS:
            raise ValueError(f"notion inconnue : {v!r}")
        return v

    @field_validator("id")
    @classmethod
    def identifiant_bien_forme(cls, v: str) -> str:
        if not MOTIF_LECON.match(v):
            raise ValueError(f"identifiant de lecon invalide : {v!r} (attendu c1-variables)")
        return v

    @model_validator(mode="after")
    def ordre_de_sa_notion(self) -> "Lecon":
        # L'ordre d'une lecon est celui de sa notion : c'est lui qui decide quelles
        # notions ses exemples ont le droit d'employer. Une borne fixe a 9 ne
        # garantissait rien de tel, et fermait la porte a la seance 3.
        attendu = NOTIONS[self.notion]["ordre"]
        if self.ordre != attendu:
            raise ValueError(
                f"la lecon de la notion {self.notion!r} a l'ordre {attendu}, pas {self.ordre}"
            )
        return self


def charger_lecon(chemin: Path) -> Lecon:
    return Lecon(**yaml.safe_load(chemin.read_text(encoding="utf-8")))


def charger_lecons(racine: Path) -> list[Lecon]:
    lecons = [charger_lecon(p) for p in sorted(racine.rglob("*.yaml"))]
    return sorted(lecons, key=lambda l: l.ordre)
